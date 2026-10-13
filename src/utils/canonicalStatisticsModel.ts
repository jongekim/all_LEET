import { CATALOG_ID, CATALOG_SHA256, MAPPING_SHA256, MAPPING_VERSION, questionIdentity, projectChoiceCounts, invertPermutation, registryCohort } from '../../supabase/functions/_shared/user-data-rules/questionIdentity';
import { QUESTION_REGISTRY } from '../../supabase/functions/_shared/user-data-rules/questionRegistry.generated';
import { getCorrectAnswers } from './answerData';
import { answerKeyVersion, countValue, objectValue } from './questionStatisticsModel';
import type { ExamStatisticsSelection } from '../types/questionStatistics';
import { CANONICAL_AGGREGATION_VERSION, type CanonicalCohort, type CanonicalStatistics, type CanonicalStatisticsState, type FormStatisticsView } from '../types/canonicalStatistics';
export const CANONICAL_STATISTICS_SELECT='year,subject,snapshot_id::text,answer_key_version,aggregation_version,catalog_id,catalog_sha256,mapping_version,mapping_sha256,question_count,sample_count::text,items,source_snapshot_at,published_at';
export function canonicalCatalog() {
  return {catalog_id:CATALOG_ID,catalog_sha256:CATALOG_SHA256,mapping_version:MAPPING_VERSION,mapping_sha256:MAPPING_SHA256,aggregation_version:CANONICAL_AGGREGATION_VERSION,
    cohorts:QUESTION_REGISTRY.map(c=>({...c,question_count:c.questions.length,
      answer_key_version:answerKeyVersion({year:c.year,subject:c.subject,examType:'even'}),
      questions:c.questions.map((q,i)=>({...q,correct_answer:getCorrectAnswers(c.year,c.subject,'even')[i+1]})),
    })),excluded_cohorts:([{year:'2027',subject:'verbal',question_count:30},{year:'2027',subject:'reasoning',question_count:40}])};
}
export function validateCanonicalCohort(raw:unknown):CanonicalCohort {
  const row=objectValue(raw);
  if(typeof row.year!=='string'||(row.subject!=='verbal'&&row.subject!=='reasoning')) throw new Error('지원하지 않는 통계 조합입니다.');
  const c=registryCohort(row.year,row.subject);
  if(row.question_count!==c.questions.length||typeof row.answer_key_version!=='string'||!Array.isArray(row.items)||row.items.length!==c.questions.length) throw new Error('통계 문항이 누락되었습니다.');
  const n=countValue(row.sample_count);
  const items=row.items.map((raw,i)=>{
    const item=objectValue(raw);
    if(item.question_id!==c.questions[i].question_id||typeof item.correct_answer!=='number'||!Number.isInteger(item.correct_answer)||item.correct_answer<1||item.correct_answer>5||!Array.isArray(item.choice_counts)||item.choice_counts.length!==5) throw new Error('공통 문항/선지 분포가 올바르지 않습니다.');
    const choices=item.choice_counts.map(countValue) as [number,number,number,number,number];
    const blank=countValue(item.unanswered_count);
    if(choices.reduce((s,v)=>s+v,0)+blank!==n) throw new Error('선지와 미응답 합계가 표본 수와 다릅니다.');
    return {question_id:item.question_id as string,correct_answer:item.correct_answer,choice_counts:choices,unanswered_count:blank};
  });
  if(`v1:${items.map(i=>i.correct_answer).join('')}`!==row.answer_key_version) throw new Error('공통 정답 버전이 다릅니다.');
  return {year:row.year,subject:row.subject,question_count:c.questions.length,sample_count:n,answer_key_version:row.answer_key_version,items};
}
export function validateCanonicalSnapshot(raw:unknown):CanonicalStatistics {
  const row=objectValue(raw),cohort=validateCanonicalCohort(row);
  if(typeof row.snapshot_id!=='string'||!(/^[1-9]\d*$/.test(row.snapshot_id))||row.aggregation_version!==CANONICAL_AGGREGATION_VERSION) throw new Error('통계 세대/계약이 올바르지 않습니다.');
  for(const key of ['catalog_id','catalog_sha256','mapping_version','mapping_sha256','source_snapshot_at','published_at']) if(typeof row[key]!=='string'||!row[key]) throw new Error('통계 메타데이터가 없습니다.');
  if(!/^[0-9a-f]{64}$/.test(row.catalog_sha256 as string)||!/^[0-9a-f]{64}$/.test(row.mapping_sha256 as string)||!Number.isFinite(Date.parse(row.source_snapshot_at as string))||!Number.isFinite(Date.parse(row.published_at as string))) throw new Error('통계 해시/시각이 올바르지 않습니다.');
  return {...cohort,snapshot_id:row.snapshot_id,aggregation_version:CANONICAL_AGGREGATION_VERSION,catalog_id:row.catalog_id as string,catalog_sha256:row.catalog_sha256 as string,mapping_version:row.mapping_version as string,mapping_sha256:row.mapping_sha256 as string,source_snapshot_at:row.source_snapshot_at as string,published_at:row.published_at as string};
}
export function supportsCanonicalSnapshot(row:CanonicalStatistics):boolean {
  return row.catalog_id===CATALOG_ID&&row.catalog_sha256===CATALOG_SHA256&&row.mapping_version===MAPPING_VERSION&&row.mapping_sha256===MAPPING_SHA256&&row.answer_key_version===answerKeyVersion({year:row.year,subject:row.subject,examType:'even'});
}
export function projectFormStatistics(row:CanonicalStatistics,selection:ExamStatisticsSelection):FormStatisticsView {
  if(row.year!==selection.year||row.subject!==selection.subject||!supportsCanonicalSnapshot(row)) throw new Error('지원하지 않는 통계 기준입니다.');
  const items=Array.from({length:row.question_count},(_,i)=>{
    const identity=questionIdentity(selection.year,selection.subject,selection.examType,i+1);
    const item=row.items[identity.canonical_question_no-1];
    const correct=invertPermutation(identity.choice_to_canonical)[item.correct_answer-1];
    if(correct!==getCorrectAnswers(selection.year,selection.subject,selection.examType)[i+1]) throw new Error('문형별 정답 대응이 다릅니다.');
    return {...item,question_no:i+1,correct_answer:correct,choice_counts:projectChoiceCounts(item.choice_counts,identity.choice_to_canonical)};
  });
  return {...row,exam_type:selection.examType,canonical_answer_key_version:row.answer_key_version,answer_key_version:answerKeyVersion(selection),items};
}
export function canonicalStateForSelection(rows:readonly CanonicalStatistics[],selection:ExamStatisticsSelection):CanonicalStatisticsState {
  const row=rows.find(r=>r.year===selection.year&&r.subject===selection.subject);
  if(!row) return {status:'unavailable'};
  if(!supportsCanonicalSnapshot(row)) return {status:'mismatch'};
  return {status:'ready',data:projectFormStatistics(row,selection)};
}
export function validateCanonicalGeneration(rows:readonly CanonicalStatistics[],complete=false) {
  if(new Set(rows.map(r=>`${r.year}:${r.subject}`)).size!==rows.length) throw new Error('중복 시험 조합입니다.');
  for(const key of ['snapshot_id','source_snapshot_at','published_at','catalog_id','catalog_sha256','mapping_version','mapping_sha256'] as const) if(new Set(rows.map(r=>r[key])).size>1) throw new Error('통계 발행본이 섞여 있습니다.');
  if(complete&&rows.length&&rows.length!==QUESTION_REGISTRY.length) throw new Error('전체 통계 조합이 누락되었습니다.');
}
