// Offline comparison fixture ONLY: pool the frozen V1 public counts through the reviewed registry.
// This cannot restore missing-answer exclusions, and must never be published as a V2 artifact.
import { readFile,writeFile } from 'node:fs/promises';
import { canonicalCatalog } from '../src/utils/canonicalStatisticsModel';
import { questionIdentity } from '../supabase/functions/_shared/user-data-rules/questionIdentity';
import { CANONICAL_AGGREGATION_VERSION } from '../src/types/canonicalStatistics';
import type { StatisticsSnapshot } from '../src/types/questionStatistics';
async function main() {
 const legacy=JSON.parse(await readFile('e2e/fixtures/question-statistics-2026.json','utf8')) as StatisticsSnapshot[];
 const {catalog_id,catalog_sha256,mapping_version,mapping_sha256,cohorts}=canonicalCatalog();
 const rows=cohorts.map(c=>{
  const forms=legacy.filter(r=>r.year===c.year&&r.subject===c.subject);
  const items=c.questions.map(q=>({question_id:q.question_id,correct_answer:q.correct_answer,choice_counts:[0,0,0,0,0],unanswered_count:0}));
  for(const form of forms) for(const item of form.items) {
   const mapping=questionIdentity(c.year,c.subject,form.exam_type,item.question_no),target=items[mapping.canonical_question_no-1];
   item.choice_counts.forEach((count,i)=>{target.choice_counts[mapping.choice_to_canonical[i]-1]+=Number(count);});
   target.unanswered_count+=Number(item.unanswered_count);
  }
  return {year:c.year,subject:c.subject,question_count:c.question_count,answer_key_version:c.answer_key_version,sample_count:forms.reduce((s,r)=>s+Number(r.sample_count),0),items,snapshot_id:'1',catalog_id,catalog_sha256,mapping_version,mapping_sha256,aggregation_version:CANONICAL_AGGREGATION_VERSION,source_snapshot_at:'2026-09-17T07:56:30Z',published_at:'2026-09-17T08:00:00Z'};
 });
 await writeFile('e2e/fixtures/question-statistics-v2.json',JSON.stringify(rows,null,2)+'\n');
 const verbal=rows.find(r=>r.year==='2026'&&r.subject==='verbal')!;console.log(verbal.sample_count,verbal.items[0]);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
