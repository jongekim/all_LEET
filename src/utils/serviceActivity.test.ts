import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServiceActivityClient, serviceActivityClient } from './serviceActivity';
const session = vi.hoisted(() => vi.fn());
vi.mock('../contexts/AuthContext', () => ({ supabase: { auth: { getSession: session } } }));

function fixture(enabled = true) {
  let visible = true;
  const send = vi.fn<(owner: string, signal: AbortSignal) => Promise<void>>(async () => {});
  const failed = vi.fn();
  const client = createServiceActivityClient({ enabled, visible: () => visible, now: Date.now, send, failed });
  return { client, send, failed, hide: () => { visible = false; client.pause(); }, show: () => { visible = true; client.activity(); } };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('headless last service use', () => {
  it('requires an authenticated owner and production enablement', async () => {
    const f = fixture(); f.client.activity(); await vi.runAllTimersAsync(); expect(f.send).not.toHaveBeenCalled();
    const disabled = fixture(false); disabled.client.configure('admin'); disabled.client.activity();
    await vi.runAllTimersAsync(); expect(disabled.send).not.toHaveBeenCalled();
  });
  it('tracks admin/test users and revisits, without an idle heartbeat', async () => {
    const f = fixture(); f.client.configure('test-admin'); f.client.activity();
    await vi.advanceTimersByTimeAsync(0); expect(f.send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(120_000); expect(f.send).toHaveBeenCalledTimes(1);
    f.hide(); f.show(); await vi.advanceTimersByTimeAsync(0); expect(f.send).toHaveBeenCalledTimes(2);
    expect(f.send.mock.calls.map(([owner]) => owner)).toEqual(['test-admin', 'test-admin']);
  });
  it('coalesces actions and drops pending activity in a hidden tab', async () => {
    const f = fixture(); f.client.configure('member'); f.client.activity(); await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 100; i++) f.client.activity();
    await vi.advanceTimersByTimeAsync(29_999); expect(f.send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); expect(f.send).toHaveBeenCalledTimes(2);
    f.client.activity(); f.hide(); f.client.activity();
    await vi.advanceTimersByTimeAsync(90_000); expect(f.send).toHaveBeenCalledTimes(2);
    f.show(); await vi.advanceTimersByTimeAsync(0); expect(f.send).toHaveBeenCalledTimes(3);
  });
  it('aborts previous-account requests and discards late results on logout', async () => {
    const f = fixture(); let resolve!: () => void;
    f.send.mockImplementationOnce(() => new Promise<void>(done => { resolve = done; }));
    f.client.configure('old'); f.client.activity(); await vi.advanceTimersByTimeAsync(0);
    f.client.activity(); const oldSignal = f.send.mock.calls[0][1];
    f.client.configure('new'); expect(oldSignal.aborted).toBe(true);
    f.client.activity(); await vi.advanceTimersByTimeAsync(0);
    resolve(); await vi.advanceTimersByTimeAsync(90_000);
    expect(f.send.mock.calls.map(([owner]) => owner)).toEqual(['old', 'new']);
    f.client.activity(); f.client.configure(null); await vi.runAllTimersAsync(); expect(f.send).toHaveBeenCalledTimes(2);
  });
  it('failure stays internal and is retried only upon subsequent activity', async () => {
    const f = fixture(); f.send.mockRejectedValueOnce(new Error('offline'));
    f.client.configure('member'); f.client.activity(); await vi.advanceTimersByTimeAsync(0);
    expect(f.failed).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000); expect(f.send).toHaveBeenCalledTimes(1);
    f.client.activity(); await vi.advanceTimersByTimeAsync(0); expect(f.send).toHaveBeenCalledTimes(2);
    f.client.dispose(); await vi.runAllTimersAsync();
  });
  it('production transport sends no identity or timestamp and rechecks the session', async () => {
    vi.stubEnv('PROD', true);
    vi.stubGlobal('window', { location: { origin: 'https://all-leet.vercel.app' } });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    session.mockResolvedValue({ data: { session: { user: { id: 'member' }, access_token: 'session-token' } }, error: null });
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const f = serviceActivityClient(); f.configure('member'); f.activity();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/service-activity/touch'), expect.objectContaining({
      method: 'POST', body: '{}', cache: 'no-store', headers: expect.objectContaining({ Authorization: 'Bearer session-token' }),
    }));
    session.mockResolvedValue({ data: { session: { user: { id: 'other' }, access_token: 'other-token' } }, error: null });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    f.activity(); await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    f.dispose();
  });
});
