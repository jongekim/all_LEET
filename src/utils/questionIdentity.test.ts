import { describe,it,expect } from 'vitest';
import { QUESTION_REGISTRY } from '../../supabase/functions/_shared/user-data-rules/questionRegistry.generated';
import { questionIdentity,invertPermutation,projectChoiceCounts } from '../../supabase/functions/_shared/user-data-rules/questionIdentity';
import { gradeAnswers,calculateFieldAnalysis } from './grading';
import { getCorrectAnswers,getFieldMapping } from './answerData';
import { projectHistoricalFields } from '../../supabase/functions/_shared/user-data-rules/fieldProjection';
import { canonicalCatalog,validateCanonicalSnapshot,projectFormStatistics } from './canonicalStatisticsModel';
import fixture from '../../e2e/fixtures/question-statistics-v2.json';
describe('검수 레지스트리·문형 변환',()=>{
 it('1350 ID와 2700 위치/선지/정답의 일대일 대응을 전수 확인한다',()=>{
  expect(QUESTION_REGISTRY).toHaveLength(38);expect(QUESTION_REGISTRY.reduce((s,c)=>s+c.questions.length,0)).toBe(1350);
  for(const c of QUESTION_REGISTRY) {
   expect(new Set(c.questions.map(q=>q.question_id)).size).toBe(c.questions.length);
   for(const [i,q] of c.questions.entries()) {
    const odd=questionIdentity(c.year,c.subject,'odd',q.odd_question_no),even=questionIdentity(c.year,c.subject,'even',i+1);
    expect(odd.question_id).toBe(even.question_id);
    expect(odd.choice_to_canonical[getCorrectAnswers(c.year,c.subject,'odd')[q.odd_question_no]-1]).toBe(getCorrectAnswers(c.year,c.subject,'even')[i+1]);
   }
  }
  expect(()=>questionIdentity('2027','verbal','odd',1)).toThrow();
  expect(()=>questionIdentity('2026','verbal','odd',31)).toThrow();
 });
 it('자기 역순열이 아닌 대응도 올바른 방향으로 변환한다',()=>{
  const permutation=[2,3,1,5,4];expect(invertPermutation(permutation)).toEqual([3,1,2,5,4]);
  const local=projectChoiceCounts([11,22,33,44,55],permutation);expect(local).toEqual([22,33,11,55,44]);
  expect(projectChoiceCounts(local,invertPermutation(permutation))).toEqual([11,22,33,44,55]);
  expect(()=>invertPermutation([1,1,3,4,5])).toThrow();
 });
 it('모든 문항에 서로 다른 분포를 주어 번호·선지·정답 변환 누락을 검출한다',()=>{
  for(const c of canonicalCatalog().cohorts) {
   const n=10000,base=validateCanonicalSnapshot(fixture.find(r=>r.year===c.year&&r.subject===c.subject));
   const row={...base,sample_count:n,items:base.items.map((item,i)=>({...item,choice_counts:[i+1,2*(i+1),3*(i+1),4*(i+1),5*(i+1)] as [number,number,number,number,number],unanswered_count:n-15*(i+1)}))};
   for(const form of ['odd','even'] as const) {
    const view=projectFormStatistics(row,{year:c.year,subject:c.subject,examType:form});
    for(const local of view.items) {
     const id=questionIdentity(c.year,c.subject,form,local.question_no),canonical=row.items[id.canonical_question_no-1];
     expect(local.question_id).toBe(canonical.question_id);
     expect(local.choice_counts).toEqual(id.choice_to_canonical.map(choice=>canonical.choice_counts[choice-1]));
     expect(local.choice_counts[local.correct_answer-1]).toBe(canonical.choice_counts[canonical.correct_answer-1]);
    }
   }
  }
 });
 it('홀수형의 분야 6개를 보정하고 다른 분류와 총점을 유지한다',()=>{
  const changed:string[]=[];
  for(const c of QUESTION_REGISTRY) for(const [i] of c.questions.entries()) {
   const q=i+1;
   if(getFieldMapping(c.year,c.subject,'odd')[q]!==getFieldMapping(c.year,c.subject,'even')[q]) changed.push(`${c.year}:${c.subject}:${q}`);
  }
  expect(changed).toEqual(['2025:reasoning:3','2025:reasoning:4','2025:reasoning:19','2025:reasoning:20','2026:reasoning:11','2026:reasoning:12']);
  const answers={11:getCorrectAnswers('2026','reasoning','odd')[11]};
  const result=gradeAnswers('2026','reasoning',answers,40,'odd');
  expect(result.correct).toBe(1);expect(result.fieldAnalysis.find(f=>f.field==='논리학수학')!.questions).toContain(11);
  expect(result.fieldAnalysis.find(f=>f.field==='논리학수학')!.correct).toBe(1);
 });
});
describe('과거 분야 표시와 원본 보존',()=>{
 const original=()=>gradeAnswers('2025','reasoning',{3:getCorrectAnswers('2025','reasoning','odd')[3]},40,'odd');
 it('저장 당시 정답으로 재계산하고 전체 JSON/점수/시각/회독을 바꾸지 않는다',()=>{
  const raw=original();raw.fieldAnalysis=calculateFieldAnalysis(raw.year,raw.subject,'even',raw.total,raw.userAnswers!,raw.correctAnswers!);
  const json=JSON.stringify(raw);Object.freeze(raw);const view=projectHistoricalFields(raw);
  expect(view.status).toBe('ready');if(view.status==='ready') expect(view.analysis.find(f=>f.field==='과학기술')!.questions).toContain(3);
  expect(JSON.stringify(raw)).toBe(json);
  const changedKey={...original(),correctAnswers:{...original().correctAnswers,1:1}};
  expect(projectHistoricalFields(changedKey).status).toBe('ready');
 });
 it('미응답 일부/빈 객체는 허용하고 객체/키 부재·단독 점수 변경은 숨긴다',()=>{
  const raw=original();expect(projectHistoricalFields({...raw,userAnswers:{},correct:0}).status).toBe('ready');
  expect(projectHistoricalFields({...raw,userAnswers:{1:null,2:0} as unknown as Record<number,number>,correct:0}).status).toBe('ready');
  expect(projectHistoricalFields({...raw,userAnswers:undefined}).status).toBe('missing_answers');
  expect(projectHistoricalFields({...raw,correctAnswers:{1:1}}).status).toBe('missing_answer_key');
  expect(projectHistoricalFields({...raw,correct:2}).status).toBe('inconsistent_result');
  expect(projectHistoricalFields({...raw,userAnswers:{41:1}}).status).toBe('invalid_record');
  expect(projectHistoricalFields({...raw,userAnswers:undefined},true)).toEqual({status:'example',analysis:raw.fieldAnalysis});
 });
});
