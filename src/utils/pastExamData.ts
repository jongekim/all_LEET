import type { ExamType, Subject } from '../App';
import type { PastExamDocument } from '../types/pastExam';
import { ANSWER_DATA } from './answerData';

export const PAST_EXAM_YEARS = Object.keys(ANSWER_DATA).sort((a, b) => {
  if (a === '09예비') return 1;
  if (b === '09예비') return -1;
  return Number(b) - Number(a);
});

// 실제 확보한 문제지만 등록합니다. 파일 추가 절차: docs/past-exams.md
export const PAST_EXAM_DOCUMENTS: PastExamDocument[] = [];

export function getPastExamSelection(params: URLSearchParams) {
  const requestedYear = params.get('year');
  return {
    year: requestedYear && PAST_EXAM_YEARS.includes(requestedYear) ? requestedYear : PAST_EXAM_YEARS[0],
    subject: (params.get('subject') === 'reasoning' ? 'reasoning' : 'verbal') as Subject,
    examType: (params.get('type') === 'even' ? 'even' : 'odd') as ExamType,
  };
}
