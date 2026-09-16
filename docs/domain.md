# 도메인

## 채점

홈에서 연도, 시험 유형(홀수형/짝수형), 언어이해·추리논증 답안을 받아 즉시 채점한다. `src/utils/grading.tsx`가 `answerData.ts`와 `scoreData.ts`를 사용해 정답 수, 표준점수, 백분위, 영역 분석, 보정 점수를 포함한 `GradingResult`를 만든다.

결과 페이지는 과목별 결과·답안·오답을 보여 준다. 로그인 사용자는 결과의 문항별 메모를 `grading_notes`에 저장할 수 있다.

## 공식 시험 이력과 성적 추이

로그인 사용자의 채점 결과는 Edge Function을 거쳐 KV 저장소에 기록된다. 같은 시점의 두 과목은 `groupTimestamp`로 묶인다. 이력 화면은 회독, 연도, 과목 조합을 사용해 표준점수·백분위·정답률 추이를 시각화한다.

## 사설 모의고사

시험일, 기관, 회차, 과목별 표준점수·백분위를 입력한다. `MockExamRecord`는 Edge Function 경유 KV에 저장되며, 이력 화면에서 기관 필터와 추이 차트를 제공한다.

## 로스쿨 지원 분석

LEET 합산 표준점수와 GPA를 받아 `src/utils/lawschool.ts`의 학교별 기준으로 지원 가능성을 계산한다. 결과는 적정·소신·불가로 나뉘며, 입력과 계산 결과는 화면 이동 및 새로고침 복구를 위해 `sessionStorage`에도 저장된다.

## 커뮤니티

커뮤니티는 게시글, 댓글, 좋아요, 신고, 조회 수, 이미지 첨부를 제공한다. 게시글 이미지는 `community-post-images` Storage 버킷에 업로드하고, 공개 URL 배열을 `community_posts.image_urls`에 저장한다. 화면 구현은 `CommunityPage.tsx`, `CommunityPostPage.tsx`에 있다.

`src/utils/communityStorage.ts`에는 localStorage 기반의 과거 커뮤니티 구현이 남아 있지만, 현재 커뮤니티 페이지는 Supabase 테이블을 직접 사용한다.

## 전체 채팅

전역 room ID는 `global`이다. 비로그인 사용자는 공개 메시지를 읽을 수 있고, 로그인 사용자는 자동 생성된 고유 닉네임으로 작성한다. `ChatPage.tsx`와 `RecentChatBanner.tsx`는 `chat_messages` INSERT 이벤트를 Realtime으로 구독한다.

## 공지

홈 공지는 `home_announcements`에서 읽어 배너로 순환 노출한다. 운영자는 `/admin/announcements`에서 제목·본문·배너 문구, 발행 상태, 홈 배너 노출 여부와 순서를 관리한다. 상세 운영 절차는 `docs/admin-announcements.md`를 따른다.
