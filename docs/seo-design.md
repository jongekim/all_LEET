# 검색 노출 개선 설계

작성 기준: 2026-09-24 저장소 코드와 정적 산출물. 아래 문제 표는 개선 전 진단 기록이다. 검색엔진의 실제 색인 상태, 유입량, Core Web Vitals는 Search Console·네이버 서치어드바이저·현장 측정 자료가 없어 판정하지 않는다.

## 적용 상태

홈·기출 목록·2009~2027학년도 기출·문항별 정답률에 경로별 초기 HTML, 고유 메타데이터, canonical 및 실제 링크를 적용했다. 사이트맵은 빌드에서 색인 대상 22개 URL만 생성한다. 다른 앱 화면은 `noindex`를 적용하고 미등록 정적 경로는 404로 처리한다. 공개 Supabase 통계 발행본 1의 76개 조합을 읽기 전용으로 검증해 `src/data/seoQuestionRates.json`에 비율·표본·발행 시점을 기록했다. `/question-rates`는 기본 2025학년도 홀수형 두 과목의 실제 정답률을, 2009~2026학년도 기출 페이지는 해당 연도의 양 과목·양 문형 정답률을 초기 HTML에 담는다. 2027학년도는 미발행 상태를 알린다. DB·Storage·Edge Function은 변경하지 않았다. 배포 후 실제 색인과 검색 성과는 별도 확인이 필요하다.

학년도별 페이지는 등록된 PDF 문형·개수, 정답 데이터에 따른 과목별 문항 수, 환산표 제공 여부를 해당 연도의 실제 데이터에서 계산해 설명한다. 공개 정답률은 정답 버전이 앱과 일치할 때만 검색용 요약에 포함한다. 원본 통계가 새로 발행되면 `npm run seo:sync-statistics`로 파일을 갱신하고 diff를 검토한 뒤 웹앱을 다시 빌드·배포한다. 정적 요약에는 발행일을 명시하며, 대화형 정답표는 기존처럼 최신 공개 발행본을 직접 조회한다.

남은 범위: 커뮤니티 글의 서버 렌더링·삭제 시 HTTP 404, 약관/개인정보처리방침의 검색 색인 여부 재검토, 정적 HTML과 React의 완전한 hydration, 실측 Core Web Vitals와 검색 유입 분석.

## 현재 상태와 문제

| 우선순위 | 관찰 | 영향 |
| --- | --- | --- |
| P0 | `index.html`의 `#root`가 비어 있고 모든 앱 경로가 같은 HTML로 rewrite된다. 제목·설명·canonical도 대부분 React `useEffect`에서 설정된다. | 최초 HTML에서 공개 페이지의 본문과 고유 메타데이터를 읽을 수 없다. Google·네이버 모두 JavaScript를 처리할 수 있지만, 렌더링 단계에 의존하며 다른 미리보기 수집기는 결과가 다를 수 있다. |
| P0 | 사이트맵에 `/history`, `/mock-history`, 로그인·가입·비밀번호 복구 URL이 있고, 핵심 `/community`와 `/terms`는 없다. `lastmod`는 수동 고정값이다. | 개인/인증 화면에 수집 신호를 보내고 실제 공개 콘텐츠의 발견 경로가 약하다. |
| P0 | `robots.txt`에서 `/result`, `/admission` 등 일부 앱 경로를 차단하지만 응답 자체에 `noindex`가 없다. | robots 차단은 색인 제외 규칙이 아니다. 외부 링크로 발견된 URL이 내용 없이 노출될 수 있다. |
| P1 | `ROUTE_SEO`에 없는 라우트는 홈 제목·설명을 사용하면서 현재 경로를 self-canonical로 설정한다. `/community/:id`와 알 수 없는 URL도 여기에 해당한다. | 페이지 내용·메타데이터가 맞지 않고, 존재하지 않는 경로도 SPA fallback으로 200 응답을 받는다. |
| P1 | 하단 내비게이션은 `button` + `navigate()`, 커뮤니티 글은 클릭 가능한 `div`다. 기출 선택은 query 변경 버튼이다. | HTML의 `a[href]`로 공개 콘텐츠 경로를 발견하기 어렵다. 기출 연도·과목·유형별 검색 의도를 충족할 고유 페이지가 없다. |
| P1 | `index.html`의 WebSite JSON-LD와 `App.tsx`가 삽입하는 WebSite JSON-LD가 중복되고 이름이 다르다. `og:image`는 상대 SVG 경로다. | 사이트 정체성 신호와 공유 미리보기가 일관되지 않다. |
| 확인 필요 | 현재 `build/assets`의 주 JavaScript 파일은 약 1.1 MB(압축 전)이다. | 실제 LCP/INP/CLS 문제는 이 숫자만으로 판단할 수 없다. 모바일 현장 지표와 Lighthouse로 확인한다. |

개선 전 근거 파일: `index.html`, `src/main.tsx`, `src/App.tsx`, 당시 `src/public/sitemap.xml`, `src/public/robots.txt`, `vercel.json`, `src/components/GlobalBottomNav.tsx`, `src/pages/CommunityPage.tsx`, `src/pages/PastExamsPage.tsx`.

## URL별 색인 정책

| URL | 목표 | 처리 |
| --- | --- | --- |
| `/` | 색인 | 채점 도구의 효용, 사용 방법, 기출·성적 분석으로 가는 실제 링크가 담긴 초기 HTML 제공. 고유 title/description, self-canonical. |
| `/past-exams` | 색인 | 기출 목록·대상 학년도·과목·정답표 안내를 초기 HTML로 제공. self-canonical. |
| `/past-exams/2009`~`/past-exams/2027` | 색인 | 학년도별 PDF 링크·문형별 정답표를 초기 HTML로 제공. self-canonical. |
| `/question-rates` | 색인 | 정답률의 출처·한계와 기존 통계 UI를 제공. self-canonical. |
| `/community` | 조건부 색인 | 공개 글 목록을 초기 HTML로 제공하고 목록이 실질적으로 유용한지 확인한 뒤 사이트맵에 추가. |
| `/community/:id` | 추후 판단 | 글별 고유 title/description, 본문 초기 HTML, 삭제 시 404, 공개 상태·신고/관리 정책이 준비된 글만 색인. 준비 전에는 `noindex`와 사이트맵 제외. |
| `/privacy-policy`, `/terms` | 현재 색인 제외 | 앱 HTML에서 `noindex` 처리한다. 고유 본문 초기 HTML을 제공할 때 색인 여부를 재검토한다. |
| `/history`, `/mock-history` | 색인 제외 | 개인 기록 또는 예시 UI이므로 사이트맵에서 제거하고 URL 응답에 `X-Robots-Tag: noindex`. 공개 예시를 검색 대상으로 만들려면 별도 설명 페이지를 만든다. |
| `/result`, `/admission*`, `/mock-input`, `/admin*`, `/chat`, 인증·비밀번호 경로 | 색인 제외 | 사이트맵 제외. 경로별 응답 헤더 `X-Robots-Tag: noindex`. 인증 자체는 기존 접근 제어가 담당한다. |
| 미등록 경로·없는 게시글 | 색인 제외 | 실제 HTTP 404와 사용자용 404 화면. SPA의 일괄 200 응답을 피한다. |

`robots.txt` 차단과 `noindex`를 같은 URL에 동시에 적용하지 않는다. 검색 로봇이 `noindex`를 읽을 수 있어야 한다. 공개할 가치가 있는 콘텐츠만 sitemap에 담고 `lastmod`는 실제 본문 변경 시에만 갱신한다. `changefreq`와 `priority`는 제거해도 된다.

## 구현 구조

1. **색인 정책의 단일 기준**: 경로 정의를 `src/seo/`의 공개 라우트 설정으로 분리한다. `title`, `description`, `canonical`, `indexable`, 공개 HTML 렌더링 방식, 사이트맵 포함 여부를 한곳에서 정의한다. `App.tsx`의 기본 홈 메타데이터 fallback을 없애고 동적·미등록 경로는 별도 처리한다. canonical의 기준 도메인은 실제 운영 도메인 하나로 통일한다.
2. **공개 경로의 초기 HTML**: 현재 앱 기능은 SPA로 유지하되 `/`와 `/past-exams`부터 빌드 시 정적 렌더링한다. 공개 본문을 인증·브라우저 API·Supabase 호출에 의존하지 않는 컴포넌트로 분리하고, 경로별 HTML에 본문·`h1`·메타데이터·canonical·한 개의 WebSite JSON-LD를 넣는다. React가 이 마크업을 이어받도록 hydration 경계를 정하고, 서버와 클라이언트 첫 렌더가 일치하는지 검증한다. 단순히 JS가 실행된 뒤 `document.head`를 바꾸는 방식만으로 P0 문제를 해결했다고 보지 않는다.
3. **라우팅과 응답**: Vercel에서 생성된 공개 HTML 및 404 응답을 SPA fallback보다 우선 제공한다. 개인·인증 URL에는 경로별 `X-Robots-Tag` 헤더를 적용한다. 미등록 URL을 `/index.html`로 200 rewrite하는 현재 catch-all을 404 처리와 양립하도록 조정한다. 동적 커뮤니티 글을 공개할 때는 별도 서버 렌더링/캐시 전략과 삭제·수정 반영 시간을 설계한다.
4. **발견 가능한 링크**: 공개 페이지로 이동하는 하단 내비게이션과 커뮤니티 글 제목을 React Router `Link` 또는 실제 `<a href>`로 바꾼다. 작성·좋아요·필터처럼 UI 동작을 수행하는 요소는 버튼으로 유지한다. 홈에서 기출문제, 커뮤니티, 서비스 사용법으로 이어지는 설명형 링크를 제공한다.
5. **기출 콘텐츠 확장**: 우선 `/past-exams`의 고유 설명과 학년도 목록을 강화한다. 검색 수요가 확인된 연도·과목만 상세 URL(예: `/past-exams/2027/verbal`)을 만들고, 해당 조합의 고유 제목·설명·문제지·정답표·환산표를 초기 HTML에 담는다. 현재 query 선택 URL은 상세 URL 도입 전까지 `/past-exams`로 canonical을 통일한다. 동일 본문을 수십 개 조합으로 자동 복제하지 않는다.
6. **콘텐츠와 구조화 데이터**: 채점 기준, 점수 해석, 기출 사용법, 데이터 출처·업데이트 시점을 실제 화면에서 설명한다. 저작권 있는 기출 본문을 재게시하는 설계는 피한다. WebSite JSON-LD는 하나로 통일하고 실제 페이지에 존재하는 정보만 표시한다. 공유용 이미지는 절대 URL의 래스터 이미지로 만들고 대표 URL에서 미리보기를 확인한다. 구조화 데이터가 검색 결과의 특별 노출을 보장한다고 가정하지 않는다.

## 실행 순서와 완료 조건

### 1차: 색인 신호 정리

- 사이트맵을 색인 대상 URL만으로 재구성하고 `lastmod`를 실제 변경에 맞춘다.
- robots 차단·`noindex`·canonical 정책을 URL 표와 일치시킨다.
- WebSite JSON-LD 중복과 기본 홈 메타데이터 fallback을 제거한다.
- 미등록 경로의 실제 404 처리 방식을 정한다.

완료 확인: 각 URL의 HTTP 상태, `X-Robots-Tag`, 최초 응답의 canonical/title/description, sitemap 포함 여부가 표와 일치한다.

### 2차: 공개 콘텐츠의 초기 HTML과 링크

- `/` 및 `/past-exams`에 정적 렌더링을 적용한다.
- 실제 `href` 링크를 제공한다. 고유 콘텐츠가 준비된 뒤 `/community`를 확장한다.

완료 확인: 작업 중에는 빌드된 대표 HTML의 고유 `h1`·핵심 본문·링크를 확인한다. 배포 직전에 `npm run check`로 전체 읽기 전용 E2E와 기존 채점/기출 조회 회귀를 검증한다.

### 3차: 검색 성과와 확장 판단

- Google Search Console과 네이버 서치어드바이저에서 sitemap 수집, 대표 URL 검사, 색인 상태, 검색어·노출·클릭을 기록한다.
- 모바일 현장 Core Web Vitals와 Lighthouse를 측정한 뒤 필요한 경우 코드 분할·이미지·광고 스크립트 로딩을 최적화한다.
- 연도별 기출 상세 URL과 공개 커뮤니티 글 색인은 실제 수요, 콘텐츠 품질, 운영·삭제 정책을 확인한 후 진행한다.

## 참고 가이드

- [Google: JavaScript SEO 기본사항](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google: 사이트맵 생성과 제출](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google: robots.txt 소개](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
- [네이버: 자바스크립트 검색 최적화](https://searchadvisor.naver.com/guide/seo-advanced-javascript)
- [네이버: 리소스와 링크 관리](https://searchadvisor.naver.com/guide/resource-and-link)
