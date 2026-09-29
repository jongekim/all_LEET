type Session = { access_token: string; user: { id: string } };
type SessionResult = { data: { session: Session | null }; error: unknown };
interface HistoryAuth {
  getSession(): Promise<SessionResult>;
  refreshSession(): Promise<SessionResult>;
}

export type HistoryKind = 'history' | 'mock-history';
type RequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE';
  recordId?: string | number;
  body?: unknown;
  signal?: AbortSignal;
};

export class HistoryApiError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'HistoryApiError';
  }
}

export function createHistoryApi(auth: HistoryAuth, baseUrl: string, fetcher: typeof fetch = fetch) {
  let refreshing: Promise<SessionResult> | null = null;

  const requireSession = (result: SessionResult, ownerId: string) => {
    if (result.error) {
      throw new HistoryApiError('로그인 상태를 확인하지 못했습니다. 입력을 유지한 채 잠시 후 다시 시도해주세요.', 'SESSION_UNAVAILABLE');
    }
    if (!result.data.session?.access_token) {
      throw new HistoryApiError('로그인이 만료되었습니다. 로그인 상태를 다시 확인해주세요.', 'AUTH_REQUIRED');
    }
    if (result.data.session.user.id !== ownerId) {
      throw new HistoryApiError('로그인 계정이 변경되었습니다. 현재 계정의 이력을 다시 확인해주세요.', 'ACCOUNT_CHANGED');
    }
    return result.data.session;
  };

  return async function request<T>(ownerId: string, kind: HistoryKind, options: RequestOptions = {}): Promise<T> {
    const method = options.method || 'GET';
    const suffix = options.recordId === undefined ? '' : `/${encodeURIComponent(options.recordId)}`;
    const url = `${baseUrl}/${kind}/${encodeURIComponent(ownerId)}${suffix}`;
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);

    for (let attempt = 0; attempt < 2; attempt++) {
      const session = requireSession(await auth.getSession(), ownerId);
      options.signal?.throwIfAborted();
      const controller = new AbortController();
      const abort = () => controller.abort();
      options.signal?.addEventListener('abort', abort, { once: true });
      const timeout = setTimeout(abort, 20_000);
      let response: Response;
      let payload: { success?: boolean; data?: T; code?: string } | null;
      try {
        response = await fetcher(url, {
          method,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          },
          body,
          signal: controller.signal,
        });
        payload = await response.json().catch(() => null);
      } catch (error) {
        if (options.signal?.aborted) throw error;
        // A timed-out write may already have committed: never retry it blindly.
        throw new HistoryApiError(
          method === 'GET'
            ? '이력을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
            : '요청 결과를 확인하지 못했습니다. 이력을 확인한 뒤 다시 시도해주세요.',
          'RESULT_UNKNOWN',
        );
      } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener('abort', abort);
      }

      if (response.status === 401 && payload?.success === false && payload.code === 'AUTH_REQUIRED' && attempt === 0) {
        // This code is emitted only before any KV access by our server guard.
        // Share one refresh for concurrent official/mock requests.
        const latest = requireSession(await auth.getSession(), ownerId);
        if (latest.access_token === session.access_token) {
          if (!refreshing) {
            refreshing = auth.refreshSession().finally(() => { refreshing = null; });
          }
          requireSession(await refreshing, ownerId);
        }
        continue;
      }
      if (!response.ok || payload?.success === false || !payload) {
        const code = payload?.code || 'REQUEST_FAILED';
        const message = response.status === 401
          ? '로그인 상태를 다시 확인해주세요. 입력한 내용은 유지됩니다.'
          : response.status === 403
            ? '현재 로그인 계정의 이력만 사용할 수 있습니다.'
            : response.status === 503
              ? '인증 확인이 지연되고 있습니다. 잠시 후 다시 시도해주세요.'
              : '이력 요청에 실패했습니다. 이력을 확인한 뒤 다시 시도해주세요.';
        throw new HistoryApiError(message, code);
      }
      // Do not return an earlier account's response after a session transition.
      requireSession(await auth.getSession(), ownerId);
      return payload.data as T;
    }
    throw new HistoryApiError('로그인 상태를 다시 확인해주세요.', 'AUTH_REQUIRED');
  };
}
