// Embedded PostgreSQL: synthetic accounts only, no Supabase/network requests.
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { UsageEvent, AnalyticsReport, Ack, PageResult, ActivityRow } from '../src/types/analytics';

const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const admin = id(1), member = id(2), other = id(3);
async function main() {
  const db = new PGlite(); let nextId = 10;
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema private; create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now(),confirmed_at timestamptz);
      grant usage on schema public,auth to service_role;
      create table private.admin_roles(user_id uuid,role text); alter table private.admin_roles enable row level security;
      create table public.kv_store_cd835c22(key text primary key,value jsonb);`);
    for (const [user, name] of [[admin, '관리자'], [member, '회원'], [other, '다른 회원']]) await db.query("insert into auth.users(id,email,raw_user_meta_data,confirmed_at) values($1,$2,$3,now()-interval '8 days')", [user, `${user}@example.test`, JSON.stringify({ name })]);
    await db.query("insert into private.admin_roles values($1,'admin')", [admin]);
    const migration = await readFile(new URL('../supabase/migrations/20261003141220_product_usage_analytics.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    const event = (name: UsageEvent['event_name'], attributes: UsageEvent['attributes'] = {}, channel: UsageEvent['execution_channel'] = 'pwa'): UsageEvent => ({
      event_id: id(nextId++), session_id: id(100), page_instance_id: id(101), page_entry_id: id(102), event_sequence: nextId,
      occurred_at: new Date().toISOString(), metric_version: '1', event_name: name, feature: 'grading', route: '/',
      execution_channel: channel, display_mode: channel === 'pwa' ? 'standalone' : 'browser', detection_method: 'media_query', detection_version: 1,
      os_family: 'android', device_class: 'mobile', attributes,
    });
    const ingest = async (events: UsageEvent[], user: string | null = member) => (await db.query<{ data: Ack[] }>('select public.product_analytics_ingest($1,$2::jsonb,$3) as data', [user, JSON.stringify(events), `synthetic:${user}`])).rows[0].data;
    const now = new Date(); const day = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    const filters = { start: day, end: day };
    const report = async (actor = admin, f = filters) => (await db.query<{ data: AnalyticsReport }>('select public.product_analytics_report($1,$2::jsonb) as data', [actor, JSON.stringify(f)])).rows[0].data;
    await assert.rejects(ingest([event('page_view')]), /COLLECTION_DISABLED/);
    assert.equal((await report()).status, 'unavailable');
    await db.exec("update private.product_analytics_settings set collection_enabled=true,started_at=now()-interval '2 days'");
    const attrs = { input_flow_id: id(200), grading_run_id: id(201), year: '2027', subjects: 'both', exam_type: 'odd' };
    const batch = [event('grading_input_started', attrs), event('grading_requested', attrs), event('grading_completed', attrs), event('grading_result_viewed', { ...attrs, entry_source: 'new_grading' })];
    assert.ok((await ingest(batch)).every(a => a.status === 'accepted'));
    assert.ok((await ingest(batch)).every(a => a.status === 'duplicate'));
    // New event UUID but same calculation is a semantic duplicate.
    assert.equal((await ingest([event('grading_completed', attrs)]))[0].status, 'duplicate');
    await ingest([event('page_view', {}, 'browser')]);
    await ingest([event('page_view')], other);
    await ingest([event('grading_completed', { ...attrs, grading_run_id: id(205) })], null);
    let data = await report();
    assert.equal(data.metrics.find(m => m.key === 'members')?.value, 2);
    assert.equal(data.metrics.find(m => m.key === 'grading')?.value, 2);
    assert.equal(data.pwa.both, 1); assert.equal(data.pwa.pwa_only, 1);
    await db.exec("update private.product_usage_session_state set last_activity_received_at=now()-interval '46 minutes'");
    data = await report(); assert.equal(data.conversion.closed, 1); assert.equal(data.conversion.converted, 1);
    await db.exec("update private.product_usage_session_state set last_activity_received_at=now()-interval '35 minutes'");
    assert.equal((await report()).conversion.grace, 1);
    await db.exec("update private.product_usage_session_state set last_activity_received_at=now()-interval '29 minutes'");
    assert.equal((await report()).conversion.open, 1);
    assert.equal((await ingest([event('page_view')], admin))[0].status, 'rejected');
    const directory = (await db.query<{ data: PageResult<{ user_id: string }> }>('select public.product_analytics_member_directory($1,$2::jsonb,$3) as data', [admin, JSON.stringify(filters), '회원'])).rows[0].data;
    assert.equal(directory.items.length, 2);
    const activity = (await db.query<{ data: PageResult<ActivityRow> }>('select public.product_analytics_member_activity($1,$2::jsonb,$3) as data', [admin, JSON.stringify(filters), member])).rows[0].data;
    assert.equal(activity.items.length, 5);
    assert.ok(activity.items.every(e => e.user_id === member));
    const logs = (await db.query<{ filters: object; target_user_id: string }>('select filters,target_user_id from private.product_admin_access_logs')).rows;
    assert.equal(logs.length, 2); assert.ok(!JSON.stringify(logs).includes('회원')); assert.equal(logs[1].target_user_id, member);
    await assert.rejects(report(other), /ADMIN_REQUIRED/);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from private.product_usage_events'));
      await assert.rejects(db.query('select public.product_analytics_report($1,$2::jsonb)', [admin, JSON.stringify(filters)]));
      await assert.rejects(db.query('select public.product_analytics_ingest($1,$2::jsonb,$3)', [member, '[]', 'test']));
      await db.exec('reset role');
    }
    await db.exec('set role service_role'); assert.equal((await report()).metrics[0].value, 2); await db.exec('reset role');
    // Derived counts remain correct under the same exam/channel predicates.
    const filtered = await report(admin, { ...filters, channel: 'browser' } as typeof filters);
    assert.equal(filtered.metrics.find(m => m.key === 'grading')?.value, 0);
    const filteredDirectory = (await db.query<{ data: PageResult<{ user_id: string }> }>('select public.product_analytics_member_directory($1,$2::jsonb) as data', [admin, JSON.stringify({ ...filters, channel: 'browser' })])).rows[0];
    assert.equal(filteredDirectory.data.items.length,1); assert.equal(filteredDirectory.data.items[0].user_id,member);
    // A failed item's subtransaction is rolled back, uncertainty survives until that ID succeeds.
    const broken = { ...event('grading_completed', { ...attrs, grading_run_id: id(280) }), metric_version: 'bad' };
    assert.equal((await ingest([broken]))[0].status, 'processing_failed');
    assert.equal((await report()).conversion.uncertain, 1);
    assert.equal((await ingest([{ ...broken, metric_version: '1' }]))[0].status, 'accepted');
    assert.equal((await report()).conversion.uncertain, 0);
    // Duplicate retry must not extend server observation.
    await db.exec("update private.product_usage_session_state set last_activity_received_at=now()-interval '46 minutes'");
    await ingest(batch); assert.equal((await report()).conversion.closed, 1);
    const secondTab = { ...event('session_activity', { last_interaction_at: new Date().toISOString(), activity_sequence: 1 }), page_instance_id: id(281) };
    await ingest([secondTab]); assert.equal((await report()).conversion.open, 1);
    // Current inventory validates JSON shape and returns aggregate counts only.
    await db.query('insert into public.kv_store_cd835c22 values($1,$2::jsonb)', [`history:${member}`, JSON.stringify([{ year: '2027', subject: 'verbal', timestamp: 1000, groupTimestamp: 1000, userAnswers: { 1: 5 } }, { year: '2027', subject: 'reasoning', timestamp: 1001, groupTimestamp: 1000 }, { wrong: true }])]);
    await db.query('insert into public.kv_store_cd835c22 values($1,$2::jsonb)', [`mock_history:${other}`, '{"invalid":"array"}']);
    const inventory = (await report()).inventory!;
    assert.equal(inventory.accounts, 2); assert.equal(inventory.official_records, 2); assert.equal(inventory.official_groups, 1); assert.equal(inventory.invalid_records, 2);
    assert.ok(!JSON.stringify(inventory).includes('userAnswers'));
    // Confirmed cohort: collection started before confirmation, and its exact 7-day window matured.
    await db.exec("update private.product_analytics_settings set started_at=now()-interval '20 days'");
    await db.query("update auth.users set created_at=now()-interval '15 days',confirmed_at=now()-interval '8 days' where id=$1", [member]);
    await db.query("update private.product_member_first_usage set first_core_received_at=now()-interval '8 days',first_grading_after_confirmation_received_at=now()-interval '6 days' where user_id=$1", [member]);
    const wide = { start: new Date(Date.now()-10*86400000+9*3600000).toISOString().slice(0,10), end: day };
    const membership = (await report(admin, wide)).membership!;
    assert.equal(membership.mature_confirmations, 2); assert.equal(membership.first_grading_in_7d, 1);
    const cohortDay = new Date(Date.now()-8*86400000+9*3600000).toISOString().slice(0,10);
    await db.query("insert into private.product_member_activity_days values($1,$2::date+1,'grading','pwa','android','mobile',true)", [member,cohortDay]);
    const cohort = (await report(admin, wide)).cohorts.find(c => c.date === cohortDay)!;
    assert.equal(cohort.d1, 1); assert.equal(cohort.d7, 0); assert.equal(cohort.d30, null);
    const past = { start: new Date(Date.now()-95*86400000).toISOString().slice(0,10), end: new Date(Date.now()-91*86400000).toISOString().slice(0,10) };
    assert.equal((await report(admin,past)).status,'unavailable');
    assert.equal((await report(admin,{ ...wide, os: 'android' } as typeof filters)).cohort_status,'filters_unavailable');
    // Role revocation is enforced again inside SQL, not just by a frontend flag.
    await db.query('delete from private.admin_roles where user_id=$1',[admin]);
    await assert.rejects(report(), /ADMIN_REQUIRED/);
    await db.query("insert into private.admin_roles values($1,'admin')",[admin]);
    // Known pause survives re-enabling and excludes apparently complete period comparison.
    await db.exec("update private.product_analytics_settings set collection_enabled=false");
    assert.equal((await db.query<{ n: number }>('select count(*)::int as n from private.product_analytics_collection_gaps where ended_at is null')).rows[0].n,1);
    await assert.rejects(ingest([event('page_view')]), /COLLECTION_DISABLED/);
    await db.exec("update private.product_analytics_settings set collection_enabled=true");
    assert.equal((await db.query<{ n: number }>('select count(*)::int as n from private.product_analytics_collection_gaps where ended_at is not null')).rows[0].n,1);
    assert.equal((await report()).status,'partial');
    // Expiring detail rows must not reset durable first-use anchors.
    const before = (await db.query<{ first_pwa_received_at: Date }>('select first_pwa_received_at from private.product_member_first_usage where user_id=$1', [member])).rows[0].first_pwa_received_at;
    await db.exec('delete from private.product_usage_events; delete from private.product_member_activity_days');
    await ingest([event('page_view')]);
    const after = (await db.query<{ first_pwa_received_at: Date }>('select first_pwa_received_at from private.product_member_first_usage where user_id=$1', [member])).rows[0].first_pwa_received_at;
    assert.equal(before.getTime(), after.getTime());
    console.log('통계 SQL 검증 통과: 수집 차단, 멱등·실행 중복, 회원/채널 DISTINCT, 30/45분 관찰, 관리자 조회 감사, 역할별 접근 차단, 최초 이용일 유지');
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
