"""Audit recorded visual observations and all verbal mapping contracts.

This never supplies visual decisions. They are recorded separately after
inspecting the paired original PDF renders.
"""
import ast
import collections
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/analysis/past-exam-forms'
EVIDENCE = OUT / 'evidence/verbal-recheck'
IDENTITY = [1, 2, 3, 4, 5]
REVERSE = [5, 4, 3, 2, 1]


def key(row):
    return row['year'], row['odd_question_no']


def main():
    data = json.loads((OUT/'mapping-candidates.json').read_text())
    verbal = [r for r in data['questions'] if r['subject'] == 'verbal']
    before = json.loads((EVIDENCE/'before.json').read_text())
    observed = json.loads((EVIDENCE/'observations.json').read_text())
    manifest = json.loads((EVIDENCE/'targeted-manifest.json').read_text())
    previous = {key(r): r for r in before['previous_rows']}
    current = {key(r): r for r in verbal}
    records = observed['observations']
    assert len(verbal) == len(previous) == len(current) == 635
    assert observed['previous_mapping_sha256'] == before['previous_mapping_sha256']
    assert observed['inspected_sheets'] == list(range(1, 74))
    target_keys = {key(r) for r in previous.values() if r['review_status'] == 'requires_review'
                   or r['odd_choice_to_even'] != IDENTITY}
    assert len(target_keys) == len(records) == 197
    assert {key(r) for r in records} == target_keys
    sheets = {(y, n): s['image'] for s in manifest['sheets'] for y, n in s['questions']}
    assert set(sheets) == target_keys
    source_paths = {r[f'{form}_source_pdf'] for r in verbal for form in ['odd', 'even']}
    assert len(source_paths) == 38
    for path in source_paths:
        assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest() == data['sources'][path]
    for r in records:
        result = current[key(r)]
        assert result['review_status'] == 'source_visual_reviewed'
        assert result['odd_choice_to_even'] == r['odd_choice_to_even']
        assert Path(r['review_image']).name == sheets[key(r)]
        assert (ROOT/r['review_image']).is_file()
        for form in ['odd', 'even']:
            assert r[f'{form}_source_sha256'] == data['sources'][result[f'{form}_source_pdf']]
            assert r[f'{form}_source_pages'] == result[f'{form}_source_pages']
    for r in verbal:
        assert r['odd_question_no'] == r['even_question_no']
        permutation = r['odd_choice_to_even']
        assert sorted(permutation) == IDENTITY
        inverse = [permutation.index(n)+1 for n in IDENTITY]
        assert all(inverse[permutation[n-1]-1] == n for n in IDENTITY)
        assert permutation[r['odd_correct_answer']-1] == r['even_correct_answer']
        assert r['answer_key_consistent'] and r['review_status'] != 'requires_review'
    with (OUT/'mapping-candidates.csv').open(encoding='utf-8-sig', newline='') as f:
        csv_rows = [r for r in csv.DictReader(f) if r['subject'] == 'verbal']
    assert len(csv_rows) == 635
    for r in csv_rows:
        result = current[(r['year'], int(r['odd_question_no']))]
        assert ast.literal_eval(r['odd_choice_to_even']) == result['odd_choice_to_even']
        assert r['review_status'] == result['review_status']
    changed = [r for r in verbal if r['odd_choice_to_even'] != IDENTITY]
    assert len(changed) == 115
    assert all(r['odd_choice_to_even'] == REVERSE and r['review_status'] == 'source_visual_reviewed' for r in changed)
    prior_changed = {key(r) for r in previous.values()
                     if r['review_status'] != 'requires_review' and r['odd_choice_to_even'] != IDENTITY}
    assert len(prior_changed) == 107
    assert all(current[k]['odd_choice_to_even'] == previous[k]['odd_choice_to_even'] for k in prior_changed)
    added = {key(r) for r in changed} - prior_changed
    expected_added = {('09예비',30),('2009',15),('2010',3),('2012',34),('2013',5),('2014',35),('2018',30),('2022',30)}
    assert added == expected_added
    resolved = [r for r in records if previous[key(r)]['review_status'] == 'requires_review']
    assert len(resolved) == 90
    assert sum(r['odd_choice_to_even'] == IDENTITY for r in resolved) == 82
    counts = dict(collections.Counter(r['review_status'] for r in verbal))
    assert counts == {'source_visual_reviewed':635}
    years = ['09예비', *map(str, range(2009,2027))]
    summary = dict(question_pairs=635, source_pdfs=38, visual_reviewed=635,
                   targeted_batch_visual_reviewed=197, machine_supported=0, requires_review=0,
                   choice_changed=115, prior_choice_changed=107,
                   added_changes=[[y,n] for y in years for yy,n in sorted(added) if yy==y],
                   resolved_pending=90, resolved_identity=82, resolved_reverse=8,
                   original_pdf_hashes_verified=True, choice_bijection_verified=True,
                   all_choices_roundtrip_verified=True, answer_keys_crosschecked=True,
                   csv_json_consistent=True, status=data['status'])
    (EVIDENCE/'verification.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    lines = ['# 언어이해 홀수형·짝수형 선지 재검수', '',
             '검수일: 2026-10-11. 2027학년도 제외, 09예비 및 2009~2026학년도 635문항.', '',
             '**선지 변경 115문항을 원본에서 확인했다.** 기존 107문항은 유지됐고, 미확정 90문항 중 8문항이 추가됐다. 나머지 82문항은 같은 순서였다. 변경 문항은 모두 홀수형 ①→짝수형 ⑤, ②→④, ③→③, ④→②, ⑤→①인 역순이다. 문항 번호는 모두 동일하다.', '',
             '첫 재검수에서는 197문항(기존 변경 107 + 미확정 90)을 대조했다. 후속 전수 검수에서는 동일 순서 문항을 포함해 언어이해 635문항 모두의 문항 본문·다섯 선지를 원본 이미지로 확인했다. 변경 목록 115문항은 유지됐다. [전수 검수 보고서](full-source-review.md)를 참조한다.', '',
             '선지 마커가 누락됐던 10문항(09예비 20번, 2009 4·13·25번, 2010 12번, 2011 23번, 2012 30번, 2013 12번, 2016 2번, 2023 27번)은 원본의 기호·표·그림·문장을 비교해 동일 순서로 확인했다. 정답 번호는 배열을 결정하는 근거로 사용하지 않았다.', '',
             '## 학년도별 변경 문항', '',
             '아래 번호는 두 문형에서 같다. 모든 기재 문항의 역순을 원본에서 확인했다.', '',
             '| 학년도 | 선지 변경 번호 | 건수 | 이번 추가 확인 |',
             '|---|---|---:|---|']
    for year in years:
        numbers = sorted(r['odd_question_no'] for r in changed if r['year']==year)
        new = sorted(n for y,n in added if y==year)
        lines.append(f"| {year} | {', '.join(map(str,numbers)) or '없음'} | {len(numbers)} | {', '.join(map(str,new)) or '없음'} |")
    lines += ['', '## 검증과 근거', '',
              '- 38개 원본 PDF 해시, 635문항 번호·선지 일대일 대응, 다섯 선택지 왕복 변환, 현재 문형별 정답표와의 교차검사, CSV·JSON 일치를 검증했다. 공식 정답 첨부파일을 독립적으로 전수 재검수한 것은 아니다.',
              '- [이번 원본 대조 기록](evidence/verbal-recheck/observations.json): 문항별 판정, 이전 상태, 원본 쪽수·해시, 73개 비교 이미지 경로.',
              '- [검증 결과](evidence/verbal-recheck/verification.json) / [전체 대응표 CSV](mapping-candidates.csv) / [전체 근거 JSON](mapping-candidates.json).',
              '- 후속 검수에서 추리논증 715문항도 원본 대조를 마쳤다. 전체 자료의 `research_only_not_runtime_approved` 상태는 운영 통합 집계·화면 적용의 별도 검증을 위해 유지한다.',
              '- 앱·UI·운영 DB·정답표·발행 통계·배포 설정은 변경하지 않았다.']
    (OUT/'verbal-choice-review.md').write_text('\n'.join(lines)+'\n')
    print(json.dumps(summary,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
