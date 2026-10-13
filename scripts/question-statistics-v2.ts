import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { objectValue } from '../src/utils/questionStatisticsModel';
import { makeCanonicalArtifact, validateCanonicalArtifact, sha256 } from './question-statistics-v2-artifact';
import { canonicalCatalog } from '../src/utils/canonicalStatisticsModel';
import { stableJSON } from '../supabase/functions/_shared/user-data-rules/stableJSON';

const configuredProject = 'jkxxtyaanyhmjbdtybkp';
const [command, ...args] = process.argv.slice(2);
function option(name: string, required = true): string | undefined {
  const index = args.indexOf(`--${name}`);
  const value = index < 0 ? undefined : args[index + 1];
  if ((!value || value.startsWith('--')) && required) throw new Error(`--${name} 값을 지정하세요.`);
  return value;
}
async function main() {
  if (!['prepare','publish','status','rollback','register-catalog'].includes(command)) {
    console.log('사용법: npm run statistics:v2 -- prepare --out FILE | status | publish --file FILE --confirm-project REF --expected-current none/ID --operator NAME --reason TEXT | register-catalog --confirm-project REF --operator NAME --reason TEXT | rollback --snapshot-id ID --confirm-project REF --expected-current ID --operator NAME --reason TEXT');
    return;
  }
  const project = process.env.SUPABASE_PROJECT_REF;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (project !== configuredProject || !token) throw new Error('SUPABASE_PROJECT_REF와 SUPABASE_ACCESS_TOKEN을 올바르게 설정하세요.');
  const query = async (sql: string, parameters: string[] = [], write = false): Promise<Record<string, unknown>[]> => {
    const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query${write ? '' : '/read-only'}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql, parameters }), signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`DB 요청 실패 (${response.status}): ${(await response.text()).slice(0,500)}`);
    const body: unknown = await response.json();
    if (!Array.isArray(body)) throw new Error('DB 응답 형식이 잘못되었습니다.');
    return body.map(objectValue);
  };
  const status = () => query(`select p.snapshot_id::text,p.released_at,r.source_count::text,r.excluded_out_of_scope_count::text,r.excluded_missing_answers_count::text,r.artifact_checksum,r.catalog_id,
    (select min(s.source_snapshot_at) from public.question_statistics_snapshots_v2 s where s.snapshot_id=p.snapshot_id) as source_snapshot_at,
    (select sum(s.sample_count)::text from public.question_statistics_snapshots_v2 s where s.snapshot_id=p.snapshot_id) as included_count,
    (select count(*) from public.question_statistics_snapshots_v2 s where s.snapshot_id=p.snapshot_id) as cohorts
    from public.question_statistics_publication_v2 p join private.question_statistics_runs_v2 r on r.id=p.snapshot_id where p.key='current'`);
  if (command === 'prepare') {
    const approved=await query('select payload=$1::jsonb as approved from private.question_statistics_catalogs_v2 where catalog_id=$2 and revoked_at is null',[JSON.stringify(canonicalCatalog()),canonicalCatalog().catalog_id]);
    if(approved.length!==1||approved[0].approved!==true) throw new Error('현재 생성 카탈로그가 서버에서 승인되지 않았습니다.');
    const sql = await readFile(fileURLToPath(new URL('./question-statistics-v2-source.sql', import.meta.url)), 'utf8');
    const [raw] = await query(sql, [JSON.stringify(canonicalCatalog())]);
    const artifact = makeCanonicalArtifact(raw, project, execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim());
    await writeFile(option('out')!, `${JSON.stringify(artifact,null,2)}\n`, { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ file: option('out'), source_snapshot_at: artifact.source_snapshot_at, source_count: artifact.source_count, included_count:artifact.included_count, excluded_missing_answers_count:artifact.excluded_missing_answers_count, excluded_out_of_scope_count:artifact.excluded_out_of_scope_count, cohorts: artifact.cohorts.length, checksum: artifact.artifact_checksum }, null, 2));
    return;
  }
  if (command === 'status') { console.log(JSON.stringify(await status(),null,2)); return; }
  if (option('confirm-project') !== project) throw new Error('대상 프로젝트 확인 값이 다릅니다.');
  if(command === 'register-catalog') {
    const generated=JSON.parse(await readFile(fileURLToPath(new URL('./data/question-statistics-catalog-v2.json',import.meta.url)),'utf8'));
    if(stableJSON(generated)!==stableJSON(canonicalCatalog())) throw new Error('생성 카탈로그가 현재 코드와 다릅니다.');
    const {catalog_id,catalog_sha256,...payload}=generated;
    if(sha256(payload)!==catalog_sha256||catalog_id!==`leet-${catalog_sha256}`) throw new Error('카탈로그 해시 불일치');
    console.log(JSON.stringify(await query('select private.register_question_statistics_catalog_v2($1::jsonb,$2,$3) as catalog_id',[JSON.stringify(generated),option('operator')!,option('reason')!],true),null,2));
    return;
  }
  const expected = option('expected-current')!;
  if (expected !== 'none' && !/^[1-9]\d*$/.test(expected)) throw new Error('현재 세대는 none 또는 양의 정수 ID여야 합니다.');
  const operator = option('operator')!.trim(), reason = option('reason')!.trim();
  if (!operator || !reason) throw new Error('수행자와 변경 사유를 지정하세요.');
  if (command === 'publish') {
    const artifact = validateCanonicalArtifact(JSON.parse(await readFile(option('file')!, 'utf8')), project);
    console.log(JSON.stringify(await query('select private.publish_question_statistics_v2($1::jsonb,$2::text,$3::text,$4::text) as publication',
      [JSON.stringify(artifact), expected, operator, reason], true),null,2));
  } else {
    const id = option('snapshot-id')!;
    if (!/^[1-9]\d*$/.test(id)) throw new Error('롤백 세대는 양의 정수 ID여야 합니다.');
    console.log(JSON.stringify(await query('select private.rollback_question_statistics_v2($1::bigint,$2::text,$3::text,$4::text) as publication',
      [id,expected,operator,reason],true),null,2));
  }
  console.log(JSON.stringify(await status(),null,2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : '문항 통계 작업 실패'); process.exitCode = 1; });
