# 기출문제·정답표

`/past-exams`는 비로그인 사용자도 조회할 수 있다. 학년도·과목·유형 선택은 URL의 `year`, `subject`, `type`으로 유지된다. 정답은 기존 `src/utils/answerData.ts`를 사용하고 문항 수는 기존 `getQuestionCount()`를 따른다. `09예비`는 별도 학년도 항목으로 표시한다.

정답표 아래의 점수 환산표는 `src/utils/scoreData.ts`의 기존 등록 데이터를 사용한다. 선택한 학년도·과목의 만점부터 0개까지 표시하고 홀수형·짝수형은 같은 환산표를 사용한다. 일부 자료가 추정값임을 작은 문구로 고지한다. 등록되지 않은 구간은 `—`로 표시하며, 채점 함수의 기본값을 점수 자료로 표시하지 않는다.

## 문제지 추가

1. 파일의 출처, 재게시 가능 여부, 학년도·과목·시험 유형을 확인한다.
2. PDF를 `src/public/past-exams/<학년도>/`에 넣는다. 예: `2026/verbal-odd-v1.pdf`. 정정본은 새 파일명을 사용한다.
3. `src/utils/pastExamData.ts`의 `PAST_EXAM_DOCUMENTS`에 다음과 같은 항목을 추가한다. 실제 파일을 확보하기 전에는 등록하지 않는다.

```ts
{
  year: '2026',
  subject: 'verbal', // 추리논증: reasoning
  examType: 'odd', // 짝수형: even
  title: '2026학년도 언어이해 홀수형 문제지',
  url: '/past-exams/2026/verbal-odd-v1.pdf',
  fileName: 'LEET-2026-verbal-odd.pdf',
  sizeLabel: '실제 파일 용량', // 선택 사항
  sourceUrl: '확인한 원문 URL', // 선택 사항
}
```

4. `npm run check`를 실행하고 파일 열기·다운로드를 확인한다. Vercel 미리보기에서도 PDF URL의 응답이 `200`, `application/pdf`이며 본문이 PDF인지 확인한다. 현재 모든 경로에 SPA rewrite가 있으므로 필요하면 정적 PDF 경로 예외를 추가한다. 없는 PDF 경로의 HTML 응답을 정상 파일로 취급하지 않는다.
5. 자료 추가는 웹앱 재배포가 필요하다. `main` push는 배포를 유발하므로 명시적인 요청 후 버전·검증 절차를 따른다.

등록된 파일이 없는 조합은 준비 중 안내만 표시하며, 정답표 조회는 계속 가능하다. 이 페이지는 DB·Storage·인증·채점 데이터 변경을 요구하지 않는다.

## 검증

Vitest에서 모든 정답 조합의 문항 번호와 정답 범위, URL 선택 보정, PDF 미등록·등록 상태를 검증한다. Playwright에서 홈 진입, 선택·새로고침·뒤로가기, 과거 시험·예비시험, 하단 메뉴 순서, 좁은 화면의 가로 넘침·터치 영역, 합격예측의 기존 로그인 가드를 검증한다. 자동화에서는 Supabase 요청을 모의 응답으로 처리하고 운영 쓰기를 발생시키지 않는다.
