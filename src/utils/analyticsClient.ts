import { INACTIVITY_MS, MAX_BATCH, METRIC_VERSION, validateEvent } from '../../supabase/functions/_shared/analytics-contract';
import type { Ack, Attributes, Channel, EventName, Feature, UsageEvent } from '../types/analytics';

type Environment = Pick<UsageEvent, 'execution_channel' | 'display_mode' | 'detection_method' | 'detection_version' | 'os_family' | 'device_class'>;
export function detectEnvironment(win: Window, nav: Navigator, retained?: Channel): Environment {
  const matches = (mode: string) => { try { return win.matchMedia(`(display-mode: ${mode})`).matches; } catch { return false; } };
  const apple = (nav as Navigator & { standalone?: boolean }).standalone === true;
  const mode = ['standalone', 'window-controls-overlay', 'browser', 'minimal-ui', 'fullscreen', 'picture-in-picture'].find(matches) || 'unknown';
  const channel: Channel = apple || mode === 'standalone' || mode === 'window-controls-overlay' ? 'pwa'
    : mode === 'browser' ? 'browser' : mode === 'unknown' ? 'unknown' : retained === 'pwa' || retained === 'browser' ? retained : 'other';
  const ua = nav.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  const os: Environment['os_family'] = ios ? 'ios' : /Android/.test(ua) ? 'android' : /Windows/.test(ua) ? 'windows' : /Macintosh|Mac OS X/.test(ua) ? 'macos' : /Linux/.test(ua) ? 'linux' : ua ? 'other' : 'unknown';
  const device: Environment['device_class'] = /iPad/.test(ua) || (ios && /Macintosh/.test(ua)) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'tablet' : /iPhone|iPod|Mobile/.test(ua) ? 'mobile' : ua ? 'desktop' : 'unknown';
  return { execution_channel: channel, display_mode: apple && mode === 'unknown' ? 'standalone' : mode,
    detection_method: apple ? 'apple_standalone' : channel === retained && ['fullscreen', 'minimal-ui', 'picture-in-picture'].includes(mode) ? 'retained_context' : mode === 'unknown' ? 'unknown' : 'media_query', detection_version: 1, os_family: os, device_class: device };
}

interface Session { id: string; lastInteraction: number }
export interface GradingContext { input_flow_id: string; grading_run_id: string; session_id: string; year: string; subjects: string; exam_type: string; identity_generation: number; owner_id: string | null }
interface Options {
  enabled: boolean; storage: Pick<Storage, 'getItem' | 'setItem'>; now: () => number; uuid: () => string;
  environment: () => Environment; visible: () => boolean;
  send: (events: UsageEvent[], owner: string | null) => Promise<Ack[]>;
}
export function createUsageClient(options: Options) {
  const pageId = options.uuid();
  let pageEntryId = options.uuid(), lastEntryKey = '';
  let sequence = 0, activitySequence = 0, owner: string | null = null, blocked = false, route = '/';
  let environment = options.environment(), session: Session | null = null, lastState = -Infinity;
  let identityGeneration = 0, sending = false;
  const onceKeys = new Set<string>();
  const queue: { event: UsageEvent; owner: string | null; attempts: number; generation: number }[] = [];
  let flow: { id: string; session: string; owner: string | null; year: string; examType: string; generation: number } | null = null;
  const ensureSession = (interact = false): Session => {
    const now = options.now();
    const nextEnvironment = options.environment();
    const changed = environment.execution_channel !== nextEnvironment.execution_channel;
    environment = nextEnvironment;
    if (changed) session = null;
    const key = `allleet:usage-session:${environment.execution_channel}`;
    try {
      const saved = JSON.parse(options.storage.getItem(key) || 'null') as Session | null;
      if (saved && typeof saved.id === 'string' && /^[0-9a-f-]{36}$/i.test(saved.id) && Number.isFinite(saved.lastInteraction) && saved.lastInteraction <= now + 60_000) session = saved;
    } catch { /* Keep the document's session if cross-tab storage is unavailable. */ }
    if (!session || now - session.lastInteraction >= INACTIVITY_MS || session.lastInteraction > now + 60_000) {
      session = { id: options.uuid(), lastInteraction: now };
      lastState = -Infinity;
    }
    if (interact && options.visible()) session.lastInteraction = now;
    try { options.storage.setItem(key, JSON.stringify(session)); } catch { /* No fingerprint fallback. */ }
    return session;
  };
  const emit = (name: EventName, feature: Feature, attributes: Attributes = {}, once?: string, interacts = true, originalSession?: string) => {
    if (!options.enabled || blocked || route.startsWith('/admin')) return;
    const s = ensureSession(interacts);
    const sessionId = originalSession || s.id;
    const onceKey = once ? `${owner}:${sessionId}:${name}:${once}` : '';
    if (onceKey && onceKeys.has(onceKey)) return;
    const event: UsageEvent = { event_id: options.uuid(), session_id: sessionId, page_instance_id: pageId, page_entry_id: pageEntryId,
      event_sequence: ++sequence, occurred_at: new Date(options.now()).toISOString(), metric_version: METRIC_VERSION,
      event_name: name, feature, route, ...environment, attributes };
    if (!validateEvent(event)) return;
    if (onceKey) onceKeys.add(onceKey);
    // Bounded memory only: a closed browser does not create a durable anonymous identifier.
    if (queue.length >= 250) queue.shift();
    queue.push({ event, owner, attempts: 0, generation: identityGeneration });
  };
  const activity = () => {
    if (!options.visible() || !options.enabled || blocked || route.startsWith('/admin')) return;
    const s = ensureSession(true);
    if (options.now() - lastState >= 60_000) {
      lastState = options.now();
      emit('session_activity', 'navigation', { last_interaction_at: new Date(s.lastInteraction).toISOString(), activity_sequence: ++activitySequence }, undefined, false);
    }
  };
  return {
    configure(nextOwner: string | null, excluded: boolean) {
      if (owner !== nextOwner || blocked !== excluded) { identityGeneration++; queue.splice(0); onceKeys.clear(); }
      owner = nextOwner; blocked = excluded;
    },
    page(path: string, entryKey: string) {
      route = path.startsWith('/community/') ? '/community/:id' : path;
      if (entryKey !== lastEntryKey) { pageEntryId = options.uuid(); lastEntryKey = entryKey; }
      const pageFeature: Feature = route === '/' || route === '/result' ? 'grading' : route === '/past-exams' ? 'past_exams'
        : route === '/history' || route === '/mock-history' ? 'history' : route === '/mock-input' ? 'mock'
        : route.startsWith('/admission') ? 'admission' : route.startsWith('/community') ? 'community' : route === '/chat' ? 'chat' : 'navigation';
      emit('page_view', pageFeature, {}, entryKey);
    },
    track: emit, activity,
    identity: () => identityGeneration,
    trackForIdentity(generation: number, name: EventName, feature: Feature, attributes: Attributes = {}, once?: string) {
      if (generation === identityGeneration) emit(name, feature, attributes, once);
    },
    resetInput() { flow = null; },
    input(year: string, examType: string, hasExistingAnswers: boolean) {
      const s = ensureSession(true);
      const identityChanged = !!flow && flow.generation !== identityGeneration;
      if (!flow || flow.session !== s.id || flow.year !== year || flow.examType !== examType || identityChanged) {
        const previous = flow;
        flow = { id: options.uuid(), session: s.id, owner, year, examType, generation: identityGeneration };
        const resumed = hasExistingAnswers && (!previous || previous.session !== s.id || identityChanged);
        emit(resumed ? 'grading_input_resumed' : 'grading_input_started', 'grading', {
          year, exam_type: examType, input_flow_id: flow.id,
          ...(resumed ? { resume_reason: identityChanged ? 'identity_changed' : 'session_changed' } : {}),
          ...(resumed && previous && !identityChanged && previous.owner === owner ? { previous_input_flow_id: previous.id } : {}),
        }, flow.id);
      }
      activity();
      return flow.id;
    },
    beginGrading(year: string, examType: string, subjects: string): GradingContext {
      const id = this.input(year, examType, true);
      const context = { input_flow_id: id, grading_run_id: options.uuid(), session_id: ensureSession().id, year, subjects, exam_type: examType, identity_generation: identityGeneration, owner_id: owner };
      emit('grading_requested', 'grading', { input_flow_id: id, grading_run_id: context.grading_run_id, year, subjects, exam_type: examType }, context.grading_run_id);
      return context;
    },
    trackGrading(name: 'grading_completed' | 'grading_result_viewed' | 'history_save_outcome', context: GradingContext, attributes: Attributes = {}, once?: string) {
      if (context.identity_generation !== identityGeneration || context.owner_id !== owner) return;
      emit(name, 'grading', { input_flow_id: context.input_flow_id, grading_run_id: context.grading_run_id, year: context.year, subjects: context.subjects, exam_type: context.exam_type, ...attributes }, once || context.grading_run_id, true, context.session_id);
    },
    async flush() {
      if (sending || !options.enabled || blocked || !queue.length) return;
      sending = true;
      const generation = identityGeneration;
      const batch = queue.splice(0, MAX_BATCH).filter(item => item.owner === owner && item.generation === generation);
      try {
        const acks = await options.send(batch.map(item => item.event), owner);
        if (generation !== identityGeneration) return;
        const byId = new Map(acks.map(ack => [ack.event_id, ack]));
        for (const item of batch) {
          const ack = byId.get(item.event.event_id);
          if ((!ack || ack.status === 'processing_failed') && item.attempts < 2) { item.attempts++; queue.push(item); }
        }
      } catch {
        if (generation === identityGeneration) for (const item of batch) if (item.attempts < 2) { item.attempts++; queue.push(item); }
      } finally { sending = false; }
    },
    pending: () => queue.map(item => item.event),
  };
}
