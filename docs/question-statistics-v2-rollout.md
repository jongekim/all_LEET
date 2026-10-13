# v1.12.0 공통 문항 통계 운영 적용

2026-10-13 사용자가 버전 관리부터 배포까지 명시적으로 요청했다. [구현과 운영 절차](question-statistics-v2.md)의 신규 DB → 카탈로그/통계 → 공유 채점 Edge → 웹 순서로 진행한다.

## 대상과 보존

- Git: `jongekim/all_LEET`, `main`; 배포 전 로컬/원격 HEAD `f5442e10de96a554675556ce8f53d8d0d983aa54`, v1.11.0.
- Supabase: `jkxxtyaanyhmjbdtybkp`. 배포 전 v2 객체와 migration 이력은 없고 v1 현재 포인터는 1이다. 기존 KV/메모·v1 통계/함수·RLS·권한·Auth·Storage를 유지한다.
- Edge: make-server-cd835c22 v22, admin-user-data v11 ACTIVE. 게이트웨이 verify_jwt=false와 내부 JWT·요청 사용자 식별을 유지한다. GitHub Actions의 기존 배포 순서는 소유자 이력 함수 다음 등록 함수들이다.
- Vercel: all-leet / prj_o17bvmZ1dChYN4L2cV8VcO2v5uie, team_Os6V53Cyt3oEDy5u7S0h4d3h. Production https://all-leet.vercel.app. 연결 도구의 동일 scope 조회가 403이므로 기존 CLI 인증을 사용한다.

신규 20261012122322_canonical_question_statistics_v2.sql만 적용하며 해당 버전·SQL 원문·이력을 같은 트랜잭션으로 저장한다. 과거 이력 불일치가 있어 db push/repair를 사용하지 않는다. v2 네 테이블 모두 RLS, 현재 공개본 SELECT만 허용하고 private/과거 세대·쓰기는 차단한다. 승인 카탈로그와 통계 발행은 개발자 전용 SECURITY INVOKER·advisory lock·CAS·전체 세대 검증을 사용한다.

## 검증 경계

로컬 전체 품질 게이트·PGlite·모의 Edge·모의 브라우저·HTML 검사를 실행한다. 운영에서는 신규 DDL의 롤백 예행·권한/정의/이력 확인, 승인 카탈로그 등록·읽기 전용 aggregate prepare·통계 발행, 익명 공개 읽기와 두 문형 투영, health 및 무효 세션 거절, 실서비스 공개 HTML/화면만 확인한다. 개인 원본 답안을 내려받거나 실제 회원에게 PUT/저장·삭제를 실행하지 않는다.

## 적용 기록

진행 중. 각 단계의 완료 결과는 아래에 기록한다. 코드 revision을 고정한 릴리스 커밋을 먼저 만들고, 운영 발행 데이터를 읽은 최종 빌드·적용 기록을 후속 커밋에 포함하여 main push는 검증 완료 뒤 한 번 진행한다.

## 복구

웹 문제는 기존 v1.11.0 Production을 복구한다. 이전 앱은 동결 보존한 v1 통계를 계속 조회한다. Edge 문제가 있으면 기준 커밋의 해당 함수를 별도 체크아웃에서 재배포한다. 신규 v2 구조와 감사는 유지할 수 있으며 개인 기록을 복원·변환하지 않는다. 정상 이전 v2 세대가 있으면 명시적 rollback을 사용하고, 최초 발행 문제가 있으면 웹 전환을 중단한다. 카탈로그 오류는 폐기 표시 후 새 불변 카탈로그·수정 코드를 검증한다. 기존 migration 이력이나 v1 데이터를 삭제하지 않는다.
