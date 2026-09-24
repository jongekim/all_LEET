import { useParams } from 'react-router-dom';
import { INDEXABLE_EXAM_YEARS, PastExamYearContent } from '../components/seo/PastExamSearchContent';

export function PastExamYearPage() {
  const { year } = useParams();
  if (!year || !INDEXABLE_EXAM_YEARS.includes(year)) {
    return <main className="max-w-4xl mx-auto p-8"><h1 className="text-2xl font-bold">기출문제를 찾을 수 없습니다</h1><a href="/past-exams" className="text-blue-700 underline">전체 기출문제 보기</a></main>;
  }
  return <PastExamYearContent year={year} />;
}
