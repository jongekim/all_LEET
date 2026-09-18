import { PageHeader } from '../components/PageHeader';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Files, SlidersHorizontal, BookOpen, ClipboardList, ChartNoAxesCombined } from 'lucide-react';
import { YearSelector } from '../components/YearSelector';
import { AnswerKeyTable } from '../components/AnswerKeyTable';
import { QuestionStatistics } from '../components/QuestionStatistics';
import { PastExamFiles } from '../components/PastExamFiles';
import { ScoreConversionTable } from '../components/ScoreConversionTable';
import { PastExamReview } from '../components/PastExamReview';
import { ANSWER_DATA, getCorrectAnswers } from '../utils/answerData';
import { SCORE_DATA } from '../utils/scoreData';
import { getQuestionCount } from '../utils/grading';
import { getPastExamSelection, PAST_EXAM_DOCUMENTS, PAST_EXAM_YEARS } from '../utils/pastExamData';
import '../styles/past-exams.css';

export function PastExamsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { year, subject, examType } = getPastExamSelection(searchParams);
  const yearLabel = year === '09예비' ? '09학년도 예비시험' : `${year}학년도`;
  const subjectLabel = subject === 'verbal' ? '언어이해' : '추리논증';
  const isSingleForm = PAST_EXAM_DOCUMENTS.some(document => document.year === year && document.examType === 'single');
  const typeLabel = isSingleForm ? '단일 문형' : examType === 'odd' ? '홀수형' : '짝수형';
  const documents = PAST_EXAM_DOCUMENTS.filter(document =>
    document.year === year && document.subject === subject && (document.examType === 'single' || document.examType === examType));
  const alternativeDocument = documents.length === 0
    ? PAST_EXAM_DOCUMENTS.find(document => document.year === year && document.subject === subject)
    : undefined;
  const total = getQuestionCount(year, subject);
  const hasAnswers = Boolean(ANSWER_DATA[year]?.[subject]?.[examType]);
  const scores = SCORE_DATA[year]?.[subject];

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
    <div className="past-exams-page min-h-screen bg-gray-50">
      <PageHeader
        title={<span className="flex items-center gap-2"><Files className="w-6 h-6 text-blue-600" aria-hidden="true" />기출문제·정답표</span>}
        description="문제 풀이부터 정답 확인까지, 전개년 기출문제를 한곳에서."
      />
      <main className="past-exam-main">
        <section aria-label="시험 선택" className="past-exam-panel past-exam-selection">
          <div className="past-exam-section-heading">
            <SlidersHorizontal size={18} aria-hidden="true" />
            <h2>시험 선택</h2>
            <span className="past-exam-section-caption">09예비 ~ 2027학년도</span>
          </div>
          <div className="past-exam-filters">
            <YearSelector selectedYear={year} onYearChange={value => updateSelection('year', value)} years={PAST_EXAM_YEARS} />
            <fieldset>
              <legend className="text-sm font-semibold text-gray-700 mb-2">과목 선택</legend>
              <div className="past-exam-segment">
                {(['verbal', 'reasoning'] as const).map(value => (
                  <button key={value} type="button" aria-pressed={subject === value} className="past-exam-choice" onClick={() => updateSelection('subject', value)}>
                    {value === 'verbal' ? '언어이해' : '추리논증'}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold text-gray-700 mb-2">시험 유형</legend>
              <div className="past-exam-segment">
                {isSingleForm ? <p className="past-exam-single">단일 문형 (홀수형·짝수형 구분 없음)</p> : (['odd', 'even'] as const).map(value => (
                  <button key={value} type="button" aria-pressed={examType === value} className="past-exam-choice" onClick={() => updateSelection('type', value)}>
                    {value === 'odd' ? '홀수형' : '짝수형'}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </section>
        <section aria-labelledby="past-exam-file-heading" className="past-exam-panel past-exam-documents">
          <div className="past-exam-section-heading">
            <BookOpen size={20} aria-hidden="true" />
            <h2 id="past-exam-file-heading">문제지</h2>
            <span className="past-exam-badge">PDF</span>
          </div>
          <p className="past-exam-section-description">{yearLabel} · {subjectLabel} · {typeLabel}</p>
          <PastExamFiles documents={documents} />
          {alternativeDocument && <div className="mt-4">
            <button type="button" className="past-exam-link" onClick={() => updateSelection('type', alternativeDocument.examType === 'even' ? 'even' : 'odd')}>
              {alternativeDocument.examType === 'odd' ? '홀수형' : '짝수형'} 문제지 보기
            </button>
          </div>}
          <div className="past-exam-notice">
            <p>전개년·전과목 문제지는 모두 PDF로 제공합니다.</p>
            <p>법학적성시험 문제의 저작권은 법학전문대학원협의회에 있습니다.</p>
          </div>
        </section>
        <PastExamReview key={`${year}:${subject}:${examType}`}>
          <section aria-labelledby="answer-key-heading" className="past-exam-panel">
            <div className="past-exam-table-heading">
              <div className="past-exam-section-heading"><ClipboardList size={20} aria-hidden="true" />
                <h2 id="answer-key-heading" className="past-exam-answer-title">{yearLabel} {subjectLabel} {typeLabel} 정답표</h2>
              </div>
              <p className="past-exam-section-description">총 {total}문항 · 문제지의 학년도와 유형을 확인해주세요.</p>
            </div>
            <div className="p-4 sm:p-6">
              {hasAnswers ? <QuestionStatistics selection={{ year, subject, examType }}>
                <AnswerKeyTable answers={getCorrectAnswers(year, subject, examType)} total={total} />
              </QuestionStatistics> : <p className="text-sm text-gray-600">이 시험의 정답표는 아직 준비 중입니다.</p>}
            </div>
          </section>
          <section aria-labelledby="score-conversion-heading" className="past-exam-panel past-exam-score-panel">
            <div className="past-exam-section-heading"><ChartNoAxesCombined size={20} aria-hidden="true" />
              <h2 id="score-conversion-heading" className="past-exam-answer-title">{yearLabel} {subjectLabel} 점수 환산표</h2>
            </div>
            <p className="text-sm text-gray-600 mt-2">{isSingleForm ? '맞은 개수 많은 순' : '홀수형·짝수형 공통 · 맞은 개수 많은 순'}</p>
            {scores ? <>
              <p id="score-estimate-notice" className="text-xs text-gray-500 mt-2 mb-4">일부 표준점수·백분위는 추정값으로 실제 성적과 차이가 있을 수 있습니다. 참고용으로 확인해주세요.</p>
              <ScoreConversionTable scores={scores} total={total} />
            </> : <p className="text-sm text-gray-600 mt-2">이 시험의 점수 환산표는 아직 준비 중입니다.</p>}
          </section>
          {hasAnswers && <p className="text-xs text-gray-500">정답표는 all LEET 채점에 사용하는 정답 데이터와 동일합니다.</p>}
        </PastExamReview>
      </main>
    </div>
  );
}
