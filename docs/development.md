# 개발 가이드

채점 후 답안 수정은 [구현·검증·운영 적용 순서](answer-edit.md)를 따른다. `test:user-data`의 격리 SQL 검사와 Edge/단위/E2E가 인증·충돌·응답 유실·같은 회독 보존을 검증한다. 명시적 배포 요청 범위에서 신규 migration → 이력 Edge → 웹 순서로 적용한다. v1.11.0은 [운영 적용 기록](answer-edit-rollout.md)을 참고한다.

결과 화면의 분야 요약·문항 이동·정답률 표시 설정은 [결과 분석 UI](result-analysis.md)를 따른다. `FieldAnalysis.test.tsx`와 `QuestionStatistics.test.tsx`의 단위 검사, `e2e/field-analysis.spec.ts`의 1280/390/320px 화면 검사는 운영 요청을 모킹하여 펼침·포커스·초안 보존·반영 후 재계산·브라우저 설정 기억과 기출 정답표의 기존 동작을 확인한다.

## 명령어

| 목적 | 명령 |
|---|---|
| 의존성 설치 | `npm install` |
| 개발 서버 | `npm run dev` |
| lint | `npm run lint` |
| 타입 검사 | `npm run typecheck` |
| 테스트 1회 실행 | `npm run test` |
| 테스트 감시 실행 | `npm run test:watch` |
| 이력 Edge Function 타입·보안 회귀 검사 | `npm run test:edge` (Deno 2.9.5) |
| 관리자 사용자 데이터 SQL·Edge 회귀 검사 | `npm run test:user-data` |
| 읽기 전용 화면 E2E 테스트 | `npm run test:e2e` |
| Playwright UI 모드 | `npm run test:e2e:ui` |
| 프로덕션 빌드·공개 HTML 생성 | `npm run build` |
| 운영 DB 없이 고정 공개 통계 파일로 HTML 검증 빌드 | `npm run build:test` |
| 빌드 HTML·자바스크립트 없는 화면 검증 | `npm run test:prerender` |
| 기출 선택 HTML 배포 라우팅 갱신 | `npm run prerender:routes` |
| 전체 품질 게이트 | `npm run check` |
| 디데이 설정 SQL·RLS 격리 검사 | `npm run test:schedule` |
| 서비스 버전 일치 검사 | `npm run version:verify` |
| 기출문제 URL 사이트맵 갱신 | `npm run sitemap:generate` |
| PATCH / MINOR / MAJOR 릴리스 준비 | `npm run release:patch` / `npm run release:minor` / `npm run release:major` |
| 예시 이력 생성 | `npm run gen:example-history` |
| 예시 이력 시드 | `npm run seed:example-history` |
| 문항 통계 생성/발행/확인/롤백 | `npm run statistics -- prepare/publish/status/rollback ...` |

Vite 개발 서버 포트는 `vite.config.ts`에서 `3000`으로 설정되어 있다. 빌드 산출물은 `build/`다.
저장소의 `.npmrc`는 기존 `@jsr` 의존성을 공식 `https://npm.jsr.io`에서 설치하도록 지정한다. 개인 npm 설정이 없는 CI에서도 같은 패키지를 설치하기 위해 필요하며, 의존성 버전을 변경하지 않는다.
읽기 전용 화면 E2E는 개발 서버의 초기 렌더링이 병렬 부하로 지연되지 않도록 Playwright 워커 두 개로 실행한다.
디데이 저장 후 비로그인 화면 반영 검사는 별도 브라우저 컨텍스트의 서비스워커를 차단한다. 첫 설치 controllerchange 새로고침과 연속 페이지 이동의 경합을 피하며, 푸시·서비스워커 동작은 해당 전용 테스트에서 검증한다.

SEO 경로를 변경할 때는 `src/utils/pageSeo.ts`의 공유 메타데이터 정의와 `src/public/sitemap.xml`을 함께 확인한다. 사이트맵에는 검색에 노출할 공개 경로만 넣고, 확인할 수 없는 `lastmod`는 기록하지 않는다. 게시글 메타데이터는 기존 게시글 조회 결과를 사용하며 별도의 서버 요청을 추가하지 않는다.
기출문제 메타데이터는 선택한 학년도·과목·문형을 기준으로 설정한다. 쿼리 매개변수의 순서나 불필요한 매개변수가 달라도 canonical은 `year`, `subject`, `type` 순서의 유효한 선택 URL이어야 한다. `npm run sitemap:generate`는 등록된 문제지마다 하나의 선택 URL을 생성하며, 2027학년도 단일 문형은 `type=odd` 하나만 사용한다.
내부 이동 요소를 수정할 때는 홈 바로가기·하단 메뉴·게시글 제목의 실제 `href`와 기존 경로 이동을 함께 확인한다.

## 배포 안전 규칙

`main` 브랜치에 push하면 실서비스 배포가 시작되는 운영 구조다. 따라서 Codex와 개발자는 명시적인 배포 의도 없이 `main`에 직접 push하지 않는다. 가능한 경우 pull request를 만들고 GitHub Actions의 `Quality checks`가 통과한 뒤 병합한다.

서비스 버전과 배포 절차는 [versioning.md](./versioning.md)를 따른다. 배포를 일으키는 모든 `main` push 전에는 변경 영향에 맞게 `npm run release:patch`, `npm run release:minor`, `npm run release:major` 중 하나를 실행해 버전을 올린 뒤, `npm run version:verify`와 `npm run check`를 통과시킨다. 버전 변경은 배포할 변경과 같은 커밋 또는 PR에 포함한다.

직접 push가 불가피할 때도, push 전에 반드시 로컬에서 `npm run check`를 통과시킨다. 이 명령의 성공은 품질 검증일 뿐 Supabase 권한, 외부 서비스, 운영 데이터의 안전을 보장하지 않으므로, 해당 영역 변경에는 별도 검증이 필요하다.

Codex는 기능 구현, 문서 정리, 검증 설정처럼 독립적으로 검토 가능한 작업 단위가 끝날 때마다 커밋·push를 권장할지 판단해 알린다. 권장에는 변경 요약, 수행한 검증, `main` 배포 위험을 포함한다. 다만 권장은 push 실행 권한이 아니며, Codex는 사용자의 명시적 요청이 있을 때만 push한다. 운영 영향이 없는 문서 변경도 `main` push는 배포를 유발하므로 동일한 원칙을 적용한다.

GitHub에서 `main` 브랜치 보호 규칙을 설정해 `Quality checks`의 성공을 병합 필수 조건으로 지정해야 PR 검증이 실제 배포 게이트가 된다. 이 설정은 저장소 파일만으로 강제할 수 없는 GitHub 저장소 설정이다.

## 화면 수준 검증 정책

로컬 앱도 현재 운영 Supabase 프로젝트에 연결되므로, 화면 수준 검증은 기본적으로 읽기 전용으로 수행한다.

- 허용: 공개 화면·목록·상세 조회, 페이지 이동, 로그인 화면 진입, 폼 입력, 클라이언트 유효성 검사, 모달 열기/닫기, 이미지 선택과 미리보기, 제출 직전의 버튼 상태 확인
- 금지: 회원가입 완료, 로그인 완료, 저장, 제출, 수정 저장, 삭제 확정, 좋아요, 신고, 채팅 전송, 이미지 업로드처럼 서버 상태를 바꾸는 모든 실행
- 쓰기 기능은 입력값과 유효성 메시지, 제출 버튼 활성화 상태를 확인한 뒤 실제 요청을 만들기 전에 멈춘다.

서버 쓰기가 필요한 통합 검증은 운영 데이터와 분리된 Supabase 환경 또는 명시적으로 승인된 테스트 계정·테스트 데이터가 마련된 경우에만 수행한다.

`e2e/history-security.spec.ts`는 모든 Supabase 요청을 Playwright 모의 응답으로 처리한 뒤 저장 실패 흐름을 검사한다. 운영에 연결된 일반 로컬 앱에서는 같은 저장 버튼을 누르지 않는다. Edge 테스트는 네트워크·환경 변수 권한 없이 가짜 KV와 Auth 응답만 사용한다. 실제 서비스 연동과 운영 데이터 검증을 대체하지 않는다.

## 테스트·lint·타입 검사

- lint: ESLint 10 flat config가 `src/`, `scripts/`, Vite/Vitest 설정 파일을 검사한다. Deno 전용 Edge Function 소스는 이 Node 기반 lint 범위에서 제외된다. 기존 코드의 `any`, 미사용 식별자, Hook 규칙 위반과 effect 내 동기 상태 갱신은 현재 경고로 보고하며, 별도 안정화 작업으로 오류 수준으로 올려야 한다.
- typecheck: `tsconfig.json`이 프론트엔드와 스크립트를 strict 모드로 검사한다. Deno 전용 `src/supabase/functions/`는 제외된다.
- test: Vitest + jsdom + Testing Library를 사용한다. 현재 D-day 계산의 회귀 테스트가 포함되어 있다.
- 화면 E2E: Playwright Chromium이 `e2e/`의 공개 읽기 전용 흐름을 실행한다. 로컬 최초 실행 전에는 `npx playwright install chromium`으로 브라우저를 설치한다.
- CI: `.github/workflows/quality.yml`은 pull request와 수동 실행에서 Node 20.19.0과 Deno 2.9.5로 lint, typecheck, unit test, Edge 타입·보안 테스트, 화면 E2E, `build:test`와 HTML 검증을 실행한다. HTML 테스트는 고정 공개 집계 파일을 사용하여 운영 DB에 접근하지 않는다. lockfile의 설치 전략에 맞춰 `npm ci --legacy-peer-deps`를 사용한다. `main` push 이후가 아니라 PR 단계에서 실패를 발견하도록 구성했다.

기출문제 78개는 Supabase Storage의 워터마크 PDF를 직접 참조하므로 빌드에 PDF·HWP를 복사하지 않는다. 이전 정적 원본은 `downloads/past-exams-original-archive/`에 보존하며, `downloads/`의 원본·ZIP은 git에서 제외한다. 공개 파일 URL·등록 목록·검증 기록은 버전 관리한다. 문제지 정정 시 기존 파일을 덮어쓰지 않고 새 Storage 버전 경로로 등록한다. [등록 절차](past-exams.md)를 따른다.

`output/`의 가공 PDF도 중복 바이너리 산출물이므로 git에서 제외하고, 파일 목록·해시·변환 및 Storage 업로드 기록은 버전 관리한다. 워터마크 PDF 78개의 보관 경로는 [기출문제 Storage](past-exam-storage.md)에 기록한다.

빌드는 `build/` 파일을 갱신한다. 검증 뒤에는 의도하지 않은 산출물 변경이 있는지 확인한다.

## 코드 스타일에서 관찰되는 규칙

- React 함수 컴포넌트와 named export를 주로 사용한다.
- TypeScript 타입은 인터페이스와 `type` 별칭을 함께 사용한다.
- import는 외부 패키지, 내부 컴포넌트/유틸/타입 순으로 작성되는 경향이 있다.
- 페이지별 로컬 상태는 hooks로 선언하고, 비동기 핸들러는 `async` 함수로 둔다.
- 사용자 메시지와 주석은 한국어가 많으며, 오류는 `console.error`와 `alert`로 처리하는 패턴이 있다.
- 스타일은 JSX의 Tailwind 클래스와 일부 inline style을 혼용한다.
- 라우트 문자열·Supabase 테이블 문자열은 각 사용 위치에 직접 작성되어 있다.

명시적인 ESLint/Prettier 설정은 확인되지 않았다. 새로운 포맷 규칙을 도입하기 전에는 기존 파일의 형식을 우선 따른다.

## 문서 갱신 원칙

오픈소스 의존성, 복사한 UI·CSS, 폰트·이미지 변경 시에는 [라이선스 준수 관리](./open-source-compliance.md)에 따라 [의존성 목록](./licenses/dependency-inventory.md)과 `src/public/third-party-notices.txt`의 실제 버전·원문 고지를 함께 갱신한다. 고지 텍스트는 기존 public 디렉터리 설정으로 빌드에 포함된다. 개발 의존성 고지 근거는 `docs/licenses/development-notices.txt`에서 관리하며, 원문 미수집 항목은 준수 완료로 판정하지 않는다.

새로운 기능을 개발하거나 아키텍처를 변경할 때는 관련 문서 수정도 필수 작업에 포함한다. 코드 변경과 문서 갱신은 같은 작업 및 커밋 또는 PR에 포함하고, 작업 완료 전에 문서가 실제 구현과 일치하는지 확인한다.

- 기능 동작·사용자 흐름 변경: `docs/domain.md` 및 해당 기능별 문서
- 구조·라우팅·컴포넌트 책임·서비스 연동 경계 변경: `docs/architecture.md`
- 데이터 모델·API·인증·권한·Storage 변경: `docs/database.md` 및 해당 기능별 문서
- 개발 명령·검증 방법·배포 절차 변경: `docs/development.md`, `docs/versioning.md`

변경에 영향을 받는 문서만 갱신하며, 기존 문서로 설명하기 어려운 새 기능은 필요한 기능별 문서를 추가한다.

## 새 기능의 일반적인 변경 범위

### 새 페이지

1. `src/pages/`에 화면을 만든다.
2. `src/App.tsx`에 route를 등록한다.
3. 로그인 전용이면 `PrivateRoute`를 적용한다.
4. 필요한 경우 `GlobalBottomNav` 및 SEO 경로 정의를 검토한다.

### 새 Supabase 데이터

1. 타입을 `src/types/` 또는 기존 공용 타입 위치에 정의한다.
2. DB 스키마와 RLS 정책을 먼저 설계·검토한다.
3. 브라우저 직접 접근인지 Edge Function 경유인지 기존 데이터 경계를 기준으로 결정한다.
4. 마이그레이션 이력 불일치를 확인한 뒤, 명시적 승인 아래 변경한다.

### 커뮤니티 이미지

게시글 생성, Storage 업로드, `image_urls` 갱신은 별도 요청으로 실행된다. 실패 시 일부 단계만 성공할 수 있으므로 성공·실패·삭제 경로를 함께 검증한다.

## 위험도가 높은 변경

문항 통계는 [수동 갱신 가이드](question-statistics.md)의 status → prepare(읽기 전용 집계·파일 검증) → 개발자 검토 → publish(검증 파일 전체 발행) → status/공개 조회 순서로 갱신한다. 문제 시 명시적 rollback을 사용한다. 프로젝트 확인·예상 현재 세대·수행자·사유가 필요하며 원본 KV를 수정하지 않는다. 자동/예약 갱신은 없다. 운영 DB 최초 구조/발행은 적용했고 화면 기능은 v1.2.0에 포함한다. 웹 배포 시 DB 재적용이나 Edge Function 배포는 하지 않는다. 격리 SQL/RLS 검증과 모의 API 화면 테스트 방법도 해당 가이드에 명시한다.

- `supabase/config.toml`의 Edge Function JWT 설정 및 Edge Function의 사용자 식별
- `verify_jwt = false`인 성적 이력 Edge Function의 내부 토큰·소유자 검증과 클라이언트 먼저 적용하는 [운영 절차](history-security-rollout.md)
- `kv_store_cd835c22`의 이력 읽기·쓰기·삭제
- RLS 정책, Storage 정책, `SECURITY DEFINER` 함수, DB 트리거
- 커뮤니티 이미지 삭제와 Storage 객체 정리
- 채점 정답·점수 환산 데이터
- `App.tsx`의 라우팅과 이력 상태 변경

## 권장 검증 순서

1. 변경 범위와 연관된 기존 화면·테이블·정책을 읽는다.
2. 최소 범위로 구현한다.
3. `npm run check`를 실행한다.
4. 영향을 받은 사용자 흐름을 브라우저에서 읽기 전용 정책 아래 확인한다.
5. Supabase 변경이 있다면 인증 사용자와 비인증 사용자 모두의 권한 경로를 확인한다.

## UI 변경 승인

기존 UI 변경은 적용 전에 사용자에게 변경 범위를 설명하고 명시적 승인을 받아야 한다. 화면 본문·사용자용 문구·레이아웃·색상·서체·간격·요소 추가 및 삭제·메뉴·이동 동선·상호작용 변경이 대상이다. 기능·SEO·GEO·성능 개선 요청 자체를 UI 변경 승인으로 해석하지 않는다. 승인 요청에는 구체적인 제안 또는 기존 앱과 분리된 목업·미리보기를 제시하고, 승인 전 실제 앱 UI를 변경하지 않는다. 이미 명시적으로 승인받은 범위는 재확인하지 않으며 범위 확장에는 별도 승인이 필요하다. 이 규칙은 루트 `AGENTS.md`에도 명시되어 있다.

화면에 변화가 없는 내부 처리·HTML 사전 렌더링·검색 메타데이터 개선은 기존 UI를 유지하는 방식으로 진행한다. SEO·GEO 개선을 위해 검색엔진만을 대상으로 숨김 본문을 추가하지 않는다. 실제 사용자에게 제공하는 기존 화면을 최초 HTML에도 제공한다.

## 공개 HTML 사전 렌더링

`npm run build`는 Vite 정적 빌드 후 `node --import tsx scripts/prerender.ts`를 실행한다. 새 패키지나 Chromium 없이 기존 React 서버 렌더러로 공개 83개 화면을 생성한다. 렌더링 전에 기존 anon 키로 현재 공개 문항 통계 전체를 GET 한 번 수행한다. 15초 제한·건수/구조/발행본 검증을 적용하며 실패하면 빌드도 실패한다. 이후 실제 React 렌더링 중에는 외부 fetch를 금지하며 인증 세션·공지·개인 데이터를 가져오지 않는다. 브라우저는 HTML의 통계를 캐시에 넣지 않고 기존 DB 최신 조회 흐름을 따른다. 로컬 `npm run check`의 build 단계도 이 공개 읽기를 사용하므로 네트워크 연결이 필요하다.

`npm run build:test`는 `e2e/fixtures/question-statistics-2026.json`의 기존 공개 집계 파일로 같은 생성기를 검증하며 운영 DB 요청은 없다. 고정 파일은 2026학년도 두 과목/두 문형뿐이므로 다른 시험은 미발행 상태로 검증된다. Vercel 환경에서는 fixture 옵션을 거절하여 테스트 파일이 실서비스에 배포되지 않도록 한다. Vercel Build Command는 계속 `npm run build`를 사용해야 한다. 테스트 빌드 산출물은 운영 배포에 사용하지 않는다.

정답률은 코드에 하드코딩하지 않는다. 기존 절차로 DB 공개 통계를 발행한 뒤 최신 Production 배포의 Vercel Redeploy를 실행하면 새 commit/push 없이 HTML이 최신 발행본으로 바뀐다. Build Cache 사용은 해제한다. 새 학년도·정답표·집계 규칙 변경은 코드/DB 지원 범위 변경이므로 별도 개발과 배포 절차가 필요하다. [HTML 갱신 운영 절차](question-statistics-html.md)를 따른다.

기출문제 등록·공개 정적 경로 변경 시 `npm run sitemap:generate`와 `npm run prerender:routes`를 실행하고 `vercel.json` 변경도 검토한다. 빌드는 생성 규칙과 실제 배포 rewrite의 일치를 검사하고 불일치하면 실패한다. 일반 코드 빌드는 배포 설정을 자동 수정하지 않는다. 공개 HTML의 query 순서·불필요한 매개변수·기본값·잘못된 선택·단일 문형 처리는 클라이언트 선택과 같아야 한다.

`npm run test:prerender`는 먼저 생성된 build를 필요로 한다. 로컬 preview에서 저장된 Vercel rewrite의 query 조건을 적용하고 83개 최초 HTML 응답, 본문·canonical·제목·구조화 데이터, JavaScript 없는 접근, 앱 시작 후 선택과 정답표, 모바일 가로 넘침, 개인 경로 fallback을 검증한다. 이 preview는 배포 플랫폼 자체의 검증을 대체하지 않는다. 첫 배포 후 홈·과거 기출·예비시험·단일 문형 URL의 HTTP 응답을 추가 확인한다. `npm run check`와 CI는 빌드 이후 이 검증까지 실행한다.

UI 유지 검증은 같은 빌드에서 빈 `app.html`로 시작한 기존 방식과 사전 HTML로 시작한 방식을 비교한다. 홈·선택한 기출문제·로그인 화면의 데스크톱(1280px)과 모바일(375px) 최종 스크린샷이 같아야 한다. JavaScript 로딩을 보류한 상태부터 앱 시작까지 화면 프레임의 제목 개수를 검사해 빈 화면·중복 표시를 확인한다. 비로그인 채점 결과와 보호 경로의 로그인 이동도 검사하며 모든 Supabase 요청은 모의 응답으로 격리한다. 실제 로그인·운영 저장 요청은 실행하지 않는다.

배포 후에는 HTML 원문에 해당 시험의 본문·제목·canonical이 있는지 먼저 확인한다. Search Console은 홈, 최신 기출, 과거 기출, 예비시험의 대표 URL을 각각 검사하고 마지막 크롤링 날짜·Google 선택 표준 URL·색인 제외 사유를 비교한다. 페이지 색인 보고서의 최신 날짜와 사이트맵 필터도 함께 확인한다. 사전 렌더링 검증 통과를 Google 색인 완료로 해석하지 않는다.

`build/prerender/`와 `build/app.html`은 git에서 제외한 재생성 산출물이다. 기존 추적 중인 `build/index.html`과 assets 변경은 빌드 후 확인한다. 사전 렌더링 진입점과 preview 스크립트는 브라우저 배포 번들에 포함되지 않는다.

## 디데이 설정 검증·적용 경계

미저장 변경 이동 검사는 `src/hooks/useUnsavedDdayChanges.test.tsx`의 가드/복구/해제/새로고침 경고와 `e2e/admin-dday.spec.ts`의 실제 브라우저 뒤로가기·앞으로가기 취소/승인으로 검증한다. E2E는 입력값뿐 아니라 같은 입력 DOM 인스턴스가 유지되는지도 확인하여 URL만 복구하고 폼은 재마운트되는 오류를 검출한다. 반복 검증은 `npm run test:e2e -- e2e/admin-dday.spec.ts --grep '브라우저' --repeat-each=5`로 실행한다.

`npm run test:schedule`은 임시 PGlite에서 합성 Auth·관리자 역할·RLS를 만들고 신규 `20261004082512_exam_schedule.sql`만 실행한다. 운영 DB 접근은 없다. `npm run check`와 CI에 포함한다. 공통 계산·템플릿·캐시·API 및 자정 갱신은 Vitest에 포함하고 `e2e/admin-dday.spec.ts`는 모든 Supabase 요청을 모의 응답으로 처리해 관리자 저장 성공·충돌·응답 유실·권한 거절·입력 보존 및 모바일 화면을 검사한다.

`e2e/dday-public.spec.ts`는 공개 세 화면의 공통 표시·조회 중/실패·캐시 복구·HTML 텍스트 처리·60초 조회·다른 탭 알림·KST 자정·모바일 줄바꿈을 검사한다. 관리자 검사에는 저장 후 홈·비로그인 로그인·가입 화면 반영을 포함한다. `e2e-prerender/public-html.spec.ts`는 JS 없는 홈에서 조회 중 상태만 출력되고 고정 날짜·디데이를 포함하지 않는지 검사한다. `node --import tsx scripts/build-dday-preview.ts`로 운영 요청 없는 `docs/previews/dday-public.html`을 재생성한다.

사용자의 명시적 DB 적용·버전 관리·커밋·push 요청으로 v1.6.0 릴리스를 진행한다. 신규 마이그레이션·초기 행·동일 버전 적용 이력을 운영에 먼저 반영하고 실제 공개 읽기와 롤백 트랜잭션의 역할별 권한을 확인한다. 운영에 연결한 로컬 앱에서 저장을 클릭하지 않는다. [디데이 운영 적용](admin-dday-rollout.md)의 DB 먼저 적용·품질 게이트·main push·실서비스 확인 순서를 따른다.

## 관리자 이용 통계 검증·활성화

`npm run check`와 CI 품질 워크플로에 `npm run test:analytics`를 포함했다. 이 명령은 개발 의존성 PGlite 0.5.8의 임시 PostgreSQL에서 합성 역할/Auth/KV를 구성하여 신규 통계 마이그레이션을 검증하고, 신규 Deno 함수 타입 및 모의 요청 테스트를 실행한다. `src/utils/analyticsClient.test.ts`와 `adminAnalyticsApi.test.ts`는 기존 Vitest에, `e2e/admin-analytics.spec.ts`는 모의 Supabase Playwright에 포함된다. 운영 수집/저장 요청이 발생하지 않는다.

기본 로컬/preview에는 수집이 없다. 운영 빌드, `VITE_USAGE_ANALYTICS_ENABLED=true`, 정확한 `VITE_USAGE_ANALYTICS_ORIGINS`가 모두 필요하다. 서버는 `USAGE_ANALYTICS_ENABLED`와 DB의 기본 false 설정을 추가로 검사한다. `ANALYTICS_ALLOWED_ORIGINS`를 함수에서 지정하며 브라우저에 service-role 비밀값을 넣지 않는다. Supabase 신규 함수는 `supabase/functions/usage-events`와 `admin-analytics`, 공유 소스는 `_shared`다. main 함수 배포에는 기존 이력 함수와 두 통계 함수를 포함했다. DB 마이그레이션은 별도 적용하며 자동 db push로 저장소의 과거 운영 이력을 덮어쓰지 않는다.

사용자의 실제 서비스 반영·커밋·푸시 요청에 따라 운영 DB·함수·수집 설정을 적용했다. [v1.5.0 운영 적용](admin-analytics-rollout.md)에 실제 스키마 롤백 검증·PostgREST·RLS·수집 및 웹 배포 확인을 기록한다. 자동 삭제·탈퇴 cascade·예약 발행은 추가하지 않았으며 실제 설치 기기의 OS별 확인은 브라우저 모의 검사와 구분한다.

대시보드 확장은 `scripts/test-dashboard-sql.ts`로 두 로컬 마이그레이션·121명 복합 커서·기간 DISTINCT·원자 재발행/롤백·일반 역할/실제 service-role 권한·감사 실패 차단을 합성 DB에서 검증한다. `adminDashboard.test.ts`, `adminAnalyticsErrors.test.ts`, `AdminMemberPicker.test.tsx`는 계산/인가/IME·목록 상태를 확인한다. `e2e/admin-dashboard-preview.spec.ts`는 외부 요청 없이 실제 재사용 컴포넌트의 모바일/데스크톱 미리보기를 확인한다. `node --import tsx scripts/build-dashboard-preview.ts`로 새 예시 미리보기를 재생성한다. 구현·검증·운영 적용 경계는 [확장 구현 문서](admin-dashboard-implementation.md)를 따른다.

## 관리자 사용자 데이터 검증·릴리스

로컬 회원 목록 확장의 `test:user-data`는 최근 이용 시각 SQL·`service-activity` 타입/인증·서명 커서를 추가 검사하며 함수 CI 대상에도 `service-activity`를 추가했다. DB → `admin-user-data`/`service-activity` → 웹 순서가 필요하다. 전체 이력 탈퇴 보관 정책·운영 미적용 상태와 검사 범위는 [회원 목록 확장](admin-user-data-member-list.md)을 따른다.

`npm run test:user-data`는 PGlite 합성 스키마의 실제 권한/트랜잭션과 Deno 주입 API를 확인하며 운영 데이터에 접근하지 않는다. 새 프론트 단위 검사와 `e2e/admin-user-data.spec.ts`는 계정 범위·승인·이미지·권한 회수·분석 저장 실패의 UI를 검사한다. E2E의 변경 제출은 모든 Supabase 요청을 모킹한 합성 API에만 실행한다. 운영에 연결된 브라우저에서 변경·업로드·좋아요 등 쓰기를 검증하지 않는다.

전체 `check`와 CI에 새 SQL·Edge 검사가 포함된다. DB migration, 기존 원자 이력 함수, 새 관리자/분석 함수, 웹의 순서로 조정해야 하며 실제 적용·배포·push는 명시적 요청 뒤 수행한다. 함수 CI는 Supabase CLI 2.119.0을 고정하고 기존 이력 함수를 먼저 배포하며 `admin-user-data`·`admission-history`도 포함한다. 새 DB migration은 main push 전에 별도 적용해야 한다. v1.7.0 실제 적용은 [운영 적용 기록](admin-user-data-rollout.md), 세부 목록과 검증 한계는 [사용자 데이터 구현·운영](admin-user-data-implementation.md)을 따른다.

## 웹·PWA 푸시 검증·운영 준비

관리자 구독 통계는 기존 `test:push`에 실제 SQL의 회원 DISTINCT·유효 구독/계정·service-only/현재 세션/읽기 전용 검증을 추가하고, `test:e2e:push`에서 모바일/PC·실패/0 구분·입력 유지·권한 회수를 검사한다. 사용자 배포 요청으로 v1.10.0의 신규 RPC를 먼저 적용하고 admin-push와 웹을 순서대로 배포한다. 원격 이력 일괄 복구나 구독 데이터 변경 없이 [푸시 구독 통계](push-subscriber-statistics.md)의 검증·적용 기록을 따른다.

서비스 접속 팝업의 7일 유예는 `PushConsent.test.tsx`와 푸시 E2E의 모의 시계로 검증한다. 상단 재진입 링크 없음·새로고침·Esc·기간 만료, 홈 밖 회원/비회원 자동 안내·권한 허용 후 등록 실패 재접속을 모바일/PC에서 확인하며 실제 알림 권한과 Supabase는 모킹한다. 분리 미리보기는 `docs/previews/push-consent-popup.html`이며 실제 등록하지 않는다. 로컬 안내 UI만 확인하려면 정확한 localhost origin을 지정해 `VITE_PUSH_ENABLED=true VITE_PUSH_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000 npm run dev -- --port 3000 --strictPort`로 실행할 수 있다. 실제 등록/저장 버튼 검증은 운영 연결 대신 모의 E2E에서 진행한다.

승인된 관리자/홈 UI와 신규 private SQL·Edge 세 함수·SW를 로컬 구현했다. `npm run test:push`는 실제 신규 SQL의 합성 PostgreSQL 및 Deno 타입/API/worker/라이브러리 암호화를 검사한다. `npm run test:e2e:push`는 별도 포트 3001에서 전체 Supabase/알림 API를 모킹하여 UI를 검사한다. SW 단위 검사는 기존 Vitest에 포함한다. 새 명령은 전체 check와 품질 CI에 추가했다. 운영에 연결된 로컬에서 등록·초안·preview·테스트 확인도 실행하지 않는다.

개발 모드는 기본 off이며 프론트의 명시 true/정확 origin, Edge PUSH_ENABLED, DB enabled 및 수동 캠페인 별도 스위치가 필요하다. `.env.production`에는 비밀 없는 두 공개 푸시 설정만 기록하며 정식 origin 외 preview/localhost에서는 비활성화한다. 새 세 함수는 main 함수 CI 대상이므로 DB 준비가 main push보다 앞서야 한다. 별도 opt-in Cron SQL은 자동 migration 대상이 아니며 사용자 릴리스 요청에 따라 운영에 적용했다. Edge의 `ECE_KEYLOG=0`은 필수 서버 설정이며 읽기 전용 환경에서 변경하지 않는다. 기존 프론트 공개 키가 기본 anon 키와 다르면 `PUSH_PUBLIC_API_KEY`로 기존 공개 키를 지정한다. 이 차이와 읽기 전용 초기화는 Deno runtime 회귀 검사로 검증한다. 설정·키 보관·실기기/처리량 한계는 [구현·운영 준비](push-notifications-implementation.md), DB·secrets·함수·Cron 반영과 v1.9.0 릴리스 상태는 [운영 기록](push-notifications-rollout.md)을 따른다. 실제 기기 테스트 완료 전 일반 캠페인은 비활성화한다.
