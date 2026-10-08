# 아키텍처

## 개요

all_LEET은 Vite로 빌드되는 React 단일 페이지 애플리케이션(SPA)이다. 브라우저는 Supabase Auth·PostgREST·Storage·Realtime에 직접 연결하고, 성적 이력 두 종류는 기존 Edge Function으로 저장한다. 이용 통계 수집·관리자 조회용 함수와 DB는 v1.5.0 운영 대상에 적용했다. Vercel은 정적 산출물과 SPA fallback을 제공한다.

```text
브라우저 (React / React Router)
 ├─ Supabase Auth
 ├─ Supabase Postgres (채팅, 커뮤니티, 오답 메모, 발행된 문항 통계)
 ├─ Supabase Realtime (채팅 INSERT 구독)
 ├─ Supabase Storage (커뮤니티 이미지, 공개 기출문제 PDF)
 ├─ Edge Functions usage-events / admin-analytics
 │    └─ private product_* 통계·세션·회원 최초 이용·관리자 조회 이력
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
- 답안 수정: `EditableAnswers` → `useUserHistory.updateOfficial` → 기존 이력 Edge PUT → service-only `user_history_update_answers`. 공유 재계산·기존 쓰기 잠금·전체 기록 비교를 사용한다. [설계](answer-edit.md) 참고.
- 결과 분석 UI: `ResultPanel`의 `FieldAnalysis`가 기존 `GradingResult.fieldAnalysis`를 요약하고 한 분야의 문항만 펼친다. 문항 선택 콜백은 `ResultPage`가 보관한 과목별 답안표 ref로 포커스·스크롤·일시 강조를 처리한다. `ResultRateVisibilityProvider`는 결과 화면에만 적용하여 두 과목의 공개 정답률 선택을 공유하고 브라우저 저장소에 기억한다. 기존 통계 hook의 enabled 인자를 사용하며 DB/API 계약은 바꾸지 않는다. [구현·검증](result-analysis.md) 참고.
- 인증 provider와 Supabase 클라이언트: `src/contexts/AuthContext.tsx`
- 화면: `src/pages/`
- 도메인 UI: `src/components/`
- 범용 UI 프리미티브: `src/components/ui/`
- 계산·정적 데이터·보조 기능: `src/utils/`

홈의 관리자 버튼 → `/admin` 관리 메뉴 → `/admin/announcements` 공지 목록·편집, `/admin/analytics` 이용 통계 또는 `/admin/dday` 디데이 설정으로 이동한다. 관리자 여부는 `AuthContext`가 기존 RPC로 확인해 버튼과 라우트에 공유한다. DB 변경 권한은 기존 RLS가 강제한다. 관리자 전용 반응형 스타일은 `src/styles/admin.css`에 있으며, 미리 생성된 `src/index.css`에 없는 Tailwind 유틸리티에 의존하지 않는다.

`App.tsx`는 `BrowserRouter`, `AuthProvider`, 전역 하단 내비게이션, PWA 설치 버튼, Vercel Analytics를 조립한다. `useUserHistory`가 공식/사설 이력과 로딩·오류 상태를 관리하고 페이지로 props를 전달한다. 계정 전환·로그아웃 때 이전 계정의 배열과 늦게 도착한 요청 결과를 사용하지 않는다. 동일한 사용자 ID의 토큰 갱신은 이력을 초기화하지 않는다.

### 백엔드

기존 운영 Edge Function은 `make-server-cd835c22`다. 통계용 `usage-events`와 `admin-analytics`도 운영에 등록·배포했다. 설정은 `supabase/config.toml`, 구현은 `supabase/functions/make-server-cd835c22/`에 있다. Deno에서 Hono를 실행하고 `SUPABASE_SERVICE_ROLE_KEY`로 `kv_store_cd835c22`를 읽고 쓴다.

`index.ts`가 실제 Auth/KV 의존성을 조립하고 `app.ts`의 Hono 앱을 실행한다. `auth.ts`는 명시적인 Bearer 토큰을 Supabase `getUser(token)`으로 검증한다. 테스트에서는 외부 요청을 모의 구현으로 대체한다.

`src/supabase/functions/server/index.tsx`는 등록된 진입점을 참조하는 레거시 어댑터다. 독립적인 라우트 사본을 유지하지 않으며 배포 경로로 사용하지 않는다. v1.4.5 서버 인증 변경의 운영 적용과 승인된 전용 테스트 계정 검증은 [이력 보안 배포 절차](history-security-rollout.md)를 따른다.

## 라우팅

### 문항 통계 조회·수동 발행

`QuestionStatistics`/`QuestionRate`와 `useQuestionStatistics`를 결과 답안 및 기출 정답표가 공유한다. 동일 학년도·유형의 두 과목은 한 공개 SELECT로 읽고 5분간 공유 캐시한다. RLS가 현재 발행 세대만 허용한다. 통계 오류·정답 버전 불일치가 개인 결과·메모·정답표를 막지 않는다.

개발자 전용 `scripts/question-statistics.ts`는 브라우저와 분리된 Supabase Management API로 읽기 전용 집계 파일 생성, 검증 파일의 원자적 전체 발행, 상태 확인, 롤백을 수행한다. 주기 작업·Edge Function·원본 이력 API 변경은 없다. 구조와 운영 절차는 [문항 통계 설계](question-statistics-design.md) 및 [수동 갱신](question-statistics.md)을 따른다.

공개 라우트는 홈(`/`), 결과, 로그인/회원가입/비밀번호 재설정, 약관, 커뮤니티, 채팅이다. `PrivateRoute`가 적용된 라우트는 지원 분석(`/admission`, `/admission-result`)과 사설 모의고사 입력(`/mock-input`)이다. `/history`와 `/mock-history`는 라우트 가드 없이 렌더링되며, 이력 로딩 자체는 현재 사용자 유무에 따라 동작한다.

공개 페이지의 사이트맵은 `scripts/generate-sitemap.ts`가 `src/public/sitemap.xml`에 생성한다. 기출문제 URL은 등록된 문제지 78개와 일대일로 대응한다. 검색 제목·설명·canonical은 `src/utils/pageSeo.ts`를 빌드와 브라우저가 공유한다. 홈의 검색 제목·설명은 LEET 채점, 문항별 정답률·선지별 응답 분포, 기출문제 PDF·정답표·환산표를 강조하며 기존 화면의 본문·레이아웃은 유지한다.

`npm run build`는 Vite 빌드 후 `scripts/prerender.ts`가 기존 React 화면을 Vite SSR/React 서버 렌더러로 HTML에 기록한다. 대상은 홈, 성적 이력 예시 두 경로, 정책 두 경로, 기출문제 선택 URL 78개로 총 83개다. `scripts/prerenderStatistics.ts`가 기존 anon 키와 SELECT/RLS로 현재 공개 발행 통계 전체를 GET 한 번으로 읽고, 응답 건수·문항 합계·시험 조합 중복·발행본 일치를 검증한다. 요청은 15초 제한·redirect 금지·캐시 미사용이다. 조회 실패·부분 응답·잘못된 통계에는 빌드를 실패시키며 오래된 파일로 대체하지 않는다.

`src/entry-prerender.tsx`는 `StaticRouter`, 세션 없는 인증 Context, 빌드 전용 `PrerenderStatisticsContext`로 `AppContent`를 렌더링한다. AuthProvider·React effect는 실행하지 않는다. 공개 통계 조회를 마친 뒤 실제 React 렌더링에서는 외부 fetch를 금지하며 공지·개인 이력·인증·쓰기 요청은 실행하지 않는다. 원본 통계 JSON·집계 건수·조회 일자는 HTML에 직렬화하지 않고 기존 문항별 정답률과 경고만 렌더링한다. 미발행 시험과 정답 버전 불일치는 기존 상태를 유지한다.

`PastExamReview`는 기존 정답표를 forceMount하고 닫혀 있을 때 `hidden`을 적용하여 실제 사용자가 펼쳐 볼 표를 최초 HTML과 브라우저 DOM에 보관한다. 기본 접힘·버튼·디자인·정답률 모달·시험 변경 후 다시 접힘은 유지하며 별도의 검색엔진 전용 본문을 추가하지 않는다. 브라우저는 빌드 통계를 초기 캐시에 넣지 않고 기존 공개 DB 조회·5분 공유 캐시·포커스 재조회·오류 재시도를 사용한다. 통계 조회는 기출 페이지의 접힌 표가 마운트되는 시점부터 시작한다.

DB의 공개 발행 통계가 갱신되어도 이미 배포된 HTML은 자동 변경되지 않는다. 통계를 새로 발행한 뒤 Vercel의 최신 Production 배포를 빌드 캐시 없이 Redeploy하면 코드 변경·새 커밋·push 없이 현재 공개 통계로 HTML을 다시 생성한다. 새 학년도 등 코드/DB 지원 범위 변경은 별도 개발·검증·배포가 필요하다. 운영 절차는 [정답률 HTML 갱신](question-statistics-html.md)을 따른다.

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

## 관리자 디데이 설정

`src/main.tsx`는 `BrowserRouter` 마운트 전 미저장 디데이 변경용 popstate 리스너를 설치한다. 폼의 `useUnsavedDdayChanges`가 현재 가드를 연결하며, 이동 취소와 이력 복구 이벤트를 라우터에 전달하지 않아 같은 폼 인스턴스·입력을 유지한다. 확인창 승인 시에는 기존 라우터 이동을 허용한다.

`/admin/dday`는 기존 `AdminRoute`·`AuthContext`를 사용하고 계정 ID로 재마운트된다. `examScheduleApi`가 기존 Supabase 클라이언트로 공개 한 행을 읽고 날짜·문구만 버전 조건으로 수정한다. 15초 제한·요청 취소·요청 전후 계정 검사·충돌·응답 미확인 재조회를 적용한다. 별도 Edge Function이나 인증 원본은 추가하지 않는다.

`ExamScheduleProvider`의 `ExamScheduleStore`가 요청 합치기·공개 localStorage 캐시·저장 응답 반영·늦은 응답 차단을 제공한다. `examScheduleModel`과 `ddayTemplate`은 순수 계산·검증·치환이고 `useKstNow`가 자정·포커스 복귀를 갱신한다. 관리자 미리보기와 홈·로그인·회원가입은 같은 로직으로 문구를 표시한다. `DdayText`는 관리자가 설정한 템플릿을 React 텍스트로 출력하며 긴 문구는 영역 안에서 줄바꿈한다. 세 공개 경로 진입·visible 60초 주기·포커스/온라인/storage 알림에 재조회한다. Provider를 사전 렌더링에도 사용하되 초기 HTML에는 조회 중 상태만 기록하므로 DB 값을 빌드에 고정하지 않는다. 런타임 기본 시험일은 제거했다. [디데이 설계](admin-dday-design.md)를 따른다.

## 관리자 이용 통계

`useUsageTracking`이 계정·라우트·실제 조작의 공통 수집 상태를 관리한다. `analyticsClient`의 메모리 큐·채널별 30분 세션·입력/실행 ID와 `usageAnalytics`의 운영 origin/명시 스위치를 사용한다. 일반 화면 UI는 유지하고 기능 성공/열기 위치에 관측만 추가했다. 배경 이력 조회, 설치 상태 확인, SW 갱신은 핵심 이용으로 취급하지 않는다. 브라우저 오류/차단으로 통계가 미도달해도 계산·이력 저장을 막지 않는다.

`adminAnalyticsApi`는 최신 계정 토큰으로 GET을 실행하고 요청 전후 계정 일치를 확인한다. 화면은 계정별 재마운트, 취소·15초 제한·no-store를 사용하며 검색어를 URL에 넣지 않는다. `AdminAnalyticsPage`의 7개 탭과 `admin-analytics.css`는 승인된 관리자 범위에만 적용된다. 관리자 화면·실제 관리자/승인된 테스트 계정은 이용 수집에서 제외한다.

신규 등록 경로 `supabase/functions/usage-events`와 `admin-analytics`는 `_shared/analytics-app.ts`의 검증/인가와 `analytics-runtime.ts`의 실제 Auth/service role 의존성을 분리한다. 관리자 요청마다 기존 JWT·역할 RPC 확인 후 service-role 전용 SECURITY INVOKER 집계를 호출하며 SQL에서 실제 요청자 역할을 재검사한다. 개인 조회 감사와 응답은 동일 트랜잭션이다. private 테이블은 클라이언트에 직접 노출하지 않는다. 수집 스위치 중단 구간은 설정 트리거로 기록하여 재개 이후 가용 범위를 부분 상태로 유지한다. 운영 중 원인 불명 수집 누락까지 완전 관측으로 보장하지 않는다.

현재 상태·출처별 필터·후속 기능·운영 적용 순서는 [통계 구현·운영](admin-analytics.md)을 따른다. 두 통계 함수도 main 변경 배포 대상에 포함했다. 실제 운영 적용·수집 개시·배포 검증 기록은 [v1.5.0 운영 적용](admin-analytics-rollout.md)을 따른다.

대시보드·회원 선택 확장에는 `_shared/dashboard.ts`의 순수 기간/집계/정책 계산, `AdminDashboard`/`AdminMemberPicker`의 서비스 주입, `AdminAnalyticsError`/화면 단위 `AnalyticsAuthorizationScope`를 추가했다. 현재 계정의 HTTP 401/403은 모든 개인 결과를 제거하고 취소·세대 검사로 늦은 성공을 차단한다. AuthContext 외 인증 원본을 추가하지 않는다. `dashboard_source`는 SQL 한 읽기 스냅샷의 내부 사실을 서버에 제공하고 공개 DTO는 집계만 반환한다. 목록/피드의 개인 응답과 감사는 동일 트랜잭션이다. 신규 UI 컴포넌트는 사용자의 명시적 승인 뒤 실제 통계 페이지에 연결했다. 개인 선택 상태를 가진 화면 본문은 권한 거절 때 전체 언마운트하여 모든 메모리 결과·선택·검색·커서를 제거한다. [확장 구현 문서](admin-dashboard-implementation.md)를 따른다.

## 관리자 사용자 데이터 경계 (v1.7.0)

로컬 회원 목록 확장은 `user_data_members_recent`의 전체 최근 이용순·건수 요약과 HMAC 복합 커서를 사용한다. `useServiceActivity`·`service-activity`는 일반 UI 변경 없이 운영 로그인 사용자의 마지막 이용 시각만 기록하고 기존 통계 제외 정책과 독립적이다. 구성·전체 이력 탈퇴 보관·운영 미적용 상태는 [회원 목록 확장](admin-user-data-member-list.md)을 따른다.

`/admin/user-data`는 기존 관리자 인증을 유지하고 선택 사용자의 데이터를 서버 adapter로 기존 페이지에 주입한다. `admin-user-data`는 매 JWT/현재 역할을 검증하고 service-only `user_data_*` RPC로 읽기·준비·승인 적용·상태 대조를 수행한다. 소유자 RLS를 관리자용으로 넓히거나 사용자 세션을 대체하지 않는다. 선택/입력은 메모리에서만 유지하며 대상 전환·403·새로고침 시 비운다.

`admission-history`는 유효한 분석 실행을 headless 저장하고 결과 이동을 기다리지 않는다. 계산 모듈은 `supabase/functions/_shared/user-data-rules/`에서 프론트와 Edge가 공유하며 `src/utils`는 기존 export 계약을 유지한다. 기존 이력 Edge 쓰기는 `user_history_mutate`로 옮겨 관리자와 같은 키 잠금을 사용한다. Storage/Auth 외부 변경은 영속 작업 의도·hash 대조·outbox·unknown/partial 상태로 관리한다. 구성/배포 순서는 [구현·운영](admin-user-data-implementation.md)을 따른다.

## 웹·PWA 수동 푸시

푸시 관리자 상단의 구독 통계는 `PushSubscriberStats`에서 기존 admin-push의 `/statistics`를 조회한다. 서비스 전용 읽기 RPC `push_subscriber_statistics`가 활성 구독의 회원 DISTINCT·전체/회원/비회원 기기를 한 번에 집계한다. 실패와 0을 구분하며 계정·권한 경계를 유지한다. [집계·조회·적용 순서](push-subscriber-statistics.md)를 따른다.

앱 공통 `PushConsent`는 사용자 요청에 따라 Radix Dialog 팝업으로 변경했다. `HomePage`에서 `AppContent`로 옮겨 회원·비회원이 일반 서비스 화면으로 직접 진입해도 자동 안내하며 관리자 작업 화면은 제외한다. `usePushSubscription`이 상태 조회 완료와 권한을 제공하고, 서비스 진입 후 3초 지연 안내한다. 미동의는 서버 확인 결과와 관계없이 안내하고 권한만 허용한 기기는 등록 확인 후 미등록일 때 안내한다. localStorage의 버전 있는 유예 키에 7일 뒤 시각만 기록하며 계정/등록 상태의 원본으로 사용하지 않는다. 새로고침·탭 간 storage 이벤트와 화면 복귀 시 재확인한다. 완료/등록 대기/유예 중에는 자동 표시하지 않으며 차단·미지원·설치 필요·서버 오류에는 해당 안내를 제공한다. 상단 재진입 링크를 제거하고 팝업 안의 명시적 권한·등록 처리만 제공한다. 브라우저에서 허용을 선택하거나 이미 허용한 기기에서 등록을 시작하면 팝업을 즉시 닫고 서버 등록은 계속한다. 허용 후에는 같은 서비스 방문 중 자동으로 다시 열지 않고, 7일 나중에 유예를 기록하지 않는다. 실패한 미등록 기기는 다음 접속에서 팝업으로 다시 안내한다.

사용자가 [분리 미리보기](previews/push-notifications.html) 범위의 UI를 승인했다. `/admin/push`와 앱 공통 `PushConsent`, 인증 연결, 기존 SW의 수신/클릭/등록 ACK를 연결했다. private 관계형 outbox·세대 고정 preview·append-only 시도/감사·worker slot을 Supabase Edge 세 함수에서 처리한다. 기본 기능 스위치는 꺼져 있으며 v1.9.0 운영에서는 등록·관리자 현재 기기 테스트를 먼저 활성화한다. 공지/앱 기능 연결·예약은 추가하지 않았다. [구현·운영 준비](push-notifications-implementation.md)에 실제 소스·권한·설정·기동/검증 경계를 기록한다. 운영 DB·Edge·키·Cron 적용과 일반 발송 개방 조건은 [v1.9.0 운영 기록](push-notifications-rollout.md)을 따른다.
