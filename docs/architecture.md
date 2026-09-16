# 아키텍처

## 개요

all_LEET은 Vite로 빌드되는 React 단일 페이지 애플리케이션(SPA)이다. 브라우저는 Supabase Auth·PostgREST·Storage·Realtime에 직접 연결하고, 성적 이력 두 종류만 Supabase Edge Function을 통해 저장한다. Vercel은 정적 산출물과 SPA fallback을 제공한다.

```text
브라우저 (React / React Router)
 ├─ Supabase Auth
 ├─ Supabase Postgres (채팅, 커뮤니티, 오답 메모)
 ├─ Supabase Realtime (채팅 INSERT 구독)
 ├─ Supabase Storage (커뮤니티 이미지)
 └─ Edge Function make-server-cd835c22
      └─ kv_store_cd835c22 (공식·사설 성적 이력 JSONB)

Vercel ── Vite build/ 정적 파일과 SPA rewrite 제공
```

## 런타임 경계

### 프론트엔드

- 진입점: `src/main.tsx`
- 앱 조립, 라우팅, 이력 API 호출: `src/App.tsx`
- 인증 provider와 Supabase 클라이언트: `src/contexts/AuthContext.tsx`
- 화면: `src/pages/`
- 도메인 UI: `src/components/`
- 범용 UI 프리미티브: `src/components/ui/`
- 계산·정적 데이터·보조 기능: `src/utils/`

홈의 관리자 버튼 → `/admin` 관리 메뉴 → `/admin/announcements` 공지 목록·편집 순으로 이동한다. 관리자 여부는 `AuthContext`가 기존 RPC로 확인해 버튼과 라우트에 공유한다. DB 변경 권한은 기존 RLS가 강제한다. 관리자 전용 반응형 스타일은 `src/styles/admin.css`에 있으며, 미리 생성된 `src/index.css`에 없는 Tailwind 유틸리티에 의존하지 않는다.

`App.tsx`는 `BrowserRouter`, `AuthProvider`, 전역 하단 내비게이션, PWA 설치 버튼, Vercel Analytics를 조립한다. 공식/사설 이력 배열과 이력 CRUD 핸들러도 이 파일에 있으며, `HistoryPage`와 `MockExamInputPage`로 props를 전달한다.

### 백엔드

등록된 Edge Function은 `make-server-cd835c22`다. 설정은 `supabase/config.toml`, 구현은 `supabase/functions/make-server-cd835c22/`에 있다. Deno에서 Hono를 실행하고 `SUPABASE_SERVICE_ROLE_KEY`로 `kv_store_cd835c22`를 읽고 쓴다.

`src/supabase/functions/server/`에도 Hono/KV 구현이 존재하지만, 이 경로는 현재 `supabase/config.toml`에 등록되어 있지 않다.

## 라우팅

공개 라우트는 홈(`/`), 결과, 로그인/회원가입/비밀번호 재설정, 약관, 커뮤니티, 채팅이다. `PrivateRoute`가 적용된 라우트는 지원 분석(`/admission`, `/admission-result`)과 사설 모의고사 입력(`/mock-input`)이다. `/history`와 `/mock-history`는 라우트 가드 없이 렌더링되며, 이력 로딩 자체는 현재 사용자 유무에 따라 동작한다.

## 프론트엔드 패턴

- 페이지 파일은 화면 상태, Supabase 호출, 화면 렌더링을 함께 가진다.
- 재사용 가능한 도메인 시각화는 `TrendChart`, `MockTrendChart`, `ResultPanel`처럼 컴포넌트로 분리되어 있다.
- UI 상태는 `useState`, 파생값은 `useMemo`, 데이터 로딩·구독은 `useEffect`를 쓴다.
- 라우트 간 일회성 데이터는 React Router의 navigation state를 사용한다. 지원 분석 결과는 새로고침 대비로 `sessionStorage`에도 저장한다.
- 스타일은 Tailwind 유틸리티 클래스 위주이며, 범용 UI는 Radix 기반 컴포넌트를 사용한다.

## 배포 및 PWA

- Vite `outDir`은 `build/`이고 public 디렉터리는 `src/public/`이다.
- `vercel.json`은 정적 파일 캐시 헤더와 모든 앱 경로의 `/index.html` rewrite를 설정한다.
- `src/main.tsx`가 `/sw.js`를 등록한다. 서비스 워커는 캐시를 정리하고 네트워크 요청을 가로채지 않는다.
- 서비스 배포 버전의 단일 기준은 `package.json`의 `version`이며, `main` push 전 갱신 절차는 `docs/versioning.md`에 정의한다.

## 관찰된 구조상 주의점

- `App.tsx`가 라우팅, SEO 메타데이터, 이력 데이터, 이력 API 호출을 함께 담당한다.
- 커뮤니티·채팅·메모는 정규화 테이블을 직접 사용하지만, 성적 이력은 사용자별 JSON 배열을 KV 테이블 한 행에 저장한다.
- 원격 Supabase 마이그레이션 이력과 저장소의 `supabase/migrations/` 파일 목록이 일치하지 않는다. DB 작업 시 어느 쪽이 운영 기준인지 먼저 확인해야 한다.
