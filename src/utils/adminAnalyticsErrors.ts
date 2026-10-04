export class AdminAnalyticsError extends Error {
  constructor(public code: string, public status: number | null, public retryable: boolean, message: string) { super(message); this.name = 'AdminAnalyticsError'; }
  get authorizationDenied() { return this.status === 401 || this.status === 403; }
}
export const canKeepPreviousAnalytics = (error: unknown) => error instanceof AdminAnalyticsError && error.retryable && !error.authorizationDenied;

/** Scoped to one mounted admin workspace, never a second source of auth truth. */
export class AnalyticsAuthorizationScope {
  private generation = 0;
  private denied: AdminAnalyticsError | null = null;
  private controllers = new Set<AbortController>();
  private listeners = new Set<() => void>();
  constructor(readonly owner: string) {}
  getSnapshot = () => this.generation;
  get error() { return this.denied; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  begin(owner: string) {
    if (owner !== this.owner) throw new AdminAnalyticsError('ACCOUNT_CHANGED', null, false, '계정이 변경되어 조회를 중단했습니다.');
    if (this.denied) throw this.denied;
    const generation = this.generation, controller = new AbortController(); this.controllers.add(controller);
    return { generation, controller, finish: () => this.controllers.delete(controller) };
  }
  assertCurrent(generation: number) {
    if (this.denied) throw this.denied;
    if (generation !== this.generation) throw new AdminAnalyticsError('STALE_REQUEST', null, false, '조회가 취소되었습니다.');
  }
  reject(error: AdminAnalyticsError, generation: number) {
    if (!error.authorizationDenied || generation !== this.generation) return;
    this.denied = error; this.generation++;
    for (const c of this.controllers) c.abort(); this.controllers.clear();
    for (const listener of this.listeners) listener();
  }
  dispose() { this.generation++; for (const c of this.controllers) c.abort(); this.controllers.clear(); this.listeners.clear(); }
}
