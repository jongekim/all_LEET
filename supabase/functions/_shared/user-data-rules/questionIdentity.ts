import { QUESTION_REGISTRY } from './questionRegistry.generated.ts';
import type { ExamType, Subject } from './types.ts';
export { MAPPING_VERSION, MAPPING_SHA256, CLASSIFICATION_VERSION, CATALOG_ID, CATALOG_SHA256 } from './questionRegistry.generated.ts';
export type QuestionIdentity = {question_id:string; canonical_question_no:number; local_question_no:number; choice_to_canonical:readonly number[]};
const identity = [1,2,3,4,5] as const;
export function registryCohort(year:string,subject:Subject) {
  const cohort = QUESTION_REGISTRY.find(c=>c.year===year&&c.subject===subject);
  if(!cohort) throw new Error(`문형 대응 자료가 없습니다: ${year}:${subject}`);
  return cohort;
}
export function questionIdentity(year:string,subject:Subject,form:ExamType,question:number):QuestionIdentity {
  if(form!=='odd'&&form!=='even') throw new Error('지원하지 않는 문형입니다.');
  const cohort=registryCohort(year,subject);
  const index=form==='even'?question-1:cohort.questions.findIndex(q=>q.odd_question_no===question);
  const item=cohort.questions[index];
  if(!Number.isInteger(question)||question<1||!item) throw new Error('지원하지 않는 문항입니다.');
  return {question_id:item.question_id,canonical_question_no:index+1,local_question_no:question,choice_to_canonical:form==='odd'?item.odd_choice_to_even:identity};
}
export function invertPermutation(permutation:readonly number[]):number[] {
  if(permutation.length!==5||[...permutation].sort().join('')!=='12345') throw new Error('선지 대응은 1~5 순열이어야 합니다.');
  const inverse:number[]=[];
  permutation.forEach((value,index)=>{inverse[value-1]=index+1;});
  return inverse;
}
export function projectChoiceCounts(counts:readonly number[],localToCanonical:readonly number[]):[number,number,number,number,number] {
  invertPermutation(localToCanonical);
  if(counts.length!==5) throw new Error('선지 분포가 올바르지 않습니다.');
  return localToCanonical.map(c=>counts[c-1]) as [number,number,number,number,number];
}
