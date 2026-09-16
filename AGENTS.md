# all_LEET 작업 지침

## 프로젝트 개요

- Vite + React + TypeScript 단일 페이지 애플리케이션이다.
- 인증·데이터·실시간 기능은 Supabase를 사용하고, 정적 웹앱은 Vercel에 배포한다.
- 라우팅과 성적 이력 상태의 중심은 `src/App.tsx`다.
- 시작 전에는 `docs/architecture.md`, `docs/database.md`, `docs/domain.md`, `docs/development.md`를 읽는다.

## 기본 작업 원칙

- 현재 코드와 원격 Supabase 스키마를 먼저 읽고, 존재하지 않는 API·테이블·정책을 가정하지 않는다.
- 애플리케이션 코드, 마이그레이션, 배포 설정 변경은 과업에 필요할 때만 최소 범위로 한다.
- 사용자가 요청하지 않은 데이터 삭제, 스키마 변경, 배포, Edge Function 배포를 하지 않는다.
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

- 현재 저장소에는 프로젝트 테스트·lint·typecheck 스크립트가 없다.
- 프론트엔드 변경 후 최소 검증은 `npm run build`다. 빌드는 `build/` 산출물을 갱신하므로 변경 여부를 확인한다.
- Supabase 변경 후에는 대상 흐름, RLS, Storage 정책, Edge Function 동작을 별도로 검증한다.
- 신규 기능에는 가능한 한 테스트 실행 환경과 검증 방법을 함께 추가하거나 문서화한다.
