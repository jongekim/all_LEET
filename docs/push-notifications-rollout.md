# v1.9.0 웹·PWA 푸시 운영 적용

2026-10-07. 사용자의 버전 관리·커밋·push 및 기능 작동에 필요한 미비 작업 요청에 따라 적용했다. 정식 주소는 `https://all-leet.vercel.app`, Supabase 프로젝트는 기존 `jkxxtyaanyhmjbdtybkp`다. 기능 계약은 [설계](push-notifications-design.md), 소스·제한은 [구현 문서](push-notifications-implementation.md)를 따른다. 웹의 실제 릴리스 커밋과 Vercel 배포 확인은 최종 작업 보고에 기록한다.

## 현재 운영 범위

| 항목 | 적용 상태 |
|---|---|
| 공개 웹 설정 | `.env.production`: `VITE_PUSH_ENABLED=true`, 정확한 정식 origin만 허용 |
| Edge / DB enabled | true: 구독 등록·확인, 관리자 현재 기기 테스트 허용 |
| DB campaigns_enabled | false: 일반 전체 구독자·전체 회원·선택 회원 발송 잠금 |
| 관리자 초안·이력 | 기존 관리자 역할과 실제 세션 확인 후 사용 |
| 실제 기기 발송 | 자동화로 실행하지 않음; OS/기기 및 실제 provider 처리량 확인 필요 |

별도 알림 설정이나 상단 알림 링크는 없다. 일반 서비스 방문 후 자동 팝업에서 동의하고, 허용 직후 닫으며 등록은 계속한다. 나중에·닫기·Esc·바깥 클릭은 7일 유예한다. 등록은 실제 확인 알림의 서비스워커 ACK 검증 이후 active가 된다. preview/localhost는 운영 origin에서 제외하며 개발 모드에는 `.env.production`이 적용되지 않는다.

## DB·권한 적용

적용 전 실제 객체·RLS·관리자/세션 열과 이력을 확인하고 새 마이그레이션만 적용했다. 과거 이력 일괄 `db push`나 repair는 하지 않았다. 적용과 해당 버전의 `schema_migrations` 기록은 같은 트랜잭션이다.

| 버전 | 변경 | 파일 SHA-256 |
|---|---|---|
| 20261007044858 | private 푸시 테이블 19개, service-only invoker RPC·권한·기본 off | `121127ff32e8edb49f4943905e25cd814f9c9e0beb89472a9686f0eec5b432e7` |
| 20261007141129 | 기존 RPC 세 개의 상태 갱신 6곳에 singleton WHERE 조건 추가 | `1dcacd2dbcaf3c275c8051b28e09d68eb801fb5209e15af1cf89773c6d400f52` |

운영 API는 safeupdate로 조건 없는 UPDATE를 차단한다. 기본 SQL의 singleton 갱신도 이 정책 대상이어서 실제 worker 호출 때 발견했고, 원래 적용 이력을 유지한 후속 마이그레이션으로 보완했다. 합성 SQL 검사도 두 마이그레이션을 순서대로 실행한다.

운영 롤백 트랜잭션에서 private 푸시 RLS, anon/authenticated 테이블·RPC 접근 거절, service-role 함수 실행과 DELETE/감사 UPDATE 제한을 확인했다. 기존 성적·커뮤니티·회원 데이터는 삭제하거나 수정하지 않았다. Auth의 timebox/inactivity 제한 0과 DB의 대응 값도 일치한다.

## 키·Edge·기동

고정 VAPID v1, AES-GCM v1, 별도 내부 dispatch 비밀을 서버에 한 번 생성·저장했다. 배포마다 재생성하지 않는다. private/AES/내부 비밀은 Git·브라우저·문서에 넣지 않았다. VAPID subject는 기존 운영 연락처 `mailto:all_leet@naver.com`이다. provider는 FCM·Mozilla·Apple의 지정 호스트만 허용한다.

`push-subscriptions`, `admin-push`, `push-dispatch` 세 함수를 실제 배포했다. 다음 운영 차이를 수정했다.

- 운영 Edge 환경은 읽기 전용이므로 키 로그 차단용 `Deno.env.set`을 제거하고 서버 `ECE_KEYLOG=0`을 필수로 설정했다. 동적 import 전에 검사하며 누락/다른 값은 초기화를 거절한다.
- 기존 프론트의 공개 키가 자동 제공 기본 anon 키와 달라 `PUSH_PUBLIC_API_KEY`에 기존 공개 키를 지정했다. 자동 생성 `info.tsx`와 기존 인증 키는 변경하지 않았다. 관리자 JWT·설치 capability 검증은 계속 별도로 필요하다.
- 예상 밖 DB RPC 오류는 고정 함수 이름과 검증된 DB 오류 코드만 기록한다. 원문 요청·DB 메시지·비밀은 기록하지 않는다.

새 함수는 JWT/설치 capability/내부 비밀을 각각 자체 검증한다. gateway `verify_jwt=false`를 인증 생략으로 사용하지 않는다. 향후 main CI가 같은 소스를 재배포하며 DB 두 버전이 먼저 준비되어 있어야 한다.

별도 opt-in SQL로 pg_cron·pg_net을 설치하고 기존 Vault를 사용했다. Vault의 전용 URL과 내부 비밀 일치를 비밀값을 출력하지 않고 검증했다. `private.push_wake`는 invoker이고 브라우저와 service_role에도 실행을 주지 않는다. postgres 소유 `leet-push-fast-tick`은 10초, `leet-push-recovery`는 1분 주기이며 두 작업의 실제 실행 성공을 확인했다. 빈 tick의 wake는 null을 반환해 외부 HTTP를 만들지 않는다.

실제 내부 worker HTTP 접수 후 DB `last_worker_at` 갱신과 busy slot 0을 확인했다. 해당 확인 시 구독·캠페인·외부 시도는 모두 0이며 사용자 알림을 발송하지 않았다. 접수 200만으로 background 완료를 판정하지 않았다.

## 검증과 발송 개방 조건

실제 API에서 공개 설정 200/enabled true/65바이트 VAPID 공개키, 허용 origin preflight 204, localhost 403, apikey 누락·잘못된 JWT·비로그인 관리자·인증 없는 dispatch 401을 확인했다. anon 직접 RPC는 401/42501로 차단되며 내부 인증 dispatch만 200으로 접수된다.

읽기 전용 Edge 초기화·기존 공개 키와 기본 키 차이·암호화를 재현하는 Deno 회귀 검사를 추가했다. 로컬 표준 게이트는 lint·typecheck·Vitest 268개, 이력 Edge 100개, 사용자 데이터 Edge 21개, 통계 Edge 10개, 푸시 Edge 11개 및 SQL·화면·production build·prerender를 포함한다. SQL 규모 검사는 합성 1,000/10,000개 후보이며 실제 provider 처리량을 의미하지 않는다. 변경 단계별 검사 기록은 구현 문서에 보존한다.

최종 `npm run version:verify`·`npm run check`는 v1.9.0의 두 마이그레이션과 모든 서버 보완을 반영한 코드에서 통과했다. lint 오류 0개·기존 경고 69개, 기존 화면 E2E 84개·푸시 E2E 11개·HTML E2E 10개, 현재 공개 통계 76개 조합/발행본 1을 읽는 운영 build를 확인했다. 직전 실행의 기존 통계 화면 1건은 조회 대기 중 5초 timeout으로 실패했지만 같은 코드의 개별 3회 반복과 최종 전체 실행에서 모두 통과했다. 배포할 빌드 산출물을 함께 기록하고 다른 작업의 파일·로컬 캐시는 보존한다.

최초 운영에서는 [설계의 단계별 적용](push-notifications-design.md)에 따라 일반 발송을 잠근다. 다음 확인 후 `campaigns_enabled=true`로 전체/선택 발송을 개방한다.

1. 정식 서비스에서 관리자 기기를 구독하고 확인 알림 수신·ACK 활성화를 확인한다. 관리자 푸시 화면에서 같은 기기 테스트의 실제 표시·링크 이동을 확인한다.
2. PC/Android/PWA/iPhone 홈 화면의 닫힘·백그라운드·권한 철회·링크·계정 전환과 로그아웃을 확인한다.
3. 분리된 검증 환경에서 429·느린 응답과 1,000/10,000개 처리량·Edge CPU·저장 성장·quota를 측정하고 운영 상한을 확정한다. 운영 사용자 대상으로 부하 알림을 보내지 않는다.

각 실제 전체 발송에도 같은 제목·본문·주소의 관리자 표시·클릭 확인이 필요하다. provider accepted는 실제 표시·읽음을 보장하지 않는다. 공지 연결·자동/예약 발송·기록 자동 삭제는 이번 버전에 포함하지 않는다.

중단은 DB enabled/campaigns_enabled를 먼저 false로 하고 Edge/웹 스위치를 끈다. 기존 작업·시도·감사는 보존하며 내부 recovery는 미시작 만료와 시작 후 유실을 정리한다. Cron을 중단하면 recovery도 멈추므로 재개 전에 상태를 확인한다. 일반 발송 개방을 위한 실기기 확인을 완료했다고 추정하거나 자동 확인하지 않는다.
