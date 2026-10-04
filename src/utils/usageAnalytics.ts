import { supabase } from '../contexts/AuthContext';
import { projectId, publicAnonKey } from './supabase/info';
import { createUsageClient, detectEnvironment } from './analyticsClient';
import { analyticsId } from './analyticsId';
import type { UsageEvent, Ack } from '../types/analytics';

let client: ReturnType<typeof createUsageClient> | undefined;
export function usageAnalytics() {
  if (!client) {
    const win = typeof window === 'undefined' ? null : window;
    const origins = String(import.meta.env.VITE_USAGE_ANALYTICS_ORIGINS || '').split(',');
    const enabled = !!win && import.meta.env.PROD && import.meta.env.VITE_USAGE_ANALYTICS_ENABLED === 'true' && origins.includes(win.location.origin);
    let retained: 'pwa' | 'browser' | 'other' | 'unknown' | undefined;
    const environment = () => {
      if (!win) return { execution_channel: 'unknown' as const, display_mode: 'unknown', detection_method: 'unknown', detection_version: 1, os_family: 'unknown' as const, device_class: 'unknown' as const };
      const detected = detectEnvironment(win, navigator, retained); retained = detected.execution_channel; return detected;
    };
    const storage = { getItem(key: string) { return win?.localStorage.getItem(key) || null; }, setItem(key: string, value: string) { win?.localStorage.setItem(key, value); } };
    client = createUsageClient({ enabled, storage, now: Date.now, uuid: analyticsId, environment, visible: () => !!win && document.visibilityState === 'visible',
      async send(events: UsageEvent[], owner: string | null): Promise<Ack[]> {
        const { data, error } = await supabase.auth.getSession();
        if (error || (data.session?.user.id || null) !== owner) throw new Error('ACCOUNT_CHANGED');
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/usage-events`, { method: 'POST',
          headers: { apikey: publicAnonKey, 'Content-Type': 'application/json', ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}) },
          body: JSON.stringify({ events }), keepalive: true, signal: AbortSignal.timeout(8_000) });
        if (!response.ok) { if ([400, 401, 403, 429].includes(response.status)) return events.map(e => ({ event_id: e.event_id, status: 'rejected' })); throw new Error('COLLECTION_UNAVAILABLE'); }
        const body = await response.json(); if (!Array.isArray(body.results)) throw new Error('INVALID_ACK'); return body.results;
      },
    });
  }
  return client;
}
