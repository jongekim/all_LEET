import snapshot from '../../data/seoQuestionRates.json';

const subjectName = { verbal: '언어이해', reasoning: '추리논증' } as const;
const formName = { odd: '홀수형', even: '짝수형' } as const;

function koreanDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
}

export function QuestionRatesSnapshot({ year, preview = false }: { year: string; preview?: boolean }) {
  const cohorts = snapshot.cohorts
    .filter(cohort => cohort.year === year && (!preview || cohort.examType === 'odd'))
    .sort((a, b) => (a.subject === b.subject ? (a.examType === 'odd' ? -1 : 1) : a.subject === 'verbal' ? -1 : 1));
  const isNumericYear = /^\d{4}$/.test(year);

  return <section id="year-rates" className="past-exam-panel past-exam-selection space-y-3" aria-labelledby="year-rates-heading">
    <h2 id="year-rates-heading" className="text-lg font-bold text-gray-900">{year === '09예비' ? '09학년도 예비시험' : `${year}학년도`} 문항별 정답률</h2>
    {cohorts.length ? <>
      <p className="text-sm text-gray-700 leading-7">
        <time dateTime={snapshot.publishedAt}>{koreanDate(snapshot.publishedAt)}</time> 공개된 all LEET 채점 기록 기준입니다.
        반복 채점도 포함되며, 실제 LEET 전체 응시자의 공식 정답률과 다릅니다.
        미응답은 오답에 포함됩니다. 최신 발행본은 대화형 정답표에서 확인하세요.
      </p>
      {cohorts.map((cohort, index) => <details key={`${cohort.subject}:${cohort.examType}`} open={preview || index === 0} className="rounded-lg border border-gray-200 p-3">
        <summary className="cursor-pointer font-semibold text-gray-900">
          {subjectName[cohort.subject as keyof typeof subjectName]} {formName[cohort.examType as keyof typeof formName]} · 채점 기록 {cohort.sampleCount.toLocaleString('ko-KR')}건
        </summary>
        <div className="mt-3 space-y-2">
          {cohort.sampleCount <= 30 && <p className="text-sm text-amber-800">채점 기록이 30건 이하이므로 정답률의 정확도가 낮을 수 있습니다.</p>}
          {cohort.examType === 'even' && <p className="text-sm text-gray-700">짝수형은 다회독 데이터가 많아 실제 정답률보다 높게 나타나는 경향이 있습니다.</p>}
          {cohort.sampleCount === 0 && <p className="text-sm text-gray-700">채점 기록이 없어 정답률을 계산할 수 없습니다.</p>}
          <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm" aria-label={`${year}학년도 ${subjectName[cohort.subject as keyof typeof subjectName]} ${formName[cohort.examType as keyof typeof formName]} 문항별 정답률`}>
            {cohort.rates.map((rate, question) => <li key={question} className="rounded bg-gray-50 p-2">{question + 1}번 정답률 <strong>{rate}</strong></li>)}
          </ol>
        </div>
      </details>)}
      {preview && isNumericYear && <p className="text-sm"><a className="text-blue-700 underline underline-offset-2" href={`/past-exams/${year}#year-rates`}>{year}학년도 짝수형 정답률도 보기</a></p>}
    </> : <p className="text-sm text-gray-700 leading-7">이 학년도의 문항별 정답률은 이 공개 요약 발행본에 포함되지 않았습니다. 대화형 정답표에서 최신 통계 여부를 확인할 수 있습니다.</p>}
  </section>;
}
