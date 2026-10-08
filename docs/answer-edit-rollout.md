# v1.11.0 운영 적용

2026-10-09 사용자가 버전 관리·커밋·DB·Edge Function·push·배포를 명시적으로 요청했다. 릴리스 범위는 [채점 후 답안 수정](answer-edit.md)과 [결과 분석·정답률 설정](result-analysis.md)이다.

## 대상과 순서

- Git: `jongekim/all_LEET`, `main`; 배포 전 기준 `68c239e3a9ae80cab7198cdf3255b5cf5097f096`(v1.10.0). 원격과 로컬 HEAD가 같음을 확인했다.
- Supabase: `jkxxtyaanyhmjbdtybkp`. 배포 전 `make-server-cd835c22` v20 ACTIVE, 내부 `getUser(token)`·URL 소유자 검증과 `verify_jwt=false`를 유지한다.
- Vercel: `all-leet` / `prj_o17bvmZ1dChYN4L2cV8VcO2v5uie`, scope `team_Os6V53Cyt3oEDy5u7S0h4d3h`, Production `https://all-leet.vercel.app`.
- 신규 `20261008143156_official_answer_updates.sql`만 DB에 적용하고 동일 트랜잭션에서 해당 버전의 적용 이력을 기록한다. 로컬·원격 과거 이력 불일치 때문에 일괄 `db push`나 이력 repair를 하지 않는다.
- DB 권한·정의 확인 → Supabase CLI 2.119.0으로 `make-server-cd835c22` 선배포·확인 → 릴리스 커밋·main push 순서다. 기존 GitHub Actions는 이력 함수를 먼저 배포하고 나머지 등록 함수를 이어 배포한다. Vercel Git 연동이 웹을 빌드한다.

## 데이터와 검증 경계

신규 service-role 전용 SECURITY INVOKER RPC 하나를 추가한다. 기존 KV/메모 테이블·RLS·기존 함수·Auth·Storage·사용자 데이터·공개 통계 발행본은 변경하지 않는다. 익명/회원 직접 RPC 실행은 거절하며 서버에서 소유자 JWT를 검증하고 점수를 재계산한다. 개인 이력의 실제 PUT은 운영 회원에게 실행하지 않는다.

로컬 검증은 전체 품질 게이트와 격리 PostgreSQL·모의 Edge·모의 브라우저 쓰기 테스트를 사용한다. 운영 검증은 스키마·권한·마이그레이션 이력·함수 상태 조회, 데이터 변경 없는 권한 거절, 공개 health/HTML/번들/로그인 경계 확인으로 제한한다. 실제 회원 JWT로 저장하는 전체 운영 쓰기 흐름과 실제 다중 연결 부하 시험은 포함하지 않는다.

## 적용 기록

v1.11.0 버전 파일 일치 검사를 통과했다. 운영 DB에서 기존 `user_history_mutate`의 공유 잠금과 service-role 권한, KV/메모 RLS를 확인했고 신규 RPC·migration 버전은 아직 없었다. Vercel 연결 도구는 해당 scope 403을 반환했으나 기존 CLI 인증으로 올바른 scope의 v1.10.0 Production READY를 확인했다.

v1.11.0에서 `npm run version:verify`와 `npm run check` 전체가 종료 코드 0으로 통과했다. lint 오류 0개·기존 경고 52개, 타입 검사, 단위 31파일/280개, 이력 Edge 122개, 사용자 데이터 Edge 21개, 분석 Edge 10개, 푸시 Edge 12개, 격리 SQL 검사, 일반 화면 94개, 푸시 화면 13개, 사전 HTML 10개와 프로덕션 빌드를 확인했다. 공개 통계 76조합/발행본 1을 읽어 83개 HTML을 생성했다. 소스의 공백 검사는 통과했으며 생성된 JS 번들에는 라이브러리 문자열의 공백 경고가 남아 있어 번들을 수동 편집하지 않았다.

신규 migration의 SHA256은 `40dcd7ea1a206bbc12d63c4ad7ab7e5a1d5c9b7d349d702027b8b3c7bf7e5904`이다. 운영 PostgreSQL에서 임시 생성·권한 거절 검사를 전체 롤백한 후 함수 생성·권한 검사·해당 버전 이력 기록을 한 트랜잭션으로 정식 적용했다. 이후 `prosrc`와 이력의 SQL이 로컬 원본과 정확히 같고 SECURITY INVOKER·빈 search_path·anon/authenticated 거절·service_role 허용인 것을 확인했다. 기존 이력 함수 정의, KV/메모 RLS·grants와 과거 migration 목록도 적용 전과 동일했다. 실제 회원 기록은 수정하지 않았다.

Supabase CLI 2.119.0의 `--use-api --no-verify-jwt`로 `make-server-cd835c22`만 선배포했다. v20 → v21 ACTIVE를 확인했고 health GET 200, 미인증/잘못된 토큰의 PUT과 미인증 이력 GET 401·no-store, PUT의 OPTIONS 204를 확인했다. 내부 JWT 검증은 유지한다. 최종 웹 커밋·Vercel·GitHub Actions 상태와 CI 후 Edge 버전은 배포 후 작업 보고에 남긴다.

## 복구

웹 문제는 이전 v1.10.0 Production을 Vercel에서 승격해 새 수정 진입점을 제거한다. 이전 Edge가 필요하면 기준 커밋의 `make-server-cd835c22`를 별도 체크아웃에서 다시 배포한다. 신규 RPC는 기존 CRUD에 영향을 주지 않으므로 웹/Edge 복구 시 유지할 수 있다. 이미 사용자가 수정한 답안은 이전 값으로 자동 복원하지 않는다. DB 함수를 제거해야 한다면 새 웹 진입점과 새 Edge 호출을 먼저 중단하고 별도 migration으로 제거한다. 기존 마이그레이션 이력을 삭제하거나 기존 성적 데이터를 일괄 덮어쓰지 않는다.
