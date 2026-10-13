# 공통 문항 통계 v2 구현·운영 절차

2026-10-12 로컬 구현. 운영 migration 적용·카탈로그 등록·통계 발행·Edge/웹 배포·push는 실행하지 않았다. 기존 v1 테이블·발행본은 그대로 유지한다. 정책과 검수 근거는 [확정 설계](past-exam-form-implementation-plan.md)를 따른다.

## 기준과 화면

09예비 및 2009~2026의 38개 학년도·과목, 1,350공통 문항을 지원한다. 기존 짝수형 번호 기반 ID를 고정하고 홀수형 번호·선지를 명시적 순열로 연결한다. 2027 단일 문형 채점은 유지하며 통계 범위에는 포함하지 않는다.

검수 원천은 `scripts/data/question-registry-reviewed.json`이다. `npm run registry:generate`가 공유 `questionRegistry.generated.ts`, DB 등록용 `question-statistics-catalog-v2.json`, 원본 해시 provenance를 함께 생성한다. `registry:check`는 생성 파일·번호/선지 순열·정답 일치를 검사하며 CI에서 원본 PDF/OCR 없이 실행한다. 원본 PDF가 있는 검수 환경은 `npm run registry:check -- --verify-sources`로 76개 PDF 해시도 확인한다. 분석용 원문·이미지는 앱에 포함하지 않는다. 정답은 기존 공유 answerData에서 생성한다. 분야 버전은 과거 기준 분야표와 2027 분야표의 해시로 생성하며 통계 대응/정답/카탈로그 버전과 독립적이다. 분야만 변경하면 통계 카탈로그와 분포를 무효화하지 않는다.

공개 `CanonicalStatistics`는 공통 순서이며 `projectFormStatistics`가 실제 문형의 문항·선지·정답을 함께 투영해 `FormStatisticsView`를 만든다. 브라우저 버튼·모달·정답표·JS 없는 HTML이 같은 변환을 사용한다. 양 문형의 같은 문제는 같은 표본·정답률을 사용하고 선택률은 현재 문제지의 순서다. 5분 캐시와 포커스 재조회·표시 설정·정답표 호환 검사·오류 재시도를 유지한다. 문형/세대 변경 시 분포 모달만 초기화하며 답안 편집은 재마운트하지 않는다.

화면에 긴 통합 설명을 추가하지 않는다. 기존 짝수형 전용 다회독 안내를 제거하고 분포 설명의 ‘전체 채점 기록’을 ‘답안이 저장된 풀이 기록’으로 정정했다. 0표본은 —, 30건 이하 경고는 합산 표본 기준이다. 개인 정답·메모·점수는 통계 미가용 상태에서도 제공한다. 통계 기준 불일치는 개인 정답표 불일치와 구분해 안내한다. 새 앱은 v1로 fallback하지 않는다.

## 표본과 감사

`question-statistics-v2-source.sql` 한 문장이 KV를 한 MVCC 스냅샷에서 읽는다. DB 밖으로 개인 ID·개별 답안을 내보내지 않는다. 같은 사람의 반복 풀이도 저장 기록마다 센다.

- 범위 안 정상 답안 객체: 포함. 일부 키 누락/null/0과 빈 객체는 미응답이다.
- 정상 메타데이터에 답안 객체 전체 누락/null: 제외하고 내부 감사에 건수를 남긴다.
- 정상 2027: 범위 밖 제외. 존재하는 답안이 손상됐으면 invalid다.
- 알 수 없는 조합·문항 수·키/값·배열/스칼라 답안·이력 배열 손상: 발행 중단.

`source_count = included_count + excluded_out_of_scope_count + excluded_missing_answers_count + invalid_count`, 전체 표본 합계는 included_count, 각 문항의 5개 선택+미응답은 묶음 표본 수다. 저장 correct/correctAnswers 불일치 자체는 정상 답안의 통계 제외 이유가 아니다. 현재 승인 정답으로 계산하며 첫 풀이 통계는 추가하지 않았다.

## DB와 권한

로컬 migration: `20261012122322_canonical_question_statistics_v2.sql`. 신규 private 카탈로그·발행 감사와 public 스냅샷·포인터를 추가한다. 기존 v1/KV를 수정하지 않는다. 모두 RLS를 활성화하고 공개 역할에는 현재 포인터와 현재 세대 SELECT만 허용한다. private 데이터·과거 세대·쓰기·발행/롤백 실행 권한은 없다. 별도 service role·Edge Function·Cron·저장 트리거는 추가하지 않는다.

개발자 전용 private SECURITY INVOKER 함수는 승인된 불변 카탈로그, 안전 정수·정확한 전체 조합/문항/정답·분포 합계·건수 분할·정렬 JSON SHA-256을 검사한다. 카탈로그 등록/발행/롤백은 같은 transaction advisory lock을 사용한다. 38개 행·감사·포인터를 한 트랜잭션으로 저장하고 예상 현재 세대가 달라지면 중단한다. 재실행은 같은 현재 파일만 idempotent하며 과거 파일은 명시적 rollback이 필요하다. 카탈로그 payload는 변경/삭제 불가다. 오류로 revoked_at이 설정된 카탈로그는 발행·롤백을 거절한다. 과거 카탈로그와 정답을 보존한다.

## 최초 운영 전환 (별도 명시적 요청 필요)

로컬·원격 이력 불일치가 있으므로 전체 `db push`를 하지 않는다. 신규 파일·대상 객체·권한·migration 이력을 재대조한 뒤 이 migration만 적용하고 해당 이력을 같은 트랜잭션으로 기록한다. 이후 다음 순서를 따른다. 관리 토큰은 CLI 환경에서만 사용하며 브라우저/빌드에는 넣지 않는다.

```sh
npm run registry:check
npm run statistics:v2 -- register-catalog --confirm-project jkxxtyaanyhmjbdtybkp --operator '수행자' --reason '검수 대응표와 승인 정답 등록'
npm run statistics:v2 -- status
npm run statistics:v2 -- prepare --out /private/tmp/leet-statistics-v2-review.json
```

등록은 DB 쓰기다. prepare는 승인된 서버 카탈로그와 현재 생성물을 먼저 비교하고 읽기 전용으로 집계한다. 파일은 새 경로에 0600으로 생성하며 기존 파일을 덮어쓰지 않는다. HEAD revision·카탈로그/대응/정답/집계 버전·원본 시각·전체 건수·제외 건수·38묶음/1,350ID·문항별 합계·체크섬을 검토한다. 수정한 파일은 발행하지 않는다.

```sh
npm run statistics:v2 -- publish --file /private/tmp/leet-statistics-v2-review.json --confirm-project jkxxtyaanyhmjbdtybkp --expected-current none --operator '수행자' --reason '최초 공통 정답률 발행'
```

첫 발행만 none을 사용하고 이후에는 status의 실제 ID를 지정한다. 응답 유실 시 status를 먼저 확인한다. 공개 anon/auth 조회·현재 세대·대표 홀짝 문항/선지·제외 건수·v1 조회 유지를 검증한 뒤 새 웹/HTML을 빌드·배포한다. 공유 채점 함수가 바뀌므로 관리자 재계산과 이력 답안 수정에 사용하는 Edge들도 같은 코드로 배포해야 한다(`make-server-cd835c22`, `admin-user-data`). 이 작업에서 운영 배포는 실행하지 않았다.

정상 이전 v2가 있으면 검증된 ID로 rollback한다. 폐기 카탈로그·불완전/손상 세대는 거절한다. 최초 v2가 실패하면 웹 전환을 진행하지 않고 기존 앱/v1을 유지한다.

```sh
npm run statistics:v2 -- rollback --snapshot-id ID --confirm-project jkxxtyaanyhmjbdtybkp --expected-current CURRENT_ID --operator '수행자' --reason '롤백 사유'
```

v1은 구버전 탭/PWA를 위해 동결 보존한다. 갱신된 앱은 v2만 사용하며 강제 로그아웃·개인 기록 변경은 없다. `LegacyFormStatistics`는 오프라인 비교용으로 유지한다. 구버전 집계에서 답안 객체 누락 제외를 복원할 수 없으므로 v1을 단순 합산해 운영 v2로 발행하지 않는다.

## 검증

`npm run test:statistics`는 운영 자격증명/네트워크 없이 PGlite에서 실제 migration/source/publish/rollback/RLS를 검사한다. `npm run check`에는 레지스트리, 단위·Edge·격리 SQL·모의 화면·fixture HTML 검증과 마지막 운영 공개 GET 빌드가 포함된다. CI에는 원본 PDF·운영 토큰이 필요하지 않다.

`e2e/fixtures/question-statistics-v2.json`은 동결된 2026 v1 공개 집계를 검수 대응표로 변환한 **오프라인 비교 fixture**이며 다른 묶음은 0표본이다. `scripts/generate-statistics-test-fixture.ts`로 재생성한다. 누락 답안 제외를 복원하지 못하며 발행용 파일이 아니다. `build:test` 결과를 배포하지 않는다. 마지막 `npm run build`는 v2 공개본만 읽고, 테이블 미설치/미발행은 통계 미가용 HTML을 만든다. 네트워크·일반 HTTP 오류·부분/혼합 세대·깨진 합계에는 빌드를 실패시킨다.

2026-10-12 실제 새 source SQL의 읽기 전용 확인: 5,717개 기록 모두 포함, 정상 제외/invalid/손상 이력 0건, 38묶음/1,350ID 검증. [집계 검증 근거](../output/analysis/past-exam-forms/evidence/v2-implementation-read-only-2026-10-12.json). 개인 답안·ID를 보관하지 않았고 승인 카탈로그 등록·발행은 하지 않았다.


## 2026-10-12 완료 검증 기록

- `npm run check` 전체 통과: lint 오류 0건(기존 경고 52건), typecheck, Vitest 33파일/290개, Edge 122개·사용자 데이터 21개·analytics 10개·push 12개 및 관련 격리 SQL, push 화면 13개, 일반 화면 95개, fixture HTML 화면 10개. 생성 레지스트리와 v2 SQL/RLS 검사도 품질 게이트에 포함됐다.
- 이후 최종 검토 보강: 분야 버전을 독립 해시로 생성, v1 범위 명시 동결, 공개 items의 추가 항목 차단, 카탈로그 숫자 형식 검증, 비자기역순열 source SQL, CLI 파일 검증 및 폐기 카탈로그 재승인 거절을 확인했다. 관련 단위 6파일/47개와 v2 SQL·typecheck·lint를 재검증했다.
- 통계 기준 불일치 안내를 개인 정답표와 분리한 최종 변경은 UI 단위 16개·모의 화면 1개로 확인했다. 빠른 문형 전환·늦은 응답·열린 모달 초기화·미지원 카탈로그·개인 답안 유지가 포함된다.
- 과거 홀수형 분야 보정 후 답안 수정은 화면에 새 분야를 표시하면서 PUT expected에는 원본 전체 JSON을 보내는 실제 모의 흐름으로 확인했다. 원본 시각·묶음·회독·다른 과목·메모를 보존했다.
- 76개 원본 PDF 해시를 포함한 `registry:check -- --verify-sources` 통과. 운영에는 v2 테이블/발행본이 없으므로 마지막 실제 공개 GET 빌드는 통계 0묶음의 미가용 상태로 83개 공개 HTML을 생성했다. 테스트 빌드의 합산 fixture는 최종 산출물에 남기지 않았다.
- 운영 DB 쓰기·발행·배포·commit·push 없이 완료했다. 빌드가 추적 중인 build/index.html 및 번들 산출물을 갱신하므로 소스 커밋과 분리해 확인한다. 배포 순서는 신규 DB → 카탈로그/통계 → 공유 채점 Edge → 웹/HTML이다. 웹을 먼저 전환하면 v2 정답률은 미가용 상태다.
