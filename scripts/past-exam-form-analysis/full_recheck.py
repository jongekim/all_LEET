"""Render every original question pair for a recorded visual census.

Images are review material only. This script never chooses a correspondence.
"""
import argparse
import hashlib
import json
import subprocess
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'output/analysis/past-exam-forms'
FOLDER = OUT/'evidence/full-recheck'
POPPLER = Path('/Users/jongeunkim/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/bin/pdftoppm')


def segments(doc):
    direct = OUT/'cache/direct'/(doc+'.json')
    if direct.exists():
        return json.loads(direct.read_text())['questions']
    if '-verbal-' in doc:
        data = json.loads((ROOT/'output/markdown/verbal-odd'/(doc+'.json')).read_text())
        return [q for q in data['segments'] if q['kind']=='question']
    return None


def trim(im):
    mask = im.convert('L').point(lambda p: 255 if p<210 else 0)
    # Remove only an isolated page-number ornament at the far right. It can
    # otherwise add hundreds of pixels of empty margin after the final choice.
    _, rows = mask.getprojection()
    end=next((i for i in range(len(rows)-1,-1,-1) if rows[i]),-1)
    if end>=0:
        start=end
        while start>0 and rows[start-1]:start-=1
        prior=next((i for i in range(start-1,-1,-1) if rows[i]),-1)
        tail=mask.crop((0,start,im.width,end+1)).getbbox()
        if tail and tail[0]>.85*im.width and end-start<120 and start-prior>20:
            im=im.crop((0,0,im.width,start));mask=mask.crop((0,0,im.width,start))
    box = mask.getbbox()
    if box:
        box = (max(0,box[0]-10),max(0,box[1]-10),min(im.width,box[2]+10),min(im.height,box[3]+10))
        return im.crop(box)
    return im


def stitch(images, width=700):
    images = [trim(im) for im in images]
    images = [im.resize((width,round(im.height*width/im.width))) for im in images]
    result = Image.new('RGB',(width,sum(im.height for im in images)),'white')
    y=0
    for im in images:result.paste(im,(0,y));y+=im.height
    return result


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--subject',choices=['verbal','reasoning'])
    parser.add_argument('--year')
    parser.add_argument('--prefix',default='all')
    args=parser.parse_args()
    FOLDER.mkdir(parents=True,exist_ok=True)
    before=FOLDER/'before.json'
    if not before.exists():
        before.write_bytes((OUT/'mapping-candidates.json').read_bytes())
    data=json.loads(before.read_text())
    for path,digest in data['sources'].items():
        assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest, path
    rows=[r for r in data['questions'] if (not args.subject or r['subject']==args.subject)
          and (not args.year or r['year']==args.year)]
    rows.sort(key=lambda r: ('2008' if r['year']=='09예비' else r['year'],r['subject'],r['odd_question_no']))
    docs={Path(r[f'{f}_source_pdf']).stem for r in rows for f in ['odd','even']}
    docq={d:segments(d) for d in docs}
    regions={};tasks=set()
    for r in rows:
        for form in ['odd','even']:
            doc=Path(r[f'{form}_source_pdf']).stem
            if docq[doc] is None:continue
            questions=docq[doc];q=next(q for q in questions if q['number']==r[f'{form}_question_no'])
            parts=defaultdict(list)
            for line in q['lines']:parts[(line['page'],line['column'])].append(line)
            bounds=[]
            for (page,col),lines in parts.items():
                y0=max(.10,min(l['y'] for l in lines)-.009)
                # Extend beyond the text's last glyph to retain graphical choices.
                following=[min(l['y'] for l in other['lines'] if l['page']==page and l['column']==col)
                           for other in questions if other['number']>q['number']
                           and any(l['page']==page and l['column']==col for l in other['lines'])]
                y1=min(.92,min(following)-.006) if following else .92
                bounds.append((page,col,y0,max(y1,max(l['y']+l['height'] for l in lines)+.008)))
                tasks.add((doc,page))
            regions[(r['year'],r['subject'],r['odd_question_no'],form)]=bounds
    def render(task):
        doc,page=task;target=FOLDER/'pages'/doc/f'{page:02d}'
        target.parent.mkdir(parents=True,exist_ok=True)
        old=OUT/'evidence/verbal-recheck/pages'/doc/f'{page:02d}.png'
        if old.exists():return
        if not target.with_suffix('.png').exists():
            subprocess.run([str(POPPLER),'-f',str(page),'-l',str(page),'-r','140','-singlefile','-png',
                            str(ROOT/'output/pdf'/(doc+'.pdf')),str(target)],check=True,capture_output=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        for i,_ in enumerate(pool.map(render,sorted(tasks)),1):
            if i%50==0:print('page renders',i,'/',len(tasks),flush=True)
    prefix='-'.join(x for x in [args.prefix,args.subject,args.year] if x)
    entries=[];sheets=[];pending=[];height=0
    def save():
        nonlocal pending,height
        if not pending:return
        canvas=Image.new('RGB',(1440,height),'white');draw=ImageDraw.Draw(canvas);y=0
        covered=[]
        for r,part,pair in pending:
            label=f"{r['year']} {r['subject']} ODD Q{r['odd_question_no']:02d} | EVEN Q{r['even_question_no']:02d} | part {part}"
            draw.text((8,y+3),label,fill='black');y+=22
            for i,im in enumerate(pair):canvas.paste(im,(8+i*720,y))
            y+=max(im.height for im in pair)+10
            draw.line((0,y-1,1440,y-1),fill='#777',width=2)
            covered.append([r['year'],r['subject'],r['odd_question_no'],part])
        name=f'{prefix}-{len(sheets)+1:04d}.png';canvas.save(FOLDER/name)
        sheets.append(dict(image=name,questions=covered));pending=[];height=0
    for r in rows:
        pair=[]
        for form in ['odd','even']:
            doc=Path(r[f'{form}_source_pdf']).stem;crops=[]
            if docq[doc] is None:
                meta=json.loads((ROOT/'output/images/reasoning-odd'/(doc+'.json')).read_text())
                assert meta['source_sha256']==data['sources'][r[f'{form}_source_pdf']]
                q=next(q for q in meta['questions'] if q['number']==r[f'{form}_question_no'])
                path=ROOT/'output/images/reasoning-odd'/q['file']
                assert hashlib.sha256(path.read_bytes()).hexdigest()==q['sha256']
                with Image.open(path) as im:
                    # Shared passages have their own regions. Keep this question.
                    boxes=[a['output_box'] for a in q['regions'] if a['segment'].startswith('question-')]
                    crops=[im.crop(box).convert('RGB') for box in boxes]
            else:
                for page,col,y0,y1 in regions[(r['year'],r['subject'],r['odd_question_no'],form)]:
                    path=OUT/'evidence/verbal-recheck/pages'/doc/f'{page:02d}.png'
                    if not path.exists():path=FOLDER/'pages'/doc/f'{page:02d}.png'
                    with Image.open(path) as im:
                        x0=.025 if col==0 else .504;x1=.493 if col==0 else .975
                        crop=im.crop((int(x0*im.width),int(y0*im.height),int(x1*im.width),int(y1*im.height))).convert('RGB')
                        crops.append(trim(crop))
            pair.append(stitch(crops))
        parts=max((im.height+1749)//1750 for im in pair)
        for part in range(parts):
            cut=[im.crop((0,part*1750,700,min(im.height,(part+1)*1750)))
                 if part*1750<im.height else Image.new('RGB',(700,1),'white') for im in pair]
            h=max(im.height for im in cut)+32
            if pending and (height+h>1900 or (pending[-1][0]['year'],pending[-1][0]['subject'])!=(r['year'],r['subject'])):save()
            pending.append((r,part+1,cut));height+=h
        entries.append(dict(year=r['year'],subject=r['subject'],odd_question_no=r['odd_question_no'],
                            even_question_no=r['even_question_no'],parts=parts))
    save()
    manifest=dict(scope='all original question regions',question_count=len(rows),sources=data['sources'],
                  entries=entries,sheets=sheets)
    (FOLDER/(prefix+'-manifest.json')).write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print('complete',len(rows),'question pairs',len(sheets),'sheets',flush=True)


if __name__=='__main__':main()
