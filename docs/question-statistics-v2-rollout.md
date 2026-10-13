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

- 버전 1.12.0, 소스 기준 커밋 `d1755334f63f2596bf47d3f3cadd69536ff21232`. 운영 발행 데이터를 읽은 최종 빌드·적용 기록은 후속 커밋에 포함하여 main push를 한 번 진행한다. 웹 최종 배포 SHA/READY·CI 결과는 작업 완료 응답에 기록한다.
- migration `20261012122322`, SHA256 `3e05ef0dc3dbe8e3785ffc68b7b0293bba1898ab104d27f3eeedf936a9960f74`: 롤백 예행 후 정식 적용과 저장 SQL 일치를 확인했다. 신규 네 테이블 RLS, 공개 현재 세대 SELECT, private 함수 10개의 SECURITY INVOKER/빈 search_path/실행 권한 차단을 확인했다. DB 배치 쿼리는 바인딩 매개변수 대신 충돌 검사한 dollar quote로 SQL 원문을 이력에 저장한다.
- 승인 카탈로그 `leet-0c7132983fda641f61a90ca796394fc7a00c8d355e7bfa52b7d32ab8de1515f1`, 대응표 `leet_forms_2026_10_12_v1`. 통계 1세대, 집계 시각 `2026-10-13 11:47:22.14074+00`, 발행 시각 `2026-10-13 11:48:06.59815+00`, artifact SHA256 `5a74664ca7e2291138a7ae631a1027304be3779e424d9e455607b3e4b1ed096e`.
- 5,717개 원본 풀이 모두 포함, 답안 객체 누락/범위 밖/invalid 0건. 익명 현재 공개 38묶음·1,350문항, 양 문형 2,700위치의 대응과 정답률 일치를 전수 검증했다. 기존 v1 포인터 1과 76행, 기존 함수 정의/ACL·테이블 ACL/RLS·정책은 변경 없이 유지됐다.
- Edge 사전 배포: make-server-cd835c22 v23, admin-user-data v12 ACTIVE. health 200, 토큰 없음/무효 이력 GET 및 관리자 미인증 GET은 401/no-store. 실제 회원 저장·수정은 실행하지 않았다. main push의 기존 Edge CI가 같은 코드를 다시 배포하므로 최종 함수 버전은 증가할 수 있다.
- 보안 advisor 배포 전/후 기존 WARN 16개로 동일, 신규 경고 없음. 기존 함수 search_path/일부 커뮤니티 실행권한/Auth 비밀번호 보호 권고는 이번 변경 범위 밖이다.
- `npm run version:verify`, `npm run check` 통과: lint 오류 0/기존 경고 52, typecheck, registry, 단위 33파일/292개, v2 격리 SQL/RLS, Edge 122/사용자 데이터 21/analytics 10/push 12 및 SQL, push 화면 13/일반 화면 96/fixture HTML 10. 통계 발행 후 실제 공개 GET 빌드가 38묶음/세대 1로 공개 HTML 83개를 생성했다. 실제 빌드의 HTML 화면 검사 10개도 통과했다.
- Supabase CLI 2.120.0 API 배포, Vercel CLI 63.1.2로 기존 인증 사용. 이전 Vercel Production `dpl_4MvVLxiLDmPQhNNc4yPn64gMaEdc`, URL `all-leet-9elf7tpnz-jekims-projects-e62391e5.vercel.app`, SHA `f5442e10de96a554675556ce8f53d8d0d983aa54`를 복구 기준으로 기록했다.

## 복구

웹 문제는 기존 v1.11.0 Production을 복구한다. 이전 앱은 동결 보존한 v1 통계를 계속 조회한다. Edge 문제가 있으면 기준 커밋의 해당 함수를 별도 체크아웃에서 재배포한다. 신규 v2 구조와 감사는 유지할 수 있으며 개인 기록을 복원·변환하지 않는다. 정상 이전 v2 세대가 있으면 명시적 rollback을 사용하고, 최초 발행 문제가 있으면 웹 전환을 중단한다. 카탈로그 오류는 폐기 표시 후 새 불변 카탈로그·수정 코드를 검증한다. 기존 migration 이력이나 v1 데이터를 삭제하지 않는다.
