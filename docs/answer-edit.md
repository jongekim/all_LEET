# 채점 후 문항별 답안 수정

## 범위와 동작

승인한 실서비스 기반 HTML 미리보기를 결과 답안표에 적용했다. 기존 점수 카드·분야별 분석·답안표·메모·정답률·전역 메뉴는 유지한다. `답안 수정` → 문항 선택 → ①~⑤/미응답 → 변경 내역·예상 정답 개수 → `수정 반영` 순서다. 편집 중 정오 표시를 숨기고 변경 문항만 파란색으로 표시한다. 취소·실패 전에는 기존 점수/이력을 변경하지 않는다.

- 저장된 공식 이력 한 과목만 갱신하며 새 회독을 만들지 않는다. 기록 시각·회독·응시 묶음·학년도·문형·문항 수·메모 연결과 알 수 없는 기존 필드는 유지한다.
- 비로그인 결과는 현재 navigation state만 갱신한다. 이후 로그인해도 자동 저장하지 않는다.
- 예시 이력, 관리자 주입 화면, 저장 성공을 확인하지 못한 새 채점에는 일반 수정 버튼을 제공하지 않는다. 관리자 수정은 기존 관리자 API를 유지한다.
- 저장 중 선택·반영·취소와 중복 클릭을 막는다. 실패 시 초안을 유지한다. 충돌·삭제·응답 미확정은 반영을 잠그고 취소 후 최신 이력을 다시 열도록 안내한다.
- 공개 정답률은 기존 수동 발행본을 유지한다. 개인 답안 수정은 새 표본을 추가하거나 공개 통계를 즉시 갱신하지 않는다. 다음 수동 집계 때 수정한 원본을 사용한다.

## 프론트엔드

`EditableAnswers`는 원본 스냅샷과 초안을 분리한다. `AnswerSheetResult`는 선택적인 편집 props를 받으며 기본 표시 동작은 유지한다. 반영 전과 서버 재계산은 `_shared/user-data-rules/answerEdit.ts`/`grading.ts`를 공유한다. 기존 정답 버전 또는 환산 자료가 맞지 않으면 계산을 중단한다.

`useUserHistory.addOfficial`은 서버의 실제 저장 기록을 반환한다. `HomePage`는 결과 이동 전에 서버 timestamp/round를 사용하고 route state에 소유자 ID·저장 성공한 시각을 넣는다. 계정 전환 시 이전 결과·초안을 표시하지 않고 늦은 수정 응답도 버린다.

`updateOfficial`은 성공 후 기존 이력 한 항목만 교체하고 초기 조회의 늦은 응답을 버전 검사로 막는다. 응답 유실/저장소 장애에는 GET으로 동일 기록·회독·묶음·답안을 대조하며 PUT을 자동 반복하지 않는다. 충돌·삭제·중복 오류에도 이력을 다시 조회하여, 현재 초안은 유지하되 취소 후 다시 열면 최신 스냅샷을 사용하게 한다. 성공 결과는 navigation state를 교체하여 결과 새로고침/이력 재진입에도 사용한다. 미저장 새로고침·뒤로가기 가드는 기존 `useUnsavedDdayChanges`의 공통 navigation guard를 재사용하고 이동 버튼·링크에도 폐기 확인을 적용한다.

## API와 DB

`PUT /make-server-cd835c22/history/:userId/:timestamp`는 `{ expected: 편집 시작 당시 전체 기록, userAnswers: 문항별 선지 }`만 받는다. 기존 JWT `getUser(token)`과 URL 소유자 비교를 통과한 뒤에만 KV에 접근하며 개인 응답은 no-store다. 본문은 64 KiB 이하, 문항은 정규 정수 번호와 범위, 선지는 정수 0~5로 제한한다. 클라이언트 점수·정답·회독을 받지 않고 Edge가 저장된 시험 정보와 공유 계산 규칙으로 정답 개수·표준점수·백분위·분야별 분석·보정 점수를 계산한다.

`20261008143156_official_answer_updates.sql`은 `public.user_history_update_answers(uuid,bigint,jsonb,jsonb)`만 추가한다. 기존 테이블·RLS·데이터·user_history_mutate 계약은 유지한다. SECURITY INVOKER·빈 search_path·service_role 전용 EXECUTE와 활성 소유자 검사를 사용한다.

Edge는 클라이언트 스냅샷과 실제 계산에 사용할 저장 기록을 먼저 비교하며 JSON 객체의 키 순서는 무시한다. RPC에는 이 서버 스냅샷을 전달한다. RPC는 기존 소유자/관리자 쓰기와 동일한 `pg_advisory_xact_lock(hashtextextended('history:' || owner,0))`을 얻는다. 잠금 안에서 배열을 읽고 정확히 한 대상인지, 전체 기록이 expected와 같은지 다시 확인한 뒤 배열의 그 위치만 교체한다. 다른 기록의 변경은 보존한다. 삭제된 대상을 생성하지 않으며 같은 timestamp의 레거시 중복은 임의 선택하지 않는다. 대상이 다른 탭/관리자에 의해 바뀌면 HISTORY_CONFLICT로 거절한다. patch 허용 필드는 답안과 서버 계산 필드뿐이다.

상태 코드는 입력 400, 인증 401/403, 삭제·미저장 404, 충돌·중복 409, 계산 자료 불일치 422, 저장소 장애 503이다. 기존 GET/POST/DELETE 계약은 유지한다.

## 검증과 운영 적용

2026-10-08 운영 RPC 정의·KV/메모 RLS·grants·migration 목록을 Management API read-only endpoint로 대조했다. 기존 원격/로컬 migration 이력은 불일치하므로 일괄 db push로 맞추지 않는다.

**2026-10-09 명시적 배포 요청에 따라 운영 DB와 이력 Edge v21을 웹 push 전에 적용·검증했다.** 신규 migration만 적용하고 `make-server-cd835c22` → 웹 순서로 배포한다. main push의 함수 배포와 웹 배포는 별도로 실행되므로 그 사이의 순서는 보장되지 않는다. DB와 이력 Edge를 먼저 준비·확인한 뒤 웹 릴리스 push를 한다. 웹 롤백은 수정 진입점만 제거하며 기존 이력 CRUD를 유지한다. 데이터 삭제·일괄 변환은 없다. [v1.11.0 적용·검증·복구](answer-edit-rollout.md)를 참고한다.

- `npm run test:edge`: PUT 포함 소유자 인증, 입력 변조, 재계산, 충돌/삭제/중복/정답 버전 거절.
- `npm run test:user-data`: 추가 `scripts/test-answer-edit-sql.ts`에서 격리 PGlite의 service-only·전체 기록 비교·기존 append/delete/clear 교차 실행·식별자/메모/타인/다른 기록 보존·탈퇴 소유자를 검사한다. 실제 다중 연결 부하 시험은 포함하지 않는다.
- `npm run test`: PUT 계약, 계정 전환, 응답 유실의 GET 대조.
- `npm run test:e2e -- e2e/answer-edit.spec.ts`: Supabase 전체 모의 처리로 PC/모바일 반영·취소·실패·응답 유실·새 채점 식별자·비로그인을 확인한다. 운영 요청은 전송하지 않는다.
- 최종 표준 게이트는 `npm run check`다. 실제 회원 기록을 수정하는 운영 RPC/Edge 쓰기 연동 검증은 별도 테스트 데이터 정책 확인 후 수행한다. 이번 배포에서는 격리 DB·모의 API로 저장 흐름을 검증하고 운영에서는 데이터 변경 없는 권한 검사를 수행했다.

2026-10-08 로컬 검증에서 `npm run check`를 통과했다. 최종 보완 후 단위 275개, 이력 Edge 122개, 답안 수정 E2E 7개를 재확인했고 lint·타입 검사도 통과했다. 기존 lint 경고는 54개다. 전체 게이트에는 브라우저 회귀 91개·푸시 13개·HTML 10개와 프로덕션 빌드가 포함된다. 추적 중인 `build/` 번들·index.html은 현재 소스로 갱신했다. 답안 수정 쓰기 테스트는 격리 DB와 모의 API만 사용했다.

v1.11.0 버전 갱신 후 `npm run version:verify`와 전체 `npm run check`를 다시 통과했다. 최종 단위 280개·이력 Edge 122개·일반 화면 94개·푸시 화면 13개·HTML 10개 및 SQL·타입·빌드 검사가 통과했고 lint 오류 0개·기존 경고 52개다.
