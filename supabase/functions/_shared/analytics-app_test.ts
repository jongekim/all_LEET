import { createAnalyticsApp, type AnalyticsDependencies } from './analytics-app.ts';
import type { UsageEvent } from './analytics-contract.ts';
const id = '00000000-0000-4000-8000-000000000001';
const event: UsageEvent = { event_id: id, session_id: id, page_instance_id: id, page_entry_id: id, event_sequence: 1, occurred_at: '2026-10-03T00:00:00Z', metric_version: '1', event_name: 'page_view', feature: 'navigation', route: '/', execution_channel: 'browser', display_mode: 'browser', detection_method: 'media_query', detection_version: 1, os_family: 'android', device_class: 'mobile', attributes: {} };
function assert(value: unknown, message = 'Assertion failed'): asserts value { if (!value) throw new Error(message); }
function fixture(kind: 'collect' | 'admin' = 'collect') {
  const calls: { name: string; args: Record<string, unknown> }[] = [], logs: string[] = [];
  const deps: AnalyticsDependencies = { enabled: true, origins: ['https://example.test'], verify: token => Promise.resolve({ userId: token === 'valid' ? id : null }), isAdmin: token => Promise.resolve(token === 'valid'), rateKey: () => Promise.resolve('hashed-rate-key'), log: code => { logs.push(code); }, rpc: (name, args) => { calls.push({ name, args }); return Promise.resolve(name === 'product_analytics_ingest' ? [{ event_id: id, status: 'accepted' }] : { items: [], next_cursor: null }); } };
  const app = createAnalyticsApp(kind, deps);
  function request(body: unknown, token?: string) { return new Request('https://example.test/usage-events', { method: 'POST', headers: { origin: 'https://example.test', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }); }
  return { deps, calls, logs, app, request };
}
Deno.test('무효 JWT는 익명으로 처리하지 않고 수집 전에 거절한다', async () => {
  const f = fixture(); const r = await f.app(f.request({ events: [event] }, 'invalid')); assert(r.status === 401); assert(f.calls.length === 0);
});
Deno.test('검증된 사용자 ID만 저장 서버에 전달하며 클라이언트 사용자 위조는 거절한다', async () => {
  const f = fixture(); const r = await f.app(f.request({ events: [event, { ...event, user_id: 'victim', source: 'server' }] }, 'valid'));
  const body = await r.json(); assert(r.status === 200); assert(body.results.length === 2); assert(body.results[1].status === 'rejected');
  assert(f.calls[0].args.p_user_id === id); assert((f.calls[0].args.p_events as unknown[]).length === 1); assert(f.calls[0].args.p_rejected === 1);
});
Deno.test('비활성 수집·대량 배치·비허용 Origin은 DB를 호출하지 않는다', async () => {
  const f = fixture(); f.deps.enabled = false; assert((await f.app(f.request({ events: [event] }))).status === 503);
  f.deps.enabled = true; assert((await f.app(f.request({ events: Array(51).fill(event) }))).status === 400);
  const req = new Request('https://example.test/usage-events', { method: 'POST', headers: { origin: 'https://attacker.test' }, body: '{}' });
  assert((await f.app(req)).status === 403); assert(f.calls.length === 0);
});
Deno.test('비로그인·역할 회수 관리자는 회원 식별자를 지정해도 조회할 수 없다', async () => {
  const f = fixture('admin'); const url = `https://example.test/admin-analytics/member-activity?user_id=${id}`;
  assert((await f.app(new Request(url))).status === 401); f.deps.isAdmin = () => Promise.resolve(false);
  assert((await f.app(new Request(url, { headers: { Authorization: 'Bearer valid' } }))).status === 403); assert(f.calls.length === 0);
});
Deno.test('대상·기간·cursor를 검증하고 요청자의 실제 ID로 감사 조회를 실행한다', async () => {
  const f = fixture('admin'); const headers = { Authorization: 'Bearer valid' };
  assert((await f.app(new Request('https://example.test/admin-analytics/member-activity?user_id=bad', { headers }))).status === 400);
  assert((await f.app(new Request(`https://example.test/admin-analytics/member-activity?user_id=${id}&session_id=${id}`, { headers }))).status === 400);
  assert((await f.app(new Request('https://example.test/admin-analytics/report?start=2026-01-01&end=2026-10-01', { headers }))).status === 400);
  await f.app(new Request(`https://example.test/admin-analytics/member-activity?user_id=${id}`, { headers }));
  assert(f.calls.length === 1); assert(f.calls[0].args.p_actor === id); assert(f.calls[0].args.p_user_id === id);
});
Deno.test('저장소 실패 응답/로그는 개인정보와 DB 오류 원문을 포함하지 않는다', async () => {
  const f = fixture(); f.deps.rpc = () => { throw new Error('raw secret email@example.test'); };
  const r = await f.app(f.request({ events: [event] })); assert(r.status === 503); assert(!JSON.stringify(await r.json()).includes('secret')); assert(f.logs.join() === 'ANALYTICS_UNAVAILABLE');
});
Deno.test('HTTP 성공의 일부 처리 실패는 ACK를 그대로 유지한다', async () => {
  const f = fixture(); f.deps.rpc = () => Promise.resolve([{ event_id: id, status: 'processing_failed', reason: 'STORAGE_FAILED' }]);
  const r = await f.app(f.request({ events: [event] })); assert(r.status === 200); assert((await r.json()).results[0].status === 'processing_failed');
});
Deno.test('대시보드 장기 기간은 한 SQL 스냅샷이며 ID 사실 자료를 외부 반환하지 않는다',async()=>{
  const f=fixture('admin');f.deps.rpc=(name,args)=>{f.calls.push({name,args});return Promise.resolve({snapshot_at:new Date().toISOString(),facts:[],days:[],confirmations:[],conversion:null,previous_conversion:null,collection_enabled:false,started_at:null,last_accepted_at:null});};
  const r=await f.app(new Request('https://example.test/admin-analytics/dashboard?range=1y',{headers:{Authorization:'Bearer valid'}}));const body=await r.json();assert(r.status===200);assert(body.series.length===12);assert(body.dashboard_policy_version===2);assert(!('facts' in body));assert(f.calls.length===1);assert(f.calls[0].name==='product_analytics_dashboard_source');
  assert((await f.app(new Request('https://example.test/admin-analytics/dashboard?range=1y&start=2026-01-01',{headers:{Authorization:'Bearer valid'}}))).status===400);
});
Deno.test('회원 커서는 사용자·목적·검색에 서명하고 변조·다른 문맥에서는 DB 호출 전 거절',async()=>{
  const {createCursorCodec}=await import('./analytics-cursor.ts');const codec=createCursorCodec('synthetic-signing-secret-only');const f=fixture('admin');f.deps.cursorCodec=codec;const context=JSON.stringify([id,'member_activity','한글','1']);
  const cursor=await codec.encode({user_id:id,created_at:'2025-01-01T00:00:00Z',snapshot_at:'2026-01-01T00:00:00Z'},context);const headers={Authorization:'Bearer valid'};
  const req=(q:string,p='member_activity',c=cursor)=>new Request(`https://example.test/admin-analytics/member-options?purpose=${p}&query=${encodeURIComponent(q)}&cursor=${encodeURIComponent(c)}`,{headers});
  assert((await f.app(req('한글'))).status===200);assert(f.calls.length===1);
  assert((await f.app(req('다른검색'))).status===400);assert((await f.app(req('한글','audit_actor'))).status===400);assert((await f.app(req('한글','member_activity',cursor+'x'))).status===400);assert(f.calls.length===1);
  const malformed=await codec.encode({user_id:'bad',snapshot_at:'yesterday'},context);assert((await f.app(req('한글','member_activity',malformed))).status===400);
});
Deno.test('목록 조회는 기간·수집 비활성과 독립적이며 알려지지 않은 필터·과도한 검색은 거절',async()=>{
  const {createCursorCodec}=await import('./analytics-cursor.ts');const f=fixture('admin');f.deps.enabled=false;f.deps.cursorCodec=createCursorCodec('synthetic-secret');const headers={Authorization:'Bearer valid'};
  const req=(q:string)=>new Request('https://example.test/admin-analytics/member-options'+q,{headers});
  assert((await f.app(req(''))).status===200);assert(f.calls[0].name==='product_analytics_member_options');assert(!('p_filters' in f.calls[0].args));
  assert((await f.app(req('?start=2026-01-01'))).status===400);assert((await f.app(req('?query='+Array(122).join('a')))).status===400);assert(f.calls.length===1);
});
