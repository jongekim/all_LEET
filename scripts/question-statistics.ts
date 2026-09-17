import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { statisticsCatalog, objectValue } from '../src/utils/questionStatisticsModel';
import { makeArtifact, validateArtifact } from './question-statistics-artifact';

const configuredProject = 'jkxxtyaanyhmjbdtybkp';
const [command, ...args] = process.argv.slice(2);
function option(name: string, required = true): string | undefined {
  const index = args.indexOf(`--${name}`);
  const value = index < 0 ? undefined : args[index + 1];
  if ((!value || value.startsWith('--')) && required) throw new Error(`--${name} 값을 지정하세요.`);
  return value;
}
async function main() {
  if (!['prepare','publish','status','rollback'].includes(command)) {
    console.log('사용법: npm run statistics -- prepare --out FILE | status | publish --file FILE --confirm-project REF --expected-current none/ID --operator NAME --reason TEXT | rollback --snapshot-id ID --confirm-project REF --expected-current ID --operator NAME --reason TEXT');
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
  const status = () => query(`select p.snapshot_id::text,p.released_at,
    (select min(s.source_snapshot_at) from public.question_statistics_snapshots s where s.snapshot_id=p.snapshot_id) as source_snapshot_at,
    (select sum(s.sample_count)::text from public.question_statistics_snapshots s where s.snapshot_id=p.snapshot_id) as source_count,
    (select count(*) from public.question_statistics_snapshots s where s.snapshot_id=p.snapshot_id) as cohorts
    from public.question_statistics_publication p where p.key='current'`);
  if (command === 'prepare') {
    const sql = await readFile(fileURLToPath(new URL('./question-statistics-source.sql', import.meta.url)), 'utf8');
    const [raw] = await query(sql, [JSON.stringify(statisticsCatalog())]);
    const artifact = makeArtifact(raw, project, execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim());
    await writeFile(option('out')!, `${JSON.stringify(artifact,null,2)}\n`, { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ file: option('out'), source_snapshot_at: artifact.source_snapshot_at, source_count: artifact.source_count, cohorts: artifact.cohorts.length, checksum: artifact.artifact_checksum }, null, 2));
    return;
  }
  if (command === 'status') { console.log(JSON.stringify(await status(),null,2)); return; }
  if (option('confirm-project') !== project) throw new Error('대상 프로젝트 확인 값이 다릅니다.');
  const expected = option('expected-current')!;
  if (expected !== 'none' && !/^[1-9]\d*$/.test(expected)) throw new Error('현재 세대는 none 또는 양의 정수 ID여야 합니다.');
  const operator = option('operator')!.trim(), reason = option('reason')!.trim();
  if (!operator || !reason) throw new Error('수행자와 변경 사유를 지정하세요.');
  if (command === 'publish') {
    const artifact = validateArtifact(JSON.parse(await readFile(option('file')!, 'utf8')), project);
    console.log(JSON.stringify(await query('select private.publish_question_statistics($1::jsonb,$2::text,$3::text,$4::text) as publication',
      [JSON.stringify(artifact), expected, operator, reason], true),null,2));
  } else {
    const id = option('snapshot-id')!;
    if (!/^[1-9]\d*$/.test(id)) throw new Error('롤백 세대는 양의 정수 ID여야 합니다.');
    console.log(JSON.stringify(await query('select private.rollback_question_statistics($1::bigint,$2::text,$3::text,$4::text) as publication',
      [id,expected,operator,reason],true),null,2));
  }
  console.log(JSON.stringify(await status(),null,2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : '문항 통계 작업 실패'); process.exitCode = 1; });
