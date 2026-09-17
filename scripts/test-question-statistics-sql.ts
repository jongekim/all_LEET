// Isolated PostgreSQL verification. No network or production credentials used.
// PGLITE_MODULE=/absolute/path/to/pglite/dist/index.js npx tsx scripts/test-question-statistics-sql.ts
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { statisticsCatalog } from '../src/utils/questionStatisticsModel';
import { makeArtifact } from './question-statistics-artifact';

async function main() {
  if (!process.env.PGLITE_MODULE) throw new Error('임시 설치된 PGLITE_MODULE 경로가 필요합니다.');
  const { PGlite } = await import(process.env.PGLITE_MODULE);
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role; create schema private; grant usage on schema public to anon,authenticated; create table public.kv_store_cd835c22(key text primary key,value jsonb);');
    await db.exec(await readFile(fileURLToPath(new URL('../supabase/migrations/20260917075220_question_statistics.sql',import.meta.url)),'utf8'));
    const records=[{year:'2026',subject:'verbal',examType:'odd',userAnswers:{1:4,2:0,3:null}}, {year:'2026',subject:'verbal',examType:'odd',userAnswers:{1:1}}, {year:'2026',subject:'reasoning',examType:'even',userAnswers:{}}];
    await db.query('insert into public.kv_store_cd835c22 values($1,$2::jsonb)',['history:synthetic',JSON.stringify(records)]);
    const sourceSQL=await readFile(fileURLToPath(new URL('./question-statistics-source.sql',import.meta.url)),'utf8');
    const source=(await db.query(sourceSQL,[JSON.stringify(statisticsCatalog())])).rows[0];
    source.source_snapshot_at=source.source_snapshot_at.toISOString();
    const first=makeArtifact(source,'jkxxtyaanyhmjbdtybkp','local-test');
    assert.equal(first.source_count,3);
    const verbal=first.cohorts.find(c=>c.year==='2026'&&c.subject==='verbal'&&c.exam_type==='odd')!;
    assert.deepEqual(verbal.items[0].choice_counts,[1,0,0,1,0]);
    assert.equal(verbal.items[1].unanswered_count,2);
    assert.equal(verbal.items[2].unanswered_count,2);
    const publish = async (artifact: unknown, expected:string) => (await db.query('select private.publish_question_statistics($1::jsonb,$2,$3,$4) as result',[JSON.stringify(artifact),expected,'test','isolated SQL test'])).rows[0].result;
    const a=await publish(first,'none'); assert.equal(a.already_published,false);
    assert.equal((await publish(first,'none')).already_published,true);
    const broken=JSON.parse(JSON.stringify(first)); broken.artifact_checksum='f'.repeat(64); broken.cohorts[0].items[0].unanswered_count++;
    await assert.rejects(publish(broken,a.snapshot_id));
    assert.equal((await db.query('select count(*)::int as n from private.question_statistics_runs')).rows[0].n,1);
    const second=makeArtifact({...source,source_snapshot_at:new Date(Date.now()+1000).toISOString()},first.project_ref,'second-test');
    await assert.rejects(publish(second,'none'));
    const b=await publish(second,a.snapshot_id);
    for (const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      assert.equal((await db.query('select count(*)::int as n from public.question_statistics_snapshots')).rows[0].n,76);
      assert.equal((await db.query('select count(*)::int as n from public.question_statistics_snapshots where snapshot_id=$1',[a.snapshot_id])).rows[0].n,0);
      await assert.rejects(db.query('delete from public.question_statistics_publication'));
      await assert.rejects(db.query('select * from private.question_statistics_runs'));
      await assert.rejects(db.query("select private.rollback_question_statistics(1,'2','test','forbidden')"));
      await db.exec('reset role');
    }
    await assert.rejects(db.query('select private.rollback_question_statistics($1,$2,$3,$4)',[a.snapshot_id,'999','test','wrong CAS']));
    await db.query('select private.rollback_question_statistics($1,$2,$3,$4)',[a.snapshot_id,b.snapshot_id,'test','rollback test']);
    assert.equal((await db.query('select snapshot_id::text as id from public.question_statistics_publication')).rows[0].id,a.snapshot_id);
    await db.query('update public.kv_store_cd835c22 set value=$1::jsonb where key=$2',[JSON.stringify([...records,{year:'2026',subject:'verbal',examType:'odd',userAnswers:{1:'4'}}]),'history:synthetic']);
    const badSource=(await db.query(sourceSQL,[JSON.stringify(statisticsCatalog())])).rows[0];
    badSource.source_snapshot_at=badSource.source_snapshot_at.toISOString();
    assert.equal(badSource.quarantined_count,'1');
    assert.throws(()=>makeArtifact(badSource,first.project_ref,'invalid'));
    console.log('SQL 검증 통과: 76개 조합, 미응답·부분 답안, 원자적 발행, 중복 발행, CAS, 롤백, anon/authenticated RLS·쓰기 거부, 원본 이상 시 중단');
  } finally { await db.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
