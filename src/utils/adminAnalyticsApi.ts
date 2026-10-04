import { supabase } from '../contexts/AuthContext';
import { projectId, publicAnonKey } from './supabase/info';
import type { AccessRow, ActivityRow, AnalyticsFilters, AnalyticsReport, MemberSummary, PageResult, ReportKind } from '../types/analytics';
import type { ActivityFeed, Dashboard, DashboardRange, MemberOptions, MemberPurpose } from '../types/analytics';
import { AdminAnalyticsError, AnalyticsAuthorizationScope } from './adminAnalyticsErrors';

const messages: Record<string, string> = {
  AUTH_REQUIRED: '로그인 상태를 확인한 뒤 다시 시도해주세요.',
  ACCOUNT_CHANGED: '계정이 변경되어 조회를 중단했습니다.',
  ADMIN_REQUIRED: '통계를 조회할 관리자 권한이 없습니다.',
  INVALID_FILTERS: '조회 기간과 필터를 확인해주세요.',
  ANALYTICS_UNAVAILABLE: '통계를 불러오지 못했습니다. 서버 설정과 연결을 확인한 뒤 다시 시도해주세요.',
};
export function createAdminAnalyticsApi(scope?: AnalyticsAuthorizationScope) {
async function read<T>(path: string, filters: Partial<AnalyticsFilters>, owner: string, extra: Record<string, string> = {}, signal?: AbortSignal): Promise<T> {
  const request = scope?.begin(owner);
  try {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new AdminAnalyticsError('AUTH_UNAVAILABLE', null, true, messages.AUTH_REQUIRED);
  if (!data.session) throw new AdminAnalyticsError('AUTH_REQUIRED', 401, false, messages.AUTH_REQUIRED);
  if (data.session.user.id !== owner) throw new AdminAnalyticsError('ACCOUNT_CHANGED', null, false, messages.ACCOUNT_CHANGED);
  if (request) scope!.assertCurrent(request.generation);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...extra })) if (typeof value === 'string' && value) params.set(key, value);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  request?.controller.signal.addEventListener('abort', abort, { once: true });
  if (signal?.aborted || request?.controller.signal.aborted) abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; abort(); }, 15_000);
  let response: Response, body;
  try {
    response = await fetch(`https://${projectId}.supabase.co/functions/v1/admin-analytics/${path}?${params}`, {
      headers: { apikey: publicAnonKey, Authorization: `Bearer ${data.session.access_token}` }, cache: 'no-store', signal: controller.signal,
    });
    // Preserve a denied HTTP status even when a gateway returned HTML/malformed JSON.
    if (response.status === 401 || response.status === 403) throw new AdminAnalyticsError(response.status === 401 ? 'AUTH_REQUIRED' : 'ADMIN_REQUIRED', response.status, false, response.status === 401 ? messages.AUTH_REQUIRED : messages.ADMIN_REQUIRED);
    try { body = await response.json(); } catch { throw new AdminAnalyticsError('INVALID_RESPONSE', response.status, false, messages.ANALYTICS_UNAVAILABLE); }
  } catch (error) {
    if (error instanceof AdminAnalyticsError) throw error;
    if (scope?.error) throw scope.error;
    if (signal?.aborted || request?.controller.signal.aborted) throw new AdminAnalyticsError('CANCELLED', null, false, '조회가 취소되었습니다.');
    console.error('관리자 통계 연결 실패');
    throw new AdminAnalyticsError(timedOut ? 'TIMEOUT' : 'NETWORK_ERROR', null, true, messages.ANALYTICS_UNAVAILABLE);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); request?.controller.signal.removeEventListener('abort', abort); }
  const latest = await supabase.auth.getSession();
  if (latest.error) throw new AdminAnalyticsError('AUTH_UNAVAILABLE', null, true, messages.AUTH_REQUIRED);
  if (!latest.data.session) throw new AdminAnalyticsError('AUTH_REQUIRED', 401, false, messages.AUTH_REQUIRED);
  if (latest.data.session.user.id !== owner) throw new AdminAnalyticsError('ACCOUNT_CHANGED', null, false, messages.ACCOUNT_CHANGED);
  if (request) scope!.assertCurrent(request.generation);
  if (!response.ok) {
    const code = typeof body?.code === 'string' && Object.prototype.hasOwnProperty.call(messages, body.code) ? body.code : 'ANALYTICS_UNAVAILABLE';
    console.error('관리자 통계 조회 실패', response.status);
    throw new AdminAnalyticsError(code, response.status, [500,502,503,504].includes(response.status), messages[code] || messages.ANALYTICS_UNAVAILABLE);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) || (path === 'report' ? !Array.isArray(body.metrics) : path === 'dashboard' ? body.dashboard_policy_version !== 2 || !Array.isArray(body.cards) || !Array.isArray(body.series) : !Array.isArray(body.items))) throw new AdminAnalyticsError('INVALID_RESPONSE', response.status, false, messages.ANALYTICS_UNAVAILABLE);
  return body as T;
  } catch (error) {
    if (error instanceof AdminAnalyticsError && request) scope!.reject(error, request.generation);
    throw error;
  } finally { request?.finish(); }
}
return {
  report: (filters: AnalyticsFilters, owner: string, report: ReportKind, signal?: AbortSignal) => read<AnalyticsReport>('report', filters, owner, { report }, signal),
  members: (filters: AnalyticsFilters, owner: string, query = '', cursor = '', signal?: AbortSignal) => read<PageResult<MemberSummary>>('member-directory', filters, owner, { query, cursor }, signal),
  activity: (filters: AnalyticsFilters, owner: string, target: { user_id?: string; session_id?: string }, cursor = '', signal?: AbortSignal) => read<PageResult<ActivityRow>>('member-activity', filters, owner, { ...target, cursor }, signal),
  access: (filters: AnalyticsFilters, owner: string, target: { target_user_id?: string; admin_user_id?: string } = {}, cursor = '', signal?: AbortSignal) => read<PageResult<AccessRow>>('admin-access-history', filters, owner, { ...target, cursor }, signal),
  dashboard: (owner: string, range: DashboardRange, channel = '', compare = true, signal?: AbortSignal) => read<Dashboard>('dashboard', {}, owner, { range, channel, compare: compare ? 'previous' : 'none' }, signal),
  feed: (filters: Pick<AnalyticsFilters,'start'|'end'|'channel'>, owner: string, signal?: AbortSignal) => read<ActivityFeed>('activity-feed', filters, owner, {}, signal),
  options: (owner: string, purpose: MemberPurpose, query = '', cursor = '', signal?: AbortSignal) => read<MemberOptions>('member-options', {}, owner, { purpose, query, cursor }, signal),
};
}
export const adminAnalyticsApi = createAdminAnalyticsApi();
export type AdminAnalyticsApi = ReturnType<typeof createAdminAnalyticsApi>;
