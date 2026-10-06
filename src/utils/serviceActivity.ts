import { supabase } from '../contexts/AuthContext';
import { projectId, publicAnonKey } from './supabase/info';
import { CANONICAL_ORIGIN } from './pageSeo';

// No history, input contents, client timestamps or persistent browser queue.
export function createServiceActivityClient(deps: {
  enabled: boolean; visible(): boolean; now(): number;
  send(owner: string, signal: AbortSignal): Promise<void>;
  failed?(): void;
}) {
  let owner: string | null = null, generation = 0, pending = false;
  let lastAttempt = -Infinity, inflight = false;
  let controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pause = () => { pending = false; clearTimeout(timer); timer = undefined; };
  const schedule = () => {
    if (!pending || inflight || timer || !owner) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (!deps.visible() || !owner) { pending = false; return; }
      pending = false; inflight = true; lastAttempt = deps.now();
      const version = generation, actor = owner;
      void deps.send(actor, controller.signal).catch(() => {
        if (version === generation && !controller.signal.aborted) deps.failed?.();
      }).finally(() => {
        if (version !== generation) return;
        inflight = false; schedule();
      });
    }, Math.max(0, 30_000 - (deps.now() - lastAttempt)));
  };
  return {
    configure(next: string | null) {
      if (owner === next) return;
      generation++; controller.abort(); controller = new AbortController();
      pause(); owner = next; inflight = false; lastAttempt = -Infinity;
    },
    activity() {
      if (!deps.enabled || !owner || !deps.visible()) return;
      pending = true; schedule();
    },
    pause,
    dispose() { generation++; controller.abort(); pause(); owner = null; inflight = false; },
  };
}

export function serviceActivityClient() {
  return createServiceActivityClient({
    enabled: import.meta.env.PROD && typeof window !== 'undefined' && window.location.origin === CANONICAL_ORIGIN,
    visible: () => typeof document !== 'undefined' && document.visibilityState === 'visible',
    now: Date.now,
    async send(owner, signal) {
      const { data, error } = await supabase.auth.getSession();
      if (signal.aborted || error || data.session?.user.id !== owner) throw new Error('ACCOUNT_CHANGED');
      const request = new AbortController();
      const abort = () => request.abort();
      signal.addEventListener('abort', abort, { once: true });
      const timeout = setTimeout(abort, 8_000);
      try {
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/service-activity/touch`, {
          method: 'POST', cache: 'no-store', body: '{}',
          headers: { apikey: publicAnonKey, Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
          signal: request.signal,
        });
        if (!response.ok) throw new Error('ACTIVITY_UNAVAILABLE');
      } finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
      }
    },
    failed: () => console.error('최근 이용 시각을 기록하지 못했습니다.'),
  });
}
