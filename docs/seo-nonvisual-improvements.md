# 화면을 유지하는 SEO 개선

2026-11-10 요청 범위는 기존 화면·동작을 유지하는 HTTP 응답·검색 메타데이터·HTML 제공·전송 최적화다. 화면 문구·입력 라벨·연락처 동작·시험 선택 링크는 이번 변경에 포함하지 않는다. 앱 UI 변경 승인을 이 요청에서 추정하지 않는다.

## 경로와 검색 지시

`src/utils/appRoutes.ts`의 등록 경로 목록과 React Router 선언을 테스트로 대조한다. `scripts/generate-prerender-routes.ts`는 기존 83개 공개 HTML rewrite, 커뮤니티 함수 rewrite, 등록된 개인/인증 화면 shell rewrite를 생성한다. 포괄 `/(.*) → /app.html`은 제거한다. 실제 정적 파일은 플랫폼 파일시스템에서 제공되고, 없는 화면·파일은 Vercel의 `build/404.html`로 HTTP 404를 반환한다.

404 HTML에는 기존 빈 root와 동일 앱 스크립트를 넣는다. 새 오류 문구나 화면을 추가하지 않는다. 인증·개인·관리 화면 shell은 빈 root와 기존 앱을 유지하면서 자기 canonical과 noindex를 제공한다. 로그인·가입·비밀번호 화면은 검색 제목을 구분한다. 브라우저에서도 경로별 noindex를 적용하고 공개 화면 이동 시 제거한다. 공통 `app.html`에 일괄 noindex를 넣지 않는다.

`src/utils/seoHtml.ts`는 검색 메타데이터와 JSON-LD를 HTML 이스케이프하여 생성한다. 공개 페이지에는 기존 `WebSite`와 실제 제목·설명·URL을 사용하는 `WebPage`를 제공한다. 화면에 없는 평점·후기·작성자 자격·가격은 추가하지 않는다. `CommunityPostPage`가 기존 게시글 GET 결과로 상세 페이지 JSON-LD를 갱신하며 별도 브라우저 조회를 추가하지 않는다.

## 커뮤니티 요청별 HTML

Vercel의 정적 사이트와 Node 함수 빌드 모두 `vercel-build`를 실행한다. 함수 빌드도 렌더러와 HTML 템플릿을 자체 생성하므로 두 빌드의 파일 공유에 의존하지 않는다.

`api/community.ts`는 새 **Vercel Node.js Function** 진입점이며 Supabase Edge Function이 아니다. Vite가 `src/server/communityEntry.tsx`를 `.generated/community/handler.mjs`로 번들하고 앱 HTML template과 함께 함수의 includeFiles로만 포함한다. `.generated/`는 공개 build/ 밖에 있고 git에서 제외한다. 게시글 내용은 빌드 산출물·소스·서버 전역 캐시에 저장하지 않는다. 새 npm 패키지나 비밀 환경 변수는 없다.

목록·상세 요청마다 현재 브라우저와 같은 anon 공개 SELECT/RLS로 `community_posts`, `community_comments`, `community_post_likes`를 읽는다. 사용자 Cookie·Authorization을 전달하지 않고 service role도 사용하지 않는다. API에는 GET/HEAD만 허용한다. UUID 외 식별자는 조회 없이 404, 읽기 성공 후 없는 글은 404, 네트워크·권한·잘못된 데이터·크기 오류는 noindex/Retry-After를 가진 503으로 응답한다. 조회는 8초·JSON 2MB·HTML 4MB 제한이며 redirect를 따르지 않는다. 실패를 정상 빈 목록으로 저장하지 않는다.

기존 `AppContent`, `CommunityPage`, `CommunityPostPage`를 세션 없는 Context와 요청별 공개 데이터로 서버 렌더링한다. React effect가 실행되지 않으므로 서버에서 조회수 증가 RPC·로그인·좋아요·댓글 쓰기를 호출하지 않는다. `Cache-Control: private, no-store`와 `Vercel-CDN-Cache-Control: no-store`를 사용하여 삭제/권한 변경 후 오래된 응답을 재사용하지 않는다. 봇과 일반 사용자가 같은 HTML을 받는다.

브라우저에는 초기 데이터 JSON을 직렬화하거나 캐시에 주입하지 않는다. 기존 createRoot·AuthProvider·최신 DB 조회·필터·쓰기·이미지 보기·조회수 동작은 유지한다. 최초 HTML은 기존 `prerender-shell` 방식으로 최신 커뮤니티 조회가 끝날 때까지 유지하고, 새 root를 숨겨 중복·깜박임을 막은 뒤 한 번에 교체한다. 회원 화면은 항상 기존 인증 흐름에서 결정한다. 목록 필터 및 개인 좋아요 상태를 서버 응답에 섞지 않는다.

원격 검토(읽기 전용): 세 테이블의 컬럼과 RLS 활성화, 기존 공개 SELECT 정책, 최근 마이그레이션을 대조했고 anon 공개 GET 200을 확인했다. DB·RLS·Storage·Edge Function 변경은 없다. 게시글 자동 조회수 쓰기 때문에 운영 상세 페이지는 브라우저에서 열지 않는다.

## JavaScript와 이미지

외부 라이브러리를 별도 vendor chunk로 분리해 앱 코드가 바뀌어도 라이브러리의 장기 캐시를 재사용한다. 정적 import와 기존 앱 시작 순서·CSS를 유지하며 lazy/Suspense와 새 로딩 화면은 추가하지 않는다. 첫 방문의 전체 JavaScript 실행량이 크게 줄었다는 주장과 실제 사용자 CWV 통과 주장은 하지 않는다. UI를 유지한 캐시 재사용 개선이다.

운영 공개 게시글 6개에는 이미지가 없어 썸네일 원본 전송량을 측정할 수 없었다. 실제 Storage 이미지 변환 지원·전송 개선을 검증하지 못한 상태에서 원본 품질·업로드 규칙·공개 URL을 변경하지 않는다. 이미지 최적화는 확인 가능한 이미지 표본과 지원 기능을 확보한 뒤 진행한다. PageSpeed 공개 API의 이전 429와 실제 Search Console 자료 미연결은 여전히 별도 측정 한계다.

## 검증과 배포 경계

- 단위 검사: 경로 매트릭스/React Router 일치, noindex 범위, 메타데이터·JSON-LD의 XSS 이스케이프, 공개 GET 헤더, 삭제 후 404, 오류/크기 초과 503, 잘못된 UUID/POST 차단, HEAD 본문 없음.
- `npm run build:test`: 기존 통계 fixture만 사용하고 커뮤니티 데이터는 빌드에서 읽지 않는다. 83개 공개 HTML·개인 shell·404·비공개 함수 번들을 생성한다.
- `npm run test:prerender`: 기본 커뮤니티 preview를 합성 fixture로 격리한다. 83개 공개 HTML과 경로별 응답·커뮤니티 JS 없는 본문·실제 함수 진입점의 번들 로드를 확인한다. 기존 화면 동일성·비로그인 채점·모바일 검사를 유지한다.
- `SEO_BASELINE_ORIGIN`을 지정한 추가 화면 검사는 변경 전 소스로 별도 빌드한 앱과 홈·기출·로그인·커뮤니티 목록/상세를 1280/375px에서 비교한다. 모든 Supabase 요청은 합성 응답이며 운영 쓰기를 하지 않는다.
- `npm run check` 전체 게이트 후 최종 운영 build는 기존 공개 문항 통계 SELECT 한 번만 사용한다. 커뮤니티 공개 GET은 실제 적용 전 별도 읽기 검증한다.

이 변경은 로컬 구현이다. 커밋·main push·Vercel 배포·DB 적용·Edge Function 배포는 자동 실행하지 않는다. 운영 반영 시 새 Node 함수와 정적 산출물이 같은 배포에 포함되어야 한다. 함수는 요청별 공개 조회·서버 렌더링 비용과 지연을 추가한다. 배포 후 실제 Vercel의 파일시스템/404·정적 자산·함수 rewrite를 확인해야 하며 로컬 preview 결과가 플랫폼 검증을 대체하지 않는다.

## 최종 검증 기록 (2026-11-10)

- `npm run check`: 종료 코드 0. 단위 343개, 기존 일반 E2E 100개, 푸시 E2E 22개와 격리 SQL·Deno 검사를 통과했다. 게이트 안의 HTML 검사는 16개 통과·선택적 변경 전 화면 비교 2개 건너뜀이다.
- 최종 코드의 lint/타입 재검사 통과. lint 오류 0개, 경고 52개가 남아 있다. HTML 치환 특수문자 회귀를 추가한 뒤 관련 단위 검사 11개를 다시 통과했다.
- 최종 운영 빌드에서 `SEO_BASELINE_ORIGIN=http://127.0.0.1:4180 npm run test:prerender`: 18개 모두 통과했다. 기준 커밋 `d5f7275f060f5e306fed8339f55fd2ee177a5688`의 원래 App/커뮤니티 소스로 별도 빌드한 앱과 5개 화면×2개 너비, 총 10개 화면의 픽셀이 동일하다. CSS 파일 SHA-256도 동일하다. 최신 커뮤니티 조회를 보류한 동안 초기 제목·본문 유지와 중복 방지를 확인했다.
- 마지막 `npm run build`는 운영 공개 통계 38개 조합·발행본 1을 GET으로 읽어 기존 83개 공개 HTML을 생성했다. 최종 산출물은 테스트 통계 빌드가 아니다.
- 실제 Node 함수 진입점을 현재 공개 DB에 읽기 전용으로 연결해 목록·상세 HTTP 200을 확인했다. 목록 25,709 bytes, 상세 12,430 bytes, JSON-LD 2개, `private, no-store` 응답이다. 실제 외부 호출은 `community_posts` GET 두 번뿐이었으며 비조회 요청을 차단했다. 글 내용·식별자는 이 검증 기록에 저장하지 않았다.
- JS gzip 합계는 변경 전 390,519 bytes, 변경 후 앱 152,205 + vendor 237,396 = 389,601 bytes다. 첫 방문 전송량의 큰 감소는 없으며 목적은 앱 변경 시 약 237KB vendor 캐시의 재사용이다. 두 차례 앱 변경/빌드에서도 vendor 파일 해시는 유지됐다. CWV 통과를 주장하지 않는다.
- 기존 robots.txt의 개인 경로 차단은 보존했다. 차단된 URL의 noindex는 크롤러가 읽지 못할 수 있으며, 이번 직접적인 색인 지시 개선 대상인 로그인·가입·비밀번호·관리 경로는 robots 접근이 허용되어 있다. 실제 색인 제외 완료는 Search Console에서 별도 확인한다.
- 빌드가 추적 중인 `build/index.html`·기존 JS를 갱신하고 새 앱/vendor JS를 생성했다. 기존 사용자 변경은 보존했으며 `src/utils/supabase/info.tsx`, DB migration, Supabase 함수는 수정하지 않았다.

상세 실행 로그·자산 해시·공개 조회 집계는 `all-leet.vercel.app-audit/implementation/`에 기록했다. 감사 원문과 이번 구현은 서로 다른 시점의 기록이다. 변경 검토 후 작업 단위 커밋을 권장하며, main push는 실서비스 배포를 시작하므로 이번 검증만으로 실행하지 않는다.
