import { MAX_BATCH, parseFilters, UUID, validateEvent } from './analytics-contract.ts';
import type { UsageEvent } from './analytics-contract.ts';
import { addDays, buildDashboard, customPeriod, kstDay, makePeriod, previousPeriod, type DashboardRange, type DashboardSource } from './dashboard.ts';
import type { CursorCodec } from './analytics-cursor.ts';
export interface AnalyticsDependencies {
  enabled: boolean; origins: string[];
  verify(token: string): Promise<{ userId: string | null; unavailable?: boolean }>;
  isAdmin(token: string): Promise<boolean>;
  rpc(name: string, args: Record<string, unknown>): Promise<unknown>;
  rateKey(request: Request, userId: string | null): Promise<string>;
  log(code: string): void;
  cursorCodec?: CursorCodec;
}
export function createAnalyticsApp(kind: 'collect' | 'admin', deps: AnalyticsDependencies) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Origin' };
    if (origin && deps.origins.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info';
      headers['Access-Control-Allow-Methods'] = kind === 'collect' ? 'POST, OPTIONS' : 'GET, OPTIONS';
    }
    const respond = (payload: unknown, status = 200) => Response.json(payload, { status, headers });
    if (origin && !deps.origins.includes(origin)) return respond({ code: 'ORIGIN_NOT_ALLOWED' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== (kind === 'collect' ? 'POST' : 'GET')) return respond({ code: 'METHOD_NOT_ALLOWED' }, 405);
    if (kind === 'collect' && !deps.enabled) return respond({ code: 'COLLECTION_DISABLED' }, 503);
    try {
      const header = request.headers.get('authorization');
      let userId: string | null = null, token = '';
      if (header) {
        if (!/^Bearer \S+$/i.test(header)) return respond({ code: 'AUTH_REQUIRED' }, 401);
        token = header.slice(7);
        const verified = await deps.verify(token);
        if (verified.unavailable) return respond({ code: 'AUTH_UNAVAILABLE' }, 503);
        if (!verified.userId) return respond({ code: 'AUTH_REQUIRED' }, 401);
        userId = verified.userId;
      }
      if (kind === 'admin') {
        if (!userId) return respond({ code: 'AUTH_REQUIRED' }, 401);
        if (!(await deps.isAdmin(token))) return respond({ code: 'ADMIN_REQUIRED' }, 403);
      }
      if (kind === 'collect') {
        const body = await request.text();
        if (new TextEncoder().encode(body).length > 64_000) return respond({ code: 'BATCH_TOO_LARGE' }, 413);
        let payload: unknown; try { payload = JSON.parse(body); } catch { return respond({ code: 'INVALID_JSON' }, 400); }
        if (!payload || typeof payload !== 'object' || Object.keys(payload).some(key => key !== 'events')) return respond({ code: 'INVALID_BATCH' }, 400);
        const events = (payload as { events?: unknown }).events;
        if (!Array.isArray(events) || events.length < 1 || events.length > MAX_BATCH) return respond({ code: 'INVALID_BATCH' }, 400);
        const valid: UsageEvent[] = [];
        const rejected: { event_id: string; status: string; reason: string }[] = [];
        for (const input of events) {
          const event = validateEvent(input);
          if (event) valid.push(event);
          else {
            const id = input && typeof input === 'object' ? (input as { event_id?: unknown }).event_id : '';
            rejected.push({ event_id: typeof id === 'string' && UUID.test(id) ? id : '', status: 'rejected', reason: 'INVALID_EVENT' });
          }
        }
        const results = await deps.rpc('product_analytics_ingest', { p_user_id: userId, p_events: valid, p_rejected: rejected.length, p_actor_key: await deps.rateKey(request, userId) });
        if (!Array.isArray(results)) throw new Error('INVALID_STORAGE_RESPONSE');
        if (rejected.length) deps.log('VALIDATION_REJECTED');
        return respond({ results: [...results, ...rejected] });
      }
      const url = new URL(request.url), params = url.searchParams;
      const tail = url.pathname.split('/').filter(Boolean).at(-1);
      if (tail === 'member-options') {
        if ([...params.keys()].some(k=>!['purpose','query','cursor'].includes(k))) return respond({code:'INVALID_FILTERS'},400);
        const purpose=params.get('purpose')||'member_activity',query=(params.get('query')||'').trim();
        if (!['member_activity','audit_target','audit_actor'].includes(purpose)||query.length>120) return respond({code:'INVALID_SEARCH'},400);
        if (!deps.cursorCodec) throw new Error('CONFIG_UNAVAILABLE');
        const context=JSON.stringify([userId,purpose,query,'1']);
        const after=params.get('cursor')?await deps.cursorCodec.decode(params.get('cursor')!,context):null;
        if(after!==null) {const c=after as Record<string,unknown>;if(typeof after!=='object'||Array.isArray(after)||Object.keys(c).some(k=>!['user_id','created_at','snapshot_at'].includes(k))||typeof c.user_id!=='string'||!UUID.test(c.user_id)||typeof c.snapshot_at!=='string'||!Number.isFinite(Date.parse(c.snapshot_at))||(c.created_at!==null&&(typeof c.created_at!=='string'||!Number.isFinite(Date.parse(c.created_at))))||(purpose==='member_activity'&&c.created_at===null)) return respond({code:'INVALID_CURSOR'},400);}
        const value=await deps.rpc('product_analytics_member_options',{p_actor:userId,p_purpose:purpose,p_query:query,p_after:after}) as {next_cursor:unknown};
        return respond({...value,next_cursor:value.next_cursor?await deps.cursorCodec.encode(value.next_cursor,context):null});
      }
      if (tail === 'dashboard' || tail === 'activity-feed') {
        const allowed=tail==='dashboard'?['start','end','range','channel','compare']:['start','end','channel'];
        if ([...params.keys()].some(k=>!allowed.includes(k))) return respond({code:'INVALID_FILTERS'},400);
        const range=params.get('range')||'7d';
        if(!['7d','30d','6m','1y'].includes(range)) return respond({code:'INVALID_FILTERS'},400);
        const explicit=params.has('start')||params.has('end');
        if(explicit&&params.has('range')) return respond({code:'INVALID_FILTERS'},400);
        const preset=makePeriod(range as DashboardRange);
        const dateParams=new URLSearchParams(params);
        if(!explicit) {dateParams.set('start',preset.start);dateParams.set('end',preset.end);}
        const f=parseFilters(dateParams,new Date(),366);
        if(!f||(tail==='dashboard'&&f.end>=kstDay(new Date()))) return respond({code:'INVALID_FILTERS'},400);
        if(tail==='activity-feed') return respond(await deps.rpc('product_analytics_activity_feed',{p_actor:userId,p_filters:f}));
        const mode=params.get('compare')||'previous';
        if(!['previous','none'].includes(mode)) return respond({code:'INVALID_FILTERS'},400);
        const period=explicit?customPeriod(f.start,f.end):preset, prior=previousPeriod(period);
        const source=await deps.rpc('product_analytics_dashboard_source',{p_actor:userId,p_start:mode==='previous'?prior.start:period.start,p_end:period.end,p_current_start:period.start,p_previous_end:prior.end,p_channel:f.channel||null,p_compare:mode==='previous'}) as DashboardSource;
        if(!source||!Array.isArray(source.facts)||!Array.isArray(source.days)||!Array.isArray(source.confirmations)) throw new Error('INVALID_STORAGE_RESPONSE');
        return respond(buildDashboard(source,period,f.channel||null,mode==='previous'));
      }
      const filters = parseFilters(params);
      if (!filters) return respond({ code: 'INVALID_FILTERS' }, 400);
      const target = (key: string): string | null => {
        const value = params.get(key); if (value && !UUID.test(value)) throw new Error('INVALID_TARGET'); return value;
      };
      let result: unknown;
      if (tail === 'member-directory') {
        const query = params.get('query') || '';
        if (query.length > 120) return respond({ code: 'INVALID_SEARCH' }, 400);
        result = await deps.rpc('product_analytics_member_directory', { p_actor: userId, p_filters: filters, p_query: query, p_after: target('cursor') });
      } else if (tail === 'member-activity') {
        const member = target('user_id'), session = target('session_id');
        if (!!member === !!session) return respond({ code: 'TARGET_REQUIRED' }, 400);
        let cursor: { time: string; id: string } | null = null;
        if (params.get('cursor')) {
          try {
            if (params.get('cursor')!.length > 250) throw new Error();
            cursor = JSON.parse(atob(params.get('cursor')!));
            if (!cursor || !UUID.test(cursor.id) || !Number.isFinite(Date.parse(cursor.time))) throw new Error();
          } catch { return respond({ code: 'INVALID_CURSOR' }, 400); }
        }
        result = await deps.rpc('product_analytics_member_activity', { p_actor: userId, p_filters: filters, p_user_id: member, p_session_id: session, p_before_time: cursor?.time || null, p_before_id: cursor?.id || null });
        if (result && typeof result === 'object' && 'next_cursor' in result && result.next_cursor) {
          result = { ...result, next_cursor: btoa(JSON.stringify(result.next_cursor)) };
        }
      } else if (tail === 'admin-access-history') {
        const cursor = params.get('cursor'); if (cursor && !/^[1-9]\d{0,17}$/.test(cursor)) return respond({ code: 'INVALID_CURSOR' }, 400);
        result = await deps.rpc('product_analytics_access_history', { p_actor: userId, p_filters: filters, p_target: target('target_user_id'), p_admin: target('admin_user_id'), p_before: cursor || null });
      } else {
        const report = params.get('report') || 'overview';
        if (!['overview', 'features', 'grading', 'members', 'pwa'].includes(report)) return respond({ code: 'INVALID_REPORT' }, 400);
        result = await deps.rpc('product_analytics_report', { p_actor: userId, p_filters: filters, p_report: report });
        if (result && typeof result === 'object' && 'coverage' in result) {
          const length = (Date.parse(filters.end) - Date.parse(filters.start)) / 86400_000 + 1;
          const previous = { ...filters, start: new Date(Date.parse(filters.start) - length * 86400_000).toISOString().slice(0, 10), end: new Date(Date.parse(filters.start) - 86400_000).toISOString().slice(0, 10) };
          const prior = await deps.rpc('product_analytics_report', { p_actor: userId, p_filters: previous, p_report: report }) as { status?: string; metrics?: unknown };
          const current = result as { status?: string };
          result = { ...result, comparison: current.status === 'complete' && prior.status === 'complete' ? { status: 'complete', metrics: prior.metrics } : { status: 'unavailable' } };
        }
      }
      return respond(result);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'UNAVAILABLE';
      if (['INVALID_TARGET','INVALID_CURSOR','INVALID_PERIOD','INVALID_SEARCH','INVALID_PURPOSE'].includes(code)) return respond({ code }, 400);
      if (code === 'ADMIN_REQUIRED') return respond({ code }, 403);
      // No URLs, tokens, search terms, event bodies or raw DB errors in logs.
      deps.log('ANALYTICS_UNAVAILABLE');
      return respond({ code: 'ANALYTICS_UNAVAILABLE' }, 503);
    }
  };
}
