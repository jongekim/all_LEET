# all_LEET 작업 지침

## 프로젝트 개요

- Vite + React + TypeScript 단일 페이지 애플리케이션이다.
- 인증·데이터·실시간 기능은 Supabase를 사용하고, 정적 웹앱은 Vercel에 배포한다.
- 라우팅과 성적 이력 상태의 중심은 `src/App.tsx`다.
- 시작 전에는 `docs/architecture.md`, `docs/database.md`, `docs/domain.md`, `docs/development.md`를 읽는다.

## 기본 작업 원칙

- 현재 코드와 원격 Supabase 스키마를 먼저 읽고, 존재하지 않는 API·테이블·정책을 가정하지 않는다.
- 애플리케이션 코드, 마이그레이션, 배포 설정 변경은 과업에 필요할 때만 최소 범위로 한다.
- 새로운 기능을 개발하거나 아키텍처를 변경할 때는 관련 문서를 같은 작업에서 함께 수정한다. 변경 내용에 따라 `docs/domain.md`, `docs/architecture.md`, `docs/database.md`, `docs/development.md` 및 기능별 문서를 갱신하고, 문서가 실제 구현과 일치하는지 확인한다.
- 사용자가 요청하지 않은 데이터 삭제, 스키마 변경, 배포, Edge Function 배포를 하지 않는다.
- 이 저장소에서 `main` 브랜치로의 push는 실서비스 배포로 이어진다. Codex는 사용자의 명시적 요청 없이 `git push`하지 않는다.
- `main` push 뒤 Vercel 배포는 비동기로 진행되어 수십 초에서 몇 분 걸릴 수 있다. push 직후 운영 URL이 이전 버전을 반환해도 실패로 단정하지 않는다. 해당 커밋의 Vercel 배포 상태가 성공인지 확인한 뒤 운영 URL을 점검하고, 명시적 실패 상태면 로그·설정을 조사한다.
- Codex는 독립적인 작업 단위가 끝날 때마다 변경 사항, 검증 결과, 배포 위험을 짧게 정리하고 커밋·push 필요 여부를 사용자에게 권장한다. 권장은 실행 권한이 아니며, 실제 push는 사용자의 명시적 요청 뒤에만 한다.
- 배포 대상 변경은 push 전에 `npm run check`를 통과해야 한다. DB·Edge Function·인증 변경은 관련 권한과 운영 흐름도 별도 검증한다.
- 작업 트리에 이미 있는 사용자 변경 사항은 보존한다.
- `src/utils/supabase/info.tsx`는 자동 생성 파일이므로 직접 편집하지 않는다.

## 프론트엔드 규칙

- 새 라우트는 `src/pages/`에 두고 `src/App.tsx`에 등록한다.
- 인증이 필요한 화면은 기존 `PrivateRoute`와 `useAuth()` 사용 방식을 따른다.
- 페이지 전용 상태는 React hooks로 유지한다. 전역 인증 상태는 `AuthContext`만 사용한다.
- 도메인 타입은 `src/types/` 또는 기존 공용 타입 위치에 추가한다.
- UI는 기존 Tailwind 유틸리티 클래스와 `src/components/ui/`의 프리미티브를 우선 재사용한다.
- 네트워크·Supabase 오류는 기존처럼 콘솔 기록과 사용자용 한국어 안내를 함께 제공한다.

## Supabase 및 보안 규칙

- DB 변경 전에는 원격 스키마·RLS 정책·마이그레이션 이력을 읽기 전용으로 확인한다.
- `public` 테이블에는 RLS와 목적에 맞는 정책을 함께 설계한다. 소유자 데이터에는 `auth.uid()` 기반 조건을 사용한다.
- 브라우저에는 publishable/anon 키만 둔다. service role 키를 클라이언트 코드에 넣지 않는다.
- Storage는 버킷 정책과 파일 경로 소유권을 함께 검토한다.
- 성적 이력 Edge Function은 현재 URL의 `userId`를 받아 KV에 접근하는 구조다. 이 영역을 변경할 때는 JWT 검증과 요청 사용자 식별을 우선 검토한다.
- `supabase/functions/make-server-cd835c22/`가 `supabase/config.toml`에 등록된 함수 경로다. `src/supabase/functions/server/`에는 유사한 중복 소스가 있으므로 배포 대상을 혼동하지 않는다.

## 검증

- 수정 직후에는 변경 범위에 맞는 작은 검사만 실행한다. 문서는 `git diff --check`, TypeScript 코드는 `npm run typecheck`와 관련 단위 테스트를 우선 사용한다. 범위가 여러 파일에 걸치면 `npm run check:quick`(타입 검사 + 단위 테스트)을 사용한다. 정적 HTML·빌드 설정 변경에는 필요한 경우 빌드 산출물의 해당 페이지만 확인한다.
- 전체 `npm run test:e2e`와 `npm run check`를 매 수정마다 반복하지 않는다. `npm run check`는 lint, typecheck, unit test, E2E, build를 포함하는 배포 직전 품질 게이트이며, 배포 대상 변경은 push 전에 통과해야 한다.
- 빌드는 `build/` 산출물을 갱신하므로 변경 여부를 확인한다.
- 사용자 흐름 변경 뒤에는 필요할 때 대표 화면 한두 곳을 읽기 전용으로 확인한다. 전체 화면 E2E는 배포 직전에 실행한다. 공개 조회, 로그인 화면 진입, 목록·상세 조회, 폼 입력, 유효성 검사, 이미지 미리보기처럼 서버 상태를 바꾸지 않는 흐름을 우선 확인한다.
- 운영 Supabase에 연결된 로컬 앱에서는 서버 쓰기 요청을 발생시키지 않는다. 제출·저장·삭제·좋아요·신고·채팅 전송은 클릭하지 않으며, 쓰기 기능은 요청 직전의 UI 상태까지만 검증한다.
- 화면 자동화는 Playwright의 `npm run test:e2e`로 실행한다. Chromium이 설치되지 않은 환경에서는 먼저 `npx playwright install chromium`을 실행한다.
- Supabase 변경 후에는 대상 흐름, RLS, Storage 정책, Edge Function 동작을 별도로 검증한다.
- 신규 기능에는 가능한 한 테스트 실행 환경과 검증 방법을 함께 추가하거나 문서화한다.
