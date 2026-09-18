import type { ExamType, Year } from '../App';

export function isSingleFormYear(year: Year): boolean {
  return year === '2027';
}

export function getExamTypeLabel(year: Year, examType: ExamType): string {
  return isSingleFormYear(year) ? '단일 문형' : examType === 'odd' ? '홀수형' : '짝수형';
}
