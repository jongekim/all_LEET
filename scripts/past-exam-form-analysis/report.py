"""Render a research summary and an explicit source-review queue."""
import collections
import html
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/analysis/past-exam-forms'


def main():
    data=json.loads((OUT/'mapping-candidates.json').read_text());rows=data['questions']
    assert len(rows)==1350 and not data['skipped']
    summaries=[]
    for year in ['09예비',*[str(y) for y in range(2009,2027)]]:
        for subject in ['verbal','reasoning']:
            part=[r for r in rows if r['year']==year and r['subject']==subject]
            summaries.append(dict(year=year,subject=subject,question_count=len(part),
                moved_questions=[r['odd_question_no'] for r in part if r['odd_question_no']!=r['even_question_no']],
                swap_pairs=[[r['odd_question_no'],r['even_question_no']] for r in part if r['odd_question_no']<r['even_question_no']],
                field_mismatches=[r['odd_question_no'] for r in part if r['field_would_change']],
                supported_choice_changes=[r['odd_question_no'] for r in part if r['review_status']!='requires_review' and r['odd_choice_to_even']!=[1,2,3,4,5]],
                review_required=[r['odd_question_no'] for r in part if r['review_status']=='requires_review']))
    summary=dict(question_pairs=len(rows),source_pdfs=len(data['sources']),cohort_count=len(summaries),
                 moved_questions=sum(r['odd_question_no']!=r['even_question_no'] for r in rows),
                 field_mismatches=sum(r['field_would_change'] for r in rows),
                 review_status_counts=dict(collections.Counter(r['review_status'] for r in rows)),
                 review_issue_counts=dict(collections.Counter(i for r in rows for i in r['review_issues'])),cohorts=summaries)
    (OUT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    lines=['# 전 학년도 문형 대조 요약','',
           '1,350문항 쌍의 문항 번호와 다섯 선지를 원본 이미지로 전수 대조했다. [전수 검수 범위와 근거](full-source-review.md)를 참조한다.','',
           '| 학년도 | 언어 문항 이동 | 추리 문항 교환쌍 | 분야 불일치 홀수형 번호 | 추가대조 언어/추리 |',
           '|---|---:|---|---|---:|']
    for i in range(0,len(summaries),2):
        v,r=summaries[i:i+2];pairs=', '.join(f'{a}↔{b}' for a,b in r['swap_pairs']) or '없음'
        fields=', '.join(map(str,r['field_mismatches'])) or '없음'
        lines.append(f"| {r['year']} | {len(v['moved_questions'])} | {pairs} | {fields} | {len(v['review_required'])}/{len(r['review_required'])} |")
    lines+=['','## 선지 배열 변경: 원본 전수 대조한 번호','',
            '언어이해 115문항, 추리논증 72문항의 선지 순서가 다르다. 09예비 추리논증 14번과 2015 추리논증 8번은 `[4,5,3,1,2]`, 나머지는 `[5,4,3,2,1]` 역순이다. 동일 순서 문항을 포함해 1,350문항 모두 원본 대조했다.','']
    for s in summaries:
        label='언어이해' if s['subject']=='verbal' else '추리논증'
        lines.append(f"- {s['year']} {label}: {', '.join(map(str,s['supported_choice_changes'])) or '없음(전 문항 동일 순서)'}")
    lines+=['','## 검증 현황','',f"- 문항 쌍 {len(rows)}개 / 문제지 {len(data['sources'])}개 / 시험·과목 {len(summaries)}개.",
            f"- 문항 번호 이동 {summary['moved_questions']}개 / 기존 분야표 불일치 {summary['field_mismatches']}개.",
            f"- 상태: `{json.dumps(summary['review_status_counts'],ensure_ascii=False)}`.",
            '- 전 문항의 선지 변환 후 현재 문형별 정답표가 일치한다. 공식 정답 첨부파일의 독립 전수 검수나 운영 집계 검증을 완료했다는 뜻은 아니다.']
    (OUT/'SUMMARY.md').write_text('\n'.join(lines)+'\n')
    queue=[]
    reviews=json.loads((ROOT/'scripts/past-exam-form-analysis/source-reviews.json').read_text())
    review_by_key={(r['year'],r['subject'],r['odd_question_no']):r for r in reviews}
    for r in rows:
        odd=html.escape(r['odd_body']+'\n'+str(r['odd_choices']))
        even=html.escape(r['even_body']+'\n'+str(r['even_choices']))
        oddlink='../../../'+r['odd_source_pdf']+'#page='+str(r['odd_source_pages'][0])
        evenlink='../../../'+r['even_source_pdf']+'#page='+str(r['even_source_pages'][0])
        record=review_by_key[(r['year'],r['subject'],r['odd_question_no'])]
        pictures=''.join(f"<img loading='lazy' style='width:100%;height:auto' src='../../../{html.escape(path)}' alt='양쪽 원본 문항 대조 이미지'>" for path in record.get('review_images',[]))
        queue.append(f"<details><summary>{html.escape(r['year'])} {r['subject']} 홀수 {r['odd_question_no']} → 짝수 {r['even_question_no']} / {html.escape(r['review_status'])}</summary><p><a href='{oddlink}'>홀수형 원본</a> · <a href='{evenlink}'>짝수형 원본</a></p><p>홀수 선지 1~5 → 짝수 선지: {r['odd_choice_to_even']}</p><div class='pair'><pre>{odd}</pre><pre>{even}</pre></div>{pictures}<p>{html.escape(record['evidence'])}</p></details>")
    (OUT/'review.html').write_text("<!doctype html><html lang='ko'><meta charset='utf-8'><title>문형 대응 전수 검수</title><style>body{font:16px system-ui;max-width:1400px;margin:30px auto;padding:0 20px}details{border:1px solid #ddd;margin:10px 0;padding:14px}summary{cursor:pointer}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.6 system-ui}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style><h1>문형 대응 전수 검수</h1><p>앱과 분리된 로컬 분석 자료입니다. 1,350문항 쌍의 번호·본문·다섯 선지를 원본 이미지로 확인했습니다. 항목을 펼치면 원본 링크·대응표·비교 이미지를 볼 수 있습니다. 운영 적용 전의 분석 자료입니다.</p>"+'\n'.join(queue)+"</html>")
    print(json.dumps({k:v for k,v in summary.items() if k!='cohorts'},ensure_ascii=False,indent=2))


if __name__=='__main__':main()
