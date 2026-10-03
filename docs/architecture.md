# 아키텍처

## 개요

all_LEET은 Vite로 빌드되는 React 단일 페이지 애플리케이션(SPA)이다. 브라우저는 Supabase Auth·PostgREST·Storage·Realtime에 직접 연결하고, 성적 이력 두 종류만 Supabase Edge Function을 통해 저장한다. Vercel은 정적 산출물과 SPA fallback을 제공한다.

```text
브라우저 (React / React Router)
 ├─ Supabase Auth
 ├─ Supabase Postgres (채팅, 커뮤니티, 오답 메모, 발행된 문항 통계)
 ├─ Supabase Realtime (채팅 INSERT 구독)
 ├─ Supabase Storage (커뮤니티 이미지, 공개 기출문제 PDF)
 └─ Edge Function make-server-cd835c22
      └─ kv_store_cd835c22 (공식·사설 성적 이력 JSONB)

Vercel ── Vite build/ 정적 파일과 SPA rewrite 제공
```

## 런타임 경계

### 프론트엔드

- 진입점: `src/main.tsx`
- 앱 조립과 라우팅: `src/App.tsx`
- 계정별 이력 상태와 CRUD: `src/hooks/useUserHistory.ts`
- 세션 토큰·응답·제한된 인증 재시도: `src/utils/historyApi.ts`
- 인증 provider와 Supabase 클라이언트: `src/contexts/AuthContext.tsx`
- 화면: `src/pages/`
- 도메인 UI: `src/components/`
- 범용 UI 프리미티브: `src/components/ui/`
- 계산·정적 데이터·보조 기능: `src/utils/`

홈의 관리자 버튼 → `/admin` 관리 메뉴 → `/admin/announcements` 공지 목록·편집 순으로 이동한다. 관리자 여부는 `AuthContext`가 기존 RPC로 확인해 버튼과 라우트에 공유한다. DB 변경 권한은 기존 RLS가 강제한다. 관리자 전용 반응형 스타일은 `src/styles/admin.css`에 있으며, 미리 생성된 `src/index.css`에 없는 Tailwind 유틸리티에 의존하지 않는다.

`App.tsx`는 `BrowserRouter`, `AuthProvider`, 전역 하단 내비게이션, PWA 설치 버튼, Vercel Analytics를 조립한다. `useUserHistory`가 공식/사설 이력과 로딩·오류 상태를 관리하고 페이지로 props를 전달한다. 계정 전환·로그아웃 때 이전 계정의 배열과 늦게 도착한 요청 결과를 사용하지 않는다. 동일한 사용자 ID의 토큰 갱신은 이력을 초기화하지 않는다.

### 백엔드

등록된 Edge Function은 `make-server-cd835c22`다. 설정은 `supabase/config.toml`, 구현은 `supabase/functions/make-server-cd835c22/`에 있다. Deno에서 Hono를 실행하고 `SUPABASE_SERVICE_ROLE_KEY`로 `kv_store_cd835c22`를 읽고 쓴다.

`index.ts`가 실제 Auth/KV 의존성을 조립하고 `app.ts`의 Hono 앱을 실행한다. `auth.ts`는 명시적인 Bearer 토큰을 Supabase `getUser(token)`으로 검증한다. 테스트에서는 외부 요청을 모의 구현으로 대체한다.

`src/supabase/functions/server/index.tsx`는 등록된 진입점을 참조하는 레거시 어댑터다. 독립적인 라우트 사본을 유지하지 않으며 배포 경로로 사용하지 않는다. v1.4.5 서버 인증 변경의 운영 적용과 승인된 전용 테스트 계정 검증은 [이력 보안 배포 절차](history-security-rollout.md)를 따른다.

## 라우팅

### 문항 통계 조회·수동 발행

`QuestionStatistics`/`QuestionRate`와 `useQuestionStatistics`를 결과 답안 및 기출 정답표가 공유한다. 동일 학년도·유형의 두 과목은 한 공개 SELECT로 읽고 5분간 공유 캐시한다. RLS가 현재 발행 세대만 허용한다. 통계 오류·정답 버전 불일치가 개인 결과·메모·정답표를 막지 않는다.

개발자 전용 `scripts/question-statistics.ts`는 브라우저와 분리된 Supabase Management API로 읽기 전용 집계 파일 생성, 검증 파일의 원자적 전체 발행, 상태 확인, 롤백을 수행한다. 주기 작업·Edge Function·원본 이력 API 변경은 없다. 구조와 운영 절차는 [문항 통계 설계](question-statistics-design.md) 및 [수동 갱신](question-statistics.md)을 따른다.

공개 라우트는 홈(`/`), 결과, 로그인/회원가입/비밀번호 재설정, 약관, 커뮤니티, 채팅이다. `PrivateRoute`가 적용된 라우트는 지원 분석(`/admission`, `/admission-result`)과 사설 모의고사 입력(`/mock-input`)이다. `/history`와 `/mock-history`는 라우트 가드 없이 렌더링되며, 이력 로딩 자체는 현재 사용자 유무에 따라 동작한다.

공개 페이지의 사이트맵은 `scripts/generate-sitemap.ts`가 `src/public/sitemap.xml`에 생성한다. 기출문제 URL은 등록된 문제지 78개와 일대일로 대응한다. 검색 제목·설명·canonical은 `src/utils/pageSeo.ts`를 빌드와 브라우저가 공유한다. 홈의 검색 제목·설명은 LEET 채점, 문항별 정답률·선지별 응답 분포, 기출문제 PDF·정답표·환산표를 강조하며 기존 화면의 본문·레이아웃은 유지한다.

`npm run build`는 Vite 빌드 후 `scripts/prerender.ts`가 기존 React 화면을 Vite SSR/React 서버 렌더러로 HTML에 기록한다. 대상은 홈, 성적 이력 예시 두 경로, 정책 두 경로, 기출문제 선택 URL 78개로 총 83개다. `src/entry-prerender.tsx`는 `StaticRouter`와 세션 없는 인증 Context로 `AppContent`를 렌더링한다. AuthProvider는 실행하지 않으며 React effect·로그인·데이터 요청·변경도 실행하지 않는다. 외부 fetch를 금지하고 실제 문항 통계·공지·개인 이력을 빌드 HTML에 복사하지 않는다. 실제 문항 정답률은 기존 공개 조회로 불러오며 접힌 정답표의 동작은 유지한다. 검색엔진만을 위한 숨김 본문은 추가하지 않는다.

`vercel.json`의 query 조건부 rewrite는 유효한 학년도·과목·문형에 맞는 `build/prerender/past-exams/*.html`을 제공한다. 생략·잘못된 선택과 단일 문형 보정은 기존 선택 규칙과 일치한다. 정적 정책·이력 경로도 각각의 HTML을 받는다. 홈은 `build/index.html`이며 로그인·관리자·개인 화면 및 커뮤니티의 fallback은 빈 앱 본문을 가진 `build/app.html`이다. 커뮤니티 목록·게시글은 최신 공개 DB 조회가 필요한 동적 화면으로 기존 클라이언트 렌더링을 유지하며, 게시글 메타데이터는 조회 결과로 갱신한다.

브라우저는 초기 정적 본문을 `prerender-shell`에 보관하고 기존 createRoot/AuthProvider를 실행한다. 인증 초기화 후 실제 페이지가 마운트되면 정적 본문을 제거한다. HTML을 hydrate하지 않으므로 빌드 시점 날짜·세션·화면 폭 차이로 인한 hydration 불일치가 없다. 사이트명 구조화 데이터는 `ldjson-website` 한 개로 유지한다.

홈의 기능 바로가기·정책 링크와 전역 하단 메뉴는 React Router 링크를 사용한다. 커뮤니티 목록의 게시글 제목에도 상세 URL 링크가 있으며, 기존 카드 전체 클릭 이동과 좋아요 버튼은 유지한다.

## 프론트엔드 패턴

- 페이지 파일은 화면 상태, Supabase 호출, 화면 렌더링을 함께 가진다.
- 재사용 가능한 도메인 시각화는 `TrendChart`, `MockTrendChart`, `ResultPanel`처럼 컴포넌트로 분리되어 있다.
- UI 상태는 `useState`, 파생값은 `useMemo`, 데이터 로딩·구독은 `useEffect`를 쓴다.
- 라우트 간 일회성 데이터는 React Router의 navigation state를 사용한다. 지원 분석 결과는 새로고침 대비로 `sessionStorage`에도 저장한다.
- 스타일은 Tailwind 유틸리티 클래스 위주이며, 범용 UI는 Radix 기반 컴포넌트를 사용한다.

## 배포 및 PWA

- Vite `outDir`은 `build/`이고 public 디렉터리는 `src/public/`이다.
- `vercel.json`은 정적 파일 캐시 헤더, 공개 HTML rewrite와 나머지 앱 경로의 `/app.html` fallback을 설정한다. 공개 HTML은 no-store로 응답하며 자산은 기존 장기 캐시를 유지한다. `pastExamDocuments.ts`의 78개 문제지는 Supabase 공개 버킷 `past-exams/watermarked/v1/`의 워터마크 PDF를 직접 참조한다. 원본 PDF·HWP는 로컬 다운로드 보관 영역에 유지하고 웹 빌드에 포함하지 않는다. `pastExamData.ts`가 정답 학년도와 문제지 학년도를 합쳐 선택 목록을 구성한다. 기출 PDF 유형은 단일 문형도 지원하되 기존 채점 타입은 홀수형·짝수형을 유지한다.
- `src/main.tsx`가 `/sw.js`를 등록한다. 서비스 워커는 캐시를 정리하고 네트워크 요청을 가로채지 않는다.
- 서비스 배포 버전의 단일 기준은 `package.json`의 `version`이며, `main` push 전 갱신 절차는 `docs/versioning.md`에 정의한다.

## 관찰된 구조상 주의점

- `App.tsx`의 라우팅·SEO와 `useUserHistory`의 계정별 이력 상태가 연결되어 있다.
- 커뮤니티·채팅·메모는 정규화 테이블을 직접 사용하지만, 성적 이력은 사용자별 JSON 배열을 KV 테이블 한 행에 저장한다.
- 원격 Supabase 마이그레이션 이력과 저장소의 `supabase/migrations/` 파일 목록이 일치하지 않는다. DB 작업 시 어느 쪽이 운영 기준인지 먼저 확인해야 한다.
