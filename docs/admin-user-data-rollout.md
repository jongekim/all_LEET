# 관리자 사용자 데이터 v1.7.0 운영 적용

적용일: 2026-10-05 KST. 사용자가 확정 설계의 개발 이후 버전 관리·커밋·push·관련 설정을 요청했다. 대상은 Supabase `LEET_Service` (`jkxxtyaanyhmjbdtybkp`), Vercel `all-leet`, 운영 origin `https://all-leet.vercel.app`이다. 기존 사용자 화면 UI·UX를 유지하며 다른 작업의 기출 이미지·마크다운 파일과 개발 캐시는 이번 커밋에서 제외한다.

## 버전·품질 설정

호환되는 관리자 기능 추가이므로 `npm run release:minor`로 1.6.1 → **1.7.0**을 적용하고 `npm run version:verify`를 통과했다. 기능·DB·CI·문서·버전·빌드 산출물을 같은 릴리스 커밋에 포함한다. 릴리스 태그는 `v1.7.0`을 사용한다.

운영 수집 설정(`VITE_USAGE_ANALYTICS_ENABLED=true`, `VITE_USAGE_ANALYTICS_ORIGINS=https://all-leet.vercel.app`)으로 최종 `npm run check` 전체를 통과했다. lint 오류 0·기존 경고 69개, TypeScript, Vitest 230개, 이력 Edge 100개·사용자 데이터 Edge 19개·통계 Edge 10개, 합성 SQL, 브라우저 E2E 81개와 사전 HTML 검사 10개를 확인했다. 공개 통계 76조합·발행본 1개를 읽어 83개 공개 HTML을 생성했다. 운영 서버에 연결된 브라우저에서 저장·삭제를 실행하지 않았다.

품질 CI에 `test:user-data`를 추가했다. 함수 CI의 CLI는 검증한 2.119.0으로 고정하고 기존 성적 함수 → 관리자/지원 분석 및 기존 통계 함수 순서로 배포한다. 함수 소스·config·워크플로 변경 시 배포하며 새로운 두 함수가 누락되지 않는다. 기존 GitHub Supabase 배포 secret 두 개의 등록을 확인했고 값을 출력하지 않았다. Vercel production의 기존 환경 설정을 유지한다. 웹에 service-role 키나 새 비밀 값을 추가하지 않는다.

## DB 적용·실제 스키마 검증

원격 main이 기준 커밋 `2748bb00`과 같음을 확인했다. 적용 직전 스키마·RLS·grants·FK·트리거·함수·13개 마이그레이션 이력을 읽기 전용으로 재조회했고 개발 때 확인한 컬럼·정책과 동일했다.

신규 `20261005052901_admin_user_data.sql`을 실제 운영 스키마에 시험 적용하고 service-role RPC, 일반 역할 실행 차단, 정확한 승인, 성적 원자 저장, 지원 분석 저장·삭제·재수신 차단, 기존 FK·카운터·updated_at 및 채팅 닉네임 전파를 확인한 뒤 **전체 롤백**했다. 합성 Auth UUID·게시글·댓글·좋아요·채팅만 사용하고 기존 사용자의 데이터를 수정하지 않았다. 실제 관리자 UUID는 쿼리 내부에서만 사용하고 결과나 파일에 출력하지 않았다.

이 신규 SQL과 원문 migration 이력을 같은 트랜잭션으로 정식 적용하고 PostgREST schema cache를 갱신했다. 전체 `db push`나 이력 repair는 실행하지 않았다. 과거 13개 이력은 유지하고 동일 버전의 새 이력 1개만 추가했다. 기존 정책은 그대로이며 신규 private 테이블 6개는 RLS·anon/authenticated 접근 차단, 공개 RPC는 service-role EXECUTE 전용이다. 감사 UPDATE/DELETE는 service-role도 불가능하고 지원 분석에는 Auth FK가 없다.

적용 이후 authenticated 합성 소유자의 게시글 INSERT와 관리자 조회·승인·cascade·닉네임 전파를 다시 전체 롤백으로 확인했다. 합성 작업·감사 행이 남지 않음을 확인한다. 보안 Advisor는 기존 경고 16개를 유지하며 새 객체의 경고는 없다. 기존 경고는 이번 기능 범위 밖이다.

## 서버·웹 적용

DB 반영 뒤 `make-server-cd835c22`를 먼저 배포해 소유자와 관리자 이력 변경이 같은 잠금을 사용하도록 했다. 이어 `admin-user-data`·`admission-history`를 배포했다. 수동 적용 직후 기존 이력 함수 v12, 새 두 함수 v1이 모두 ACTIVE이며 gateway `verify_jwt=false`와 각 함수 내부의 Supabase Auth 검증을 사용한다. main push의 기존 함수 CI가 같은 소스를 다시 배포하면 함수 배포 번호는 증가할 수 있다.

실제 HTTP에서 관리자 목록의 익명 요청·수정 요청의 무효 JWT, 지원 분석 저장의 익명·무효 JWT, 기존 이력 익명 조회가 모두 401이었다. 관리자 CORS preflight는 204였다. 실제 개인 자료나 파일 본문은 운영 검증에서 조회하지 않았다.

웹은 위 준비 후 이 릴리스 커밋·태그를 main에 push하여 기존 Git 연동으로 배포한다. 해당 커밋의 Vercel READY·운영 HTML/정적 자산·관리자 로그인 경계와 GitHub 함수 CI 결과를 확인하며 최종 배포 커밋과 완료 결과는 작업 최종 보고에 기록한다.

## 검증 한계·운영 경계

실제 관리자 JWT의 전체 조회 화면 및 외부 Auth 이름 수정·Storage 업로드/삭제를 운영 계정으로 조작하지 않았다. 해당 요청과 승인 흐름은 주입 API·모의 브라우저로 검사했으며 실제 DB 권한·트리거 검증과 구분한다. 별도 비운영 Supabase의 Auth/Storage 실연동 테스트는 이번 릴리스에서 실행하지 않았다.

외부 호출 결과가 불명확하면 감사에서 결과를 대조하며 새 승인이 필요한 재시도를 사용한다. 관계별 advisory lock과 통계 공통 잠금은 기존 쓰기에도 참여하므로 운영 부하의 대기 시간은 별도 관찰 대상이다. 지원 분석 보관은 탈퇴 후에도 유지되며 관리자 수정·삭제에는 복구 기능이 없다. 서버에 도달하지 못한 저장 실패는 진단이 남지 않을 수 있다.

웹 롤백만으로 DB·서버 변경이 되돌아가지는 않는다. 신규 테이블·원자 RPC를 유지하고 기존 이력 함수를 KV 직접 쓰기 버전으로 되돌리지 않는다. 문제 발생 시 관리자 사용자 데이터 진입/API를 함께 제한하고 소유자 저장·분석 저장의 호환성을 먼저 확인한다.
