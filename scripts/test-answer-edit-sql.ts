// Isolated PostgreSQL only: no operational project, credentials or requests.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { editedResult } from '../supabase/functions/_shared/user-data-rules/answerEdit';
import { gradeAnswers } from '../src/utils/grading';

const owner = '00000000-0000-4000-8000-000000000001';
const otherOwner = '00000000-0000-4000-8000-000000000002';
async function main() {
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,deleted_at timestamptz);
    grant usage on schema auth to service_role; grant select on auth.users to service_role;
    create table public.kv_store_cd835c22(key text primary key,value jsonb);
    alter table public.kv_store_cd835c22 enable row level security;
    grant select,insert,update,delete on public.kv_store_cd835c22 to service_role;
    create table public.grading_notes(user_id uuid,group_timestamp bigint,content text);`);
  await db.query('insert into auth.users values($1,null),($2,null)', [owner, otherOwner]);
  const originalMigration = await readFile(new URL('../supabase/migrations/20261005052901_admin_user_data.sql', import.meta.url), 'utf8');
  await db.exec(originalMigration.slice(originalMigration.indexOf('create function public.user_history_mutate'), originalMigration.indexOf('-- Central whitelist')));
  await db.exec(await readFile(new URL('../supabase/migrations/20261008143156_official_answer_updates.sql', import.meta.url), 'utf8'));
  const original = { ...gradeAnswers('2026', 'verbal', { 1: 3 }, 30, 'odd'), timestamp: 123, groupTimestamp: 100, round: 3 };
  const sibling = { ...gradeAnswers('2026', 'reasoning', { 1: 2 }, 40, 'odd'), timestamp: 124, groupTimestamp: 100, round: 3 };
  const other = { ...original, timestamp: 125 };
  const json = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
  const set = async (records: unknown[]) => db.query('insert into public.kv_store_cd835c22 values($1,$2) on conflict(key) do update set value=excluded.value', [`history:${owner}`, JSON.stringify(records)]);
  const get = async () => (await db.query<{ value: typeof original[] }>('select value from public.kv_store_cd835c22 where key=$1', [`history:${owner}`])).rows[0].value;
  const patch = (record = original) => {
    const computed = editedResult(record, { 1: 4 });
    return Object.fromEntries(Object.entries(computed).filter(([key]) => ['userAnswers','correctAnswers','correct','standardScore','percentile','fieldAnalysis','adjustedScore'].includes(key)));
  };
  const update = async (expected = original, delta = patch()) => (await db.query<{ value: typeof original }>(
    'select public.user_history_update_answers($1,$2,$3,$4) value', [owner, expected.timestamp, JSON.stringify(expected), JSON.stringify(delta)]
  )).rows[0].value;
  await set([original, sibling]);
  await db.query('insert into public.kv_store_cd835c22 values($1,$2)', [`history:${otherOwner}`, JSON.stringify([other])]);
  await db.query('insert into public.grading_notes values($1,100,$2)', [owner, '유지할 문항 메모']);
  for (const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(update(), /permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  const saved = await update();
  assert.equal(saved.correct, 1);
  assert.deepEqual([saved.timestamp,saved.groupTimestamp,saved.round], [123,100,3]);
  assert.deepEqual(await get(), json([saved,sibling]));
  await assert.rejects(update(), /HISTORY_CONFLICT/);
  await assert.rejects(update(saved, { ...patch(saved), round: 8 }), /INVALID_INPUT/);
  // Appending and editing a different attempt must not cause lost updates.
  await db.query("select public.user_history_mutate($1,'history','append',$2)", [owner,JSON.stringify(other)]);
  await update(saved, patch(saved));
  assert.equal((await get()).length, 3);
  const current = (await get())[0];
  await db.query("select public.user_history_mutate($1,'history','delete',$2)", [owner,JSON.stringify({timestamp:123})]);
  await assert.rejects(update(current), /RECORD_NOT_FOUND/);
  assert.equal((await get()).length, 2);
  await set([original, original]);
  await assert.rejects(update(), /AMBIGUOUS_RECORD/);
  await set([{...original,percentile:99}]);
  await assert.rejects(update(), /HISTORY_CONFLICT/);
  await db.query("select public.user_history_mutate($1,'history','clear','{}')", [owner]);
  await assert.rejects(update(), /RECORD_NOT_FOUND/);
  assert.deepEqual(await get(), []);
  await db.exec('reset role');
  assert.deepEqual((await db.query('select content from public.grading_notes')).rows, [{content:'유지할 문항 메모'}]);
  assert.deepEqual((await db.query<{value:unknown}>('select value from public.kv_store_cd835c22 where key=$1', [`history:${otherOwner}`])).rows[0].value,json([other]));
  await set([original]);
  await db.query('update auth.users set deleted_at=now() where id=$1', [owner]);
  await db.exec('set role service_role');
  await assert.rejects(update(), /OWNER_MISMATCH/);
  const [metadata] = (await db.query<{prosecdef:boolean;proconfig:string[]}>('select prosecdef,proconfig from pg_proc where proname=$1', ['user_history_update_answers'])).rows;
  assert.equal(metadata.prosecdef, false);
  assert.ok(metadata.proconfig.some(setting => setting.startsWith('search_path=')));
  console.log('Answer edit SQL: privileges, snapshot conflicts, shared mutation path, deletion, identity, notes and other records passed.');
} finally { await db.close(); }

}
main().catch(error => { console.error(error); process.exitCode = 1; });
