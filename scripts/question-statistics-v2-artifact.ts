import { createHash } from 'node:crypto';
import { canonicalCatalog, validateCanonicalCohort } from '../src/utils/canonicalStatisticsModel';
import { countValue, objectValue } from '../src/utils/questionStatisticsModel';
import { stableJSON } from '../supabase/functions/_shared/user-data-rules/stableJSON';
import { CANONICAL_AGGREGATION_VERSION, type CanonicalCohort } from '../src/types/canonicalStatistics';
export const sha256 = (value:unknown) => createHash('sha256').update(stableJSON(value)).digest('hex');
export type CanonicalArtifact = {
  project_ref:string;aggregation_version:typeof CANONICAL_AGGREGATION_VERSION;source_snapshot_at:string;code_revision:string;
  source_count:number;included_count:number;excluded_out_of_scope_count:number;excluded_missing_answers_count:number;invalid_count:number;malformed_histories:number;
  catalog:ReturnType<typeof canonicalCatalog>;cohorts:CanonicalCohort[];artifact_checksum:string;
};
export function makeCanonicalArtifact(raw:unknown,project:string,revision:string):CanonicalArtifact {
  const source=objectValue(raw),catalog=canonicalCatalog();
  const {catalog_id,catalog_sha256,...body}=catalog;
  if(sha256(body)!==catalog_sha256||catalog_id!==`leet-${catalog_sha256}`) throw new Error('승인 카탈로그가 변경되었습니다. 레지스트리를 다시 생성하세요.');
  if(typeof source.source_snapshot_at!=='string'||!Number.isFinite(Date.parse(source.source_snapshot_at))) throw new Error('원본 조회 시각이 올바르지 않습니다.');
  if(!Array.isArray(source.cohorts)) throw new Error('통계 묶음이 없습니다.');
  const cohorts=source.cohorts.map(validateCanonicalCohort).sort((a,b)=>`${a.year}:${a.subject}`.localeCompare(`${b.year}:${b.subject}`));
  if(cohorts.length!==catalog.cohorts.length||new Set(cohorts.map(c=>`${c.year}:${c.subject}`)).size!==catalog.cohorts.length) throw new Error('전체 통계 조합이 누락되거나 중복되었습니다.');
  for(const row of cohorts) {
    const expected=catalog.cohorts.find(c=>c.year===row.year&&c.subject===row.subject)!;
    if(row.answer_key_version!==expected.answer_key_version||row.items.some((q,i)=>q.question_id!==expected.questions[i].question_id||q.correct_answer!==expected.questions[i].correct_answer)) throw new Error('승인된 공통 문항/정답과 다릅니다.');
  }
  const result={project_ref:project,aggregation_version:CANONICAL_AGGREGATION_VERSION,source_snapshot_at:source.source_snapshot_at,code_revision:revision,
    source_count:countValue(source.source_count),included_count:countValue(source.included_count),excluded_out_of_scope_count:countValue(source.excluded_out_of_scope_count),excluded_missing_answers_count:countValue(source.excluded_missing_answers_count),invalid_count:countValue(source.invalid_count),malformed_histories:countValue(source.malformed_histories),catalog,cohorts};
  if(result.invalid_count||result.malformed_histories||result.source_count!==result.included_count+result.excluded_out_of_scope_count+result.excluded_missing_answers_count+result.invalid_count||cohorts.reduce((s,c)=>s+c.sample_count,0)!==result.included_count) throw new Error('원본 검증/건수 분할에 실패했습니다. 발행을 중단합니다.');
  return {...result,artifact_checksum:sha256(result)};
}
export function validateCanonicalArtifact(raw:unknown,project:string) {
  const source=objectValue(raw);
  if(source.project_ref!==project||source.aggregation_version!==CANONICAL_AGGREGATION_VERSION||typeof source.code_revision!=='string'||!source.code_revision.trim()) throw new Error('프로젝트/집계 버전이 다릅니다.');
  const result=makeCanonicalArtifact(source,project,source.code_revision);
  if(source.artifact_checksum!==result.artifact_checksum||stableJSON(source.catalog)!==stableJSON(result.catalog)||stableJSON(raw)!==stableJSON(result)) throw new Error('파일/승인 카탈로그가 변경되었습니다. prepare를 다시 실행하세요.');
  return result;
}
