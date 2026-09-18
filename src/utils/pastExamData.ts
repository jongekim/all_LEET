import type { ExamType, Subject } from '../App';
import { ANSWER_DATA } from './answerData';
import { PAST_EXAM_DOCUMENTS } from './pastExamDocuments';

export { PAST_EXAM_DOCUMENTS };

export const PAST_EXAM_YEARS = [...new Set([
  ...Object.keys(ANSWER_DATA), ...PAST_EXAM_DOCUMENTS.map(document => document.year),
])].sort((a, b) => {
  if (a === '09예비') return 1;
  if (b === '09예비') return -1;
  return Number(b) - Number(a);
});

export function getPastExamSelection(params: URLSearchParams) {
  const requestedYear = params.get('year');
  const year = requestedYear && PAST_EXAM_YEARS.includes(requestedYear) ? requestedYear : PAST_EXAM_YEARS[0];
  const singleForm = PAST_EXAM_DOCUMENTS.some(document => document.year === year && document.examType === 'single');
  return {
    year,
    subject: (params.get('subject') === 'reasoning' ? 'reasoning' : 'verbal') as Subject,
    examType: (!singleForm && params.get('type') === 'even' ? 'even' : 'odd') as ExamType,
  };
}
