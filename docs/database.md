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

`supabase/config.toml`에서 `make-server-cd835c22`의 `verify_jwt`는 현재 `false`다. 함수 라우트는 `/history/:userId`와 `/mock-history/:userId`처럼 URL의 `userId`를 키 구성에 사용하며, 함수 내부에서 요청 JWT의 사용자와 `userId`가 같은지 검사하는 코드는 확인되지 않았다. 이 함수는 service role로 KV 테이블에 접근한다. 따라서 이력 API를 수정하거나 외부에 노출할 때는 인증·인가 모델을 먼저 검토해야 한다.

## 마이그레이션 상태

문항 통계 마이그레이션 `20260917075220_question_statistics`는 2026-09-17 운영에 적용했다. `private.exam_answer_key_versions`, `private.exam_question_answer_keys`, `private.question_statistics_runs`에 정답 버전과 발행 감사 정보를 저장하고 공개 두 테이블에 스냅샷과 현재 포인터를 저장한다. 모든 신규 테이블에 RLS를 적용하며 anon/authenticated는 현재 공개 집계의 SELECT만 가능하다. 공개 쓰기·발행 RPC·개인 기록 접근은 허용하지 않는다. 최초 발행 ID `1`: 76조합, 5,716건, 원본 조회 2026-09-17 16:56:30 KST.

기존 KV를 원본으로 집계한 발행본을 개발자가 필요할 때 수동 교체한다. 자동/예약 갱신은 없다. 발행·롤백 함수는 private SECURITY INVOKER이고 advisory lock·예상 세대 검사·전체 트랜잭션을 사용한다. [설계](question-statistics-design.md) 및 [수동 갱신](question-statistics.md)에 구조·검증·운영 규칙을 명시한다. 이번 변경은 기존 이력 API의 인증 모델을 보완하지 않는다.

저장소에는 채팅, 채점 메모, 커뮤니티 이미지 관련 SQL 파일이 있다. 원격 마이그레이션 이력에는 KV 테이블, 커뮤니티 보드/쿨다운/태그, 커뮤니티 이미지, 홈 공지가 기록되어 있다. 양쪽 목록은 동일하지 않다.

DB 변경 전에는 다음을 수행한다.

1. 원격 테이블·정책·마이그레이션 이력을 읽기 전용으로 확인한다.
2. 저장소에 없는 운영 변경을 가정하지 않는다.
3. RLS, 외래 키, 인덱스, Storage 정책, 클라이언트 호출을 함께 검토한다.
4. 실제 마이그레이션 작성·적용은 명시적으로 요청된 경우에만 한다.
