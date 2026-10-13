"""Propose source-evidenced odd/even question and option correspondences.

This is an offline research tool, not a runtime data migration. Fuzzy matches
remain review candidates. Answer keys check the result, never select a match.
"""
import argparse
import csv
import difflib
import hashlib
import itertools
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MARKERS = '①②③④⑤'


def normalize(text):
    # Keep circled Hangul, mathematical symbols and figures' labels: dropping
    # these can make distinct short choices falsely look identical.
    text=re.sub(r'[\s.,，。:;\'"“”‘’!?()[\]{}〈〉《》「」『』/\\|]', '',
                unicodedata.normalize('NFC', text))
    # Common Vision substitutions, only in short Korean combination choices.
    # Preserve sentence text, formulas, circled references and Latin variables.
    if len(text)<18 and not re.search('[가-힣一-鿿]',text) and re.fullmatch('[ㄱㄴㄷㄹㅁ7LIl2]+',text):
        text=text.translate(str.maketrans({'7':'ㄱ','L':'ㄴ','I':'ㄴ','l':'ㄴ','2':'ㄹ'}))
    return text


def parse_question(number, lines, pages):
    texts = [l['text'].strip() for l in lines if l['text'].strip()]
    # A stitched reasoning image can start with a shared passage. Keep only
    # this question for comparison with the PDF's question segment.
    start = next((i for i, t in enumerate(texts)
                  if re.match(r'^\s*' + str(number) + r'\s*[.．。)]', t)), 0)
    texts = texts[start:]
    while texts and re.fullmatch(r'\d{1,3}', texts[-1]):
        texts.pop()
    # Recover ordinary-digit readings only in a final, ordered 1..5 option
    # run, so numbered paragraphs in the question cannot become options.
    recovered=[];cursor=len(texts)
    for value in range(5,0,-1):
        candidates=[i for i in range(cursor) if re.match(r'^['+MARKERS[value-1]+str(value)+r'](?:\s|$)',texts[i])]
        if not candidates:break
        index=candidates[-1];recovered.append((index,value));cursor=index
    if len(recovered)==5:
        for index,value in recovered:
            texts[index]=MARKERS[value-1]+texts[index][1:]
    first = next((i for i,t in enumerate(texts) if re.match(r'^①',t)), None)
    if first is None:
        # Vision sometimes reads the first option marker as an ordinary 1.
        second = next((i for i,t in enumerate(texts) if re.match(r'^②',t)), None)
        if second is not None:
            candidate = next((i for i in range(second-1,-1,-1)
                              if re.match(r'^[1ㅣlI|](?:\s+|$)',texts[i])),None)
            if candidate is not None:
                texts[candidate] = '①'+texts[candidate][1:]
                first = candidate
            elif second>0 and re.fullmatch(r'[ㄱㄴㄷㄹㅁ7LIl, .]+',texts[second-1]):
                first=second-1;texts[first]='① '+texts[first]
    choices, body = {}, '\n'.join(texts)
    if first is not None:
        body = '\n'.join(texts[:first])
        active = None
        for text in texts[first:]:
            if active and active<5 and re.match(r'^'+str(active+1)+r'(?:\s|$)',text):
                text=MARKERS[active]+text[1:]
            matches=list(re.finditer('['+MARKERS+']',text))
            # Long prose may contain OCR-misread circled references. Only
            # short multi-option rows or the row's first glyph are markers.
            short_row=(len(matches)>1 and len(text)<100
                       and all(len(text[m.end():matches[k+1].start() if k+1<len(matches) else len(text)])<30
                               for k,m in enumerate(matches)))
            matches=matches if short_row else matches[:1] if matches and matches[0].start()==0 else []
            if matches and matches[0].start()==0 and MARKERS.index(matches[0].group())+1==(active or 0)+1:
                for k,m in enumerate(matches):
                    choice_number=MARKERS.index(m.group())+1
                    if choice_number!=(active or 0)+1:continue
                    end=matches[k+1].start() if k+1<len(matches) else len(text)
                    choices[choice_number]=text[m.end():end].strip();active=choice_number
            elif active:
                choices[active]+='\n'+text
        if list(choices)!=[1,2,3,4,5]:choices={}
    body = re.sub(r'^\s*\d{1,2}\s*[.．。)]', '', body)
    return dict(number=number, body=body, choices=choices, source_pages=pages,
                signature=normalize(body) + ''.join(sorted(normalize(t) for t in choices.values())))


def load_questions(document, cache):
    direct = cache / 'direct' / (document + '.json')
    if direct.exists():
        d = json.loads(direct.read_text())
        return [parse_question(q['number'],q['lines'],sorted(set(l['page'] for l in q['lines'])))
                for q in d['questions']]
    if '-verbal-' in document:
        d = json.loads((ROOT/'output/markdown/verbal-odd'/(document+'.json')).read_text())
        return [parse_question(q['number'],q['lines'],q['source_pages'])
                for q in d['segments'] if q['kind']=='question']
    d = json.loads((ROOT/'output/images/reasoning-odd'/(document+'.json')).read_text())
    questions=[]
    for q in d['questions']:
        path = cache/'ocr'/(document+f"-Q{q['number']:02d}.json")
        if not path.exists():
            raise FileNotFoundError(path)
        questions.append(parse_question(q['number'],json.loads(path.read_text()),q['source_pages']))
    return questions


def grams(text):
    return set(text[i:i+3] for i in range(max(0,len(text)-2)))


def overlap(a,b):
    return 2*len(a&b)/(len(a)+len(b)) if a or b else 0


def assignment(matrix):
    """Hungarian minimum-cost assignment (cost = 1 - similarity)."""
    n=len(matrix);u=[0.]*(n+1);v=[0.]*(n+1);p=[0]*(n+1);way=[0]*(n+1)
    for i in range(1,n+1):
        p[0]=i;j0=0;mins=[float('inf')]*(n+1);used=[False]*(n+1)
        while True:
            used[j0]=True;i0=p[j0];delta=float('inf');j1=0
            for j in range(1,n+1):
                if not used[j]:
                    cur=1-matrix[i0-1][j-1]-u[i0]-v[j]
                    if cur<mins[j]:mins[j]=cur;way[j]=j0
                    if mins[j]<delta:delta=mins[j];j1=j
            for j in range(n+1):
                if used[j]:u[p[j]]+=delta;v[j]-=delta
                else:mins[j]-=delta
            j0=j1
            if not p[j0]:break
        while True:
            j1=way[j0];p[j0]=p[j1];j0=j1
            if not j0:break
    result=[None]*n
    for j in range(1,n+1):result[p[j]-1]=j-1
    return result


def similarity(a,b):
    return difflib.SequenceMatcher(None,normalize(a),normalize(b),autojunk=False).ratio()


def analyze(year,subject,answers,cache):
    token='2009-preliminary' if year=='09예비' else year
    odd_doc=f'LEET-{token}-{subject}-odd';even_doc=odd_doc.replace('-odd','-even')
    odd=load_questions(odd_doc,cache);even=load_questions(even_doc,cache)
    assert len(odd)==len(even)==len(answers[year][subject]['odd']), (odd_doc,len(odd),len(even))
    a=[grams(q['signature']) for q in odd];b=[grams(q['signature']) for q in even]
    matrix=[[overlap(x,y) for y in b] for x in a]
    paired=assignment(matrix);rows=[]
    for i,j in enumerate(paired):
        oq,eq=odd[i],even[j];on,en=oq['number'],eq['number']
        choice_map=None;option_scores=[];option_margins=[]
        if (len(oq['choices'])==len(eq['choices'])==5
                and all(normalize(t) for t in [*oq['choices'].values(),*eq['choices'].values()])):
            cm=[[similarity(oq['choices'][x],eq['choices'][y]) for y in range(1,6)] for x in range(1,6)]
            perms=list(itertools.permutations(range(5)))
            ranked=sorted(((sum(cm[x][p[x]] for x in range(5)),p) for p in perms),reverse=True)
            best=ranked[0][1];choice_map=[v+1 for v in best]
            option_scores=[round(cm[x][best[x]],6) for x in range(5)]
            option_margins=[round(cm[x][best[x]]-max(cm[x][k] for k in range(5) if k!=best[x]),6) for x in range(5)]
        oa=answers[year][subject]['odd'][str(on)];ea=answers[year][subject]['even'][str(en)]
        key_ok=choice_map[oa-1]==ea if choice_map else None
        score=matrix[i][j];margin=score-max(matrix[i][k] for k in range(len(even)) if k!=j)
        body_score=similarity(oq['body'],eq['body'])
        issues=[]
        if not choice_map:issues.append('choice_parse')
        if margin<.12:issues.append('question_ambiguity')
        if body_score<.92:issues.append('body_text_difference')
        if option_scores and min(option_scores)<.90:issues.append('choice_text_difference')
        if option_margins and min(option_margins)<.10:issues.append('choice_ambiguity')
        if key_ok is False:issues.append('answer_key_mismatch')
        field=answers[year][subject]['fieldMapping']
        rows.append(dict(year=year,subject=subject,canonical_question_id=f'{token}:{subject}:E{en:02d}',
                         odd_question_no=on,even_question_no=en,odd_choice_to_even=choice_map,
                         odd_correct_answer=oa,even_correct_answer=ea,answer_key_consistent=key_ok,
                         odd_current_field=field[str(on)],even_current_field=field[str(en)],
                         field_would_change=field[str(on)]!=field[str(en)],
                         question_similarity=round(score,6),question_margin=round(margin,6),
                         body_similarity=round(body_score,6),choice_similarities=option_scores,
                         choice_margins=option_margins,review_issues=issues,
                         review_status='requires_review' if issues else 'machine_supported',
                         odd_source_pdf=f'output/pdf/{odd_doc}.pdf',even_source_pdf=f'output/pdf/{even_doc}.pdf',
                         odd_source_pages=oq['source_pages'],even_source_pages=eq['source_pages'],
                         odd_body=oq['body'],even_body=eq['body'],
                         odd_choices=oq['choices'],even_choices=eq['choices']))
    return rows


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--cache',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--subject',choices=['verbal','reasoning'])
    parser.add_argument('--reuse-candidates',action='store_true',help='Apply source reviews to the existing complete candidate artifact.')
    args=parser.parse_args();answers=json.loads((args.cache/'answers.json').read_text())
    rows=[];skipped=[];sources={}
    if args.reuse_candidates:
        prior=json.loads((args.output/'mapping-candidates.json').read_text())
        assert not prior['skipped'] and len(prior['questions'])==1350
        rows=prior['questions'];sources=prior['sources']
    for year in ([] if args.reuse_candidates else answers):
        if year=='2027':continue
        for subject in ([args.subject] if args.subject else ['verbal','reasoning']):
            try:
                part=analyze(year,subject,answers,args.cache)
            except FileNotFoundError as e:
                skipped.append(str(e));continue
            rows.extend(part)
            for row in part:
                for key in ['odd_source_pdf','even_source_pdf']:
                    file=row[key];sources[file]=hashlib.sha256((ROOT/file).read_bytes()).hexdigest()
            print(year,subject,len(part),'moved',sum(r['odd_question_no']!=r['even_question_no'] for r in part),
                  'choices',sum(r['odd_choice_to_even'] not in [None,[1,2,3,4,5]] for r in part),
                  'review',sum(bool(r['review_issues']) for r in part),flush=True)
    reviews_path=ROOT/'scripts/past-exam-form-analysis/source-reviews.json'
    if reviews_path.exists():
        reviews=json.loads(reviews_path.read_text())
        for review in reviews:
            row=next((r for r in rows if r['year']==review['year'] and r['subject']==review['subject']
                      and r['odd_question_no']==review['odd_question_no']),None)
            if row is None:continue
            assert row['even_question_no']==review['even_question_no']
            assert sorted(review['odd_choice_to_even'])==[1,2,3,4,5]
            for form in ['odd','even']:
                if form+'_source_sha256' in review:
                    assert review[form+'_source_sha256']==sources[row[form+'_source_pdf']], 'Source review hash changed'
            row['machine_review_issues']=row.get('machine_review_issues',row['review_issues'])
            row['odd_choice_to_even']=review['odd_choice_to_even']
            row['answer_key_consistent']=(row['odd_choice_to_even'][row['odd_correct_answer']-1]==row['even_correct_answer'])
            row['review_issues']=[] if row['answer_key_consistent'] else ['answer_key_mismatch']
            row['review_status']='source_visual_reviewed' if not row['review_issues'] else 'requires_review'
            row['source_review_note']=review['evidence']
    args.output.mkdir(parents=True,exist_ok=True)
    (args.output/'mapping-candidates.json').write_text(json.dumps(dict(schema_version=1,
        canonical_form='even',status='research_only_not_runtime_approved',
        sources=sources,skipped=skipped,questions=rows),ensure_ascii=False,indent=2)+'\n')
    columns=['year','subject','odd_question_no','even_question_no','odd_choice_to_even',
             'odd_correct_answer','even_correct_answer','answer_key_consistent','odd_current_field',
             'even_current_field','field_would_change','review_status','review_issues']
    with (args.output/'mapping-candidates.csv').open('w',newline='',encoding='utf-8-sig') as f:
        writer=csv.DictWriter(f,fieldnames=columns,extrasaction='ignore');writer.writeheader();writer.writerows(rows)
    print('total',len(rows),'skipped',len(skipped),'review',sum(bool(r['review_issues']) for r in rows))


if __name__=='__main__':main()
