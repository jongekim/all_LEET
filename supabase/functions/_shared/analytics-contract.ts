export const METRIC_VERSION = '1';
export const INACTIVITY_MS = 30 * 60_000;
export const OBSERVATION_GRACE_MS = 15 * 60_000;
export const MAX_BATCH = 50;
export const MAX_PERIOD_DAYS = 90;
export const eventNames = [
  'page_view', 'session_activity', 'grading_input_started', 'grading_input_resumed',
  'grading_requested', 'grading_completed', 'grading_result_viewed', 'past_result_viewed',
  'history_save_outcome', 'past_exam_file_clicked', 'reference_opened',
  'question_distribution_opened', 'history_viewed', 'history_trend_viewed', 'mock_saved',
  'admission_completed', 'admission_result_viewed', 'community_post_viewed', 'chat_loaded',
  'operation_outcome', 'install_cta_viewed', 'install_cta_clicked', 'install_guide_opened',
  'install_prompt_available', 'install_prompt_requested', 'install_prompt_result',
  'install_event_observed', 'execution_channel_changed',
] as const;
export type EventName = typeof eventNames[number];
export type Channel = 'pwa' | 'browser' | 'other' | 'unknown';
export type Feature = 'navigation' | 'grading' | 'past_exams' | 'history' | 'mock' | 'admission' | 'community' | 'chat' | 'install';
export type DeviceClass = 'mobile' | 'tablet' | 'desktop' | 'unknown';
export type OsFamily = 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'other' | 'unknown';
export type Attributes = Partial<Record<
  'year' | 'subjects' | 'exam_type' | 'input_flow_id' | 'previous_input_flow_id' | 'resume_reason' |
  'grading_run_id' | 'save_attempt_id' | 'entry_source' | 'target_type' | 'target_id' | 'outcome' |
  'history_kind' | 'reference_kind' | 'institution' | 'round' | 'question_no' | 'guide_type' |
  'install_attempt_id' | 'error_code' | 'last_interaction_at' | 'activity_sequence' | 'has_records',
  string | number | boolean
>>;
export interface UsageEvent {
  event_id: string; session_id: string; page_instance_id: string; page_entry_id: string; event_sequence: number;
  occurred_at: string; metric_version: string; event_name: EventName; feature: Feature; route: string;
  execution_channel: Channel; display_mode: string; detection_method: string; detection_version: number;
  os_family: OsFamily; device_class: DeviceClass; attributes: Attributes;
}
export type Ack = { event_id: string; status: 'accepted' | 'duplicate' | 'rejected' | 'processing_failed'; reason?: string };
export interface AnalyticsFilters {
  start: string; end: string; channel?: Channel; os?: OsFamily; device?: DeviceClass;
  login?: 'member' | 'anonymous'; year?: string; subjects?: string; exam_type?: string;
  feature?: Feature; outcome?: 'success' | 'failed' | 'unknown'; kind?: 'member_directory' | 'member_activity' | 'admin_access_history' | 'member_options' | 'activity_feed';
}
export type ReportKind = 'overview' | 'features' | 'grading' | 'members' | 'pwa';
export interface Metric { key: string; label: string; value: number | null; unit: string; status: string }
export interface Coverage { available_from: string | null; available_through: string; coverage_status: 'complete' | 'partial' | 'unavailable' }
export interface AnalyticsReport {
  metric_version: string; source: string; generated_at: string; data_through: string;
  status: string; filters: AnalyticsFilters; coverage: Coverage; metrics: Metric[];
  daily: { date: string; members: number; sessions: number; grading: number }[];
  features: { feature: string; members: number; sessions: number; actions: number }[];
  conversion: { status?: 'available' | 'filters_unavailable'; closed: number; converted: number; open: number; grace: number; uncertain: number; resumed: number };
  pwa: { pwa_only: number; browser_only: number; both: number; other_only: number };
  cohorts: { date: string; members: number; d1: number | null; d7: number | null; d30: number | null }[];
  cohort_status: 'available' | 'filters_unavailable' | 'unavailable';
  quality: Record<string, number>;
  grading?: Record<string, number>;
  membership?: { status: string; signups: number; confirmations: number; mature_confirmations: number; first_grading_in_7d: number; first_usage_unknown: number };
  installation?: Record<string, number>;
  inventory?: { accounts: number; confirmed: number; official_records: number; official_groups: number; mock_records: number; invalid_records: number };
  comparison?: { status: string; metrics?: Metric[] };
}
export interface MemberSummary { user_id: string; name: string | null; email: string | null; created_at: string; confirmed_at: string | null; last_seen: string | null; sessions: number; grading: number; past_exams: number; history_views: number; channels: string[] }
export interface ActivityRow extends UsageEvent { received_at: string; user_id: string | null; source: 'client' | 'server'; clock_status: string }
export interface AccessRow { id: number; admin_user_id: string; target_user_id: string | null; target_session_id: string | null; kind: string; received_at: string; returned_count: number; filters: { start?: string; end?: string; target_user_ids?: string[]; purpose?: string; search_performed?: boolean; [key: string]: string | boolean | string[] | undefined }; status: string }
export interface PageResult<T> { items: T[]; next_cursor: string | null; coverage?: Coverage }

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const features = ['navigation', 'grading', 'past_exams', 'history', 'mock', 'admission', 'community', 'chat', 'install'];
const routes = ['/', '/result', '/history', '/mock-history', '/mock-input', '/past-exams', '/admission', '/admission-result', '/community', '/community/:id', '/chat', '/login', '/signup', '/forgot-password', '/reset-password', '/terms', '/privacy-policy'];
const attributeKeys = ['year', 'subjects', 'exam_type', 'input_flow_id', 'previous_input_flow_id', 'resume_reason', 'grading_run_id', 'save_attempt_id', 'entry_source', 'target_type', 'target_id', 'outcome', 'history_kind', 'reference_kind', 'institution', 'round', 'question_no', 'guide_type', 'install_attempt_id', 'error_code', 'last_interaction_at', 'activity_sequence', 'has_records'];
export const memberActivity = (name: EventName) => !['session_activity', 'execution_channel_changed'].includes(name) && !name.startsWith('install_');
export const coreActivity = (name: EventName) => ['grading_completed', 'past_exam_file_clicked', 'reference_opened', 'history_viewed', 'mock_saved', 'admission_completed'].includes(name);

export function validateEvent(input: unknown): UsageEvent | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const e = input as Record<string, unknown>;
  const fields = ['event_id', 'session_id', 'page_instance_id', 'page_entry_id', 'event_sequence', 'occurred_at', 'metric_version', 'event_name', 'feature', 'route', 'execution_channel', 'display_mode', 'detection_method', 'detection_version', 'os_family', 'device_class', 'attributes'];
  if (Object.keys(e).some(k => !fields.includes(k))) return null;
  if (['event_id', 'session_id', 'page_instance_id', 'page_entry_id'].some(k => typeof e[k] !== 'string' || !UUID.test(e[k] as string))) return null;
  if (!Number.isSafeInteger(e.event_sequence) || Number(e.event_sequence) < 1 || Number(e.event_sequence) > 2_000_000_000) return null;
  if (e.metric_version !== METRIC_VERSION || !eventNames.includes(e.event_name as EventName) || !features.includes(String(e.feature)) || !routes.includes(String(e.route))) return null;
  if (!['pwa', 'browser', 'other', 'unknown'].includes(String(e.execution_channel)) || !['ios', 'android', 'windows', 'macos', 'linux', 'other', 'unknown'].includes(String(e.os_family)) || !['mobile', 'tablet', 'desktop', 'unknown'].includes(String(e.device_class))) return null;
  if (!['browser', 'standalone', 'window-controls-overlay', 'minimal-ui', 'fullscreen', 'picture-in-picture', 'unknown'].includes(String(e.display_mode)) || !['media_query', 'apple_standalone', 'retained_context', 'unknown'].includes(String(e.detection_method)) || e.detection_version !== 1) return null;
  if (typeof e.occurred_at !== 'string' || e.occurred_at.length > 30 || !Number.isFinite(Date.parse(e.occurred_at))) return null;
  if (!e.attributes || typeof e.attributes !== 'object' || Array.isArray(e.attributes)) return null;
  const attrs = e.attributes as Record<string, unknown>;
  for (const [key, value] of Object.entries(attrs)) {
    if (!attributeKeys.includes(key) || !['string', 'number', 'boolean'].includes(typeof value)) return null;
    if (typeof value === 'string' && (value.length > 160 || /[<>\r\n]/.test(value))) return null;
    if (typeof value === 'number' && (!Number.isFinite(value) || value < 0 || value > 2_000_000_000)) return null;
    if (key.endsWith('_id') && key !== 'target_id' && (typeof value !== 'string' || !UUID.test(value))) return null;
  }
  const allow: Record<string, string[]> = {
    subjects: ['verbal', 'reasoning', 'both'], exam_type: ['odd', 'even', 'single'],
    entry_source: ['new_grading', 'history', 'example', 'unknown'], resume_reason: ['session_changed', 'identity_changed'],
    outcome: ['success', 'failed', 'unknown', 'accepted', 'dismissed', 'error'], history_kind: ['official', 'mock'],
    reference_kind: ['answers', 'conversion'], guide_type: ['ios', 'android_menu', 'desktop_bookmark'],
    target_type: ['exam', 'pdf', 'question', 'post', 'comment', 'note', 'history', 'mock', 'admission', 'chat'],
    error_code: ['REQUEST_FAILED', 'RESULT_UNKNOWN', 'AUTH_REQUIRED', 'ACCOUNT_CHANGED', 'CLIENT_ERROR', 'PROMPT_ERROR'],
  };
  if (Object.entries(allow).some(([key, values]) => attrs[key] !== undefined && !values.includes(String(attrs[key])))) return null;
  if (attrs.year !== undefined && !/^(09예비|20\d{2})$/.test(String(attrs.year))) return null;
  if (attrs.target_id !== undefined && !/^[a-zA-Z0-9_:.-]{1,100}$/.test(String(attrs.target_id))) return null;
  if (attrs.institution !== undefined && !['sidae', 'hackers', 'mega', 'prime', 'lawjournal', 'other'].includes(String(attrs.institution))) return null;
  if (attrs.last_interaction_at !== undefined && (typeof attrs.last_interaction_at !== 'string' || !Number.isFinite(Date.parse(attrs.last_interaction_at)))) return null;
  if (attrs.has_records !== undefined && typeof attrs.has_records !== 'boolean') return null;
  if (attrs.question_no !== undefined && (!Number.isInteger(attrs.question_no) || Number(attrs.question_no) < 1 || Number(attrs.question_no) > 40)) return null;
  if (attrs.activity_sequence !== undefined && (!Number.isSafeInteger(attrs.activity_sequence) || Number(attrs.activity_sequence) < 1)) return null;
  if (attrs.round !== undefined && (!Number.isInteger(attrs.round) || Number(attrs.round) < 1 || Number(attrs.round) > 100)) return null;
  const name = e.event_name as EventName;
  if (name.startsWith('grading_input_') && !attrs.input_flow_id) return null;
  if (name === 'grading_input_resumed' && !attrs.resume_reason) return null;
  if (['grading_requested', 'grading_completed', 'grading_result_viewed'].includes(name) && (!attrs.grading_run_id || !attrs.input_flow_id)) return null;
  if (name === 'grading_result_viewed' && attrs.entry_source !== 'new_grading') return null;
  if (name === 'past_result_viewed' && !['history', 'example'].includes(String(attrs.entry_source))) return null;
  if (name === 'history_save_outcome' && (!attrs.save_attempt_id || !attrs.grading_run_id || !attrs.outcome || !['verbal', 'reasoning'].includes(String(attrs.subjects)))) return null;
  if (name === 'mock_saved' && (!attrs.save_attempt_id || attrs.outcome !== 'success')) return null;
  if (name.startsWith('install_prompt_') && name !== 'install_prompt_available' && !attrs.install_attempt_id) return null;
  if (name === 'session_activity' && (!attrs.last_interaction_at || !Number.isSafeInteger(attrs.activity_sequence))) return null;
  return e as unknown as UsageEvent;
}

export function parseFilters(params: URLSearchParams, now = new Date(), maxPeriodDays = MAX_PERIOD_DAYS): AnalyticsFilters | null {
  const today = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
  const end = params.get('end') || new Date(Date.parse(`${today}T00:00:00+09:00`) - 86400_000 + 9 * 3600_000).toISOString().slice(0, 10);
  const start = params.get('start') || new Date(Date.parse(`${end}T00:00:00+09:00`) - 6 * 86400_000 + 9 * 3600_000).toISOString().slice(0, 10);
  const date = /^\d{4}-\d{2}-\d{2}$/;
  const validDate = (v: string) => date.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
  try { if (!validDate(start) || !validDate(end)) return null; } catch { return null; }
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400_000 + 1;
  if (days < 1 || days > maxPeriodDays || end > today) return null;
  const result: Record<string, string> = { start, end };
  const enums: Record<string, string[]> = { channel: ['pwa', 'browser', 'other', 'unknown'], os: ['ios', 'android', 'windows', 'macos', 'linux', 'other', 'unknown'], device: ['mobile', 'tablet', 'desktop', 'unknown'], login: ['member', 'anonymous'], subjects: ['verbal', 'reasoning', 'both'], exam_type: ['odd', 'even', 'single'] };
  enums.feature = features; enums.outcome = ['success', 'failed', 'unknown']; enums.kind = ['member_directory', 'member_activity', 'admin_access_history', 'member_options', 'activity_feed'];
  for (const [key, values] of Object.entries(enums)) {
    const value = params.get(key); if (!value) continue;
    if (!values.includes(value)) return null; result[key] = value;
  }
  if (params.get('year')) { const v = params.get('year')!; if (!/^(09예비|20\d{2})$/.test(v)) return null; result.year = v; }
  return result as unknown as AnalyticsFilters;
}
