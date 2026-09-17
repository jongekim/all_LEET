import { QuestionRate } from './QuestionStatistics';

interface AnswerKeyTableProps {
  answers: Record<number, number>;
  total: number;
}

export function AnswerKeyTable({ answers, total }: AnswerKeyTableProps) {
  return (
    <ol className="answer-key-grid" aria-label="문항별 정답">
      {Array.from({ length: total }, (_, index) => index + 1).map(question => (
        <li key={question} className="answer-key-cell" aria-label={`${question}번 정답 ${answers[question] ?? '미등록'}`}>
          <span className="answer-key-question">{question}번</span>
          <strong className="answer-key-value">{answers[question] ?? '—'}</strong>
          <QuestionRate question={question} variant="answer-key" />
        </li>
      ))}
    </ol>
  );
}
