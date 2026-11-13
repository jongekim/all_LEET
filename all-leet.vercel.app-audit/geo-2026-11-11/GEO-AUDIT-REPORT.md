# all LEET GEO 점검 보고서

2026-11-11 KST에 all LEET 운영 웹사이트 v1.13.1(커밋 `568d36f5`)을 점검했다. 서비스 유형은 한국어 LEET 채점·기출 학습 도구다. [운영 사이트](https://all-leet.vercel.app/), [릴리스 커밋](https://github.com/jongekim/all_LEET/commit/568d36f55bb23b96efcf7c089db1337c2fbb21d9)

## 종합 평가

**GEO 준비도 40.4/100.** 홈과 기출문제는 크롤러가 첫 HTML에서 읽을 수 있다. 자체 집계 정답률, 시험별 환산표, 정답 및 PDF는 인용할 만한 자료다. 다만 그 수치의 정의와 근거가 독립적으로 읽을 수 있는 공개 문서에 모여 있지 않고, 외부 검색 표본에서 제3자 언급을 확인하지 못했다. 커뮤니티의 빈 첫 HTML과 없는 경로의 HTTP 200 응답도 운영에서 재현했다.

| 항목 | 평가 | 가중치 | 반영 점수 | 근거 |
|---|---:|---:|---:|---|
| AI 인용 적합성 | 62/100 | 25% | 15.50 | 홈 47, 2026 언어이해 74, 2027 추리논증 65. 직접 답변, 문맥의 독립성, 구조, 확인 가능한 사실, 고유 자료를 평가했다. |
| 브랜드 권위 | 5/100 | 20% | 1.00 | 자체 검색 결과는 발견했다. 표본에서 독립 언급을 확인하지 못해 스킬 최저 관측 구간의 중간값을 적용했다. |
| 콘텐츠·E-E-A-T | 38/100 | 20% | 7.60 | 원자료·정답률·환산표의 사용자 가치는 높다. 공개 출처 연결, 운영 주체와 검수·정정 근거는 부족하다. 경험 9, 전문성 10, 권위 3, 신뢰 11, 주제 범위 가산 5. |
| 기술 GEO | 70/100 | 15% | 10.50 | 공개 접근·발견 24/25, 최초 HTML·링크 22/25, HTTP·색인 지시 11/25, 모바일·성능 근거 및 전송 13/25. |
| 구조화 데이터 | 38/100 | 10% | 3.80 | 유효한 `WebSite` JSON-LD를 확인했다. 페이지·앱·운영 주체 연결이 부족하다. 스킬 원점수 30/100에서 이 도구에 부적합한 발행사 전용 항목과 종료된 검색창 항목을 제외하고 30/80을 환산했다. |
| 플랫폼 준비도 | 20/100 | 10% | 2.00 | Google AI Overviews, ChatGPT, Perplexity, Gemini, Bing Copilot의 공개 체크리스트 평균을 반올림했다. |
| **가중 합계** | | **100%** | **40.40** | `geo-seo-claude`의 가중치와 공개 근거에 따른 정성 평가. |

브랜드·플랫폼 점수는 공개 표본에서 확인 가능한 신호만 반영했다. AI 인용률, 검색 노출량·클릭, 색인 범위와 실사용자 Core Web Vitals는 계정 데이터 없이 확인하지 못했다.

## 우선순위와 실행안

| 우선순위 | 확인한 문제 | 권장 작업과 완료 기준 |
|---|---|---|
| P1 | **정답률과 환산값의 근거가 인용하기 어렵다.** 2026 언어이해의 정답·정답률 30개와 환산값 31행은 최초 HTML에 있다. 반복 채점과 실제 응시자 모집단의 차이도 들어 있다. 상세 산식과 출처 안내는 자바스크립트가 여는 모달에 있다. 2027 추리논증의 추정 표준점수 24개와 추정 백분위 25개는 각 셀의 `title`로 표시되어, 검색에서 텍스트만 읽으면 숫자와 추정 표시가 분리될 수 있다. | 정답률의 대상·분모·미응답·반복 처리, 정답/환산 원자료의 확인 범위, 2027 추정 방법, 검수·정정 절차를 설명하는 공개 문서를 만들고 기출에서 링크한다. 추정 여부는 숫자 옆의 텍스트 또는 연결된 표 주석으로 제공한다. 자바스크립트 없이 문서·링크·숫자별 표시가 읽히는지 검증한다. |
| P1 | **없는 URL과 로그인 응답을 구분하기 어렵다.** 임의의 없는 경로, `/llms.txt`, `/sitemap_index.xml`과 `/login`이 모두 동일한 빈 앱 HTML을 HTTP 200으로 반환했다. `/login` 첫 응답에는 페이지별 제목·canonical·noindex가 없다. | 없는 경로는 실제 404, 로그인 화면은 HTTP 200 및 첫 응답에서 noindex를 제공한다. 로컬 비화면 SEO 구현을 검토한 뒤 운영 GET으로 상태·헤더·본문을 재검증한다. |
| P2 | **커뮤니티가 사이트맵에 있지만 초기 HTML에 목록이 없다.** `/community`는 HTTP 200과 홈 제목을 반환했고 H1·canonical·게시글 본문이 없었다. | 커뮤니티를 검색 유입 대상으로 운영한다면 공개 목록·게시글에 해당 URL의 HTML과 제목·canonical을 제공한다. 목록은 최초 HTML의 공개 게시글 링크, 상세는 실제 공개 글의 200 및 없는 글의 404로 확인한다. |
| P2 | **페이지 유형과 출처가 기본 사이트 스키마에 연결되지 않는다.** 표본의 JSON-LD는 모두 `WebSite`였다. 공개 검색에서 독립적으로 확인할 수 있는 서비스 소개·검수 근거도 제한적이다. | 배포 대기 중인 `WebPage`를 우선 검증한다. 운영 주체를 확인할 수 있을 때 `publisher`를 연결하고, 홈의 실제 기능은 `WebApplication`으로 설명할 수 있다. 이용 안내와 데이터 기준을 공개 URL로 연결한다. |
| P3 | **`/llms.txt`에 유효한 텍스트 파일이 없다.** 현재 HTTP 200 응답은 홈용 HTML이다. | 잘못된 200을 바로잡는다. 사이트 안내 텍스트가 필요한 별도 소비자가 확인되면 검증된 공개 문서로 연결하는 선택 항목으로 둔다. Google은 이 파일을 AI 검색이나 순위에 사용하지 않는다고 명시한다. [Google AI 검색 가이드](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) |

P1 콘텐츠 표본은 운영 기출 페이지의 첫 응답을 확인했다. [2026 언어이해 홀수형](https://all-leet.vercel.app/past-exams?year=2026&subject=verbal&type=odd), [2027 추리논증](https://all-leet.vercel.app/past-exams?year=2027&subject=reasoning&type=odd)

P1·P2 기술 문제를 다루는 기존 작업은 로컬에 있으며 v1.13.1 운영 검증에는 포함되지 않았다. [로컬 비화면 SEO 구현](../../docs/seo-nonvisual-improvements.md)

## 발견·크롤링·인용 근거

- `robots.txt`와 `sitemap.xml`은 각각 HTTP 200으로 응답했다. 사이트맵의 고유 URL 84개 가운데 78개가 기출 조합이다. 각 대표 기출 최초 HTML에 선택별 제목·canonical·정답표·PDF 링크가 있다. 2026 언어이해 표본의 최초 HTML에서 기출 선택 링크 22개를 확인했다. [robots.txt](https://all-leet.vercel.app/robots.txt), [sitemap.xml](https://all-leet.vercel.app/sitemap.xml)
- robots의 공통 규칙은 홈·기출에서 Googlebot, Bingbot, OAI-SearchBot, Claude-SearchBot, PerplexityBot의 접근을 허용한다. 해당 User-Agent로 2026 기출에 요청한 5개 응답은 모두 HTTP 200이고 일반 요청과 바이트 단위로 같았다. 학습용 GPTBot·ClaudeBot 및 Google-Extended에도 공개 경로를 별도로 제한하는 규칙이 없었다. 이 검사는 이름을 사용한 HTTP 표본이다. 실제 서비스 IP에서의 크롤링·색인 기록은 확인 범위 밖이다. [OpenAI 크롤러](https://developers.openai.com/api/docs/bots), [Anthropic 크롤러](https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler), [Perplexity 크롤러](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)
- 홈은 로그인 없이 채점할 수 있다는 점, 문의, 약관과 개인정보처리방침을 제공한다. 채점 결과와 정답률의 차이, 각 도구의 이용 범위를 몇 문장으로 설명하는 공개 안내가 있으면 구체적인 질의에서 인용하기 쉬워진다. [운영 홈](https://all-leet.vercel.app/)
- 정확 도메인, 브랜드와 리트 채점 결합어, 국내 수험 커뮤니티와 YouTube·Reddit·LinkedIn·Wikipedia 검색 표본에서 확인 가능한 독립 언급을 찾지 못했다. 동명의 LeetCode 결과는 제외했다. 운영 기출 페이지의 웹 검색 결과는 확인했다. 비공개나 검색에 잡히지 않은 게시글은 조사 범위 밖이다.
- 공개 응답에서 `WebSite` JSON-LD의 문법과 속성을 점검했다. Google 사이트 이름에 필요한 기본 `name`과 `url`이 있다. 스키마 보강은 실제 서비스와 페이지의 관계를 설명하는 데 쓴다. Google AI 검색은 전용 스키마를 요구하지 않으며, 앱 리치 결과는 별도 요건을 가진다. [Google 사이트 이름 가이드](https://developers.google.com/search/docs/appearance/site-names), [앱 구조화 데이터](https://developers.google.com/search/docs/appearance/structured-data/software-app), [Google AI 검색 가이드](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- 운영 메인 JavaScript는 이번 gzip GET에서 396,001바이트였고 `immutable` 캐시가 적용됐다. 공개 PageSpeed API는 HTTP 429로 응답했다. 실제 사용자 LCP·INP·CLS와 현행 Lighthouse 점수는 확보하지 못했다. [운영 JS](https://all-leet.vercel.app/assets/index-WD6ZvNWW.js)

## 30일 검증 계획

1. 첫 주에는 없는 URL·인증 경로의 HTTP 응답을 바로잡고, Search Console의 홈·최신 기출·과거 기출·커뮤니티 URL 검사와 생성형 AI 노출 데이터를 기준선으로 기록한다.
2. 둘째 주에는 데이터 기준 문서와 표의 추정값 표시를 정리한다. 원자료 확인 범위, 정정 절차, 인용할 값의 단위와 정의를 직접 읽을 수 있어야 한다.
3. 셋째 주에는 공개 커뮤니티의 초기 HTML과 페이지 유형별 구조화 데이터를 확인한다. 운영자 정보는 검증 가능한 정보로 채운다.
4. 넷째 주에는 첫 HTML과 HTTP 응답을 다시 비교하고, Search Console 생성형 AI 노출·Bing AI Performance 인용·ChatGPT 유입 클릭을 각각 기록한다. 표본 질문은 `LEET 무료 채점 어디서 하나요`, `2026 언어이해 1번 정답률`, `2027 추리논증 환산표 추정 방식`처럼 서비스가 직접 답할 수 있는 질문으로 고정한다. [Search Console 생성형 AI 보고서](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports), [Bing AI Performance](https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/)

## 점검 범위

robots·사이트맵을 읽고 대표 경로 15개를 HTTP GET으로 확인했다. 홈, 기출 기본 및 선택본 4개, 이력 예시 2개, 커뮤니티 목록, 정책 2개, 로그인, 누락/특수 경로 3개다. 별도로 기출에 대한 크롤러 User-Agent 응답 5개와 메인 자산을 비교했다. 사이트맵의 84개 URL은 XML 목록 수이며 전수 방문 수가 아니다. 운영 저장·등록·로그인 및 조회수 증가가 발생하는 커뮤니티 상세 상호작용은 실행하지 않았다.
