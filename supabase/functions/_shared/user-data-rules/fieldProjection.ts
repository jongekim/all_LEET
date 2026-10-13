import { getQuestionCount, calculateFieldAnalysis } from './grading.ts';
import { ANSWER_DATA } from './answerData.ts';
import type { GradingResult } from './types.ts';
export type FieldProjection = {status:'ready'|'example';analysis:GradingResult['fieldAnalysis']} | {status:'missing_answers'|'missing_answer_key'|'inconsistent_result'|'invalid_record';analysis?:never};
function object(value:unknown):value is Record<string,unknown> {return value!==null&&typeof value==='object'&&!Array.isArray(value);}
export function projectHistoricalFields(result:GradingResult,example=false):FieldProjection {
  if(example) return {status:'example',analysis:result.fieldAnalysis};
  if(typeof result.year !== 'string'||!Object.prototype.hasOwnProperty.call(ANSWER_DATA,result.year)||(result.subject!=='verbal'&&result.subject!=='reasoning')||(result.examType!=='odd'&&result.examType!=='even')) return {status:'invalid_record'};
  const total=getQuestionCount(result.year,result.subject);
  if(result.total!==total||!Number.isInteger(result.correct)||result.correct<0||result.correct>total) return {status:'invalid_record'};
  if(result.userAnswers==null) return {status:'missing_answers'};
  if(!object(result.userAnswers)) return {status:'invalid_record'};
  if(!object(result.correctAnswers)||Object.keys(result.correctAnswers).length!==total||Array.from({length:total},(_,i)=>result.correctAnswers![i+1]).some(v=>!Number.isInteger(v)||v<1||v>5)) return {status:'missing_answer_key'};
  if(Object.entries(result.userAnswers).some(([key,value])=>!/^([1-9]\d*)$/.test(key)||Number(key)>total||(value!==null&&(!Number.isInteger(value)||Number(value)<0||Number(value)>5)))) return {status:'invalid_record'};
  const correct=Array.from({length:total},(_,i)=>i+1).filter(q=>result.userAnswers![q]===result.correctAnswers![q]).length;
  if(correct!==result.correct) return {status:'inconsistent_result'};
  return {status:'ready',analysis:calculateFieldAnalysis(result.year,result.subject,result.examType,total,result.userAnswers,result.correctAnswers)};
}
