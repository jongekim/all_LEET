import { ANSWER_DATA } from '../../utils/answerData';
import { PAST_EXAM_DOCUMENTS, PAST_EXAM_YEARS } from '../../utils/pastExamData';
import { getQuestionCount } from '../../utils/grading';
import { SCORE_DATA } from '../../utils/scoreData';
import seoRates from '../../data/seoQuestionRates.json';
import type { Subject } from '../../App';
import { QuestionRatesSnapshot } from './QuestionRatesSnapshot';

export const INDEXABLE_EXAM_YEARS = PAST_EXAM_YEARS.filter(year =>
  /^\d{4}$/.test(year) && PAST_EXAM_DOCUMENTS.some(document => document.year === year));

const subjectLabel: Record<Subject, string> = {
  verbal: '언어이해',
  reasoning: '추리논증',
};

const formLabel = (form: string) => form === 'single' ? '단일 문형' : form === 'odd' ? '홀수형' : '짝수형';

export function HomeSearchContent() {
  return <section aria-labelledby="home-search-heading" className="bg-white rounded-lg shadow p-5 sm:p-6 space-y-3">
    <h2 id="home-search-heading" className="text-lg font-bold text-gray-900">리트 기출문제와 문항별 정답률</h2>
    <p className="text-sm text-gray-700 leading-7">학년도별 LEET 언어이해·추리논증 문제지를 PDF로 확인하고, 정답표와 점수 환산표를 볼 수 있습니다. 문항별 정답률은 all LEET 채점 기록을 바탕으로 제공하며 전체 응시자의 공식 정답률은 아닙니다.</p>
    <div className="flex flex-wrap gap-3 text-sm font-semibold">
      <a className="text-blue-700 underline underline-offset-2" href="/past-exams">리트 기출문제 전체 보기</a>
      <a className="text-blue-700 underline underline-offset-2" href="/past-exams/2025">2025학년도 리트 기출 보기</a>
      <a className="text-blue-700 underline underline-offset-2" href="/question-rates">리트 문항별 정답률 보기</a>
    </div>
  </section>;
}

export function PastExamIndexContent() {
  return <section aria-labelledby="past-exam-years-heading" className="past-exam-panel past-exam-selection space-y-3">
    <h2 id="past-exam-years-heading" className="text-lg font-bold text-gray-900">학년도별 리트 기출문제</h2>
    <p className="text-sm text-gray-700 leading-7">학년도별 페이지에서 언어이해·추리논증 문제지 PDF와 정답표를 확인할 수 있습니다. 문제지의 홀수형·짝수형을 확인한 뒤 같은 문형의 정답표를 사용하세요.</p>
    <nav aria-label="학년도별 기출문제" className="flex flex-wrap gap-2">
      {INDEXABLE_EXAM_YEARS.map(year => <a key={year} href={`/past-exams/${year}`} className="past-exam-link">{year}학년도 리트 기출</a>)}
    </nav>
    <p className="text-sm text-gray-700 leading-7">문항별 채점 기록 기반 비율은 <a className="text-blue-700 underline underline-offset-2" href="/question-rates">리트 정답률 안내</a>에서 확인할 수 있습니다.</p>
  </section>;
}

export function QuestionRatesContent({ year = '2025' }: { year?: string }) {
  return <><section aria-labelledby="rate-guide-heading" className="past-exam-panel past-exam-selection space-y-3">
    <h2 id="rate-guide-heading" className="text-lg font-bold text-gray-900">리트 문항별 정답률을 보는 방법</h2>
    <p className="text-sm text-gray-700 leading-7">학년도·과목·문형을 선택하고 정답표를 열면 각 문항의 정답률과 1~5번 선지 선택률, 미응답률을 확인할 수 있습니다. 미응답은 오답에 포함합니다.</p>
    <p className="text-sm text-gray-700 leading-7">정답률은 all LEET에 저장된 채점 기록을 기준으로 계산합니다. 반복 채점도 포함되므로 실제 LEET 전체 응시자의 정답률과 다를 수 있습니다. 해당 시험의 채점 기록이 30건 이하라면 정확도가 낮을 수 있으며, 통계가 준비되지 않은 시험은 정답표만 제공합니다.</p>
    <div className="flex flex-wrap gap-3 text-sm font-semibold">
      <a className="text-blue-700 underline underline-offset-2" href="/past-exams/2025">2025학년도 리트 기출·정답표</a>
      <a className="text-blue-700 underline underline-offset-2" href="/past-exams/2026">2026학년도 리트 기출·정답표</a>
      <a className="text-blue-700 underline underline-offset-2" href="/past-exams">전체 학년도 기출문제</a>
    </div>
  </section><QuestionRatesSnapshot year={year} preview /></>;
}

export function PastExamYearContent({ year }: { year: string }) {
  const documents = PAST_EXAM_DOCUMENTS.filter(document => document.year === year);
  if (!INDEXABLE_EXAM_YEARS.includes(year)) return null;
  const forms = [...new Set(documents.map(document => formLabel(document.examType)))].join('·');
  const hasRates = seoRates.cohorts.some(cohort => cohort.year === year);

  return <div className="min-h-screen bg-gray-50">
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{year}학년도 리트 기출문제와 정답표</h1>
        <p className="text-sm text-gray-600 mt-2">LEET 언어이해·추리논증 문제지 PDF, 문형별 정답, 문항별 정답률 확인 경로</p>
      </div>
    </header>
    <main className="past-exam-main">
      <nav aria-label="기출문제 탐색" className="text-sm flex flex-wrap gap-3">
        <a className="text-blue-700 underline underline-offset-2" href="/past-exams">전체 학년도</a>
        <a className="text-blue-700 underline underline-offset-2" href="/question-rates">문항별 정답률</a>
        <a className="text-blue-700 underline underline-offset-2" href="/">리트 채점</a>
      </nav>
      <section className="past-exam-panel past-exam-selection space-y-2">
        <h2 className="text-lg font-bold text-gray-900">{year}학년도 기출 자료 안내</h2>
        <p className="text-sm text-gray-700 leading-7">언어이해 {getQuestionCount(year, 'verbal')}문항, 추리논증 {getQuestionCount(year, 'reasoning')}문항의 {forms} 문제지 PDF {documents.length}종을 제공합니다. {SCORE_DATA[year]?.verbal && SCORE_DATA[year]?.reasoning ? '두 과목의 점수 환산표도 확인할 수 있습니다.' : '점수 환산표는 제공 여부를 대화형 화면에서 확인하세요.'}</p>
        <p className="text-sm text-gray-700 leading-7">과목과 문형별 문제지를 열거나 다운로드할 수 있습니다. 아래 정답은 문제지를 푼 뒤 펼쳐 확인하세요. {hasRates ? '이 학년도의 채점 기록 기반 정답률은 아래에서 볼 수 있습니다.' : '이 학년도의 채점 기록 기반 정답률은 검색용 요약에 아직 없습니다.'} 점수 환산표는 대화형 기출문제 화면에서 확인하세요.</p>
        <p className="text-xs text-gray-600">법학적성시험 문제의 저작권은 법학전문대학원협의회에 있습니다. 일부 표준점수·백분위는 추정값으로 실제 성적과 다를 수 있습니다.</p>
      </section>
      {(['verbal', 'reasoning'] as const).map(subject => {
        const subjectDocuments = documents.filter(document => document.subject === subject);
        if (subjectDocuments.length === 0) return null;
        return <section key={subject} className="past-exam-panel past-exam-selection space-y-4" aria-labelledby={`${subject}-heading`}>
          <h2 id={`${subject}-heading`} className="text-lg font-bold text-gray-900">{year}학년도 {subjectLabel[subject]} 기출문제</h2>
          <ul className="space-y-3">
            {subjectDocuments.map(document => {
              const type = document.examType === 'single' ? 'odd' : document.examType;
              const answers = ANSWER_DATA[year]?.[subject]?.[type];
              return <li key={document.url} className="border border-gray-200 rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-gray-900">{document.title}</h3>
                <div className="flex flex-wrap gap-3 text-sm">
                  <a className="text-blue-700 underline underline-offset-2" href={document.url} target="_blank" rel="noopener noreferrer">{formLabel(document.examType)} PDF 열기</a>
                  <a className="text-blue-700 underline underline-offset-2" href={`${document.url}?download=${encodeURIComponent(document.fileName)}`}>PDF 다운로드</a>
                  <a className="text-blue-700 underline underline-offset-2" href={`/past-exams?year=${year}&subject=${subject}&type=${type}`}>정답률·점수 환산표 보기</a>
                </div>
                {answers && <details className="text-sm text-gray-700">
                  <summary className="cursor-pointer font-semibold">{formLabel(document.examType)} 정답표 펼치기</summary>
                  <ol className="grid grid-cols-5 sm:grid-cols-10 gap-2 mt-3" aria-label={`${year}학년도 ${subjectLabel[subject]} ${formLabel(document.examType)} 정답표`}>
                    {Object.entries(answers).map(([question, answer]) => <li key={question} className="text-center bg-gray-50 rounded p-2">{question}번 <strong>{answer}</strong></li>)}
                  </ol>
                </details>}
              </li>;
            })}
          </ul>
        </section>;
      })}
      <QuestionRatesSnapshot year={year} />
    </main>
  </div>;
}
