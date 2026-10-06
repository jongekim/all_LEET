# 관리자 사용자 데이터 구현·운영

기준일: 2026-10-05, 서비스 v1.7.0. [기능 계약](admin-user-data-design.md)의 확정 범위를 구현하고 사용자의 버전 관리·커밋·push·관련 설정 요청으로 운영 DB와 세 Edge Function을 반영했다. 실제 사용자 데이터는 수정·삭제하지 않았다. 개발 전과 적용 직전 읽기 전용 Management SQL로 기존 컬럼·RLS·grants·FK·트리거·마이그레이션 이력과 Storage 객체 컬럼을 확인했다. 웹 릴리스와 검증 결과는 [운영 적용 기록](admin-user-data-rollout.md)을 따른다.

## 구성

2026-10-06 로컬 목록 확장은 [회원 목록 확장](admin-user-data-member-list.md)에 별도로 기록한다. 운영 적용 완료된 아래 v1.7.0 구성과 구분하며 탈퇴 후 모든 이력 보관/공개 게시글·댓글·채팅 유지 정책을 반영했으며 별도 운영 적용이 필요하다.

- 진입: `AdminPage` → `/admin/user-data` → 기존 `AdminRoute`, `AuthContext`의 관리자 인증.
- 관리자 프론트: `AdminUserDataPage`, `UserDataDialogs`, `UserDataImageEditor`, `UserDataRecord`, `adminUserDataApi`.
- 재사용: `HistoryPage`, `ResultPage`, `AdmissionResultPage`의 선택적 admin adapter, 기존 차트, 추출한 `CommunityPostBody`·`ChatMessageList`의 동일 JSX.
- API: `supabase/functions/admin-user-data/index.ts`, `supabase/functions/admission-history/index.ts`.
- 공통: `_shared/user-data-app.ts`, 계약·검증·이미지 manifest·runtime, `_shared/user-data-rules/`.
- 기존 이력: **배포 대상** `supabase/functions/make-server-cd835c22/`의 `atomic-store.ts`와 `user_history_mutate` RPC. `src/supabase/functions/server/`의 레거시 경로와 혼동하지 않는다.
- DB: `20261005052901_admin_user_data.sql`. 신규 private 테이블에 RLS 활성화·anon/authenticated 권한 차단, service role 전용 RPC. 감사 UPDATE/DELETE도 차단한다.

`src/utils`의 채점·정답·점수·문형·지원 분석 export는 공통 순수 모듈을 재노출한다. 계산식과 자료는 기존 것 그대로 이동했다. 새 서버 계산과 사용자 계산을 별도로 복제하지 않는다. 기준 자료 변경 시 `USER_DATA_RULES_VERSION`도 변경하고 Edge와 웹을 함께 배포한다. 현재 버전은 `service-2026-10-05`다.

## API와 저장 경계

관리자 API는 모두 POST이며 개인 필터는 body에만 넣는다. `members`, `read`, `notes`, `prepare`, `commit`, `operation`을 제공한다. JWT는 각 함수에서 실제 Auth 사용자로 검증한다(`verify_jwt=false`는 이 수동 검증을 사용하는 설정이다). 관리자 여부를 Auth metadata에서 신뢰하지 않고 `current_user_is_admin`과 SQL의 `private.admin_roles`로 확인한다. 응답 `no-store`, 오류는 안전한 코드와 한국어 안내만 사용한다.

`read`는 HMAC 참조를 발급한다. 관계형 자료 50건과 KV 차트 요약/개별 상세를 구분한다. `prepare`는 필드·타입·현재 계산 기준을 검증하고 제안 patch와 영향 스냅샷 hash를 저장한다. `commit`은 정확한 `승인`, 작업 소유자, live 관리자, 만료, 스냅샷을 검증한다. 원본 내용/이전 값의 복구 백업은 남기지 않는다. 상태는 prepared/executing/succeeded/failed/unknown/conflict/partial이다.

이미지 추가는 prepare까지 파일 본문을 전송하지 않는다. 승인 multipart에 최대 5개의 5MB 파일(전체 요청 제한 26MB)을 넣고 manifest와 바이트를 비교한다. 외부 업로드 결과를 다시 다운로드/hash 검사한 뒤 DB URL을 확정한다. 삭제는 DB와 outbox를 확정한 뒤 Storage API로 수행한다. 삭제 대기 URL을 다시 게시글에 참조하는 경우 DB trigger가 차단한다. 공유 참조가 남은 파일은 제거하지 않는다. 파일 경로가 대상 사용자 소유가 아니거나 다른 프로젝트의 URL이면 삭제를 차단하고 부분 완료로 남긴다.

Auth 이름 수정은 `{ user_metadata: { name } }`만 전송한다. [Supabase Auth 관리자 처리](https://github.com/supabase/auth/blob/master/internal/api/admin.go)와 [metadata 병합 구현](https://github.com/supabase/auth/blob/master/internal/models/user.go)에서 지정한 키만 병합함을 확인했다. 이메일·비밀번호·다른 metadata를 요청에 다시 담아 보내지 않는다. 외부 호출 응답이 불명확하면 현재 이름과 대조하고 자동 재수정하지 않는다.

지원 분석은 Auth FK가 없는 `private.admission_history`에 매 실행을 보관한다. 실패 diagnostics는 입력/결과 없이 execution UUID·owner UUID·안전한 오류 코드만 가진다. 같은 실행의 관리자 변경 뒤 재전송은 tombstone으로 차단한다. 계정 탈퇴 후에도 이력은 남는다. 이벤트 재수신 차단 tombstone과 지원 분석 tombstone에는 원본 값이 없으며 복구 기능으로 사용할 수 없다.

## 검증 환경

`npm run test:user-data`는 운영 접근이 불가능한 PGlite 합성 PostgreSQL과 주입된 Deno API를 사용한다. 합성 fixture는 확인한 컬럼/관계를 재현하고 service_role·anon·authenticated 권한을 실제로 바꿔 확인한다. 운영 Auth/Storage 엔진 자체를 실행한 테스트는 아니므로 별도 비운영 Supabase 검증이 필요하다.

검증 범위:

- 관리자·테스트·탈퇴 후 지원 분석 계정 선택; anon/일반 회원 차단; 실제 요청자 우선; 서명 대상/영역 위조 차단.
- 정확한 승인, 원본/동일 건수 연결 행 교체 충돌, 동일 작업 재전송, 감사 실패 시 데이터·작업 상태 롤백.
- KV 원자 append/회독과 전체 삭제, 정확한 회차·과목 메모 삭제, 불변 필드와 수동/재계산 중복 차단.
- 과거 채팅 닉네임 전파, 지원 분석 idempotency·Auth 없는 보관·관리자 변경 후 재수신 차단.
- 이용 원본 삭제 후 원본/semantic 재수신 차단, 품질 접수 사실 유지, 날짜별 파생 재생성·최초 이용 unknown.
- 이미지 승인 전 DB URL 유지, manifest 바이트 불일치 시 업로드/변경 없음, 완료 파일 상태 대조, 업로드 중 게시글 충돌 정리, 연결 파일 단독 삭제 차단, Storage 메타데이터 직접 삭제 없음.
- 프론트 단위 검사: 계정 변경/취소 시 늦은 개인 응답 폐기, HTML 403, 지원 분석 재시도/안전한 진단/다른 계정 쓰기 차단.
- `e2e/admin-user-data.spec.ts`: 390/1280 화면, 승인 버튼 제한, 실제 0건·예시 없음, 새로고침 초기화, 승인 전 이미지 로컬 미리보기, 권한 회수 시 화면 제거, 저장 실패에도 기존 분석 결과.

E2E는 모든 Supabase 요청을 합성 응답으로 가로챈다. 합성 commit을 클릭해 UI→요청 계약을 확인하며 운영 데이터에 쓰지 않는다. 저장·삭제·이미지 업로드 실운영 동작은 검증하지 않았다. 전체 품질 게이트에는 새 `test:user-data`가 포함된다.

## 로컬 검증 결과

v1.7.0 릴리스 버전과 운영 수집 빌드 설정으로 최종 `npm run check` 전체 통과: lint 오류 0개(기존 경고 69개), 프론트 단위 230개, 이력 Edge 100개, 사용자 데이터 Edge 19개 및 합성 SQL, analytics Edge 10개와 SQL, 디데이 SQL, 브라우저 E2E 81개(관리자 사용자 데이터 8개 포함), 빌드·공개 HTML 10개. 기출 78개 선택 반복 검사는 연속 URL 변경 전에 선택 렌더 완료를 기다리도록 테스트만 보완했다. 일반 사용자 계산 모듈 5개의 실제 본문은 이동 전과 동일함을 비교했다. 확인창의 원본 식별 정보는 응답에만 반환하며 이전 값으로 보관하지 않는다.

## 운영 적용 순서

1. 변경 사항을 검토하고 `npm run check` 통과 후 기능 관련 파일만 커밋한다. 다른 작업의 `.DS_Store`, node_modules, 이미지/마크다운 산출물과 Supabase CLI 임시 파일은 섞지 않는다.
2. 비운영 Supabase에서 기존 실제 스키마의 migration 적용, 소유자 RLS/Storage 경로, 기존 카운터·updated_at·Auth FK 트리거와 새 graph 잠금의 상호작용을 검증한다. 이번 릴리스에서는 운영 실제 스키마의 합성 행·역할 검사 전체를 롤백해 DB 상호작용을 확인했다. 외부 Auth/Storage 변경의 실제 HTTP 흐름은 모의 요청 검사이며 비운영 연동 검증과 구분한다.
3. 운영 적용을 명시 승인받은 뒤 **이 신규 migration만** 적용한다. 저장소와 원격 migration 이력이 완전히 일치하지 않아 일괄 `db push`나 자동 repair는 하지 않는다.
4. 기존 이력 함수 `make-server-cd835c22`를 먼저 새 원자 RPC 버전으로 배포한다. 기존 함수가 KV를 직접 덮어쓰는 상태에서 관리자 변경 API를 활성화하면 잠금 계약을 지킬 수 없다.
5. `admin-user-data`, `admission-history`를 배포하고 JWT/일반 회원 거절/현재 관리자 및 함수 설정·Storage API를 비운영 계정으로 확인한다. 기본 Supabase runtime env를 사용하며 service role을 웹 환경에 추가하지 않는다.
6. 웹을 배포한다. `main` push는 실서비스 배포를 시작하므로 별도 명시적 요청 후 수행한다. 계산 규칙 버전이 다른 Edge/웹을 장기간 함께 운영하지 않는다.

이 배포에는 DB + 세 Edge Function + 웹 조정이 필요하다. DB를 먼저 적용해도 기존 소유자 화면의 HTML·입력·버튼은 바뀌지 않지만 새 잠금 trigger와 분석 wrapper가 쓰기 경로에 참여한다. 운영 부하에서 관계별 advisory lock 대기 시간을 관찰한다. 외부 Storage/Auth는 DB와 하나의 트랜잭션이 아니며 상태 대조/부분 완료가 정상 복구 절차다. 데이터 삭제의 복구는 제공하지 않는다.

## 운영 한계와 상태 확인

- unknown 계정 이름 작업은 같은 관리자 감사에서 결과를 확인한다. Auth 상태와 다르면 불명확한 작업을 자동 재실행하지 않는다. unknown인 동안 같은 대상의 새 이름 작업은 막는다.
- unknown 이미지 작업은 저장된 경로와 hash를 대조한다. 현재 탭에 파일이 남아 있으면 새 승인으로 동일 경로를 재시도한다. 탭 종료 후 누락된 파일을 자동 복원할 수 없다. 선택 사용자 저장 이미지에서 남은 고아 파일을 확인할 수 있다.
- partial 파일 삭제는 같은 작업의 미처리 경로만 새 승인 후 재시도한다. 이미 성공한 파일 삭제를 다시 하지 않는다. CDN·브라우저 캐시의 즉시 제거를 보장하지 않는다.
- expired prepared patch는 다음 prepare 시 비운다. 실행 중/unknown의 제안 정보는 결과 대조용이며 원본 복구 백업은 아니다.
- 서버까지 도달하지 못한 분석 실행은 diagnostics도 남지 않을 수 있다. 사용자 결과 화면은 정상 표시한다.
- 장기 이용 통계는 오래된 근거가 부족한 경우 partial/unknown이다. 원본 삭제로 공개 문항 통계 스냅샷을 자동 재발행하지 않는다.
