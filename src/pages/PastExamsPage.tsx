import { PageHeader } from '../components/PageHeader';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Files } from 'lucide-react';
import { YearSelector } from '../components/YearSelector';
import { AnswerKeyTable } from '../components/AnswerKeyTable';
import { PastExamFiles } from '../components/PastExamFiles';
import { ScoreConversionTable } from '../components/ScoreConversionTable';
import { PastExamReview } from '../components/PastExamReview';
import { getCorrectAnswers } from '../utils/answerData';
import { SCORE_DATA } from '../utils/scoreData';
import { getQuestionCount } from '../utils/grading';
import { getPastExamSelection, PAST_EXAM_DOCUMENTS, PAST_EXAM_YEARS } from '../utils/pastExamData';
import '../styles/past-exams.css';

export function PastExamsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { year, subject, examType } = getPastExamSelection(searchParams);
  const yearLabel = year === '09예비' ? '09학년도 예비시험' : `${year}학년도`;
  const subjectLabel = subject === 'verbal' ? '언어이해' : '추리논증';
  const typeLabel = examType === 'odd' ? '홀수형' : '짝수형';
  const documents = PAST_EXAM_DOCUMENTS.filter(document =>
    document.year === year && document.subject === subject && document.examType === examType);
  const total = getQuestionCount(year, subject);

  useEffect(() => {
    const normalized = new URLSearchParams(searchParams);
    normalized.set('year', year);
    normalized.set('subject', subject);
    normalized.set('type', examType);
    if (normalized.toString() !== searchParams.toString()) setSearchParams(normalized, { replace: true });
  }, [year, subject, examType, searchParams, setSearchParams]);

  function updateSelection(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    setSearchParams(next);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={<span className="flex items-center gap-2"><Files className="w-6 h-6 text-blue-600" aria-hidden="true" />기출문제·정답표</span>}
        description="학년도와 시험 유형을 선택해 문제지와 정답표를 확인하세요."
      />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <section aria-label="시험 선택" className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="past-exam-filters">
            <YearSelector selectedYear={year} onYearChange={value => updateSelection('year', value)} years={PAST_EXAM_YEARS} />
            <fieldset>
              <legend className="text-sm font-semibold text-gray-700 mb-2">과목 선택</legend>
              <div className="flex gap-2">
                {(['verbal', 'reasoning'] as const).map(value => (
                  <button key={value} type="button" aria-pressed={subject === value} className="past-exam-choice" onClick={() => updateSelection('subject', value)}>
                    {value === 'verbal' ? '언어이해' : '추리논증'}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold text-gray-700 mb-2">시험 유형</legend>
              <div className="flex gap-2">
                {(['odd', 'even'] as const).map(value => (
                  <button key={value} type="button" aria-pressed={examType === value} className="past-exam-choice" onClick={() => updateSelection('type', value)}>
                    {value === 'odd' ? '홀수형' : '짝수형'}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </section>
        <section aria-labelledby="past-exam-pdf-heading" className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 id="past-exam-pdf-heading" className="text-lg font-bold text-gray-900 mb-2">문제지 PDF</h2>
          <PastExamFiles documents={documents} />
        </section>
        <PastExamReview key={`${year}:${subject}:${examType}`}>
          <section aria-labelledby="answer-key-heading" className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-blue-600 px-4 sm:px-6 py-3">
              <h2 id="answer-key-heading" className="past-exam-answer-title text-lg font-bold text-white">{yearLabel} {subjectLabel} {typeLabel} 정답표</h2>
              <p className="text-sm text-blue-100 mt-1">총 {total}문항 · 문제지의 학년도와 유형을 확인해주세요.</p>
            </div>
            <div className="p-4 sm:p-6">
              <AnswerKeyTable answers={getCorrectAnswers(year, subject, examType)} total={total} />
            </div>
          </section>
          <section aria-labelledby="score-conversion-heading" className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 id="score-conversion-heading" className="past-exam-answer-title text-lg font-bold text-gray-900">{yearLabel} {subjectLabel} 점수 환산표</h2>
            <p className="text-sm text-gray-600 mt-2">홀수형·짝수형 공통 · 맞은 개수 많은 순</p>
            <p id="score-estimate-notice" className="text-xs text-gray-500 mt-2 mb-4">일부 표준점수·백분위는 추정값으로 실제 성적과 차이가 있을 수 있습니다. 참고용으로 확인해주세요.</p>
            <ScoreConversionTable scores={SCORE_DATA[year]?.[subject]} total={total} />
          </section>
          <p className="text-xs text-gray-500">정답표는 all LEET 채점에 사용하는 정답 데이터와 동일합니다.</p>
        </PastExamReview>
      </main>
    </div>
  );
}
