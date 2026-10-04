# 데이터베이스 및 Supabase

## 사용 방식

Supabase 클라이언트는 `src/contexts/AuthContext.tsx`에서 생성된다. 브라우저는 anon 키로 인증, 채팅, 커뮤니티, 오답 메모, Storage를 직접 사용한다. 공식 채점 이력과 사설 모의고사 이력은 Edge Function이 service role로 KV 테이블에 저장한다.

## public 스키마 (원격 조회 기준)

| 영역 | 테이블 | 용도 |
|---|---|---|
| KV | `kv_store_cd835c22` | 사용자별 공식/사설 이력 JSONB 값 |
| 채팅 | `chat_profiles` | 사용자당 고유 닉네임 |
| 채팅 | `chat_messages` | 전역 채팅 메시지 |
| 채팅 | `chat_rate_limits` | 메시지 삽입 트리거의 제한 상태 |
| 채점 | `grading_notes` | 응시 묶음·과목·문항별 개인 메모 |
| 채점 통계 | `question_statistics_snapshots` | 발행 세대·시험 조합별 전체 문항 분포 |
| 채점 통계 | `question_statistics_publication` | 현재 공개 세대 포인터 한 행 |
| 커뮤니티 | `community_posts` | 게시글 및 카운터·이미지 URL |
| 커뮤니티 | `community_comments` | 게시글 댓글 |
| 커뮤니티 | `community_post_likes`, `community_comment_likes` | 사용자별 좋아요 |
| 커뮤니티 | `community_post_reports`, `community_comment_reports` | 사용자별 신고 |
| 공지 | `home_announcements` | 발행 상태를 가진 홈 공지 |
| 공지 | `home_announcement_comments`, `home_announcement_likes` | 공지 댓글·좋아요 |

관리자 역할은 노출되지 않는 `private.admin_roles`에 저장한다. `private.is_admin()`은 이 역할을 확인하며, `public.current_user_is_admin()`은 로그인 사용자가 자기 자신의 관리자 여부만 확인할 수 있는 RPC다.

원격 조회 시 위 `public` 테이블의 RLS는 모두 활성화되어 있었다.

## 관계와 제약

- `chat_profiles.user_id`, `chat_messages.user_id`, `grading_notes.user_id`, 커뮤니티의 `user_id`는 `auth.users.id`를 참조한다.
- 커뮤니티 댓글·좋아요·신고는 게시글 또는 댓글을 참조한다.
- `grading_notes`에는 `(user_id, group_timestamp, subject, question_no)` 고유 인덱스가 있다.
- `chat_messages`에는 `(room_id, created_at desc)` 인덱스와 초당 사용자당 2개 삽입 제한 트리거가 있다.

## RLS 및 권한 (원격 정책 조회 기준)

- 채팅 프로필과 메시지는 공개 조회다. 프로필 생성/수정과 메시지 작성은 `auth.uid() = user_id` 조건을 사용한다.
- `grading_notes`는 조회·삽입·수정·삭제 모두 소유자만 허용한다.
- 커뮤니티 게시글·댓글·좋아요·신고는 공개 조회다. 생성·수정·삭제는 해당 행의 `user_id`와 `auth.uid()`를 비교한다.
- 공지는 `is_published = true`인 행만 공개 조회된다. `show_in_banner = true`인 발행 공지만 홈 배너에 표시되며 `display_order`, `created_at desc` 순으로 정렬한다. 공지 생성·수정·삭제와 발행 전 공지 조회는 `private.admin_roles`의 `admin` 역할만 허용한다.
- Storage 버킷 `community-post-images`는 공개 읽기이며, 인증 사용자는 자신의 `<uid>/...` 경로에만 업로드·수정·삭제할 수 있다.

## 기출문제 Storage

기존 공개 버킷 `past-exams`의 `watermarked/v1/`에 워터마크 PDF 78개를 보관하며, 기출문제 화면이 이 공개 URL을 직접 사용한다. `storage.objects`의 RLS와 기존 정책을 유지하며, 관리자 업로드 및 공개 객체 URL 다운로드를 사용한다. 객체 사용자 메타데이터에 학년도·과목·문형·워터마크·원본 및 출력 SHA-256을 기록한다. 전체 공개 다운로드와 객체 메타데이터를 검증했다. 다운로드 링크에는 `?download=<파일명>`을 사용해 별도 인증이나 브라우저 내 Blob 복사 없이 저장을 지원한다. 경로·접근·검증 내역은 [기출문제 Storage](past-exam-storage.md)를 따른다.

## 이력 KV 데이터

Edge Function의 키 규칙은 다음과 같다.

- `history:<userId>`: `GradingResult[]`
- `mock_history:<userId>`: `MockExamRecord[]`

POST와 DELETE는 배열 전체를 읽어 수정한 뒤 같은 키에 다시 저장한다. 따라서 이력은 일반 테이블처럼 개별 행을 검색하거나 부분 갱신하지 않는다.

### Edge Function 인증 경계

`supabase/config.toml`의 `verify_jwt = false`는 유지한다. 로컬 수정본은 공식/사설 이력의 GET·POST·전체 DELETE·개별 DELETE 모두에서 `auth.ts`의 `getUser(token)` 결과와 URL `userId`를 비교한 뒤, 검증된 ID로만 KV 키를 구성한다. Auth는 `SUPABASE_URL`과 `SUPABASE_ANON_KEY`를 사용하고 기존 KV 접근에만 service role을 사용한다. 설정 누락·Auth 장애는 KV 접근 없이 503, 무효/누락 토큰은 401, 타인 ID는 403이다. 공개 health와 OPTIONS는 인증 없이 동작한다. 개인 이력 응답에는 `Cache-Control: no-store`를 적용한다.

브라우저는 최신 `supabase.auth.getSession()`의 access token을 보낸다. KV에 도달하기 전 발생한 `401 AUTH_REQUIRED` 응답만 세션 갱신 후 최대 한 번 다시 요청한다. 네트워크 오류·타임아웃·그 밖의 오류가 난 쓰기는 자동 재시도하지 않는다. 기존 URL·키·배열·응답 형식·회독·그룹 규칙과 DB 구조는 유지한다.

프론트엔드 v1.4.4를 먼저 배포했다. 서버 릴리스 전 운영 함수 version 8과 필요한 환경 변수 이름, KV의 RLS 활성화·정책 없음·anon/authenticated/service_role grants, 마이그레이션 메타데이터를 읽기 전용으로 확인했다. 별도 검증 프로젝트가 없어 처음에는 보류했으나, 사용자가 전용 테스트 계정 생성·테스트 이력 저장·정리를 승인했다. v1.4.5 후보의 실제 Auth·KV 소유자 CRUD와 타인 접근 차단 45개 검사를 통과했다. 배포된 게이트웨이·웹에서 추가 확인 후 전용 계정·테스트 행을 정리한다. [배포 절차](history-security-rollout.md)를 따른다.

## 마이그레이션 상태

문항 통계 마이그레이션 `20260917075220_question_statistics`는 2026-09-17 운영에 적용했다. `private.exam_answer_key_versions`, `private.exam_question_answer_keys`, `private.question_statistics_runs`에 정답 버전과 발행 감사 정보를 저장하고 공개 두 테이블에 스냅샷과 현재 포인터를 저장한다. 모든 신규 테이블에 RLS를 적용하며 anon/authenticated는 현재 공개 집계의 SELECT만 가능하다. 공개 쓰기·발행 RPC·개인 기록 접근은 허용하지 않는다. 최초 발행 ID `1`: 76조합, 5,716건, 원본 조회 2026-09-17 16:56:30 KST.

기존 KV를 원본으로 집계한 발행본을 개발자가 필요할 때 수동 교체한다. 자동/예약 갱신은 없다. 발행·롤백 함수는 private SECURITY INVOKER이고 advisory lock·예상 세대 검사·전체 트랜잭션을 사용한다. [설계](question-statistics-design.md) 및 [수동 갱신](question-statistics.md)에 구조·검증·운영 규칙을 명시한다. 이번 변경은 기존 이력 API의 인증 모델을 보완하지 않는다.

저장소에는 채팅, 채점 메모, 커뮤니티 이미지 관련 SQL 파일이 있다. 원격 마이그레이션 이력에는 KV 테이블, 커뮤니티 보드/쿨다운/태그, 커뮤니티 이미지, 홈 공지가 기록되어 있다. 양쪽 목록은 동일하지 않다.

DB 변경 전에는 다음을 수행한다.

1. 원격 테이블·정책·마이그레이션 이력을 읽기 전용으로 확인한다.
2. 저장소에 없는 운영 변경을 가정하지 않는다.
3. RLS, 외래 키, 인덱스, Storage 정책, 클라이언트 호출을 함께 검토한다.
4. 실제 마이그레이션 작성·적용은 명시적으로 요청된 경우에만 한다.

## 이용 통계 DB

`supabase/migrations/20261003141220_product_usage_analytics.sql`과 후속 `20261004050638_admin_dashboard_and_member_options.sql`을 2026-10-04 운영 이력/스키마에 적용했다. 실제 기존 `private.admin_roles`, `current_user_is_admin()`, Auth 필드, KV와 마이그레이션 이력은 읽기 전용으로 대조했다.

| private 객체 | 역할 |
|---|---|
| product_analytics_settings / collection_gaps | 기본 false 수집 스위치·최초 개시·확인된 중단 구간 |
| product_analytics_test_accounts | 승인된 테스트 회원 제외 목록 |
| product_usage_events | 실제 user_id/익명 세션·문서/진입/흐름/실행 ID·수신/활동 시각·허용 속성·채널 |
| product_usage_session_state | 문서별 마지막 유효 수신과 미복구 처리 실패 |
| product_member_activity_days | KST 회원 활동일·기능·채널·OS·기기·핵심 여부 |
| product_member_first_usage | 실제 회원/버전별 최초 핵심·채점·확인 후 채점·PWA·PWA 핵심·브라우저 핵심 시각 및 보수적 known 플래그 |
| product_usage_ingestion_quality / rate_limits | 분 단위 기능/상태 품질·원본 IP를 저장하지 않는 임시 속도 제한 키 |
| product_admin_access_logs | 실제 관리자·대상·기간·허용 필터·반환 수의 개인 조회 감사 |

모두 RLS 활성화, anon/authenticated/PUBLIC 권한 없음, 브라우저 정책 없음이다. 서버 service role에만 SELECT/INSERT/UPDATE와 필요한 시퀀스 USAGE/SELECT를 부여한다. 운영 service-role 조회 및 일반 역할 EXECUTE 차단은 실제 스키마 롤백 검증과 PostgREST로 확인했다. 자동 DELETE·Cron·Auth 탈퇴 cascade는 없다. 원본 조회 90일과 실제 행 보존/삭제는 별개이며 이번 활성화에서는 자동 삭제·탈퇴 cascade를 추가하지 않았다. 논리 조회 범위와 물리 삭제를 구분한다.

공개 SECURITY INVOKER RPC `product_analytics_ingest`, `product_analytics_report`, `product_analytics_member_directory`, `product_analytics_member_activity`, `product_analytics_access_history`는 service role에만 EXECUTE를 부여한다. 서버 관리자가 승인된 실제 user_id를 전달하고 모든 조회 RPC는 `private.admin_roles`를 재확인한다. 기존 역할 RPC·RLS·KV 저장 API를 변경하지 않는다. private 스키마를 PostgREST에 추가 노출하지 않는다. 이벤트 UUID 및 행위자+실행/흐름/진입 의미 키가 중복을 막으며 항목별 하위 트랜잭션으로 처리 실패를 격리한다. 관리자 조회 이력 쓰기가 실패하면 응답 전체를 실패시킨다.

원본에서는 실제 회원 UUID를 유지하고 이름·이메일은 현재 Auth 계정 검색에서만 반환한다. 현재 보관 KV는 서버에서 검증/전개 후 합계만 반환하며 답안·점수 JSON을 관리자 브라우저로 전송하지 않는다. 기존 `public.analytics_summary`와 누락된 legacy analytics 테이블을 새 기능의 기반으로 사용하지 않는다. [통계 구현·운영](admin-analytics.md)에 정확한 시간/필터/권한/활성화 범위를 설명한다.

추가 운영 마이그레이션 `20261004050638_admin_dashboard_and_member_options.sql`은 private 일별 최소 사실 `product_usage_fact_days`와 완료/부분 발행 `product_usage_day_publications`, service-role 전용 `dashboard_source`, `publish_days`, `member_options`, `activity_feed` RPC를 준비한다. 파생 사실 교체에만 DELETE를 허용하고 원본 삭제/자동 삭제/예약 작업은 없다. 공개 조회 이력 RPC는 피드의 실제 대상 UUID 배열도 대상 조건에 포함한다. RLS·인가 재검사·감사 실패 차단·원자 발행은 합성 PostgreSQL에서 검증했다. 원본 90일, 발행 자료 25개월은 조회 논리 범위이며 물리 보존 자동화가 아니다. [확장 구현 문서](admin-dashboard-implementation.md)에 계정/장기 경계를 설명한다. 현재 적용 상태는 [v1.5.0 운영 적용](admin-analytics-rollout.md)을 따른다.
