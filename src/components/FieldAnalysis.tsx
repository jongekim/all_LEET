import { useId, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Minus, X } from 'lucide-react';
import type { GradingResult } from '../App';
import '../styles/field-analysis.css';

function questionStatus(result: GradingResult, question: number) {
  const expected = result.correctAnswers?.[question];
  const answer = result.userAnswers?.[question];
  if (!expected || !result.userAnswers) return 'unknown';
  if (!answer) return 'blank';
  return answer === expected ? 'correct' : 'incorrect';
}
const labels = {correct:'정답',incorrect:'오답',blank:'미응답',unknown:'결과 없음'};

export function FieldAnalysis({ result, onQuestionSelect }: {
  result: GradingResult;
  onQuestionSelect: (question: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const id = useId();
  const subject = result.subject === 'verbal' ? '언어이해' : '추리논증';
  return <section className="compact-field-analysis" aria-label={`${subject} 분야별 분석`}>
    <div className="field-analysis-heading">
      <h3>분야별 분석</h3>
      <button type="button" className="field-analysis-fold" aria-expanded={expanded} aria-controls={id}
        aria-label={`${subject} 분야별 분석 ${expanded ? '접기' : '펼치기'}`}
        onClick={()=>{setExpanded(!expanded);setSelected(null);}}>
        {expanded ? '접기' : '펼치기'}{expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
      </button>
    </div>
    <div id={id} hidden={!expanded}>
      <p className="field-analysis-intro">내 답안 기준 · 분야를 누르면 문항별 결과를 볼 수 있습니다.</p>
      {!result.fieldAnalysis.length && <p className="field-analysis-empty">분야별 분류 자료가 아직 준비되지 않았습니다.</p>}
      <div className="field-analysis-rows">
        {result.fieldAnalysis.map((field,index)=>{
          const rate = field.total ? Math.round(field.correct / field.total * 100) : null;
          const open = selected === field.field;
          const questions = field.questions ?? [];
          const counts = {correct:0,incorrect:0,blank:0,unknown:0};
          for (const question of questions) counts[questionStatus(result,question)]++;
          const detailId = `${id}-${index}`;
          return <div className="field-analysis-item" key={field.field}>
            <button type="button" className="field-analysis-row" aria-expanded={open} aria-controls={detailId}
              aria-label={`${subject} ${field.field} ${field.correct}/${field.total} 정답, 내 정답 비율 ${rate ?? '미계산'}${rate === null ? '' : '%'}, 문항 ${open ? '접기' : '보기'}`}
              onClick={()=>setSelected(open ? null : field.field)}>
              <span className="field-analysis-name">{field.field}</span>
              <span className="field-analysis-track" aria-hidden="true"><span style={{width:`${rate ?? 0}%`}} /></span>
              <span className="field-analysis-count">{field.correct}<span> / {field.total}</span></span>
              <span className="field-analysis-rate">{rate === null ? '—' : `${rate}%`}</span>
              <ChevronDown className={open ? 'field-analysis-chevron field-analysis-chevron-open' : 'field-analysis-chevron'} aria-hidden="true" />
            </button>
            <div id={detailId} className="field-analysis-detail" hidden={!open} role="region" aria-label={`${subject} ${field.field} 문항별 결과`}>
              <div className="field-analysis-detail-heading">
                <span>{field.field} · 문항별 결과</span>
                {counts.unknown === 0 && questions.length > 0 && <span className="field-analysis-breakdown">
                  정답 {counts.correct} · 오답 {counts.incorrect} · 미응답 {counts.blank}
                </span>}
              </div>
              <p className="field-analysis-detail-help">문항을 누르면 해당 답안표로 이동합니다.</p>
              {!questions.length ? <p className="field-analysis-empty">문항 정보가 없습니다.</p> : <div className="field-analysis-questions">
                {questions.map(question=>{
                  const status = questionStatus(result,question);
                  return <button type="button" key={question} className={`field-analysis-question field-analysis-question-${status}`}
                    aria-label={`${subject} ${question}번 ${labels[status]}, 답안표로 이동`} onClick={()=>onQuestionSelect(question)}>
                    <span>{question}</span>{status === 'correct' ? <Check aria-hidden="true" /> : status === 'incorrect' ? <X aria-hidden="true" /> : <Minus aria-hidden="true" />}
                  </button>;
                })}
              </div>}
            </div>
          </div>;
        })}
      </div>
    </div>
  </section>;
}
