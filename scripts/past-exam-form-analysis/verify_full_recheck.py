"""Validate the recorded visual census, not generate visual judgments."""
import ast
import collections
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'output/analysis/past-exam-forms'
FOLDER = OUT/'evidence/full-recheck'
IDENTITY = [1, 2, 3, 4, 5]
REVERSE = [5, 4, 3, 2, 1]


def key(r):
    return r['year'], r['subject'], r['odd_question_no']


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    data = json.loads((OUT/'mapping-candidates.json').read_text())
    before = json.loads((FOLDER/'before.json').read_text())
    observed = json.loads((FOLDER/'observations.json').read_text())
    manifest = json.loads((FOLDER/observed['manifest']).read_text())
    reviews = json.loads((ROOT/'scripts/past-exam-form-analysis/source-reviews.json').read_text())
    rows = {key(r): r for r in data['questions']}
    old = {key(r): r for r in before['questions']}
    records = {key(r): r for r in observed['observations']}
    assert len(rows) == len(records) == len(reviews) == len(old) == 1350
    assert rows.keys() == records.keys() == old.keys() == {key(r) for r in reviews}
    assert observed['inspected_question_pairs'] == 1350 and not observed['unresolved_inspected']
    assert observed['inspected_sheets'] == list(range(1, len(manifest['sheets'])+1))
    assert data['sources'] == before['sources'] == manifest['sources']
    assert len(data['sources']) == 76
    for path, sha in data['sources'].items():
        assert digest(ROOT/path) == sha, path
    image_hashes = {}
    coverage = collections.defaultdict(set)
    for sheet in manifest['sheets']:
        path = FOLDER/sheet['image']
        image_hashes[str(path.relative_to(ROOT))] = digest(path)
        for year, subject, number, part in sheet['questions']:
            coverage[(year, subject, number)].add(str(path.relative_to(ROOT)))
    assert coverage.keys() == rows.keys()
    changes = []
    for k, r in rows.items():
        record = records[k]
        assert set(record['review_images']) == coverage[k]
        assert r['review_status'] == 'source_visual_reviewed' and not r['review_issues']
        assert r['even_question_no'] == record['even_question_no'] == old[k]['even_question_no']
        assert r['odd_choice_to_even'] == record['odd_choice_to_even']
        p = r['odd_choice_to_even']
        assert sorted(p) == IDENTITY
        inverse = [p.index(n)+1 for n in IDENTITY]
        assert all(inverse[p[n-1]-1] == n for n in IDENTITY)
        assert r['answer_key_consistent'] and p[r['odd_correct_answer']-1] == r['even_correct_answer']
        for form in ['odd', 'even']:
            assert record[form+'_source_sha256'] == data['sources'][r[form+'_source_pdf']]
            assert record[form+'_source_pages'] == r[form+'_source_pages']
        if p != old[k]['odd_choice_to_even']:
            changes.append(dict(year=k[0], subject=k[1], odd_question_no=k[2],
                                before=old[k]['odd_choice_to_even'], after=p))
    with (OUT/'mapping-candidates.csv').open(encoding='utf-8-sig', newline='') as f:
        csv_rows = list(csv.DictReader(f))
    assert len(csv_rows) == 1350
    for r in csv_rows:
        target = rows[(r['year'], r['subject'], int(r['odd_question_no']))]
        assert int(r['even_question_no']) == target['even_question_no']
        assert ast.literal_eval(r['odd_choice_to_even']) == target['odd_choice_to_even']
        assert r['review_status'] == target['review_status']
        assert r['answer_key_consistent'] == str(target['answer_key_consistent'])
    subjects = {}
    for subject in ['verbal', 'reasoning']:
        part = [r for r in rows.values() if r['subject'] == subject]
        subjects[subject] = dict(question_pairs=len(part), visual_reviewed=len(part),
            identity=sum(r['odd_choice_to_even'] == IDENTITY for r in part),
            reverse=sum(r['odd_choice_to_even'] == REVERSE for r in part),
            other=sum(r['odd_choice_to_even'] not in [IDENTITY, REVERSE] for r in part))
    result = dict(question_pairs=1350, form_positions=2700, source_pdfs=76,
        inspected_sheets=len(manifest['sheets']), visual_reviewed=1350, requires_review=0,
        moved_questions=sum(r['odd_question_no'] != r['even_question_no'] for r in rows.values()),
        field_mismatches=sum(r['field_would_change'] for r in rows.values()), subjects=subjects,
        original_pdf_hashes_verified=True, complete_image_coverage_verified=True,
        all_choices_roundtrip_verified=True, current_answer_keys_crosschecked=True,
        csv_json_consistent=True, status=data['status'], changes_from_before=changes,
        mapping_sha256=digest(OUT/'mapping-candidates.json'), review_image_sha256=image_hashes)
    (FOLDER/'verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    lines = ['# 홀수형·짝수형 전 문항 원본 검수', '',
        '2026-10-11. 2027학년도 제외, 09예비 및 2009~2026학년도. 원본 PDF 76개에서 1,350문항 쌍(언어이해 635, 추리논증 715)의 번호 대응과 문항 본문·보기·다섯 선지를 직접 대조했다. 비교 시트 1,217개를 모두 확인했으며 미확정 선지 대응은 0개다.', '',
        '검수 범위는 각 문항 영역이다. 여러 문항이 공유하는 독립 지문 전체의 문장·서식 동일성까지 전수 인증한 것은 아니다. 정답은 현재 저장소의 문형별 정답표와 교차검사했으며, 공식 정답 첨부파일을 별도로 전수 검수하지 않았다.', '',
        '| 과목 | 전체 | 동일 순서 | 역순 | 별도 순열 |',
        '|---|---:|---:|---:|---:|']
    for subject, label in [('verbal', '언어이해'), ('reasoning', '추리논증')]:
        s = subjects[subject]
        lines.append(f"| {label} | {s['question_pairs']} | {s['identity']} | {s['reverse']} | {s['other']} |")
    lines += ['', '문항 번호 이동은 추리논증 40개이며, 현재 짝수형 분야표와 홀수형 번호의 불일치는 6개다. 이동쌍과 전 학년도 선지 변경 목록은 [상세 요약](SUMMARY.md)에 있다.', '',
        '## 별도 순열과 확인 사항', '',
        '- **09예비 추리논증 14번**: `[4,5,3,1,2]`. 그래프 곡선의 좌우 급격함을 구분해야 한다. 단순 역순으로 분류한 잠정 판정을 재확인해 수정했다.',
        '- **2015 추리논증 8번**: `[4,5,3,1,2]`. 문장별 조건을 대조한 별도 순열이다.',
        '- **2019 추리논증 7번**: 기존 자동 후보의 역순 판정은 잘못됐다. 원본 조합 선지는 양쪽 모두 같은 순서여서 `[1,2,3,4,5]`로 수정했다.',
        '- **2019 추리논증 8번**: 선지 내용은 역순이지만 화자 표기 갑·을·병·정·무는 위치 순서를 유지한다. 문자열 전체의 동일성으로 매칭하면 놓칠 수 있다.',
        '- **2016 추리논증 25번**: 확대 확인 결과 양쪽 모두 ‘시체’, ‘구역질까지 동반하는’이다. 잠정 본문 차이 관찰은 철회했다.',
        '- **2022 추리논증 40번**: 양쪽 모두 ‘고지방 식이’로 같고 표의 수치·선지도 같다.', '',
        '## 근거와 검증', '',
        '- [전수 대조 기록](evidence/full-recheck/observations.json): 문항별 원본 해시·쪽수·비교 이미지·이전 판정·최종 순열.',
        '- [비교 이미지 목록](evidence/full-recheck/compact-manifest.json) / [검증 결과와 이미지 해시](evidence/full-recheck/verification.json).',
        '- [전 문항 대응표 CSV](mapping-candidates.csv) / [전체 근거 JSON](mapping-candidates.json).',
        '- 76개 PDF 해시, 38개 학년도·과목 조합, 문항 번호 일대일 대응, 선지 순열·왕복 변환, 현재 정답표 교차검사, CSV·JSON 일치를 확인했다.',
        '- 자료는 `research_only_not_runtime_approved` 상태다. 앱·UI·운영 DB·통계 발행·배포는 변경하지 않았다. 운영 적용 시 집계 건수 보존과 문형별 역변환을 별도 검증해야 한다.']
    (OUT/'full-source-review.md').write_text('\n'.join(lines)+'\n')
    print(json.dumps({k: v for k, v in result.items() if k not in ['review_image_sha256', 'changes_from_before']}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
