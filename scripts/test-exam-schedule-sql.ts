import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { templateError } from '../src/utils/ddayTemplate';

const admin = '00000000-0000-4000-8000-000000000001';
const member = '00000000-0000-4000-8000-000000000002';
const moderator = '00000000-0000-4000-8000-000000000003';
async function main() {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema private; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public,private to authenticated;
      grant usage on schema public to anon;
      create table private.admin_roles(user_id uuid primary key,role text not null);
      alter table private.admin_roles enable row level security;
      revoke all on private.admin_roles from public,anon,authenticated;
      create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
        select exists(select 1 from private.admin_roles where user_id=(select auth.uid()) and role='admin') $$;
      revoke all on function private.is_admin() from public,anon;
      grant execute on function private.is_admin() to authenticated;
      -- Simulate broad legacy defaults: the migration must explicitly revoke them.
      alter default privileges in schema public grant all on tables to anon,authenticated;`);
    await db.query("insert into private.admin_roles values($1,'admin'),($2,'moderator')", [admin,moderator]);
    await db.exec(await readFile(new URL('../supabase/migrations/20261004082512_exam_schedule.sql',import.meta.url),'utf8'));
    const role = async (name: 'anon'|'authenticated', user = '') => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
      await db.exec(`set role ${name}`);
    };
    const read = async () => (await db.query<{ revision: number; display_template: string; updated_at: Date }>('select * from public.exam_schedule')).rows[0];
    const update = async (date = '2027-07-18', text = 'LEET 시험까지 {dday}', revision = 1) =>
      db.query('update public.exam_schedule set exam_date=$1,display_template=$2 where key=$3 and revision=$4 returning *',[date,text,'leet',revision]);
    for (const [name,user] of [['anon',''],['authenticated',member],['authenticated',moderator]] as const) {
      await role(name,user);
      assert.equal((await read()).revision,1);
      if(name==='anon') await assert.rejects(update());
      else assert.equal((await update()).rows.length,0);
      await assert.rejects(db.query("insert into public.exam_schedule(key,exam_date,display_template) values('leet','2026-07-19','test')"));
      await assert.rejects(db.query('delete from public.exam_schedule'));
      await assert.rejects(db.query("update public.exam_schedule set key='other'"));
      await assert.rejects(db.query('update public.exam_schedule set revision=100'));
      await assert.rejects(db.query("update public.exam_schedule set updated_at=now()"));
    }
    await role('authenticated',admin);
    const initial = await read();
    assert.equal((await update('2026-07-19',initial.display_template)).rows.length,1);
    assert.equal((await read()).revision,1);
    assert.equal((await read()).updated_at.getTime(),initial.updated_at.getTime());
    assert.equal((await update()).rows.length,1);
    assert.equal((await read()).revision,2);
    assert.equal((await update('2027-07-18','{dday}',1)).rows.length,0); // stale editor
    assert.equal((await update('2027-07-18','{dday}',2)).rows.length,1); // template-only edit
    assert.equal((await read()).revision,3);
    assert.equal((await update('2026-07-19','{dday}',3)).rows.length,1); // past dates supported
    const rev=(await read()).revision;
    for(const date of ['1999-12-31','2100-01-01','2026-02-29','infinity','-infinity']) await assert.rejects(update(date,'{dday}',rev));
    for(const text of ['', ' ', ' value', 'value ', '\u00a0value', 'value\uFEFF', 'x'.repeat(101), '{year}', '{DDAY}', '{{dday}}', '{date', 'value}', 'line\nnext', 'tab\t', '\u007f', '\u0085', '\u2028']) {
      await assert.rejects(update('2026-07-19',text,rev));
    }
    // Frontend normalizes outer whitespace; SQL requires the normalized storage value.
    const samples=['{date} 시험일 {dday}','{dday}{dday}','수고하셨습니다.','<img src=x onerror=alert(1)>','😀'.repeat(100),'😀'.repeat(101),'{unknown}','text\ttext','\u009f','a\u2029b'];
    for(const text of samples) {
      const valid=templateError(text)===null;
      const sql=(await db.query<{ valid: boolean }>('select private.exam_schedule_valid_template($1) as valid',[text])).rows[0].valid;
      assert.equal(sql,valid,text);
    }
    await assert.rejects(db.query('select * from private.admin_roles'));
    await assert.rejects(db.query('delete from public.exam_schedule'));
    await assert.rejects(db.query('update public.exam_schedule set revision=100'));
    await db.exec('reset role');
    await db.query('delete from private.admin_roles where user_id=$1',[admin]);
    await role('authenticated',admin);
    assert.equal((await update('2027-07-18','{dday}',rev)).rows.length,0);
    assert.equal((await read()).revision,rev);
    await db.exec('reset role');
    assert.equal((await db.query<{ rls: boolean }>("select relrowsecurity as rls from pg_class where oid='public.exam_schedule'::regclass")).rows[0].rls,true);
    console.log('디데이 SQL 검증 통과: 공개 읽기, admin만 날짜·문구 수정, 컬럼 권한, DB 입력 검증, 동시 수정, 권한 회수');
  } finally { await db.close(); }
}
main().catch(cause => { console.error(cause); process.exitCode=1; });
