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

### 문항 통계 조회·수동 발행

`QuestionStatistics`/`QuestionRate`와 `useQuestionStatistics`를 결과 답안 및 기출 정답표가 공유한다. 동일 학년도·유형의 두 과목은 한 공개 SELECT로 읽고 5분간 공유 캐시한다. RLS가 현재 발행 세대만 허용한다. 통계 오류·정답 버전 불일치가 개인 결과·메모·정답표를 막지 않는다.

개발자 전용 `scripts/question-statistics.ts`는 브라우저와 분리된 Supabase Management API로 읽기 전용 집계 파일 생성, 검증 파일의 원자적 전체 발행, 상태 확인, 롤백을 수행한다. 주기 작업·Edge Function·원본 이력 API 변경은 없다. 구조와 운영 절차는 [문항 통계 설계](question-statistics-design.md) 및 [수동 갱신](question-statistics.md)을 따른다.

공개 라우트는 홈(`/`), 결과, 로그인/회원가입/비밀번호 재설정, 약관, 커뮤니티, 채팅이다. `PrivateRoute`가 적용된 라우트는 지원 분석(`/admission`, `/admission-result`)과 사설 모의고사 입력(`/mock-input`)이다. `/history`와 `/mock-history`는 라우트 가드 없이 렌더링되며, 이력 로딩 자체는 현재 사용자 유무에 따라 동작한다.

공개 페이지의 사이트맵은 `scripts/generate-sitemap.ts`가 `src/public/sitemap.xml`에 생성한다. 기출문제 URL은 등록된 문제지 78개와 일대일로 대응한다. 정적 경로의 검색 메타데이터는 `App.tsx`가 설정하고, `/past-exams`는 선택한 학년도·과목·문형에 맞는 제목·설명과 정규화된 쿼리 canonical을 설정한다. `/community/:id`는 기존 게시글 조회 결과로 제목과 설명을 갱신한다. 모든 경로는 동일한 `index.html`을 받으므로 경로별 메타데이터는 브라우저에서 React가 실행된 뒤 적용된다.

홈의 기능 바로가기·정책 링크와 전역 하단 메뉴는 React Router 링크를 사용한다. 커뮤니티 목록의 게시글 제목에도 상세 URL 링크가 있으며, 기존 카드 전체 클릭 이동과 좋아요 버튼은 유지한다.

## 프론트엔드 패턴

- 페이지 파일은 화면 상태, Supabase 호출, 화면 렌더링을 함께 가진다.
- 재사용 가능한 도메인 시각화는 `TrendChart`, `MockTrendChart`, `ResultPanel`처럼 컴포넌트로 분리되어 있다.
- UI 상태는 `useState`, 파생값은 `useMemo`, 데이터 로딩·구독은 `useEffect`를 쓴다.
- 라우트 간 일회성 데이터는 React Router의 navigation state를 사용한다. 지원 분석 결과는 새로고침 대비로 `sessionStorage`에도 저장한다.
- 스타일은 Tailwind 유틸리티 클래스 위주이며, 범용 UI는 Radix 기반 컴포넌트를 사용한다.

## 배포 및 PWA

- Vite `outDir`은 `build/`이고 public 디렉터리는 `src/public/`이다.
- `vercel.json`은 정적 파일 캐시 헤더와 앱 경로의 `/index.html` rewrite를 설정한다. `pastExamDocuments.ts`의 78개 문제지는 Supabase 공개 버킷 `past-exams/watermarked/v1/`의 워터마크 PDF를 직접 참조한다. 원본 PDF·HWP는 로컬 다운로드 보관 영역에 유지하고 웹 빌드에 포함하지 않는다. `pastExamData.ts`가 정답 학년도와 문제지 학년도를 합쳐 선택 목록을 구성한다. 기출 PDF 유형은 단일 문형도 지원하되 기존 채점 타입은 홀수형·짝수형을 유지한다.
- `src/main.tsx`가 `/sw.js`를 등록한다. 서비스 워커는 캐시를 정리하고 네트워크 요청을 가로채지 않는다.
- 서비스 배포 버전의 단일 기준은 `package.json`의 `version`이며, `main` push 전 갱신 절차는 `docs/versioning.md`에 정의한다.

## 관찰된 구조상 주의점

- `App.tsx`가 라우팅, SEO 메타데이터, 이력 데이터, 이력 API 호출을 함께 담당한다.
- 커뮤니티·채팅·메모는 정규화 테이블을 직접 사용하지만, 성적 이력은 사용자별 JSON 배열을 KV 테이블 한 행에 저장한다.
- 원격 Supabase 마이그레이션 이력과 저장소의 `supabase/migrations/` 파일 목록이 일치하지 않는다. DB 작업 시 어느 쪽이 운영 기준인지 먼저 확인해야 한다.
