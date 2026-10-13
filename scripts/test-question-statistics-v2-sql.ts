import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { canonicalCatalog, projectFormStatistics, validateCanonicalSnapshot } from '../src/utils/canonicalStatisticsModel';
import { makeCanonicalArtifact, validateCanonicalArtifact, sha256 } from './question-statistics-v2-artifact';
import { statisticsCatalog } from '../src/utils/questionStatisticsModel';
import { makeArtifact } from './question-statistics-artifact';
async function main() {
 const db=new PGlite();
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;grant usage on schema public to anon,authenticated;alter default privileges in schema public grant all on tables to anon,authenticated,service_role;create table public.kv_store_cd835c22(key text primary key,value jsonb);`);
  await db.exec(await readFile('supabase/migrations/20260917075220_question_statistics.sql','utf8'));
  await db.exec(await readFile('supabase/migrations/20261012122322_canonical_question_statistics_v2.sql','utf8'));
  const catalog=canonicalCatalog();
  assert.equal((await db.query<{valid:boolean}>('select private.statistics_catalog_valid_v2($1::jsonb) as valid',[JSON.stringify(catalog)])).rows[0].valid,true);
  assert.equal((await db.query<{valid:boolean}>(`with candidate as(select jsonb_set($1::jsonb,'{cohorts,0,question_count}','40.0'::jsonb)-'catalog_id'-'catalog_sha256' as v), hashed as(select v,private.statistics_hash_v2(v) as h from candidate) select private.statistics_catalog_valid_v2(v||jsonb_build_object('catalog_id','leet-'||h,'catalog_sha256',h)) as valid from hashed`,[JSON.stringify(catalog)])).rows[0].valid,false);
  await db.query('select private.register_question_statistics_catalog_v2($1::jsonb,$2,$3)',[JSON.stringify(catalog),'test','verified catalog']);
  await assert.rejects(db.query("update private.question_statistics_catalogs_v2 set payload=payload||'{\"mapping_version\":\"changed\"}'::jsonb"));
  const records=[
   {year:'2025',subject:'reasoning',examType:'odd',total:40,userAnswers:{3:1,4:2}},
   {year:'2025',subject:'reasoning',examType:'even',total:40,userAnswers:{4:3,3:5}},
   {year:'2025',subject:'reasoning',examType:'odd',total:40,userAnswers:{}},
   {year:'2025',subject:'reasoning',examType:'even',total:40},
   {year:'2025',subject:'reasoning',examType:'even',total:40,userAnswers:null},
   {year:'2027',subject:'verbal',examType:'odd',total:30},
   {year:'09예비',subject:'reasoning',examType:'odd',total:40,userAnswers:{14:1}},
   {year:'2015',subject:'reasoning',examType:'odd',total:35,userAnswers:{8:2}},
   {year:'2026',subject:'verbal',examType:'odd',total:30,userAnswers:{1:0,2:null}},
  ];
  await db.query('insert into public.kv_store_cd835c22 values($1,$2::jsonb)',['history:synthetic',JSON.stringify(records)]);
  const sourceSQL=await readFile('scripts/question-statistics-v2-source.sql','utf8');
  const source=async():Promise<Record<string,unknown> & {source_snapshot_at:string}>=>{const row=(await db.query<Record<string,unknown>>(sourceSQL,[JSON.stringify(catalog)])).rows[0];return {...row,source_snapshot_at:(row.source_snapshot_at as Date).toISOString()};};
  const raw=await source();const first=makeCanonicalArtifact(raw,'jkxxtyaanyhmjbdtybkp','isolated-test');
  assert.deepEqual(validateCanonicalArtifact(JSON.parse(JSON.stringify(first)),first.project_ref),first);
  assert.throws(()=>validateCanonicalArtifact({...first,code_revision:'tampered'},first.project_ref));
  const virtual=structuredClone(catalog);virtual.cohorts.find(c=>c.year==='2025'&&c.subject==='reasoning')!.questions[3].odd_choice_to_even=[2,3,1,5,4];
  const virtualRaw=(await db.query<Record<string,unknown>>(sourceSQL,[JSON.stringify(virtual)])).rows[0];
  const virtualCohorts=virtualRaw.cohorts as typeof first.cohorts;
  assert.deepEqual(virtualCohorts.find(c=>c.year==='2025'&&c.subject==='reasoning')!.items[3].choice_counts,[0,1,1,0,0]);
  assert.equal(first.source_count,9);assert.equal(first.included_count,6);assert.equal(first.excluded_missing_answers_count,2);assert.equal(first.excluded_out_of_scope_count,1);
  const row=first.cohorts.find(c=>c.year==='2025'&&c.subject==='reasoning')!;
  assert.equal(row.sample_count,3);
  const mapped=catalog.cohorts.find(c=>c.year==='2025'&&c.subject==='reasoning')!.questions[3];
  assert.equal(row.items[3].choice_counts[mapped.odd_choice_to_even[0]-1],1+(Number(mapped.odd_choice_to_even[0])===3?1:0));
  assert.equal(row.items[0].unanswered_count,3);
  assert.equal(first.cohorts.find(c=>c.year==='09예비'&&c.subject==='reasoning')!.items[13].choice_counts[3],1);
  assert.equal(first.cohorts.find(c=>c.year==='2015'&&c.subject==='reasoning')!.items[7].choice_counts[4],1);
  // V1 retains its independent pointer and form contract.
  const old=(await db.query<Record<string,unknown>>(await readFile('scripts/question-statistics-source.sql','utf8'),[JSON.stringify(statisticsCatalog())])).rows[0];
  // V1 regards 2027 as invalid: compare same source without the intentionally out-of-scope row.
  await db.query('update public.kv_store_cd835c22 set value=$1::jsonb',[JSON.stringify(records.filter(r=>r.year!=='2027'))]);
  const oldValid=(await db.query<Record<string,unknown>>(await readFile('scripts/question-statistics-source.sql','utf8'),[JSON.stringify(statisticsCatalog())])).rows[0];
  const oldArtifact=makeArtifact({...oldValid,source_snapshot_at:(oldValid.source_snapshot_at as Date).toISOString()},first.project_ref,'legacy');
  await db.query('select private.publish_question_statistics($1::jsonb,$2,$3,$4)',[JSON.stringify(oldArtifact),'none','test','legacy compatibility']);
  assert.equal(old.quarantined_count,'1');
  await db.query('update public.kv_store_cd835c22 set value=$1::jsonb',[JSON.stringify(records)]);
  const publish=async(a:unknown,expected:string)=>(await db.query<{result:{snapshot_id:string;already_published:boolean}}>('select private.publish_question_statistics_v2($1::jsonb,$2,$3,$4) as result',[JSON.stringify(a),expected,'test','isolated publication'])).rows[0].result;
  const a=await publish(first,'none');assert.equal((await publish(first,'none')).already_published,true);
  for(const mutate of [
   (x:typeof first)=>{x.cohorts.pop();},
   (x:typeof first)=>{Object.assign(x.cohorts[0].items[0],{user_id:'must-not-publish'});},
   (x:typeof first)=>{x.cohorts[0].items[0].question_id='unknown';},
   (x:typeof first)=>{x.cohorts[0].items[0].unanswered_count++;},
   (x:typeof first)=>{x.catalog.mapping_version='unapproved';},
   (x:typeof first)=>{x.source_count++;},
  ]) {const broken=structuredClone(first);mutate(broken);const {artifact_checksum,...payload}=broken;void artifact_checksum;broken.artifact_checksum=sha256(payload);await assert.rejects(publish(broken,a.snapshot_id));}
  const badChecksum=structuredClone(first);badChecksum.artifact_checksum='f'.repeat(64);await assert.rejects(publish(badChecksum,a.snapshot_id));
  assert.equal((await db.query<{n:number}>('select count(*)::int as n from private.question_statistics_runs_v2')).rows[0].n,1);
  const second=makeCanonicalArtifact({...raw,source_snapshot_at:new Date(Date.now()-1000).toISOString()},first.project_ref,'second-test');
  await assert.rejects(publish(second,'none'));const b=await publish(second,a.snapshot_id);
  const snapshots=(await db.query<Record<string,unknown>>('select *,snapshot_id::text,sample_count::text from public.question_statistics_snapshots_v2 where snapshot_id=$1',[b.snapshot_id])).rows.map(r=>validateCanonicalSnapshot({...r,source_snapshot_at:(r.source_snapshot_at as Date).toISOString(),published_at:(r.published_at as Date).toISOString()}));
  for(const snapshot of snapshots) {
   const odd=projectFormStatistics(snapshot,{year:snapshot.year,subject:snapshot.subject,examType:'odd'}),even=projectFormStatistics(snapshot,{year:snapshot.year,subject:snapshot.subject,examType:'even'});
   for(const item of odd.items) {const e=even.items.find(e=>e.question_id===item.question_id)!;assert.equal(item.choice_counts[item.correct_answer-1],e.choice_counts[e.correct_answer-1]);}
  }
  for(const role of ['anon','authenticated']) {
   await db.exec(`set role ${role}`);
   assert.equal((await db.query<{n:number}>('select count(*)::int as n from public.question_statistics_snapshots_v2')).rows[0].n,38);
   assert.equal((await db.query<{n:number}>('select count(*)::int as n from public.question_statistics_snapshots')).rows[0].n,76);
   assert.equal((await db.query<{n:number}>('select count(*)::int as n from public.question_statistics_snapshots_v2 where snapshot_id=$1',[a.snapshot_id])).rows[0].n,0);
   for(const sql of ['select * from private.question_statistics_catalogs_v2','select * from private.question_statistics_runs_v2','delete from public.question_statistics_publication_v2',"select private.rollback_question_statistics_v2(1,'2','test','forbidden')"]) await assert.rejects(db.query(sql));
   await db.exec('reset role');
  }
  const rollback=(id:string,expected:string)=>db.query('select private.rollback_question_statistics_v2($1,$2,$3,$4)',[id,expected,'test','rollback']);
  await assert.rejects(rollback(a.snapshot_id,'999'));await rollback(a.snapshot_id,b.snapshot_id);
  await assert.rejects(publish(second,a.snapshot_id));
  await db.query('update private.question_statistics_catalogs_v2 set revoked_at=current_timestamp');
  await assert.rejects(rollback(b.snapshot_id,a.snapshot_id));await assert.rejects(publish(first,a.snapshot_id));
  await assert.rejects(db.query('select private.register_question_statistics_catalog_v2($1::jsonb,$2,$3)',[JSON.stringify(catalog),'test','revoked']));
  for(const bad of [{year:'2027',subject:'verbal',examType:'odd',total:30,userAnswers:{1:'4'}},{year:'2026',subject:'verbal',examType:'odd',total:30,userAnswers:[]},{year:'2026',subject:'verbal',examType:'wrong',total:30},{year:'2026',subject:'verbal',examType:'odd',total:40},{year:'2026',subject:'verbal',examType:'odd',total:30,userAnswers:{'01':1}},{year:2026,subject:'verbal',examType:'odd',total:30},{year:'2028',subject:'verbal',examType:'odd',total:30}]) {
   await db.query('update public.kv_store_cd835c22 set value=$1::jsonb',[JSON.stringify([...records,bad])]);
   const invalid=await source();assert.equal(invalid.invalid_count,'1');assert.throws(()=>makeCanonicalArtifact(invalid,first.project_ref,'invalid'));
  }
  await db.query("update public.kv_store_cd835c22 set value='{}'::jsonb");assert.throws(()=>makeCanonicalArtifact(awaitedInvalid(),first.project_ref,'invalid'));
  function awaitedInvalid(){return { ...raw,malformed_histories:1};}
  assert.equal((await source()).malformed_histories,'1');
  console.log('V2 SQL 통과: 38묶음/1350ID, 순열·공통 집계·분할, 승인/불변/체크섬, 원자 발행·CAS·롤백, v1 유지, anon/auth RLS·쓰기 거부');
 } finally {await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
