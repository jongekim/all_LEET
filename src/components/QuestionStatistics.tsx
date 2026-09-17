import { createContext, useContext, type ReactNode } from 'react';
import { useQuestionStatistics } from '../hooks/useQuestionStatistics';
import type { ExamStatisticsSelection, StatisticsSnapshot } from '../types/questionStatistics';
import { formatRate } from '../utils/questionStatisticsModel';
import { getCorrectAnswers } from '../utils/answerData';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './ui/dialog';
import '../styles/question-statistics.css';

const StatisticsContext = createContext<StatisticsSnapshot | undefined>(undefined);
const warning = '채점 기록이 30건 이하로 데이터가 충분하지 않아 정답률의 정확도가 떨어질 수 있습니다.';
const evenFormNotice = '짝수형은 다회독 데이터가 많아 실제 정답률보다 높게 나타나는 경향이 있습니다.';

export function QuestionStatistics({ selection, compatible = true, children }: {
  selection: ExamStatisticsSelection; compatible?: boolean; children: ReactNode;
}) {
  const { state, retry } = useQuestionStatistics(selection, compatible);
  const snapshot = compatible && state.status === 'ready' ? state.data : undefined;
  return <StatisticsContext.Provider value={snapshot}>
    <div className="question-statistics-notice" role="status">
      {snapshot ? <>
        <p>문항별 정답률</p>
        <p>정답률을 누르면 선지별 선택률과 미응답률을 볼 수 있습니다. 미응답은 오답으로 포함합니다.</p>
        {snapshot.exam_type === 'even' && <p>{evenFormNotice}</p>}
        {snapshot.sample_count <= 30 && <p className="question-statistics-warning">{warning}</p>}
        {snapshot.sample_count === 0 && <p>아직 채점 기록이 없어 정답률을 계산할 수 없습니다.</p>}
      </> : !compatible || state.status === 'mismatch' ? <p>정답 버전이 달라 문항 통계를 표시하지 않습니다. 기존 답안과 메모는 그대로 사용할 수 있습니다.</p>
        : state.status === 'loading' ? <p>문항 통계를 불러오는 중입니다.</p>
          : state.status === 'error' ? <p>문항 통계를 불러오지 못했습니다. <button type="button" onClick={retry}>다시 시도</button></p>
            : <p>이 시험의 문항 통계가 아직 준비되지 않았습니다.</p>}
    </div>
    {children}
  </StatisticsContext.Provider>;
}

export function QuestionRate({ question, variant = 'result' }: { question: number; variant?: 'result' | 'answer-key' }) {
  const snapshot = useContext(StatisticsContext);
  if (!snapshot) return null;
  const item = snapshot.items[question - 1];
  if (!item) return null;
  const correct = getCorrectAnswers(snapshot.year, snapshot.subject, snapshot.exam_type)[question];
  const n = snapshot.sample_count;
  const rate = formatRate(item.choice_counts[correct - 1], n);
  const rows = [...item.choice_counts, item.unanswered_count];
  return <Dialog>
    <DialogTrigger asChild>
      <button type="button" className={`question-rate${variant === 'answer-key' ? ' question-rate--answer-key' : ''}`} aria-label={`${question}번 정답률 ${rate}, 응답 분포 보기`}>
        {variant === 'result' && <span className="question-rate-caption">정답률</span>}<span>{rate}</span>
        {variant === 'answer-key' && <span className="question-rate-chevron" aria-hidden="true">›</span>}
      </button>
    </DialogTrigger>
    <DialogContent className="question-statistics-dialog" overlayClassName="question-statistics-overlay" closeLabel="닫기">
      <DialogTitle>{question}번 응답 분포</DialogTitle>
      <DialogDescription>
        {snapshot.year === '09예비' ? '09예비' : `${snapshot.year.slice(-2)}학년도`} · {snapshot.subject === 'verbal' ? '언어이해' : '추리논증'} · {snapshot.exam_type === 'odd' ? '홀수형' : '짝수형'}<br />
        정답 {correct}번 · 정답률 {rate}
      </DialogDescription>
      {snapshot.exam_type === 'even' && <p className="question-statistics-footnote">{evenFormNotice}</p>}
      {n <= 30 && <p className="question-statistics-warning">{warning}</p>}
      <ul className="question-distribution" aria-label="선지별 선택과 미응답 분포">
        {rows.map((count, index) => <li key={index} className={index + 1 === correct ? 'distribution-correct' : ''}>
          <div className="distribution-values"><span>{index === 5 ? '미응답' : `${index + 1}번`}{index + 1 === correct && ' (정답)'}</span><span>{formatRate(count, n)}</span></div>
          <div className="distribution-track" aria-hidden="true"><div style={{ width: `${n ? count / n * 100 : 0}%` }} /></div>
        </li>)}
      </ul>
      <p className="question-statistics-footnote">전체 채점 기록을 기준으로 계산합니다. 반복 채점도 포함하며, 실제 시험 전체 응시자의 정답률과는 다를 수 있습니다. 반올림으로 비율 합계가 100%와 다를 수 있습니다.</p>
    </DialogContent>
  </Dialog>;
}
