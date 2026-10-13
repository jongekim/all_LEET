"""Render original odd/even verbal question regions for independent review.

This produces research contact sheets; it neither edits sources nor decides
the choice permutation. Coordinates come from the preserved extraction cache.
"""
import argparse
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/analysis/past-exam-forms'
POPPLER = Path('/Users/jongeunkim/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/bin/pdftoppm')


def segments(document):
    direct = OUT / 'cache/direct' / (document + '.json')
    if direct.exists():
        return json.loads(direct.read_text())['questions']
    data = json.loads((ROOT / 'output/markdown/verbal-odd' / (document + '.json')).read_text())
    return [q for q in data['segments'] if q['kind'] == 'question']


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--scope', choices=['targeted', 'all'], default='targeted')
    parser.add_argument('--year', help='Render one exam year only (including 09예비).')
    args = parser.parse_args()
    folder = OUT / 'evidence/verbal-recheck'
    folder.mkdir(parents=True, exist_ok=True)
    data = json.loads((OUT/'mapping-candidates.json').read_text())
    snapshot = folder / 'before.json'
    # Preserve the original review queue after decisions have been applied.
    source_rows = (json.loads(snapshot.read_text())['previous_rows']
                   if args.scope == 'targeted' and snapshot.exists() else data['questions'])
    rows = [r for r in source_rows
            if r['subject'] == 'verbal' and (args.scope == 'all'
                or r['review_status'] == 'requires_review'
                or r['odd_choice_to_even'] != [1,2,3,4,5])]
    rows.sort(key=lambda r: ('2008' if r['year']=='09예비' else r['year'], r['odd_question_no']))
    if args.year: rows = [r for r in rows if r['year'] == args.year]
    prefix = args.scope + ('-'+args.year if args.year else '')
    docs = {Path(r[k]).stem for r in rows for k in ['odd_source_pdf','even_source_pdf']}
    qs = {doc: {q['number']: q for q in segments(doc)} for doc in docs}
    regions = {}
    tasks = set()
    for r in rows:
        for form in ['odd','even']:
            doc = Path(r[form+'_source_pdf']).stem
            q = qs[doc][r[form+'_question_no']]
            lines = q['lines']
            # Keep the full question when extraction was ambiguous. Otherwise
            # retain the five choices, including all wrapped continuation lines.
            start = next((i for i,l in enumerate(lines) if l['text'].lstrip().startswith('①')),0)
            if r['review_status']=='requires_review': start = 0
            parts = {}
            for l in lines[start:]:
                parts.setdefault((l['page'],l['column']),[]).append(l)
            bounds = []
            for (page,column), ls in parts.items():
                bounds.append((page,column,max(.10,min(l['y'] for l in ls)-.008),
                               min(.92,max(l['y']+l['height'] for l in ls)+.012)))
                tasks.add((doc,page))
            regions[(r['year'],r['odd_question_no'],form)] = bounds
    def render(task):
        doc,page = task
        target=folder/'pages'/doc/f'{page:02d}'
        target.parent.mkdir(parents=True,exist_ok=True)
        if not target.with_suffix('.png').exists():
            subprocess.run([str(POPPLER),'-f',str(page),'-l',str(page),'-r','140','-singlefile','-png',
                            str(ROOT/'output/pdf'/(doc+'.pdf')),str(target)],check=True,capture_output=True)
    with ThreadPoolExecutor(max_workers=3) as pool: list(pool.map(render,sorted(tasks)))
    sheets=[];current=[];height=0
    def save():
        nonlocal current,height
        if not current:return
        canvas=Image.new('RGB',(1460,height),'white'); y=0;draw=ImageDraw.Draw(canvas)
        numbers=[]
        for r,pair in current:
            draw.text((10,y+4),f"{r['year']} Q{r['odd_question_no']:02d} | ODD left / EVEN right",fill='black')
            y+=25
            for i,img in enumerate(pair): canvas.paste(img,(10+i*730,y))
            numbers.append([r['year'],r['odd_question_no']]);y+=max(im.height for im in pair)+12
            draw.line((0,y-2,1460,y-2),fill='#777777',width=2)
        name=f'{prefix}-{len(sheets)+1:03d}.png';canvas.save(folder/name)
        sheets.append(dict(image=name,questions=numbers));current=[];height=0
    for r in rows:
        pair=[]
        for form in ['odd','even']:
            doc=Path(r[form+'_source_pdf']).stem; crops=[]
            for page,column,y0,y1 in regions[(r['year'],r['odd_question_no'],form)]:
                with Image.open(folder/'pages'/doc/f'{page:02d}.png') as im:
                    # PDFs vary in outer margin. Retain the whole text column.
                    x0=.09 if column==0 else .505;x1=.49 if column==0 else .93
                    c=im.crop((int(x0*im.width),int(y0*im.height),int(x1*im.width),int(y1*im.height)))
                    c=c.resize((710,round(c.height*710/c.width)));crops.append(c)
            image=Image.new('RGB',(710,sum(c.height for c in crops)),'white');y=0
            for c in crops:image.paste(c,(0,y));y+=c.height
            pair.append(image)
        h=max(im.height for im in pair)+37
        if current and (height+h>2100 or current[-1][0]['year']!=r['year']):save()
        current.append((r,pair));height+=h
    save()
    manifest=dict(scope=args.scope,question_count=len(rows),sheets=sheets)
    (folder/(prefix+'-manifest.json')).write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(manifest,ensure_ascii=False))


if __name__=='__main__':main()
