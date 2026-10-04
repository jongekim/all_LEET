// Synthetic in-memory PostgreSQL only. No production accounts, reads or writes.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { addDays, kstDay, buildDashboard, customPeriod, type DashboardSource } from '../supabase/functions/_shared/dashboard';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function main() {
  const db=new PGlite(); const admin=id(1), member=id(2), today=kstDay(new Date()), day=addDays(today,-7);
  const rpc=async <T>(name:string,args:unknown[])=> (await db.query<{data:T}>(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) as data`,args)).rows[0].data;
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema private;create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now(),confirmed_at timestamptz,encrypted_password text);
      grant usage on schema public,auth to service_role;create table private.admin_roles(user_id uuid,role text);alter table private.admin_roles enable row level security;
      create table public.kv_store_cd835c22(key text primary key,value jsonb);grant select on public.kv_store_cd835c22 to service_role;`);
    for(let n=1;n<=122;n++) await db.query("insert into auth.users(id,email,raw_user_meta_data,created_at,confirmed_at) values($1,$2,$3,now()-interval '500 days',now()-interval '8 days')",[id(n),`member${n}@example.test`,JSON.stringify({name:n===1?'관리자':'동명이인'})]);
    await db.query("insert into private.admin_roles values($1,'admin')",[admin]);
    for(const file of ['20261003141220_product_usage_analytics.sql','20261004050638_admin_dashboard_and_member_options.sql']) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
    type Options={items:{user_id:string}[];next_cursor:unknown};
    const options=async(purpose='member_activity',query='',after:unknown=null)=>rpc<Options>('product_analytics_member_options',[admin,purpose,query,after]);
    let opts=await options(); assert.equal(opts.items.length,50); assert.equal(opts.items[0].user_id,id(122));
    const ids=opts.items.map(x=>x.user_id); while(opts.next_cursor) {opts=await options('member_activity','',opts.next_cursor);ids.push(...opts.items.map(x=>x.user_id));}
    assert.equal(ids.length,121);assert.equal(new Set(ids).size,121); assert.ok(!ids.includes(admin));
    assert.equal((await options('member_activity','MEMBER2@EXAMPLE.TEST')).items[0].user_id,member);
    const logs=await db.query<{filters:object}>('select filters from private.product_admin_access_logs');assert.ok(!JSON.stringify(logs.rows).includes('MEMBER2@'));
    // Missing/deleted audit identities and revoked admins remain navigable, not re-attributed.
    await db.query("insert into private.product_admin_access_logs(admin_user_id,target_user_id,kind,returned_count,status) values($1,$2,'member_activity',0,'provided')",[id(999),id(998)]);
    assert.ok((await options('audit_actor')).items.some(x=>x.user_id===id(999)));assert.ok((await options('audit_target',id(998))).items.some(x=>x.user_id===id(998)));
    await db.exec("update private.product_analytics_settings set collection_enabled=true,started_at=now()-interval '400 days'");
    const events=[];
    for(const [n,channel] of [[2,'pwa'],[2,'browser'],[3,'pwa']] as const) {
      const event=id(1000+events.length);
      events.push({event_id:event,session_id:id(2000+events.length),page_instance_id:event,page_entry_id:event,event_sequence:1,occurred_at:new Date().toISOString(),metric_version:'1',event_name:'grading_completed',feature:'grading',route:'/',execution_channel:channel,display_mode:channel==='pwa'?'standalone':'browser',detection_method:'media_query',detection_version:1,os_family:'android',device_class:'mobile',attributes:{input_flow_id:id(3000+events.length),grading_run_id:id(4000+events.length),subjects:'both'}});
      await rpc('product_analytics_ingest',[id(n),JSON.stringify([events.at(-1)]),`fixture-${n}`]);
    }
    await db.query("update private.product_usage_events set received_at=$1::date::timestamp at time zone 'Asia/Seoul'",[day]);
    const load=async(start:string,end:string)=>rpc<DashboardSource>('product_analytics_dashboard_source',[admin,start,end,start,addDays(start,-1),null,false]);
    let source=await load(day,day);let dashboard=buildDashboard(source,customPeriod(day,day),null,false);
    assert.equal(dashboard.cards.find(c=>c.key==='members')?.value,2);assert.equal(dashboard.pwa?.both,1);assert.equal(dashboard.cards.find(c=>c.key==='grading')?.value,3);
    const feed=await rpc<{items:{user_id:string}[]}>('product_analytics_activity_feed',[admin,JSON.stringify({start:day,end:day})]);assert.equal(feed.items.length,3);
    const audit=(await db.query<{filters:{target_user_ids:string[]}}>("select filters from private.product_admin_access_logs where kind='activity_feed'")).rows[0];assert.equal(audit.filters.target_user_ids.length,2);
    const auditRows=await rpc<{items:{kind:string}[]}>('product_analytics_access_history',[admin,JSON.stringify({start:today,end:today,kind:'activity_feed'}),member,null,null]);assert.equal(auditRows.items.length,1);
    assert.equal(await rpc('product_analytics_publish_days',[admin,day,day]),1);
    assert.equal(await rpc('product_analytics_publish_days',[admin,day,day]),1);assert.equal((await db.query<{n:number}>('select count(*)::int n from private.product_usage_fact_days')).rows[0].n,3);
    // A failed replacement must leave the existing publication and facts intact.
    await db.exec("create function private.fixture_fail_publish() returns trigger language plpgsql as $$begin raise exception 'SYNTHETIC_PUBLICATION_FAIL';end$$;create trigger fixture_fail before insert on private.product_usage_fact_days for each row execute function private.fixture_fail_publish();");
    await assert.rejects(rpc('product_analytics_publish_days',[admin,day,day]),/SYNTHETIC_PUBLICATION_FAIL/);
    assert.equal((await db.query<{n:number}>('select count(*)::int n from private.product_usage_fact_days')).rows[0].n,3);
    await db.exec('drop trigger fixture_fail on private.product_usage_fact_days;drop function private.fixture_fail_publish();');
    // Service grants are tested as the actual role, using the prepared migrations and observed legacy KV grant.
    await db.exec('set role service_role');
    assert.equal((await options()).items.length,50);assert.equal((await load(day,day)).facts.length,3);await assert.rejects(db.query('select encrypted_password from auth.users'));await rpc('product_analytics_publish_days',[admin,day,day]);await db.exec('reset role');
    // Move the published synthetic partition beyond the raw horizon, then expire only synthetic raw rows.
    const old=addDays(today,-200);
    await db.query('update private.product_usage_fact_days set day=$1',[old]);await db.query('update private.product_usage_day_publications set day=$1',[old]);
    await db.exec('delete from private.product_usage_events');source=await load(old,old);dashboard=buildDashboard(source,customPeriod(old,old),null,false);
    assert.equal(dashboard.status,'complete');assert.equal(dashboard.cards.find(c=>c.key==='members')?.value,2);assert.equal(dashboard.series[0].grading,3);
    // Unknown archive dates are not silently zero-filled; available raw zero dates are true zero.
    assert.equal(buildDashboard(await load(addDays(old,-1),old),customPeriod(addDays(old,-1),old),null,false).series[0].grading,null);
    assert.equal(buildDashboard(await load(day,day),customPeriod(day,day),null,false).series[0].grading,0);
    await assert.rejects(rpc('product_analytics_publish_days',[admin,old,old]),/ARCHIVE_SOURCE_UNAVAILABLE/);
    // A failed audit insert cannot yield a personal success response.
    await db.exec("create function private.fixture_fail_audit() returns trigger language plpgsql as $$begin raise exception 'SYNTHETIC_AUDIT_FAIL';end$$;create trigger fixture_fail before insert on private.product_admin_access_logs for each row execute function private.fixture_fail_audit();");
    await assert.rejects(options(),/SYNTHETIC_AUDIT_FAIL/);await assert.rejects(rpc('product_analytics_activity_feed',[admin,JSON.stringify({start:day,end:day})]),/SYNTHETIC_AUDIT_FAIL/);
    await db.exec('drop trigger fixture_fail on private.product_admin_access_logs;drop function private.fixture_fail_audit();');
    for(const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from private.product_usage_fact_days'));
      await assert.rejects(rpc('product_analytics_member_options',[admin,'member_activity','',null]));
      await assert.rejects(load(day,day));await db.exec('reset role');
    }
    await assert.rejects(rpc('product_analytics_member_options',[member,'member_activity','',null]),/ADMIN_REQUIRED/);
    await db.query('delete from private.admin_roles where user_id=$1',[admin]);await assert.rejects(load(day,day),/ADMIN_REQUIRED/);
    console.log('대시보드 SQL 통과: 가입순 커서 121명, 수집 전 계정 목록, 과거 감사 UUID, 조회 감사, 기간/PWA DISTINCT, 원자 재발행, 장기 사실/0건/미가용, RLS·역할 회수');
  } finally {await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
