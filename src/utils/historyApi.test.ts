import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHistoryApi } from './historyApi';

const base = 'https://isolated.invalid/functions/v1/make-server-cd835c22';
const session = (token = 'session-a', id = 'owner-a') => ({ access_token: token, user: { id } });
const ok = (data: unknown = []) => Response.json({ success: true, data });
function fixture() {
  let current: ReturnType<typeof session> | null = session();
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: current }, error: null })),
    refreshSession: vi.fn(async () => {
      current = session('refreshed-a');
      return { data: { session: current }, error: null };
    }),
  };
  const fetcher = vi.fn<typeof fetch>(async () => ok());
  return { auth, fetcher, api: createHistoryApi(auth, base, fetcher), setSession: (value: typeof current) => { current = value; } };
}
afterEach(() => vi.useRealTimers());

describe('성적 이력 세션 호출', () => {
  it('PUT preserves the expected snapshot and does not retry a conflict', async () => {
    const {api,fetcher} = fixture();
    const body = {expected:{timestamp:123,round:3},userAnswers:{1:2}};
    fetcher.mockResolvedValue(Response.json({success:false,code:'HISTORY_CONFLICT'},{status:409}));
    await expect(api('owner-a','history',{method:'PUT',recordId:123,body})).rejects.toMatchObject({code:'HISTORY_CONFLICT'});
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(`${base}/history/owner-a/123`,expect.objectContaining({method:'PUT',body:JSON.stringify(body)}));
  });
  it.each(['history', 'mock-history'] as const)('최신 세션으로 %s의 기존 URL·헤더·본문 계약을 유지한다', async kind => {
    const { api, fetcher, setSession } = fixture();
    setSession(session('latest-token'));
    fetcher.mockResolvedValueOnce(ok({ id: 'saved' }));
    expect(await api('owner-a', kind, { method: 'POST', body: { year: '2026' } })).toEqual({ id: 'saved' });
    expect(fetcher).toHaveBeenCalledWith(`${base}/${kind}/owner-a`, expect.objectContaining({
      method: 'POST', headers: { Authorization: 'Bearer latest-token', 'Content-Type': 'application/json' }, body: '{"year":"2026"}',
    }));
  });

  it.each([null, session('token-b', 'owner-b')])('세션 누락/다른 계정에서는 공용 키로 대체하지 않고 요청을 보내지 않는다', async value => {
    const { api, fetcher, setSession } = fixture();
    setSession(value);
    await expect(api('owner-a', 'history', { method: 'POST', body: {} })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('인증 단계의 명확한 401만 한 번 갱신하고 원래 쓰기를 한 번 다시 시도한다', async () => {
    const { api, fetcher, auth } = fixture();
    fetcher.mockResolvedValueOnce(Response.json({ success: false, code: 'AUTH_REQUIRED' }, { status: 401 })).mockResolvedValueOnce(ok('saved'));
    expect(await api('owner-a', 'history', { method: 'POST', body: { timestamp: 123 } })).toBe('saved');
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({ Authorization: 'Bearer refreshed-a' });
    expect(fetcher.mock.calls[0][1]?.body).toBe(fetcher.mock.calls[1][1]?.body);
  });

  it('다시 401이면 무한 갱신/재전송하지 않는다', async () => {
    const { api, fetcher, auth } = fixture();
    fetcher.mockImplementation(async () => Response.json({ success: false, code: 'AUTH_REQUIRED' }, { status: 401 }));
    await expect(api('owner-a', 'history')).rejects.toThrow(/로그인/);
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403, 500, 503])('불명확한 인증/서버 오류 %s에서 쓰기를 재전송하지 않는다', async status => {
    const { api, fetcher, auth } = fixture();
    fetcher.mockResolvedValue(Response.json({ success: false, code: status === 503 ? 'AUTH_UNAVAILABLE' : 'OTHER' }, { status }));
    await expect(api('owner-a', 'history', { method: 'POST', body: {} })).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('전송 뒤 통신 실패는 결과 미확정으로 알리고 재저장하지 않는다', async () => {
    const { api, fetcher, auth } = fixture();
    fetcher.mockRejectedValue(new TypeError('isolated connection lost'));
    await expect(api('owner-a', 'mock-history', { method: 'POST', body: {} })).rejects.toMatchObject({ code: 'RESULT_UNKNOWN' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('요청 도중 계정이 바뀌면 이전 응답을 반환하지 않는다', async () => {
    const { api, fetcher, setSession } = fixture();
    fetcher.mockImplementation(async () => { setSession(session('token-b', 'owner-b')); return ok(['private A']); });
    await expect(api('owner-a', 'history')).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' });
  });

  it('갱신 뒤 다른 계정이면 A의 데이터를 B에게 쓰지 않는다', async () => {
    const { api, fetcher, auth } = fixture();
    fetcher.mockResolvedValue(Response.json({ success: false, code: 'AUTH_REQUIRED' }, { status: 401 }));
    auth.refreshSession.mockResolvedValue({ data: { session: session('token-b', 'owner-b') }, error: null });
    await expect(api('owner-a', 'history', { method: 'DELETE' })).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('동시에 거부된 두 조회는 진행 중인 세션 갱신 하나를 공유한다', async () => {
    const { api, fetcher, auth, setSession } = fixture();
    let finish!: () => void;
    auth.refreshSession.mockImplementation(() => new Promise(resolve => {
      finish = () => { const next = session('refreshed-a'); setSession(next); resolve({ data: { session: next }, error: null }); };
    }));
    fetcher.mockImplementation(async (_url, options) => {
      return (options?.headers as Record<string, string>).Authorization === 'Bearer session-a'
        ? Response.json({ success: false, code: 'AUTH_REQUIRED' }, { status: 401 }) : ok();
    });
    const pending = Promise.all([api('owner-a', 'history'), api('owner-a', 'mock-history')]);
    await vi.waitFor(() => expect(auth.refreshSession).toHaveBeenCalledTimes(1));
    finish();
    await pending;
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('쓰기를 기다리다 timeout이 나도 자동으로 중복 저장하지 않는다', async () => {
    vi.useFakeTimers();
    const { api, fetcher } = fixture();
    fetcher.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const pending = expect(api('owner-a', 'history', { method: 'POST', body: {} })).rejects.toMatchObject({ code: 'RESULT_UNKNOWN' });
    await vi.advanceTimersByTimeAsync(20_000);
    await pending;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
