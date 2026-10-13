// Only aggregate counts are requested or written. Never print credentials/errors' bodies.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ANSWER_DATA } from '../../src/utils/answerData';
import { getQuestionCount } from '../../src/utils/grading';

async function main() {
  const project = process.env.SUPABASE_PROJECT_REF;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (project !== 'jkxxtyaanyhmjbdtybkp' || !token) throw new Error('Configured project/token required');
  const catalog = Object.keys(ANSWER_DATA).flatMap(year =>
    (['verbal', 'reasoning'] as const).flatMap(subject =>
      (['odd', 'even'] as const).map(exam_type => ({year, subject, exam_type, question_count:getQuestionCount(year,subject)}))));
  const sql = await readFile(fileURLToPath(new URL('./audit_history_quality.sql', import.meta.url)), 'utf8');
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query/read-only`, {
    method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({query:sql,parameters:[JSON.stringify(catalog)]}), signal:AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Read-only audit failed (HTTP ${response.status})`);
  const body:unknown = await response.json();
  if (!Array.isArray(body) || body.length !== 1 || !body[0] || typeof body[0] !== 'object') throw new Error('Unexpected audit shape');
  const result = body[0] as Record<string,unknown>;
  const expected = ['audited_at','malformed_history_containers','total_records','supported_records','unsupported_records',
    'missing_answer_objects','missing_correct_answer_objects','invalid_answer_objects','incomplete_or_invalid_correct_answer_keys',
    'wrong_question_counts','invalid_saved_correct_counts','score_answer_mismatches','empty_answer_objects',
    'field_recalculation_available_records','affected_odd_records','affected_odd_recalculation_unavailable',
    'affected_odd_missing_answers','affected_odd_missing_or_invalid_keys','affected_odd_score_mismatches','single_form_2027_records'];
  if (Object.keys(result).length !== expected.length || expected.some(k => !(k in result))) throw new Error('Unexpected audit fields');
  for (const k of expected.filter(k => k !== 'audited_at')) {
    if (typeof result[k] !== 'string' || !/^\d+$/.test(result[k] as string)) throw new Error('Invalid aggregate count');
  }
  const out = process.argv[2];
  if (!out) throw new Error('Output path required');
  await writeFile(out, JSON.stringify({query_kind:'read_only_aggregate',contains_personal_answers:false,...result},null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify(result,null,2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Audit failed'); process.exitCode=1; });
