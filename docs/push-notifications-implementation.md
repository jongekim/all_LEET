# 웹·PWA 수동 푸시 구현·운영 준비

2026-10-07. 사용자 승인한 분리 미리보기 범위를 구현하고 후속 릴리스 요청으로 운영 DB·키·Edge·Cron을 준비했다. **등록과 관리자 현재 기기 테스트를 먼저 활성화하고, 일반 전체/선택 발송은 실제 기기·처리량 확인 전 잠근다.** 기본 스위치는 꺼져 있으며 실제 적용 상태는 [v1.9.0 운영 기록](push-notifications-rollout.md)에 기록한다. 제품 계약은 [설계](push-notifications-design.md), 최초 검토 근거는 [검토 기록](push-notifications-review.md)다.

## 구현 경계

- 관리자 상단에 등록 완료 구독의 회원 수와 전체·회원 연결·비회원 기기를 표시한다. 독립적인 읽기 요청/새로고침과 실패/0 구분, 현재 관리자·세션 검증을 추가했으며 [푸시 구독 통계](push-subscriber-statistics.md)에 로컬 구현·운영 적용 순서를 기록한다.

- 앱 공통 `PushConsent`와 `usePushSubscription`: 회원·비회원 구분 없이 일반 서비스 화면 접속 3초 후 Radix Dialog 팝업으로 최초 안내한다. 명시 클릭으로 권한 요청, iPhone 홈 화면 안내, 등록 대기·철회·미지원 안내를 제공한다. active 수신자는 팝업을 표시하지 않고 별도 설정 화면이나 재진입 링크가 없다. 브라우저에서 허용을 선택하거나 이미 허용한 기기에서 등록을 시작하면 팝업을 즉시 닫고 서버 등록은 계속한다. 허용 후에는 같은 서비스 방문 중 자동으로 다시 열지 않고, 7일 나중에 유예를 기록하지 않는다. 실패한 미등록 기기는 다음 접속에서 팝업으로 다시 안내한다.
- 사용자 요청에 따라 ‘나중에’·닫기·Esc·바깥 클릭은 `all-leet:push-prompt-snooze:v1`에 7일 뒤 시각만 저장한다. 새로고침·홈 재진입에도 유지하고 같은 브라우저의 다른 탭에도 반영한다. 7일 후 서비스 방문에서 자동 안내를 다시 표시하며 유예 중 별도 재진입 링크는 제공하지 않는다. 저장소 차단 시 현재 화면의 메모리로 유예한다. 등록 대기·관리자 작업 화면에는 자동 안내하지 않는다. 미동의 기기는 서버 확인 실패와 관계없이, 권한만 허용한 미등록 기기는 상태 확인 후 자동 안내한다. 권한 차단·미지원·iPhone 미설치에도 각각 설정/지원/설치 안내를 표시한다. 다른 팝업이 열린 경우 닫힌 뒤 재시도하고 백그라운드에서는 보류한다. 상단 서비스 알림 받기 링크를 제거해 일반 서비스에서는 팝업으로만 진행한다. 개인정보·푸시 capability·권한 동의는 이 유예 기록에 저장하지 않는다. [분리 팝업 미리보기](previews/push-consent-popup.html)는 실제 권한 요청/서버 연결 없이 상태를 재현한다.
- `/admin/push`: 제목·본문·공개 이동 주소, 전체 구독자/전체 회원/선택 회원, 현재 기기 테스트와 표시·클릭 확인, 본인 서버 초안, 대상 확인, 최근 중복 경고, 이력·미전송 중단·unknown 수동 재시도.
- `pushApi`는 익명 요청에 JWT를 넣지 않는다. 관리자·bind는 현재 인증 세션을 사용한다. 관리자 요청은 화면의 작성자와 SDK 세션의 회원 ID가 일치할 때만 보내고, 응답 때도 동일 세션인지 확인한다. 입력·회원 선택·캠페인 내용은 메모리에서만 유지하며 계정 변경·401/403 때 페이지 본문을 제거한다.
- `pushInstallation`과 `/push-core.js`: IndexedDB v1에 설치 UUID·32바이트 capability·의도 세대·ACK만 저장한다. endpoint/auth 키·JWT·관리자 내용은 저장하지 않는다. Web Locks 지원 브라우저에서는 탭 간 작업도 직렬화하며 서버의 예상 revision 검사로 이전 요청을 거절한다. 대기열 진입 전 계정/세션도 기억하여 대기 중 계정이 바뀐 이전 detach/bind를 실행하지 않는다. 로그아웃 해제는 3초까지 기다리고 실패 의도를 보존한다. 세션 무효화 뒤 회원 발송은 서버 세션 검증으로 차단한다.
- `/sw.js`: 기존 네트워크 동작을 유지하며 visible push·현재 등록 challenge의 ACK·안전한 내부 클릭 이동을 추가했다. 폐기한 request/다른 설치/다른 실제 구독의 nonce는 확인하지 않는다. ACK 전송 실패는 다음 online/focus 메시지에서 같은 request로 재시도한다.
- 192/512px 설치 아이콘과 96px 알림 PNG는 기존 자사 SVG에서 렌더링했다. 외부 이미지나 새 브랜드 디자인은 추가하지 않았다.

관리자 확인은 실제 화면을 봤다는 진술이다. provider accepted만으로 OS 표시·읽음을 보장하지 않는다. 알림 클릭의 서버 기록, 공지 가져오기, 자동·예약 알림은 없다. 푸시 서비스 수락을 DB와 원자화할 수 없어 exactly-once 보장은 하지 않는다.

## 서버·DB

`supabase/functions/{push-subscriptions,admin-push,push-dispatch}`만 새 함수다. `_shared/push`의 contracts/crypto/app/worker/runtime을 공유한다. 등록·관리자 함수는 공개 apikey 및 경로별 capability/JWT를 자체 검증하므로 새 함수만 `verify_jwt=false`다. dispatch는 `x-push-internal` 비밀을 요구하고 임의 payload를 받지 않는다. 기존 함수 인증 설정은 유지했다.

`20261007044858_web_push_notifications.sql`은 아래 private 테이블과 service-only SECURITY INVOKER RPC 세 개를 준비한다. RLS를 활성화하고 PUBLIC/anon/authenticated 직접 권한과 RPC EXECUTE를 회수한다. service role에도 DELETE를 주지 않으며 시도·시도 이벤트·감사·receipt·테스트 확인은 UPDATE하지 못한다. 기존 성적·커뮤니티·이용 기록과 Auth 삭제 cascade는 변경하지 않는다.

| 실제 객체 | 역할 |
|---|---|
| push_control / push_limits | 기능·수동 캠페인 스위치, quota·저장량·Auth 시간 제한 설정 |
| push_installations / push_registration_requests / push_subscriptions | 설치 capability hash, pending 요청과 기존 active 소유권 분리, 수신 확인 뒤 활성 세대 교체 |
| push_drafts | actor 소유 초안·revision·최근 발송 ID |
| push_previews / push_preview_recipients | 5분 유효 후보 ID·구독/연결 세대 고정 |
| push_campaigns / push_campaign_members / push_campaign_turns | 영속 접수·회원 snapshot·캠페인별 처리 차례 |
| push_test_confirmations | 동일 내용·현재 기기의 accepted 및 관리자 확인 |
| push_deliveries / push_attempts / push_attempt_events | 작업 상태, 외부 요청 이전 started, append-only 결과·늦은 관측·lease 회수 |
| push_receipts / push_audit | operation/request UUID 멱등 결과와 변경/개인 조회 감사 |
| push_worker_slots / push_provider_control | worker 제한과 provider/key별 차단·cooldown |

공개 RPC는 `push_subscription_action`, `push_admin_action`, `push_worker_action`이며 Edge에서만 호출한다. private 스키마를 Data API에 노출하지 않는다. Auth users의 현재 id/email/name/deleted/banned, sessions의 id/user/not_after/created/refreshed 열만 추가 SELECT한다. 현재 관리자 역할과 실제 세션은 RPC에서도 재확인한다.

등록은 고정된 확인 알림을 수신한 서비스워커가 nonce와 capability로 `/verify`한 뒤 active가 된다. pending만으로 endpoint를 선점하지 않는다. 확인 시 최초 관측한 active 소유자를 다시 검사하고 endpoint 잠금·active 부분 유일 인덱스로 충돌을 막는다. 기존 active는 확인 전까지 보존한다. 등록 전에 실제 P-256 수신 공개키를 Web Crypto import와 실제 ECDH 키 합의로 검증하여 손상된 익명 수신 키가 암호화 준비 실패로 정상 provider 전체를 차단하지 않게 한다. bind/detach/sync는 설치·구독·연결의 예상 세대를 모두 요구한다. 같은 회원/세션 refresh는 세대를 올리지 않는다.

확인 후보를 접수할 때 증가분은 추가하지 않고 철회·만료·세대 변경·계정 무효만 제외한다. 최근 동일 내용·겹치는 대상의 경고 digest가 접수 직전에 바뀌면 새 확인을 요구한다. 접수와 delivery·감사는 한 트랜잭션이다. 테스트·발송·초안 응답 유실은 같은 request UUID로 재대조하고 신규 요청으로 자동 재발송하지 않는다.

운영 적용 중 확인한 PostgREST safeupdate 차단은 후속 `20261007141129_web_push_safe_updates.sql`에서 기존 공개 RPC 세 개의 singleton 상태 갱신 6곳에 WHERE 조건을 추가해 해결했다. 최초 마이그레이션과 적용 이력은 보존한다. 실제 service-role worker와 기존 권한 유지 및 합성 SQL의 두 마이그레이션 순서 실행을 검증했다.

## 작업자와 초기 제한

worker는 두 slot, 호출당 claim 5개·동시 HTTP 5개, 작업 예산 25초, HTTP timeout 5초, lease 60초다. claim을 짧은 advisory lock으로 직렬화하고 캠페인별 최근 차례를 갱신하여 큰 캠페인이 계속 앞서지 않게 한다. 외부 요청은 slot/lease/TTL/동의/계정/중단/역할/quota를 SQL에서 다시 검사하고 started를 커밋한 뒤 실행한다. 암호화·키 준비는 started 이전에 끝낸다.

| 결과 | 처리 |
|---|---|
| provider 2xx | accepted; 실제 표시/읽음은 미관측 |
| 404/410 | 실패 + 해당 구독 세대만 disabled |
| 401/403 / 키 준비 오류 | provider/key 조합 차단, 별도 운영 복구 필요 |
| 429 | Retry-After 또는 지수 지연+jitter, 총 외부 시작 3회 이내 |
| 5xx / timeout / started 후 결과 유실 | unknown; 자동 재전송하지 않음 |
| TTL·철회·계정 전환·중단 | 미시작 작업 skipped |
| 시작 전 lease 유실 | pending 복구; 외부 시작 횟수 소비 없음 |

manual unknown 재시도는 중복 경고·현재 revision·기존 24시간 TTL·합산 3회 상한을 지킨다. 이전 시도의 늦은 응답은 이벤트로 남기고 최신 상태를 덮지 않는다. 중단은 stopping → leased 작업의 결과/시작 취소 이후 stopped로 바뀐다. 정상 작성자 로그아웃은 캠페인을 중단하지 않으나 역할 회수·탈퇴·정지는 새 외부 시작을 차단한다.

초기 제한은 후보 10,000개, 하루 외부 시작 20,000회(등록 확인 포함), push 저장량 256MiB다. 등록은 설치 6회/시간·endpoint 12회/시간·해시 IP 50회/시간, 초안 120회/시간·테스트 30회/시간·preview 120회/시간·수동 캠페인 10회/시간·unknown 재시도 30회/시간이다. **합성 검증용 초기값이며 운영 처리량 보장이나 확정 비용 한도가 아니다.** 저장 한도는 새 등록·초안·preview·접수를 제한한다. 기존 행 자동 삭제는 없다.

## 초기 읽기 전용 운영 확인

아래는 운영 적용 전 확인 기록이다. 이후 사용자 릴리스 요청으로 신규 SQL만 적용했으며 현재 상태와 적용 이력은 [운영 기록](push-notifications-rollout.md)을 따른다.

2026-10-07 Management API로 실제 프로젝트의 push 객체 부재, private 관리자 helper/역할 열, Auth users/sessions 열과 migration 이력을 확인했다. Auth 시간 제한·비활성 제한은 둘 다 0, single-session 제한은 false였다. `pg_cron`·`pg_net`은 설치되어 있지 않았다. 기존 private.admin_roles는 RLS가 켜져 있고 service_role의 실제 SELECT 및 private schema USAGE 권한도 확인했다. 프로젝트는 기존 `jkxxtyaanyhmjbdtybkp`이며 사용자 데이터 본문이나 비밀은 문서에 기록하지 않았다. 앞선 설계 당시의 DNS 실패는 이번 읽기 전용 확인으로 해결했다. 새로운 SQL은 원격에 적용하지 않았다.

## 환경 설정

브라우저 설정이 없으면 `VITE_PUSH_ENABLED=false`, `VITE_PUSH_ALLOWED_ORIGINS` 빈 값이 기본이다. v1.9.0의 `.env.production`은 비밀 없는 `true`와 `https://all-leet.vercel.app`만 지정한다. 개발 모드에서는 이 파일을 읽지 않는다. 명시 true와 정확히 일치하는 origin이 있어야 API/동의 UI를 활성화한다. preview·localhost를 운영 허용 목록에 추가하지 않는다. 테스트 전용 포트 3001만 E2E에서 가상 활성화한다.

Edge 설정(비밀값은 Git·브라우저에 기록하지 않음):

| 변수 | 값의 형식·목적 |
|---|---|
| PUSH_ENABLED | 기본 false; 등록/새 발송 허용 |
| PUSH_PUBLIC_API_KEY | 기존 웹앱 공개 anon/publishable 키가 기본 SUPABASE_ANON_KEY와 다를 때 지정; 인증 권한을 부여하지 않음 |
| ECE_KEYLOG | 반드시 0; 라이브러리 키 로그 차단, 다른 값/누락은 초기화 거절 |
| PUSH_ALLOWED_ORIGINS | 정확한 HTTPS origin 쉼표 목록 |
| PUSH_VAPID_KEY_ID | 예: v1; 현재 등록 키 ID |
| PUSH_VAPID_PUBLIC_KEYS / PUSH_VAPID_PRIVATE_KEYS | `{ "v1": "base64url key" }` keyring |
| PUSH_VAPID_SUBJECT | 소유 운영 연락처 mailto 또는 HTTPS URL |
| PUSH_DATA_KEY_ID / PUSH_DATA_KEYS | AES-GCM 32바이트 keyring, base64url 형식 |
| PUSH_INTERNAL_DISPATCH_SECRET | 최소 32바이트 무작위 비밀, Vault와 일치 |
| PUSH_PROVIDER_HOSTS | 기본 fcm.googleapis.com,updates.push.services.mozilla.com,web.push.apple.com |

기존 SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY는 함수 환경에서만 사용한다. service role·VAPID private·AES·내부 인증 비밀을 `VITE_`로 만들지 않는다. AES-GCM envelope는 version/key ID/IV/ciphertext와 인증한 provider를 포함한다. Web Push는 npm:web-push 3.6.7을 Deno에서 사용하며 직접 프로토콜 암호화를 재구현하지 않는다. 세 함수는 같은 Deno lockfile을 사용한다. http_ece의 선택적 키 로깅 `ECE_KEYLOG=0`은 서버 설정으로 지정한다. 운영 Edge의 환경은 읽기 전용이므로 `Deno.env.set`을 호출하지 않고 라이브러리 동적 import 전에 값이 0인지 검사한다. 설정 누락/잘못된 값에서는 초기화를 거절한다. 원문 고지는 새 세 함수의 static_files 배포 설정 및 public 고지 파일에 보존했다. [공식 정적 파일 설정](https://supabase.com/docs/guides/local-development/cli/config#functions.function_name.static_files)을 사용한다.

키는 배포 때마다 새로 만들지 않는다. VAPID 이전 key ID를 기존 구독 종료까지 보존한다. 기존 PushSubscription.options.applicationServerKey를 공개 keyring과 대조해 원래 key ID로 수신 확인하므로 저장소 유실 복구에서도 새 키를 기존 구독에 잘못 적용하지 않는다. AES 이전 키를 암호문/백업 보존 기간 동안 유지한다. 재암호화 작업·새 VAPID로의 일괄 재구독은 아직 자동화하지 않았다. 키 오류로 차단한 provider는 원인을 해결하고 `push_provider_control`을 검토하여 수동 해제한다. 빈 keyring이나 임의 전용키로 운영을 활성화하지 않는다.

## 운영 적용 순서와 아직 필요한 실측

1. 원격 migration 차이를 다시 확인하고 **이 신규 migration만** 적용한다. 과거 이력을 일괄 db push하지 않는다. 기본 `enabled=false`, `campaigns_enabled=false`를 유지한다.
2. 고정 VAPID·AES keyring·내부 인증·origin을 안전하게 설정한다. Auth 정책과 `push_control.session_*` 값이 일치하는지 확인한다. 서비스키 호출 권한과 anon/authenticated 거절을 원격 롤백 트랜잭션/PostgREST로 검증한다.
3. 세 Edge 함수를 배포하고 내부 인증·공개/회원 경로를 확인한다. main 함수 CI에 세 함수를 추가했으므로 **main push 전에 DB를 먼저 준비해야 한다**.
4. 명시적 운영 적용 요청 뒤 `supabase/ops/install-push-cron.sql`을 별도 적용한다. pg_cron·pg_net·Vault 설치와 Vault 이름 `push_dispatch_url`/`push_dispatch_secret`이 필요하다. URL은 이 프로젝트의 `/functions/v1/push-dispatch/run`으로 제한한다. postgres 소유 10초 due tick과 1분 recovery job을 등록한다. 유휴 시 SQL만 확인하고 외부 HTTP는 만들지 않는다. worker 장애·lease·TTL 복구를 확인한다. [공식 Cron 예제](https://supabase.com/docs/guides/cron/quickstart), [Vault 스케줄 안내](https://supabase.com/docs/guides/functions/schedule-functions).
5. 승인한 테스트 origin/기기만 프론트·Edge·DB `enabled`를 켜고 **campaigns_enabled는 false**로 유지한다. PC Chromium/Firefox, Android 브라우저·PWA, iPhone 홈 화면에서 닫힘·백그라운드·권한 철회·링크·로그아웃을 확인한다. 실제 배포 Edge의 CPU/총 시간도 측정한다.
6. 정상·429·느린 응답의 1,000/10,000개 처리량과 저장 성장·quota를 측정한다. 초기 목표 1,000개/5분은 아직 보장하지 않는다. 결과가 적합할 때 DB `campaigns_enabled=true`로 수동 전체/선택 발송을 연다.
7. 웹 배포는 사용자 요청 후 버전 갱신·version:verify·check·commit/main push 순서다. 실서비스 동의/현재 기기 테스트는 승인된 대상으로만 검증한다.

중단은 DB `enabled=false`·`campaigns_enabled=false`부터 적용하고 Edge/프론트 스위치를 끈다. 기존 접수·attempt·감사는 보존한다. runtime off에서도 내부 recovery 호출은 미시작 만료/시작 후 유실 작업을 정리하되 외부 전송하지 않는다. Cron까지 멈추면 recovery도 멈추므로 재개 시 다시 확인한다. DB·함수·secrets·Cron의 실제 준비 없이 웹만 켜면 사용할 수 없다.

## 검증 방법과 한계

- `npm run test:push`: PGlite의 실제 신규 SQL에 합성 Auth/역할을 구성해 pending 선점·ACK 멱등·연결 세대·초안 소유/충돌·필수 테스트·원자 접수·기기 감소·추가 금지·중복 digest 갱신·1,000/10,000개 후보·캠페인 차례·lease 회수/늦은 결과·역할 회수·서비스 전용 권한을 검사한다. Deno 타입과 모의 API/worker, 실제 라이브러리 VAPID/암호화 요청 생성도 확인한다.
- Vitest `src/utils/pushInstallation.test.ts`: ACK/등록 응답 경쟁, A logout/B login, 3초 취소·미완료 의도를 검사한다.
- Vitest `src/utils/pushApi.test.ts`: 화면 작성자와 SDK 계정 불일치 시 요청 차단, 응답 대기 중 세션 교체 시 결과 거절을 검사한다.
- Vitest `src/utils/sw.test.ts`: visible 확인 알림, 다른 설치 nonce 거절, JWT 없는 ACK, offline 재시도, 만료 fallback, 외부 클릭 차단. 실제 SW 코드에 모의 플랫폼을 주입한다.
- Vitest `src/components/PushConsent.test.tsx`: 자동 안내와 실제 권한 요청 분리, 7일 유예·재마운트·만료·상단 링크 없음·저장소 차단·등록/기기 상태별 자동 표시 제외를 검사한다. 푸시 E2E에도 모바일/PC의 새로고침·Esc·7일 만료·가로 넘침 검사를 추가했다.
- `npm run test:e2e:push`: 별도 로컬 포트·알림 API·IndexedDB·Supabase 전체 모킹으로 모바일/데스크톱 필수 테스트/확인·접수·중단·초안·선택·응답 유실·401/403 제거·비로그인 대기를 검증한다. 실제 저장/발송은 없다.
- 두 새 명령과 SW 단위 검사를 기존 `npm run check` 및 품질 CI에 포함했다. 기존 E2E·빌드·prerender도 함께 실행한다.

합성 SQL 규모 검증은 실제 provider/네트워크 처리량이나 배포 Edge CPU를 검증한 것이 아니다. Chromium 화면 모킹은 OS 알림 표시나 iPhone 설치 검증을 대신하지 않는다. 원격 마이그레이션·pg_cron 10초 지원·Vault·Edge 배포와 실기기는 운영 적용 단계의 검증으로 남는다. 자동 경보 발송/모니터링 서비스는 추가하지 않았으며 service-only worker `metrics`와 DB/provider/cron 상태를 관찰하는 운영 절차를 준비했다.

### 변경 단계별 과거 검증 기록

아래는 각 로컬 변경 당시의 기록이며 v1.9.0의 현재 운영 검증 결과는 [운영 기록](push-notifications-rollout.md)에 별도로 기록한다.

최종 로컬 검증: 전체 `npm run check` 통과(기존 lint 경고 69개·오류 0개). 신규 VAPID 보존 키 경계도 추가 단위/Edge 검사로 통과했다. 최초 전체 실행에서 기존 E2E 두 건이 실패했지만 코드 상태를 고정한 재실행은 기존 E2E 84개와 푸시 E2E 6개·prerender 10개를 모두 통과했다. 빌드 산출물을 확인하고 임시 생성물은 원래 작업 트리 상태로 정리한다. 최종 UI 보완 이후 푸시 E2E 6개와 빌드/prerender를 다시 검증했다. 발송 응답 유실 시 확인창을 닫아 기존 요청 대조를 가리지 않도록 했다. 실제 기기·원격 적용은 미검증이다.

추가 입력 검증은 Deno의 EC import가 키 합의까지 점 검증을 미룰 수 있음을 확인한 뒤 실제 ECDH 검증까지 수행한다. 마지막 서버 검사 10개·푸시 화면 검사 6개·prerender 10개와 고정 Deno lock 검사를 통과했다.

최종 계정 전환 방어를 반영한 뒤 전체 Vitest 29개 파일·253개 테스트, TypeScript 검사와 변경 파일 lint를 통과했다. 화면 작성자와 SDK 세션이 달라진 경우 요청 자체를 막으며, 대기 중 세션이 교체된 응답도 사용하지 않는다.

홈 팝업 후속 변경 검증: lint 오류 0개(기존 경고 69개), typecheck, 전체 Vitest 30개 파일·265개 테스트, 모의 푸시 E2E 8개, 고정 공개 집계의 build:test 및 공개 HTML E2E 10개 통과. 모바일/PC의 7일 유예·새로고침·직접 진입·Esc·만료 재표시와 실제 화면을 확인했다. 실제 OS 권한·원격 등록·실기기 발송은 실행하지 않았다.

서비스 접속 자동 안내 수정 검증: 전체 Vitest 266개·푸시 E2E 11개·공개 HTML E2E 10개, typecheck와 build:test 통과. lint는 기존 경고 69개·오류 0개다. 홈 외 화면에 직접 진입한 회원/비회원과 권한만 허용하고 미등록인 기기의 재접속을 확인했다. 로컬 재검수에서 이전 나중에 기록을 초기화하려면 해당 localhost의 콘솔에서 `localStorage.removeItem("all-leet:push-prompt-snooze:v1")`만 실행하고 새로고침한다. 운영의 7일 유예 기록을 일괄 초기화하지 않는다.

권한 허용 후 닫기 수정 검증: typecheck, 전체 Vitest 30개 파일·268개 테스트, 푸시 E2E 11개, build:test 및 공개 HTML E2E 10개 통과. lint 오류 0개·기존 경고 69개다. 서버 설정 응답을 보류해도 허용 직후 닫히고 등록 요청은 계속되는 흐름, 같은 방문에서 지연/실패 시 자동 재표시 방지, 직접 열기와 권한 거절 안내 유지, 7일 유예를 기록하지 않는 허용 처리를 검증했다. 모든 쓰기 응답은 모의 처리했으며 실제 OS 권한·운영 등록·발송은 실행하지 않았다.

팝업 전용 안내 변경: 사용자 요청으로 홈 상단 서비스 알림 받기 링크·관련 props/스타일을 제거했다. 자동 3초 안내·허용 즉시 닫기·7일 유예를 유지하며, 미등록 실패는 다음 접속에서 자동 팝업으로 재시도한다. typecheck, 전체 Vitest 268개, 모의 푸시 E2E 11개, build:test 통과. lint 오류 0개·기존 경고 69개이며 실제 localhost 화면에서도 상단 링크가 없음을 확인했다. React 검토에서 조건부 훅 추가 없음, 효과 정리·버전 있는 유예 저장·Dialog 제목/설명·키보드 닫기를 확인했다. 운영 쓰기·배포는 실행하지 않았다.
