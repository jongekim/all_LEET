# 관리자 통계 v1.5.0 운영 적용

적용일: 2026-10-04 KST. 사용자가 실제 서비스 반영·버전 관리·커밋·푸시를 명시적으로 요청했다. 대상은 기존 Supabase `LEET_Service` (`jkxxtyaanyhmjbdtybkp`), Vercel `all-leet`, 운영 origin `https://all-leet.vercel.app`이다. 다른 작업의 기출 이미지·마크다운 산출물과 개발 캐시는 릴리스에서 제외한다.

## 적용 범위

- 서비스 버전을 1.4.6에서 1.5.0으로 올린다. 관리자 기능과 호환되는 API 확장이므로 MINOR 릴리스다.
- 실제 관리자 통계 7개 탭, 변화 대시보드, 회원 선택기를 포함한다. 일반 사용자 화면의 기존 흐름을 유지하고 이용 관측 코드를 배포한다.
- 통계 마이그레이션 `20261003141220_product_usage_analytics.sql` 다음 `20261004050638_admin_dashboard_and_member_options.sql`을 적용한다. 원격에만 있는 과거 마이그레이션을 재적용하거나 이력을 덮어쓰지 않는다.
- `usage-events`, `admin-analytics`를 배포하고 기존 Supabase 함수 CI에도 포함한다. 기존 이력 함수의 인증·저장 구현은 변경하지 않는다.
- 프론트 Vercel production 환경에만 `VITE_USAGE_ANALYTICS_ENABLED=true`, `VITE_USAGE_ANALYTICS_ORIGINS=https://all-leet.vercel.app`을 설정한다. 함수에는 같은 `ANALYTICS_ALLOWED_ORIGINS`를 설정한다. preview·로컬은 수집하지 않는다.
- DB 최초 개시 시각은 실제 활성화 시각으로 기록하며 기존/익명 과거 이용을 생성하지 않는다. 관리자 및 등록된 테스트 회원은 수집에서 제외한다. 회원 이름·이메일은 현재 Auth 정보로 조회하며 실제 UUID를 유지한다.

## 검증·배포 상태

운영 적용 전 실제 객체·마이그레이션 이력·RLS·관리자 RPC·Auth 열·역할을 읽기 전용으로 확인했다. 운영에 통계 객체가 없고 기존 관리자/KV 테이블에 RLS가 있는 것을 확인했다. 두 후보 마이그레이션을 실제 운영 스키마에서 한 트랜잭션으로 실행하고 service-role 대시보드·회원 목록·피드·회원 보고서, 관리자 검사, 일반 역할 EXECUTE 차단 및 Auth 비밀번호 열 접근 차단을 확인한 뒤 **전체 롤백**했다. 이 검증의 회원 자료는 출력하거나 파일로 저장하지 않았다.

최종 `npm run version:verify`와 운영 수집 환경 변수를 고정한 `npm run check`를 통과했다. lint 오류 0(기존 경고 74개), TypeScript, Vitest 177개, 기존 이력 Edge 100개·통계 Edge 10개, 합성 SQL 두 검증, Playwright 54개, 운영 설정 빌드·공개 83개 HTML 생성·사전 렌더링 8개를 확인했다. 병렬 빌드로 산출물이 교체된 검사는 순차 실행으로 재검증했으며 일반 회원 인증 이동의 개발 서버 대기는 15초로 제한했다. 실제 권한·요청 차단 검사 조건은 유지했다.

운영 DB·두 통계 함수 적용 및 Vercel production 환경 변수 설정을 완료했다. DB 수집과 서버 `USAGE_ANALYTICS_ENABLED=true`를 활성화했으며 최초 개시 시각은 **2026-10-04 16:27:37 KST**다. 초기 미관측 기간은 미가용이며 첫날은 부분 관측으로 표시한다. 실제 일반 회원 목록은 수집 여부와 독립적으로 탐색할 수 있다. 웹 릴리스는 이 기록을 포함한 v1.5.0 커밋의 main push로 배포하고 해당 커밋의 Vercel READY·실서비스 HTML/정적 자산·로그인 경계 응답을 확인한다. 실제 배포 커밋과 완료 결과는 작업 최종 보고에 기록한다.

운영 DB에는 두 원래 버전과 각 SQL 원문을 동일 적용 트랜잭션의 마이그레이션 이력에 기록했다. 이력 SQL 문자열을 전달하는 로컬 도구의 첫 치환 오류는 트랜잭션 전체 실패·롤백 후 수정하여 다시 적용했다. 최종 메타데이터에서 12개 테이블 모두 RLS가 켜지고 anon/authenticated SELECT가 없으며, 9개 공개 RPC 모두 SECURITY INVOKER·service-role EXECUTE 전용인 것을 확인했다. 기존 이력 함수 v9는 별도 통계 함수 배포 중 유지했다.

실제 HTTP 검증에서 관리자 API의 익명·무효 JWT는 401, 허용하지 않은 origin은 403, 수집 CORS preflight는 204, anon의 개인정보 RPC 실행은 401, service-role PostgREST 대시보드 조회는 200이었다. 실제 로그인한 관리자 JWT의 전체 개인 목록 흐름과 실제 설치한 iOS/Android PWA를 운영 계정으로 추가 조작하지 않았다. 해당 화면 흐름은 모의 JWT/서버 응답의 화면 테스트와 합성 SQL에서 검증했다.

CI와 같은 `npm ci --legacy-peer-deps`의 깨끗한 임시 설치에서 새 React 테스트에 필요한 DOM 패키지가 빠지는 것을 발견했다. `@testing-library/dom` 10.4.2를 직접 개발 의존성으로 고정한 뒤 같은 설치 조건에서 확인했다.

## 운영 경계

원본 상세 90일·회원 활동일 180일·조회 이력 13개월·발행 사실 25개월은 조회 범위다. **물리 자동 삭제, 탈퇴 cascade, 예약 일별 발행은 이번 릴리스에 포함하지 않는다.** 장기 발행이 없는 날짜는 미가용으로 표시하며 실제 과거 사용량을 추정하지 않는다. 장기 비교 유지에는 원본이 가용할 때의 수동 완료 날짜 발행이 필요하다. [구현 문서](admin-dashboard-implementation.md)의 발행 계약을 따른다.

문제가 생기면 DB `private.product_analytics_settings.collection_enabled=false`를 먼저 설정하여 확인된 중단 구간을 기록하고 서버 `USAGE_ANALYTICS_ENABLED`를 끈다. 최초 `started_at`은 재시작 때 바꾸지 않는다. Vercel 롤백만으로 수집 상태가 중지되는 것은 아니다. 기존 Auth·성적 이력·Storage 데이터를 삭제하지 않는다.
