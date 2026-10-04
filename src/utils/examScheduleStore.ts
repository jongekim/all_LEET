import type { ExamSchedule } from '../types/examSchedule';
import { parseExamSchedule } from './examScheduleModel';

export interface ScheduleSnapshot {
  schedule: ExamSchedule | null;
  loading: boolean;
  error: string | null;
}
const initial: ScheduleSnapshot = { schedule: null, loading: true, error: null };
const serverSnapshot = () => initial;

// One store per app root; requests and browser listeners are shared by all consumers.
export class ExamScheduleStore {
  private state = initial;
  private listeners = new Set<() => void>();
  private generation = 0;
  private request: { controller: AbortController; promise: Promise<ExamSchedule | null> } | null = null;
  private serverRevision = 0;

  constructor(private read: (signal: AbortSignal) => Promise<ExamSchedule>, readonly cacheKey: string) {}

  getSnapshot = () => this.state;
  getServerSnapshot = serverSnapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private emit(state: ScheduleSnapshot) {
    this.state = state;
    this.listeners.forEach(listener => listener());
  }
  private remember(schedule: ExamSchedule) {
    try { window.localStorage.setItem(this.cacheKey, JSON.stringify({ version: 1, schedule, fetched_at: Date.now() })); }
    catch { /* Public caching is optional, including in privacy mode. */ }
  }
  restore() {
    if (this.state.schedule) return;
    try {
      const raw: unknown = JSON.parse(window.localStorage.getItem(this.cacheKey) || 'null');
      if (!raw || typeof raw !== 'object') return;
      const cached = raw as Record<string, unknown>;
      if (cached.version !== 1 || typeof cached.fetched_at !== 'number' || !Number.isFinite(cached.fetched_at)) return;
      // Cache revisions are untrusted; the first server response always takes priority.
      this.emit({ ...this.state, schedule: parseExamSchedule(cached.schedule) });
    } catch { /* Corrupt/old cache must not prevent the first request. */ }
  }
  publish(schedule: ExamSchedule): boolean {
    if (schedule.revision < this.serverRevision) return false;
    this.generation++;
    this.request?.controller.abort();
    this.request = null;
    this.serverRevision = schedule.revision;
    this.emit({ schedule, loading: false, error: null });
    this.remember(schedule);
    return true;
  }
  refresh = (): Promise<ExamSchedule | null> => {
    if (this.request) return this.request.promise;
    const generation = this.generation;
    const controller = new AbortController();
    this.emit({ ...this.state, loading: true });
    const promise = this.read(controller.signal).then(schedule => {
      if (controller.signal.aborted || generation !== this.generation) return null;
      if (schedule.revision < this.serverRevision) {
        this.emit({ ...this.state, loading: false });
        return this.state.schedule;
      }
      this.serverRevision = schedule.revision;
      this.emit({ schedule, loading: false, error: null });
      this.remember(schedule);
      return schedule;
    }).catch(cause => {
      if (controller.signal.aborted || generation !== this.generation) return null;
      console.error('디데이 설정 조회 실패', cause);
      this.emit({ ...this.state, loading: false, error: '디데이 설정을 불러오지 못했습니다.' });
      return null;
    }).finally(() => {
      if (this.request?.controller === controller) this.request = null;
    });
    this.request = { controller, promise };
    return promise;
  };
  cancel() {
    this.generation++;
    this.request?.controller.abort();
    this.request = null;
  }
}
