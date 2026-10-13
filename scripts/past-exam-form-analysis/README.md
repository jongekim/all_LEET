# 문형 차이 분석 도구

실제 이력의 분야 재계산 가능 여부는 `audit_history_quality.ts`와 같은 이름의 SQL로 읽기 전용 합계만 확인한다. 등록된 채점 카탈로그에는 2027도 포함해 조회 품질을 검사하지만 문형 대응·통계 발행 지원 범위를 바꾸지는 않는다. 사용자 ID·이메일·개별 답안은 반환하지 않는다. 기존 프로젝트의 `SUPABASE_PROJECT_REF`와 `SUPABASE_ACCESS_TOKEN`을 실행 환경에서 사용하며 출력 파일은 새 이름으로만 생성한다.

```sh
node --import tsx scripts/past-exam-form-analysis/audit_history_quality.ts \
  output/analysis/past-exam-forms/evidence/history-quality-YYYY-MM-DD.json
```

감사 결과는 읽기 시점의 상태이며 실제 집계 정책 결정은 [확정 설계](../../docs/past-exam-form-implementation-plan.md)를 따른다.

앱·DB와 연결되지 않는 오프라인 분석 도구다. 결과와 한계는 [분석 보고서](../../docs/past-exam-form-analysis.md)를 따른다. 후보 JSON을 운영 데이터로 직접 가져오지 않는다.

필요 도구: Python + `pdfplumber`, `pypdf`, `Pillow`, Node + 저장소의 `tsx`, macOS Swift·PDFKit·Vision. 이번 작업은 Codex 번들 Python을 사용했다. 시스템 Python에 해당 패키지가 없으면 번들 Python을 지정한다. 앱 의존성은 수정하지 않는다.

## 작업 캐시

완료한 캐시는 `output/analysis/past-exam-forms/cache/`에 보존한다. `direct/`는 PDF 텍스트 또는 페이지 OCR의 문항 분할 자료, `ocr/`는 기존 추리논증 문항 이미지 OCR, `pdf-ocr/`는 2022~2023 짝수형 70쪽의 좌표 자료다. 원본 언어이해 홀수형 JSON·PNG는 기존 `output/markdown/`·`output/images/`를 사용한다. 원본 해시가 변하면 새 캐시 경로에서 재추출한다.

```sh
ANALYSIS_PYTHON=/Users/jongeunkim/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3
ANALYSIS_CACHE=output/analysis/past-exam-forms/cache
"$ANALYSIS_PYTHON" scripts/past-exam-form-analysis/analyze.py \
  --cache "$ANALYSIS_CACHE" --output output/analysis/past-exam-forms
"$ANALYSIS_PYTHON" scripts/past-exam-form-analysis/verify.py \
  output/analysis/past-exam-forms/mapping-candidates.json
"$ANALYSIS_PYTHON" scripts/past-exam-form-analysis/report.py
```

`source-reviews.json`에는 실제 원본 확인한 대응만 기록한다. 검수 기록의 반영만 필요하면 기존 완전한 후보를 재사용할 수 있다.

```sh
"$ANALYSIS_PYTHON" scripts/past-exam-form-analysis/analyze.py \
  --cache "$ANALYSIS_CACHE" --output output/analysis/past-exam-forms --reuse-candidates
```

그 후 반드시 `verify.py`와 `report.py`를 재실행한다. 원본의 변경이나 추출 로직의 변경에는 `--reuse-candidates`를 사용하지 않는다.

## 언어이해 선지 재검수

2026-10-11 재검수는 이전 변경 107문항과 미확정 90문항의 원본 선지 영역을 양쪽으로 렌더해 직접 비교했다. `verbal_recheck.py`는 비교 이미지만 만들며 순열을 결정하지 않는다. `evidence/verbal-recheck/before.json`이 있으면 최초 197문항 검수 범위를 유지한다. 결과를 반영한 뒤에도 같은 비교 자료를 재현하기 위한 동작이다.

```sh
"$ANALYSIS_PYTHON" scripts/past-exam-form-analysis/verbal_recheck.py --scope targeted
"$ANALYSIS_PYTHON" scripts/past-exam-form-analysis/verify_verbal_recheck.py
```

렌더에는 도구 파일의 `POPPLER` 경로에 지정된 `pdftoppm`이 필요하다. 실제 눈으로 확인한 결과만 `observations.json`과 `source-reviews.json`에 기록한다. 원본 대조 기록에는 PDF 해시·쪽수·비교 이미지·이전 상태를 남겼다. 새로운 PDF로 교체하면 이전 PNG 캐시와 검수 판정을 재사용하지 않는다.

`verify_verbal_recheck.py`는 기록된 검수 범위, 원본 해시, 언어이해 전체 635문항의 왕복 변환·현재 정답표와의 교차검사·CSV 일치를 확인하고 `verbal-choice-review.md`와 `verification.json`을 생성한다. 검증 도구가 원본을 읽고 시각적 판단을 자동 생성하는 것은 아니다. 판정 반영 뒤 이 도구도 재실행한다.

## 全再抽出の手順

1. 新規の作業ディレクトリを作り、現時点の正解・分野カタログを保存する。秘密の環境変数やユーザー履歴を出力しない。

```sh
mkdir -p /private/tmp/leet-form-analysis-new
node --import tsx -e 'const {ANSWER_DATA}=require("./src/utils/answerData.ts");require("node:fs").writeFileSync("/private/tmp/leet-form-analysis-new/answers.json",JSON.stringify(ANSWER_DATA))'
swiftc -module-cache-path /private/tmp/leet-form-analysis-new/swift-cache \
  scripts/past-exam-form-analysis/ocr_images.swift -o /private/tmp/leet-form-analysis-new/ocr-images
swiftc -module-cache-path /private/tmp/leet-form-analysis-new/swift-cache \
  scripts/past-exam-form-analysis/ocr_pdf.swift -o /private/tmp/leet-form-analysis-new/ocr-pdf
```

2. 09예비~2023 추리논증 홀수형의 기존 PNG 595개 절대 경로 목록을 JSON 배열로 만든다.

```sh
"$ANALYSIS_PYTHON" - <<'PY'
import json
from pathlib import Path
files = sorted(str(p.resolve()) for p in Path('output/images/reasoning-odd').glob('LEET-*/LEET-*-Q*.png')
               if not any(f'-{year}-' in p.name for year in (2024, 2025, 2026, 2027)))
assert len(files) == 595
Path('/private/tmp/leet-form-analysis-new/images.json').write_text(json.dumps(files))
PY
/private/tmp/leet-form-analysis-new/ocr-images \
  /private/tmp/leet-form-analysis-new/images.json /private/tmp/leet-form-analysis-new/ocr
```

3. 텍스트 레이어가 없는 짝수형 PDF 네 개를 두 단으로 나누어 OCR한다.

```sh
for ANALYSIS_YEAR in 2022 2023; do
  for ANALYSIS_SUBJECT in verbal reasoning; do
    /private/tmp/leet-form-analysis-new/ocr-pdf \
      "output/pdf/LEET-${ANALYSIS_YEAR}-${ANALYSIS_SUBJECT}-even.pdf" \
      "/private/tmp/leet-form-analysis-new/pdf-ocr/LEET-${ANALYSIS_YEAR}-${ANALYSIS_SUBJECT}-even"
  done
done
"$ANALYSIS_PYTHON" scripts/past-exam-form-analysis/extract.py \
  --cache /private/tmp/leet-form-analysis-new/direct --workers 3
```

4. `analyze.py --cache /private/tmp/leet-form-analysis-new --output <새 결과 경로>` 후 원본 해시·1,350행·38조합 검증과 요약 생성을 실행한다. `report.py`는 현재 고정 출력 경로의 완전한 결과를 읽으므로 다른 경로를 이용할 때는 검증 후 보고서 생성 범위를 명시적으로 조정한다.

OCR에는 오독이 있다. `review_issues`를 실제 문제 차이나 정답 오류로 해석하지 않는다. 표·그림·밑줄·기호를 추정해 보완하지 않으며, 원본 확인 기록 없이 후보를 확정값으로 올리지 않는다.

## 전 문항 원본 검수

`full_recheck.py`는 1,350문항 쌍의 본문·보기·다섯 선지를 원본에서 렌더한다. 공유 지문 전체는 별도 영역이므로 전수 검수 범위에 포함하지 않는다. `evidence/full-recheck/before.json`은 전수 검수 시작 전 대응표를 보존한다. 실제 대조한 번호만 `record_full_review.py --accept <시트 번호> --overrides '<문항 키별 순열 JSON>'`으로 기록한다. 원래 순열이 비어 있던 문항에는 눈으로 확인한 순열을 명시해야 한다. 이미지를 생성하는 것만으로 검수 완료로 판정하지 않는다.

이번 검수는 `compact-manifest.json`의 1,217시트를 모두 대조한 `observations.json`에 기록했다. 초기 렌더 목록과 이전 212문항의 검수 기록은 같은 근거 폴더에 보존한다. `source-reviews.json`은 최종 1,350문항 기록이다. 최종 결과는 원본·검수 기록을 바꾸지 않는 다음 검증으로 확인한다.

```sh
"$ANALYSIS_PYTHON" scripts/past-exam-form-analysis/verify_full_recheck.py
```

이 도구는 전 문항·원본 해시·비교 이미지 범위·최종 순열·왕복 변환·현재 정답표·CSV 일치를 검사하고 `full-source-review.md`와 `evidence/full-recheck/verification.json`을 생성한다. 원본 이미지에 대한 판단을 대신하지 않는다. 재검수된 대응이 이전과 달라졌을 때의 차이도 기록한다. 후속 전수 검수 뒤 `verify_verbal_recheck.py`는 최초 197문항 관찰의 보존 여부와 현재 언어이해 635문항 계약을 함께 확인한다.
