# 관리자 이용통계 v1.13.0 운영 적용

2026-10-16~17 KST. 사용자가 최종 검증 후 버전 관리·커밋·push·배포를 요청했다. 대상은 기존 Supabase `LEET_Service` (`jkxxtyaanyhmjbdtybkp`)와 Vercel `all-leet` (`prj_o17bvmZ1dChYN4L2cV8VcO2v5uie`, `JEKim's projects`), 운영 주소 `https://all-leet.vercel.app`이다.

## 범위와 적용 순서

승인된 7개 탭의 화면, 수집 품질·채점/저장·기능 노출·복습/재방문·실행 버전 분석 및 필요한 최소 계측을 배포한다. [구현 계약](admin-analytics-enhancement-implementation.md)과 [설계 검토](admin-analytics-enhancement-review.md)를 따른다. 다른 작업의 기출 가공 자료·홈 말풍선 미리보기·시스템 파일·개발 캐시는 커밋하지 않는다.

1. 호환되는 관리 기능/API 확장이므로 `1.12.3` → `1.13.0` MINOR 버전을 사용한다.
2. 현재 원격 함수 정의·RLS·권한·마이그레이션 이력을 대조하고 복구용 함수 정의를 로컬에 보존한다.
3. 전체 품질 게이트와 운영 스키마의 롤백 트랜잭션 검증을 통과한 뒤 신규 `20261016121746_analytics_insights.sql`만 같은 원문·버전 이력과 함께 원자 적용한다. 기존 원격 이력을 일괄 복구하거나 다른 migration을 적용하지 않는다.
4. 기존 `usage-events`·`admin-analytics`를 먼저 배포해 새 속성/이벤트와 새 읽기 API를 준비한다. 기존 수집 스위치·origin·최초 개시 시각은 유지한다.
5. 관련 구현·검증·문서·버전·최종 운영 공개 통계 빌드를 커밋하고 main에 push한다. 연결된 Vercel 웹 배포와 기존 Supabase 함수 workflow를 확인한다.
6. 정확한 커밋의 웹 배포 READY, 운영 HTML·정적 자산·공개 통계·인증 경계 및 신규 RPC의 service-only 권한을 확인한다.

원본 사용량·개인 이력의 생성/삭제·장기 통계 재발행·수집 활성화 변경·예약 작업은 없다. 실제 관리자/회원의 운영 저장·메모·채점·알림 발송을 클릭하지 않는다. 새 기능 노출·시간·앱 버전 자료는 새 클라이언트에서 관측된 이후부터 쌓인다.

## 최종 검증 및 적용 기록

- v1.13.0에서 전체 `npm run check` 단일 실행 종료 코드 0. Vitest 336개, 앱 브라우저 100개, 푸시 브라우저 22개, 사전 렌더링 10개, SQL/Edge/API·타입·최종 운영 빌드를 모두 통과했다. lint 기존 경고 52개와 기존 번들/Node 경고는 유지된다.
- 운영 후보 SQL을 실제 원격 트랜잭션에서 검증·롤백한 뒤, `20261016121746` 신규 마이그레이션 원문과 이력을 같은 트랜잭션으로 적용했다. 기존 ingest wrapper가 동일함을 확인했다. service_role 조회, 비관리자 거절, anon/authenticated EXECUTE 차단을 확인했다.
- 실제 운영 관측 자료를 새 source와 집계 빌더로 읽어 7일 집계 상태 `complete`를 확인했다. DTO에 UUID 식별자가 없음을 검사했다. 새 계측 자료는 소급 생성하지 않는다.
- 보안 advisor는 전후 16건 WARN으로 동일하며 신규/해소 항목은 없다. 기존 보안 경고의 무관한 변경은 하지 않는다.
- 웹보다 먼저 `usage-events`와 `admin-analytics`를 v14 ACTIVE로 배포했다. 기존 내부 JWT 검증과 origin 설정을 유지한다. main push 뒤 기존 workflow가 동일 소스를 다시 배포할 수 있다.
- 배포된 API의 미인증·무효 토큰은 401, 미허용 origin은 403, 허용 origin OPTIONS는 204와 정확한 CORS 헤더로 확인했다. 운영 수집 POST·개인 이력 저장 요청은 실행하지 않았다.
- 웹은 이 문서·버전·검증·구현을 포함하는 main 릴리스 커밋으로 배포한다. 정확한 최종 커밋, Vercel READY 및 운영 응답 확인 결과는 작업 최종 보고에 기록한다.

사전 읽기 확인: 통계용 12개 private 테이블 모두 RLS 활성·anon/authenticated SELECT 없음, 신규 source RPC 미설치, 기존 두 통계 함수 v13 ACTIVE·gateway JWT 비활성이다. 기존 함수 내부 JWT/현재 관리자 검증은 유지한다. DB 수집은 활성이고 최초 개시 시각은 2026-10-04 16:27:37 KST다.

Vercel 연결의 상세 조회는 403이었으나 동일 팀·프로젝트를 지정한 공식 CLI의 기존 인증으로 프로젝트 ID·소유자·Vite·출력 경로를 확인했다. 검증/배포 대상은 변경하지 않는다.

## 복구와 확인 한계

적용 전 보존한 함수 정의와 마이그레이션 SHA256으로 원격 동시 변경을 검사한다. SQL 검증/권한/이력 중 하나라도 실패하면 전체 트랜잭션을 롤백한다. 기존 ingest wrapper의 활성 계정 확인·삭제 잠금과 tombstone trigger는 유지한다.

배포 후 문제가 있으면 먼저 해당 커밋의 웹/함수를 이전 정상 버전으로 되돌리고, 신규 이벤트 수신 상태를 확인한 다음 DB 함수 정의 복구를 검토한다. 개인 데이터 삭제로 복구하지 않는다. 실제 설치 iOS/Android 및 운영 로그인 관리자의 전체 개인 상세 조작은 모의 브라우저 검사와 구분한다.
