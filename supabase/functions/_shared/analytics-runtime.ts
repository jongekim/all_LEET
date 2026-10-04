import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createUserVerifier } from '../make-server-cd835c22/auth.ts';
import type { AnalyticsDependencies } from './analytics-app.ts';
import { createCursorCodec } from './analytics-cursor.ts';

export function analyticsDependencies(): AnalyticsDependencies {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) } };
  const server = url && secret ? createClient(url, secret, options) : null;
  return {
    cursorCodec: secret ? createCursorCodec(secret) : undefined,
    enabled: Deno.env.get('USAGE_ANALYTICS_ENABLED') === 'true',
    origins: (Deno.env.get('ANALYTICS_ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean),
    verify: createUserVerifier({ url, anonKey: anon }),
    async isAdmin(token) {
      if (!url || !anon) throw new Error('AUTH_UNAVAILABLE');
      const requester = createClient(url, anon, { ...options, global: { ...options.global, headers: { Authorization: `Bearer ${token}` } } });
      const { data, error } = await requester.rpc('current_user_is_admin');
      if (error) throw new Error('AUTH_UNAVAILABLE');
      return data === true;
    },
    async rpc(name, args) {
      if (!server) throw new Error('CONFIG_UNAVAILABLE');
      const { data, error } = await server.rpc(name, args);
      if (error) throw new Error(error.code === '42501' ? 'ADMIN_REQUIRED' : 'STORAGE_UNAVAILABLE');
      return data;
    },
    async rateKey(request, userId) {
      const address = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
      const input = `${secret}:${Math.floor(Date.now() / 60_000)}:${userId || address}`;
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
      return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
    },
    log: code => console.warn('analytics-request', { code }),
  };
}
