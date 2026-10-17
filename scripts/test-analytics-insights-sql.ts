// Only synthetic in-memory PostgreSQL. Never connects to Supabase.
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildInsights, type InsightsSource } from '../supabase/functions/_shared/analytics-insights';
import { addDays, kstDay } from '../supabase/functions/_shared/dashboard';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function main(){
 const db=new PGlite(),admin=id(1),member=id(2),today=kstDay(new Date()),yesterday=addDays(today,-1);let serial=100;
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema private;create schema auth;
  create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now(),confirmed_at timestamptz,deleted_at timestamptz);
  create table private.admin_roles(user_id uuid,role text);alter table private.admin_roles enable row level security;
  create table public.kv_store_cd835c22(key text primary key,value jsonb);grant usage on schema public,auth to service_role;grant select on public.kv_store_cd835c22 to service_role;`);
  await db.query("insert into auth.users(id,email,confirmed_at) values($1,'admin@example.test',now()),($2,'member@example.test',now())",[admin,member]);
  await db.query("insert into private.admin_roles values($1,'admin')",[admin]);
  for(const file of ['20261003141220_product_usage_analytics.sql','20261004050638_admin_dashboard_and_member_options.sql'])await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
  await db.exec(`alter function public.product_analytics_ingest(uuid,jsonb,text,integer) rename to product_analytics_ingest_v1;
  create function public.product_analytics_ingest(p_user_id uuid,p_events jsonb,p_actor_key text,p_rejected integer default 0) returns jsonb language plpgsql security invoker set search_path='' as $$begin perform pg_advisory_xact_lock(hashtextextended('user_data_analytics',0));return public.product_analytics_ingest_v1(p_user_id,p_events,p_actor_key,p_rejected);end$$;
  revoke all on function public.product_analytics_ingest(uuid,jsonb,text,integer) from public,anon,authenticated;grant execute on function public.product_analytics_ingest(uuid,jsonb,text,integer) to service_role;`);
  const wrapper=(await db.query<{definition:string}>("select pg_get_functiondef('public.product_analytics_ingest(uuid,jsonb,text,integer)'::regprocedure) definition")).rows[0].definition;
  await db.exec(await readFile(new URL('../supabase/migrations/20261016121746_analytics_insights.sql',import.meta.url),'utf8'));
  assert.equal((await db.query<{definition:string}>("select pg_get_functiondef('public.product_analytics_ingest(uuid,jsonb,text,integer)'::regprocedure) definition")).rows[0].definition,wrapper);
  await db.exec("update private.product_analytics_settings set started_at=now()-interval '40 days',collection_enabled=true");
  const event=(name:string,attributes:Record<string,unknown>={})=>({event_id:id(serial++),session_id:id(10),page_instance_id:id(11),page_entry_id:id(12),event_sequence:serial,occurred_at:new Date().toISOString(),metric_version:'1',event_name:name,feature:'grading',route:'/result',execution_channel:'browser',display_mode:'browser',detection_method:'media_query',detection_version:1,os_family:'android',device_class:'mobile',attributes});
  const ingest=async(es:unknown[])=>db.query<{ack:{status:string}[]}>('select public.product_analytics_ingest($1,$2::jsonb,$3) ack',[member,JSON.stringify(es),`fixture-${serial}`]);
  const attrs={tool:'field',surface:'new',result_context_id:id(20)};
  await ingest([event('tool_available',attrs),event('tool_exposed',attrs),event('client_timing',{grading_run_id:id(30),timing_phase:'result',elapsed_ms:200,visible_ms:200})]);
  assert.equal((await db.query<{n:number}>('select count(*)::int n from private.product_member_activity_days')).rows[0].n,0,'Passive observations must not create active days');
  assert.equal((await db.query<{n:number}>('select count(*)::int n from private.product_usage_session_state')).rows[0].n,0,'Passive observations must not extend session observation');
  assert.equal((await ingest([event('tool_available',attrs)])).rows[0].ack[0].status,'duplicate');
  await db.exec(`create function private.fail_passive_fixture() returns trigger language plpgsql as $$begin if new.event_name='tool_available' and new.attributes->>'tool'='edit' then raise exception 'synthetic failure';end if;return new;end$$;create trigger fail_passive_fixture before insert on private.product_usage_events for each row execute function private.fail_passive_fixture();`);
  assert.equal((await ingest([event('tool_available',{...attrs,tool:'edit'})])).rows[0].ack[0].status,'processing_failed');
  assert.equal((await db.query<{n:number}>('select count(*)::int n from private.product_usage_session_state')).rows[0].n,0,'Failed passive observations must not make the funnel uncertain');
  await db.exec('drop trigger fail_passive_fixture on private.product_usage_events;drop function private.fail_passive_fixture()');
  const run={input_flow_id:id(31),grading_run_id:id(30),subjects:'both',year:'2027',exam_type:'single'};
  await ingest([event('grading_input_started',run),event('grading_requested',run),event('grading_completed',run),event('grading_result_viewed',{...run,entry_source:'new_grading'}),event('history_save_outcome',{...run,subjects:'verbal',save_attempt_id:id(40),outcome:'success'}),event('history_save_outcome',{...run,subjects:'reasoning',save_attempt_id:id(41),outcome:'unknown'})]);
  await db.query("update private.product_usage_events set received_at=$1::date::timestamp at time zone 'Asia/Seoul'",[yesterday]);
  await db.exec("update private.product_usage_session_state set last_activity_received_at=now()-interval '1 hour'");
  const filters={start:yesterday,end:yesterday};
  const source=async(actor=admin)=>(await db.query<{data:InsightsSource}>('select public.product_analytics_insights_source($1,$2::jsonb) data',[actor,JSON.stringify(filters)])).rows[0].data;
  const raw=await source(),report=buildInsights(raw,filters);
  assert.equal(report.decomposition.runs,1);assert.equal(report.saves.targets,2);assert.equal(report.saves.success,1);assert.equal(report.saves.unknown,1);assert.deepEqual(report.funnels.flow.stages,[1,1,1,1]);
  assert.ok(!JSON.stringify(raw).includes('@example.test'));
  assert.ok(!JSON.stringify(report).includes(member),'Browser DTO must not contain member identifiers');
  for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(source());await assert.rejects(db.query('select * from private.product_usage_events'));await db.exec('reset role');}
  await db.exec('set role service_role');assert.equal((await source()).events.length,9);await assert.rejects(source(member),/ADMIN_REQUIRED/);await db.exec('reset role');
  // A gap on the RETURN date, outside the anchor-date selection, must not become 0%.
  const anchor=addDays(today,-15),returned=addDays(anchor,7);
  await db.query("update private.product_member_first_usage set first_core_received_at=$1::date::timestamp at time zone 'Asia/Seoul',first_usage_known=true where user_id=$2",[anchor,member]);
  await db.query("insert into private.product_analytics_collection_gaps(started_at,ended_at) values($1::date::timestamp at time zone 'Asia/Seoul',($1::date+1)::timestamp at time zone 'Asia/Seoul')",[returned]);
  const old=(await db.query<{data:{cohorts:{d7:number|null}[]}}>('select public.product_analytics_report($1,$2::jsonb) data',[admin,JSON.stringify({start:anchor,end:anchor})])).rows[0].data;
  assert.equal(old.cohorts[0].d7,null);
  await db.exec('begin read only');await source();await db.exec('rollback');
  await db.query('delete from private.admin_roles where user_id=$1',[admin]);await assert.rejects(source(),/ADMIN_REQUIRED/);
  console.log('Analytics insights SQL: passive classification, semantic duplicate, wrapper preservation, source, 2-subject storage, return-date gap, actual service/ordinary roles and read-only checks passed.');
 }finally{await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
