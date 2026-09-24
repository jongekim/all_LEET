# 문항 통계 수동 갱신 가이드

## 전제와 대상

자동 갱신은 없다. 기존 KV를 그대로 두고 개발자가 집계 파일을 검토·발행한다. 계산·공개 규칙과 데이터 모델은 [설계 문서](question-statistics-design.md)를 따른다.

현재 프로젝트는 `jkxxtyaanyhmjbdtybkp`다. 아래 환경 변수는 개발자 터미널에만 설정하고 `.env`·Git·브라우저 코드·채팅 출력에 액세스 토큰을 넣지 않는다.

- `SUPABASE_PROJECT_REF`: 위 프로젝트 ref
- `SUPABASE_ACCESS_TOKEN`: 해당 프로젝트에 SQL 관리 권한을 가진 개발자의 Supabase Personal Access Token

service role 키를 사용하지 않는다. Management API query 권한이 없는 계정으로는 발행할 수 없다. 프로젝트를 바꿀 때에는 도구의 고정 대상과 DB 함수의 대상 검증도 함께 검토·수정해야 한다.

## 최초 상태

2026-09-17 적용한 마이그레이션: `supabase/migrations/20260917075220_question_statistics.sql`. 최초 발행 ID는 `1`, 76조합/5,716건이다. 같은 마이그레이션을 운영 DB에 재실행하지 않는다.

기존 로컬·원격 마이그레이션 목록이 불일치하므로 `supabase db push`로 모든 대기 파일을 일괄 적용하지 않는다. 새 환경에서는 기존 private 스키마/Supabase 역할을 포함한 기반 구조를 먼저 확인하고 이 마이그레이션을 검토·적용한다. 로컬 SQL 단위 검증은 아래 격리 테스트를 사용한다.

## 1. 현재 발행 확인 (읽기 전용)

```sh
npm run statistics -- status
```

`snapshot_id`, `released_at`, `source_snapshot_at`, 전체 `source_count`, `cohorts=76`을 확인한다. 아직 발행본이 없으면 배열이 비어 있다. 첫 발행에만 `expected-current none`을 사용한다.

## 2. 파일 생성 (읽기 전용)

```sh
npm run statistics -- prepare --out /private/tmp/leet-question-statistics-review.json
```

파일은 개인정보 없는 집계 결과·정답표·원본 조회 시각·HEAD revision·집계 규칙 버전·SHA-256 체크섬을 포함한다. 이미 있는 파일은 덮어쓰지 않으므로 새 파일명을 쓴다. macOS가 아닌 환경에서는 사용 가능한 안전한 로컬 경로를 지정한다. 작업 트리 변경은 HEAD revision에 포함되지 않으므로 갱신 도구/규칙 변경이 있다면 검토·커밋한 버전에서 생성하는 것이 좋다.

prepare 오류 시 발행하지 않는다. 부분 답안/미응답은 정상 데이터로 포함하지만 잘못된 구조·미지원 시험·범위 밖 선지/문항 키는 임의 변환·제외하지 않는다. 원인을 확인하고 별도 승인 아래 원본/규칙을 정리한 뒤 파일을 다시 생성한다.

## 3. 개발자 검토

반드시 다음을 확인한다.

1. 대상 프로젝트, 집계 규칙 `all_saved_records_v1`, 원본 조회 시각과 적용할 코드 revision이 맞는가?
2. 76개 조합과 모든 문항이 있는가? `source_count = included_count = 각 조합 sample_count 합계`, 격리·잘못된 이력 배열 0건인가?
3. 각 문항의 5개 선택 건수 + 미응답 건수 = 전체 표본인가? 0건·30건 이하를 의도적으로 숨기지 않았는가?
4. 이전 발행과 달라진 표본 수, 미응답 비중, 대표 문항 분포가 예상 가능한가? 필요하면 이전 파일과 비교한다.
5. 정답표 변경이 있었다면 현재 프론트엔드와 호환되는가? 내용 지문이 달라지면 구버전 화면은 통계를 숨긴다. 앱 배포와 집계 발행 순서를 검토한다.

검토 파일은 수정하지 않는다. 수정·정답 변경 후에는 prepare를 다시 실행한다. 파일 생성 이후의 추가 채점 기록은 이번 파일에 포함되지 않는다. 기간 만료로 자동 재집계하지 않는다.

## 4. 전체 발행 (DB 쓰기)

status에서 현재 ID가 `1`일 때의 예:

```sh
npm run statistics -- publish --file /private/tmp/leet-question-statistics-review.json --confirm-project jkxxtyaanyhmjbdtybkp --expected-current 1 --operator '개발자 이름' --reason '갱신 사유'
```

`expected-current`에는 **방금 확인한 실제 ID**를 지정한다. 위 예의 `1`을 영구 고정하지 않는다. operator/reason은 감사 이력으로 남는다.

발행 함수가 76개 조합을 한 트랜잭션으로 검증·저장하고 포인터를 바꾼다. 오류/동시 발행/예상 세대 불일치 시 기존 공개본이 유지된다. 세대가 바뀌었다는 오류를 단순히 최신 ID로 바꿔 재시도하지 말고 다른 개발자의 발행 사유와 파일을 확인한다.

응답이 끊긴 경우 먼저 status를 확인한다. 같은 파일이 이미 현재 발행본이면 재시도는 새 세대를 만들지 않고 `already_published=true`를 반환한다. 이미 보존된 과거 파일은 publish로 다시 덮어쓰지 않으며 rollback을 사용한다.

## 5. 적용 후 검증

publish/rollback 도구는 마지막에 status를 다시 읽는다. 실패 시 DB 변경을 되돌렸다고 가정하지 말고 별도로 status를 실행한다.

- 현재 ID·76조합·전체 표본 수·원본 조회 시각을 파일과 비교한다.
- 비로그인 정답표를 새로고침해 대표 문항의 6개 퍼센트 분포를 파일에서 계산한 비율과 비교한다. 결과·대화형 정답표에는 실제 채점 기록 수·선지별 응답 건수를 표시하지 않는다. 검색용 정적 요약에는 발행일과 조합별 표본 수를 표시한다.
- 결과/정답표와 응답 분포 모달에 집계 일자가 노출되지 않는지 확인한다. 짝수형에는 "짝수형은 다회독 데이터가 많아 실제 정답률보다 높게 나타나는 경향이 있습니다."라는 안내가 있고 홀수형에는 없는지 확인한다. 30건 이하 경고는 이 안내와 별도로 유지한다.
- 30건 **이하** 경고, 31건 경고 없음, 미응답 비율과 오답 포함을 확인한다.
- 답안/정답/메모/PDF/환산표·접기·시험 선택이 그대로 동작하는지 읽기 전용으로 확인한다.
- `anon`/`authenticated`의 SELECT만 허용되며 이전 세대·private 이력 조회와 공개 쓰기/발행 RPC가 허용되지 않는지 권한을 확인한다.

화면 캐시는 5분이다. 즉시 확인하려면 새로고침한다. 로그인이나 채점 기록 저장을 위해 운영 서버에 테스트 쓰기를 발생시키지 않는다.

## 문제 시 롤백 (DB 쓰기)

현재 ID가 `2`, 검증된 이전 ID가 `1`일 때의 예:

```sh
npm run statistics -- rollback --snapshot-id 1 --confirm-project jkxxtyaanyhmjbdtybkp --expected-current 2 --operator '개발자 이름' --reason '롤백 사유'
```

완전한 보존 발행본으로 포인터만 바꾼다. 원본·DB 구조·개인 메모·집계 파일을 삭제하지 않는다. 이전 정답 버전이 현 앱과 다르면 화면은 통계를 숨기므로 호환성도 확인한다. 최초 발행 전으로 비우는 기능이나 보존본 자동 삭제는 구현하지 않았다.

## 개발 검증

작업 중에는 수정 범위에 맞는 단위 테스트와 `npm run check:quick`으로 확인한다. 전체 E2E를 포함한 `npm run check`는 웹앱 배포 직전에 실행한다.

Vitest: 실제 집계 예시, 파일 무결성·76조합·미응답/합계, 0/1/30/31건 안내, 오류 상태, 정답 보기·메모 동작 분리. Playwright: 모든 Supabase 요청을 모의 처리한 정답표/결과 흐름, 재시도, 포커스, 시험 선택, 320/390/1280px 모달 화면 검증.

Docker/Postgres가 없는 환경에서도 **임시 폴더**에 PGlite를 고정 버전으로 설치해 격리 SQL 검증을 실행할 수 있다. 앱 의존성에는 추가하지 않는다.

```sh
npm install --prefix /private/tmp/leet-sql-check --save-exact @electric-sql/pglite@0.3.14
PGLITE_MODULE=/private/tmp/leet-sql-check/node_modules/@electric-sql/pglite/dist/index.js node_modules/.bin/tsx scripts/test-question-statistics-sql.ts
```

테스트는 네트워크/운영 자격증명을 사용하지 않는 메모리 PostgreSQL에 마이그레이션을 적용한다. 부분 답안·미응답, 실제 집계 SQL, 원자적 검증 실패, 중복 발행, CAS, 롤백, anon/authenticated의 현재 세대 조회·이전 세대 비공개·쓰기/함수 실행 차단을 확인한다.

새 학년도·문항 수·집계 규칙을 추가할 때에는 도구의 카탈로그와 DB 함수의 지원 범위/76조합 검증을 함께 갱신하고 마이그레이션·테스트·문서를 추가한다. 원본 KV 정규화, 이력 API 인증 개선은 별도 과업이다.
