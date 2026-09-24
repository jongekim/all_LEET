# 개발 가이드

## 명령어

| 목적 | 명령 |
|---|---|
| 의존성 설치 | `npm install` |
| 개발 서버 | `npm run dev` |
| lint | `npm run lint` |
| 타입 검사 | `npm run typecheck` |
| 테스트 1회 실행 | `npm run test` |
| 테스트 감시 실행 | `npm run test:watch` |
| 작업 중 빠른 확인(타입 검사 + 단위 테스트) | `npm run check:quick` |
| 읽기 전용 화면 E2E 테스트 | `npm run test:e2e` |
| Playwright UI 모드 | `npm run test:e2e:ui` |
| 프로덕션 빌드 | `npm run build` |
| 배포 직전 전체 품질 게이트 | `npm run check` |
| 서비스 버전 일치 검사 | `npm run version:verify` |
| PATCH / MINOR / MAJOR 릴리스 준비 | `npm run release:patch` / `npm run release:minor` / `npm run release:major` |
| 예시 이력 생성 | `npm run gen:example-history` |
| 예시 이력 시드 | `npm run seed:example-history` |
| 문항 통계 생성/발행/확인/롤백 | `npm run statistics -- prepare/publish/status/rollback ...` |

Vite 개발 서버 포트는 `vite.config.ts`에서 `3000`으로 설정되어 있다. 빌드 산출물은 `build/`다. `npm run build`는 Vite 빌드 후 `scripts/generate-seo-pages.tsx`로 색인 대상 HTML과 `sitemap.xml`을 생성·검사한다. 개발 서버는 Vite의 SPA fallback을 사용하므로 초기 HTML/HTTP 상태 검사는 `build/` 산출물과 Vercel 경로 설정을 기준으로 한다. `/past-exams/:year` HTML은 빌드 시 생성되며 `/build/past-exams/`는 git 제외 상태다.

## 검증 시점

- **수정 직후:** 변경된 내용이 맞는지 확인할 최소 범위만 실행한다. 문서만 수정했으면 `git diff --check`와 해당 문단 확인, TypeScript를 수정했으면 `npm run typecheck`와 관련 단위 테스트(`npx vitest run <관련 테스트 파일>`)를 우선한다. 영향 범위가 넓으면 `npm run check:quick`을 사용한다. 정적 HTML·빌드 설정을 바꿨으면 `npm run build` 후 영향받은 산출물을 확인한다.
- **배포 직전:** 최종 변경 묶음에 대해 `npm run version:verify`와 `npm run check`를 한 번 실행한다. `check`는 lint, typecheck, 단위 테스트, 전체 읽기 전용 E2E, 빌드를 포함한다. 배포 전 전체 E2E가 실패해 코드를 수정했다면 관련 테스트로 먼저 확인하고 최종 게이트를 다시 통과시킨다.
- 운영 DB·인증·권한·Storage·Edge Function 변경에는 변경된 권한과 대상 흐름의 별도 검증을 추가한다. 운영 Supabase에 연결된 로컬 앱에서 서버 쓰기 요청을 만들지 않는 규칙은 모든 단계에 적용한다.

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

## 테스트·lint·타입 검사

- lint: ESLint 10 flat config가 `src/`, `scripts/`, Vite/Vitest 설정 파일을 검사한다. Deno 전용 Edge Function 소스는 이 Node 기반 lint 범위에서 제외된다. 기존 코드의 `any`, 미사용 식별자, Hook 규칙 위반과 effect 내 동기 상태 갱신은 현재 경고로 보고하며, 별도 안정화 작업으로 오류 수준으로 올려야 한다.
- typecheck: `tsconfig.json`이 프론트엔드와 스크립트를 strict 모드로 검사한다. Deno 전용 `src/supabase/functions/`는 제외된다.
- test: Vitest + jsdom + Testing Library를 사용한다. 현재 D-day 계산의 회귀 테스트가 포함되어 있다.
- 화면 E2E: Playwright Chromium이 `e2e/`의 공개 읽기 전용 흐름을 실행한다. 테스트는 PWA 서비스 워커를 차단해 기존 `controllerchange`의 자동 새로고침이 화면 검증을 방해하지 않게 한다. 로컬 최초 실행 전에는 `npx playwright install chromium`으로 브라우저를 설치한다.
- CI: `.github/workflows/quality.yml`은 pull request와 수동 실행에서 Node 20.19.0으로 lint, typecheck, unit test, 읽기 전용 화면 E2E, build를 실행한다. lockfile의 설치 전략에 맞춰 `npm ci --legacy-peer-deps`를 사용한다. `main` push 이후가 아니라 PR 단계에서 실패를 발견하도록 구성했다.

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

문항 통계 발행 또는 롤백 후 검색용 정적 요약도 `npm run seo:sync-statistics`로 갱신한다. 이 명령은 공개 anon SELECT만 수행하고 검증된 비율·표본·발행 시점을 `src/data/seoQuestionRates.json`에 저장한다. 생성된 diff와 현재 발행 ID를 확인하고 `npm run build`로 대표 검색 HTML을 점검한다. 전체 `npm run check`는 배포 직전에 실행한다. 웹앱 배포 전까지 정적 요약은 이전 발행일의 값으로 남고, 대화형 정답표는 최신 DB 발행본을 조회한다.

- `supabase/config.toml`의 Edge Function JWT 설정 및 Edge Function의 사용자 식별
- 현재 `verify_jwt = false`인 성적 이력 Edge Function과 URL `userId` 기반 접근
- `kv_store_cd835c22`의 이력 읽기·쓰기·삭제
- RLS 정책, Storage 정책, `SECURITY DEFINER` 함수, DB 트리거
- 커뮤니티 이미지 삭제와 Storage 객체 정리
- 채점 정답·점수 환산 데이터
- `App.tsx`의 라우팅과 이력 상태 변경

## 권장 검증 순서

1. 변경 범위와 연관된 기존 화면·테이블·정책을 읽는다.
2. 최소 범위로 구현한다.
3. 관련 단위 테스트·타입 검사 등 수정 범위에 맞는 빠른 검증을 실행한다.
4. 필요할 때 대표 사용자 흐름만 브라우저에서 읽기 전용 정책 아래 확인한다.
5. Supabase 변경이 있다면 인증 사용자와 비인증 사용자 모두의 권한 경로를 확인한다.
6. 배포 직전에 `npm run version:verify`와 `npm run check`로 전체 E2E를 포함한 최종 검증을 수행한다.
