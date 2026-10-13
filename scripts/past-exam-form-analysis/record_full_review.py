"""Record explicitly inspected sheets; never mark unseen sheets reviewed.

--accept means the caller has visually compared the listed paired renders.
An unknown permutation must be supplied with --overrides after that inspection.
"""
import argparse
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
FOLDER=ROOT/'output/analysis/past-exam-forms/evidence/full-recheck'


def key(r):return f"{r['year']}:{r['subject']}:{r['odd_question_no']}"


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--accept',nargs='+',required=True,type=int,help='Sheet numbers actually visually inspected.')
    p.add_argument('--overrides',default='{}',help='Explicit inspected choice maps by year:subject:odd-number.')
    p.add_argument('--notes',default='{}',help='Optional source inspection notes by question key.')
    p.add_argument('--manifest',default='compact-manifest.json')
    args=p.parse_args()
    manifest=json.loads((FOLDER/args.manifest).read_text())
    before=json.loads((FOLDER/'before.json').read_text())
    progress=FOLDER/'observations.json'
    data=json.loads(progress.read_text()) if progress.exists() else dict(inspected_sheets=[],overrides={},notes={},observations=[])
    allowed=set(range(1,len(manifest['sheets'])+1))
    assert set(args.accept)<=allowed
    data['inspected_sheets']=sorted(set(data['inspected_sheets'])|set(args.accept))
    overrides=json.loads(args.overrides)
    for perm in overrides.values():assert sorted(perm)==[1,2,3,4,5]
    data['overrides'].update(overrides);data['notes'].update(json.loads(args.notes))
    files={key(r):[] for r in before['questions']}
    for n,sheet in enumerate(manifest['sheets'],1):
        for year,subject,number,part in sheet['questions']:
            files[f'{year}:{subject}:{number}'].append((n,sheet['image'],part))
    seen=set(data['inspected_sheets']);records=[];unresolved=[]
    for r in before['questions']:
        k=key(r)
        if not all(n in seen for n,_,_ in files[k]):continue
        perm=data['overrides'].get(k,r['odd_choice_to_even'])
        if perm is None:unresolved.append(k);continue
        images=sorted({image for _,image,_ in files[k]})
        record={name:r[name] for name in ['year','subject','odd_question_no','even_question_no','odd_source_pages','even_source_pages']}
        record.update(odd_choice_to_even=perm,review_batch='full-source-census-2026-10-11',reviewed_at='2026-10-11',
                      previous_status=r['review_status'],previous_mapping=r['odd_choice_to_even'],
                      review_images=[str((FOLDER/im).relative_to(ROOT)) for im in images],
                      odd_source_sha256=before['sources'][r['odd_source_pdf']],
                      even_source_sha256=before['sources'][r['even_source_pdf']],
                      evidence='2026-10-11 전수 검수: 양쪽 원본에서 렌더한 문항 전체 영역의 문제 본문·다섯 선지·기호·표·그림을 직접 비교. 문항 번호 대응과 홀수형 선지 1~5 → 짝수형 선지 순열 '+str(perm)+' 확인. 정답 번호는 대응 결정에 사용하지 않음. '+data['notes'].get(k,''))
        records.append(record)
    data.update(reviewed_at='2026-10-11',manifest=args.manifest,observations=records,
                inspected_question_pairs=len(records),unresolved_inspected=unresolved,
                total_question_pairs=1350,total_sheets=len(manifest['sheets']))
    progress.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:data[k] for k in ['inspected_question_pairs','total_question_pairs','total_sheets','unresolved_inspected']},ensure_ascii=False))


if __name__=='__main__':main()
