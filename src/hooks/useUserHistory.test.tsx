import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserHistory } from './useUserHistory';
import type { GradingResult } from '../App';
import { HistoryApiError } from '../utils/historyApi';
import { gradeAnswers } from '../utils/grading';
import { editedResult } from '../../supabase/functions/_shared/user-data-rules/answerEdit';

vi.mock('../contexts/AuthContext', () => ({ supabase: { auth: {} } }));
const record = (timestamp: number) => ({ timestamp }) as GradingResult;
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
type Request = NonNullable<Parameters<typeof useUserHistory>[1]>;
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function renderHook<P, T>(hook: (props: P) => T, options?: { initialProps: P }) {
  const result = {} as { current: T };
  function Harness({ props }: { props: P }) { result.current = hook(props); return null; }
  const rerender = (props: P) => act(() => root.render(<Harness props={props} />));
  rerender(options?.initialProps as P);
  return { result, rerender };
}
async function waitFor(assert: () => void) {
  await act(async () => { await Promise.resolve(); });
  await vi.waitFor(assert);
}

describe('history account lifecycle', () => {
  it('updates one existing record and returns the persisted timestamp and round from append', async () => {
    const original = { ...gradeAnswers('2026','verbal',{1:3},30,'odd'), timestamp:123, groupTimestamp:100, round:3 };
    const saved = editedResult(original, {1:4});
    const request = vi.fn((_owner, kind, options) => Promise.resolve(options?.method === 'PUT' ? saved : options?.method === 'POST' ? original : kind === 'history' ? [original,record(124)] : []));
    const { result } = renderHook(() => useUserHistory('a', request as Request));
    await waitFor(() => expect(result.current.loading.history).toBe(false));
    await act(async () => expect(await result.current.updateOfficial(original,{1:4})).toEqual(saved));
    expect(result.current.history).toEqual([saved,record(124)]);
    expect(request).toHaveBeenCalledWith('a','history',expect.objectContaining({ method:'PUT',recordId:123,body:{expected:original,userAnswers:{1:4}} }));
    await act(async () => expect(await result.current.addOfficial(original)).toEqual(original));
  });

  it('reconciles a committed PUT with a lost response using GET without resending', async () => {
    const original = { ...gradeAnswers('2026','verbal',{1:3},30,'odd'), timestamp:123, round:3 };
    const saved = editedResult(original,{1:4});
    let committed = false;
    const request = vi.fn((_owner,kind,options) => {
      if (options?.method === 'PUT') { committed=true;return Promise.reject(new HistoryApiError('응답 미확인','RESULT_UNKNOWN')); }
      return Promise.resolve(kind === 'history' ? [committed ? saved : original] : []);
    });
    const { result } = renderHook(() => useUserHistory('a',request as Request));
    await waitFor(() => expect(result.current.loading.history).toBe(false));
    await act(async () => expect(await result.current.updateOfficial(original,{1:4})).toEqual(saved));
    expect(result.current.history).toEqual([saved]);
    expect(request.mock.calls.filter(call=>call[2]?.method === 'PUT')).toHaveLength(1);
  });

  it('ignores an old account edit response after switching accounts', async () => {
    const original = { ...gradeAnswers('2026','verbal',{1:3},30,'odd'), timestamp:123, round:3 };
    const pending = deferred<GradingResult>();
    const request = vi.fn((_owner,kind,options) => options?.method === 'PUT' ? pending.promise : Promise.resolve(kind === 'history' ? [original] : []));
    const { result,rerender } = renderHook(({owner})=>useUserHistory(owner,request as Request),{initialProps:{owner:'a'}});
    await waitFor(() => expect(result.current.loading.history).toBe(false));
    const outcome = result.current.updateOfficial(original,{1:4}).catch(error=>error);
    rerender({owner:'b'});
    await act(async () => pending.resolve(editedResult(original,{1:4})));
    expect(await outcome).toMatchObject({code:'ACCOUNT_CHANGED'});
    expect(result.current.history.some(item=>item.correct === 1)).toBe(false);
  });

  it('keeps the original error when a lost write cannot be reconciled with a valid list', async () => {
    const original = { ...gradeAnswers('2026','verbal',{1:3},30,'odd'), timestamp:123, round:3 };
    const lost = new HistoryApiError('응답 미확인','RESULT_UNKNOWN');
    let committed = false;
    const request = vi.fn((_owner,kind,options) => {
      if (options?.method === 'PUT') { committed=true;return Promise.reject(lost); }
      return Promise.resolve(kind === 'history' ? (committed ? {} : [original]) : []);
    });
    const { result } = renderHook(() => useUserHistory('a',request as Request));
    await waitFor(() => expect(result.current.loading.history).toBe(false));
    await act(async () => { await expect(result.current.updateOfficial(original,{1:4})).rejects.toBe(lost); });
    expect(result.current.history).toEqual([original]);
    expect(request.mock.calls.filter(call=>call[2]?.method === 'PUT')).toHaveLength(1);
  });

  it('refreshes history after a conflict so reopening does not reuse the stale snapshot', async () => {
    const original = { ...gradeAnswers('2026','verbal',{1:3},30,'odd'), timestamp:123, round:3 };
    const latest = editedResult(original,{1:0});
    const conflict = new HistoryApiError('다른 곳에서 변경','HISTORY_CONFLICT');
    let changed = false;
    const request = vi.fn((_owner,kind,options) => {
      if (options?.method === 'PUT') { changed=true;return Promise.reject(conflict); }
      return Promise.resolve(kind === 'history' ? [changed ? latest : original] : []);
    });
    const { result } = renderHook(() => useUserHistory('a',request as Request));
    await waitFor(() => expect(result.current.loading.history).toBe(false));
    await act(async () => { await expect(result.current.updateOfficial(original,{1:4})).rejects.toBe(conflict); });
    expect(result.current.history).toEqual([latest]);
    expect(request.mock.calls.filter(call=>call[2]?.method === 'PUT')).toHaveLength(1);
  });

  it('finishes loading after a reconciliation read finds a deleted target and ignores an older read', async () => {
    const original = { ...gradeAnswers('2026','verbal',{1:3},30,'odd'), timestamp:123, round:3 };
    const oldRead = deferred<GradingResult[]>();
    const lost = new HistoryApiError('응답 미확인','RESULT_UNKNOWN');
    let reads = 0;
    const request = vi.fn((_owner,kind,options) => {
      if (options?.method === 'PUT') return Promise.reject(lost);
      return kind === 'history' && ++reads === 1 ? oldRead.promise : Promise.resolve([]);
    });
    const { result } = renderHook(() => useUserHistory('a',request as Request));
    await act(async () => { await expect(result.current.updateOfficial(original,{1:4})).rejects.toBe(lost); });
    expect(result.current.loading.history).toBe(false);
    await act(async () => oldRead.resolve([original]));
    expect(result.current.history).toEqual([]);
  });

  it('discards a previous account read after switching accounts', async () => {
    const pending = deferred<GradingResult[]>();
    const request = vi.fn((owner: string, kind: string) => owner === 'a' && kind === 'history' ? pending.promise : Promise.resolve([]));
    const { result, rerender } = renderHook(({ owner }) => useUserHistory(owner, request as Request), { initialProps: { owner: 'a' } });
    rerender({ owner: 'b' });
    await act(async () => pending.resolve([record(1)]));
    await waitFor(() => expect(result.current.loading.history).toBe(false));
    expect(result.current.history).toEqual([]);
  });

  it('clears existing data on logout and ignores the old read after logging back in', async () => {
    const pending = deferred<GradingResult[]>();
    let officialReads = 0;
    const request = vi.fn((_owner: string, kind: string) => Promise.resolve(kind === 'history' ? (++officialReads === 1 ? [record(1)] : []) : []));
    const { result, rerender } = renderHook(({ owner }) => useUserHistory(owner, request as Request), { initialProps: { owner: 'a' as string | null } });
    await waitFor(() => expect(result.current.history).toHaveLength(1));
    request.mockImplementation((_owner, kind) => kind === 'history' ? pending.promise : Promise.resolve([]));
    act(() => { void result.current.reload('history'); });
    rerender({ owner: null });
    expect(result.current.history).toEqual([]);
    request.mockImplementation(() => Promise.resolve([]));
    rerender({ owner: 'a' });
    await act(async () => pending.resolve([record(99)]));
    await waitFor(() => expect(result.current.loading.history).toBe(false));
    expect(result.current.history).toEqual([]);
  });

  it('rejects an old account save completion without adding it to the new account', async () => {
    const pending = deferred<GradingResult>();
    const request = vi.fn((_owner: string, _kind: string, options?: { method?: string }) => options?.method === 'POST' ? pending.promise : Promise.resolve([]));
    const { result, rerender } = renderHook(({ owner }) => useUserHistory(owner, request as Request), { initialProps: { owner: 'a' } });
    await waitFor(() => expect(result.current.loading.history).toBe(false));
    const outcome = result.current.addOfficial(record(1)).catch(error => error);
    rerender({ owner: 'b' });
    await act(async () => pending.resolve(record(1)));
    expect(await outcome).toBeInstanceOf(Error);
    expect(result.current.history).toEqual([]);
  });

  it('reconciles an initial read racing a successful save without losing older records', async () => {
    const oldRead = deferred<GradingResult[]>();
    let reads = 0;
    const request = vi.fn((_owner: string, kind: string, options?: { method?: string }) => {
      if (options?.method === 'POST') return Promise.resolve(record(2));
      return kind === 'history' ? (++reads === 1 ? oldRead.promise : Promise.resolve([record(1), record(2)])) : Promise.resolve([]);
    });
    const { result } = renderHook(() => useUserHistory('a', request as Request));
    await act(async () => { await result.current.addOfficial(record(2)); });
    await act(async () => oldRead.resolve([record(1)]));
    await waitFor(() => expect(result.current.loading.history).toBe(false));
    expect(result.current.history.map(item => item.timestamp)).toEqual([1, 2]);
  });

  it('keeps confirmed partial deletion and reloads without retrying an ambiguous DELETE', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let deletions = 0;
    const request = vi.fn((_owner: string, kind: string, options?: { method?: string }) => {
      if (options?.method === 'DELETE') return ++deletions === 1 ? Promise.resolve(null) : Promise.reject(new Error('응답 유실'));
      return Promise.resolve(kind === 'history' ? [record(2)] : []);
    });
    const { result } = renderHook(() => useUserHistory('a', request as Request));
    await waitFor(() => expect(result.current.loading.history).toBe(false));
    await act(async () => { await result.current.deleteOfficial([1, 2]); });
    expect(deletions).toBe(2);
    expect(result.current.history).toEqual([record(2)]);
    expect(window.alert).toHaveBeenCalled();
  });

  it('distinguishes a failed load from a valid empty history', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const request = vi.fn((_owner: string, kind: string) => kind === 'history' ? Promise.reject(new Error('인증 서버 장애')) : Promise.resolve([]));
    const { result } = renderHook(() => useUserHistory('a', request as Request));
    await waitFor(() => expect(result.current.loading.history).toBe(false));
    expect(result.current.errors.history).toBe('인증 서버 장애');
    expect(result.current.errors['mock-history']).toBeNull();
  });

  it('reads back an ambiguous POST without resubmitting the committed record', async () => {
    let committed = false;
    const request = vi.fn((_owner: string, kind: string, options?: { method?: string }) => {
      if (options?.method === 'POST') { committed = true; return Promise.reject(new Error('응답 유실')); }
      return Promise.resolve(kind === 'history' && committed ? [record(1)] : []);
    });
    const { result } = renderHook(() => useUserHistory('a', request as Request));
    await waitFor(() => expect(result.current.loading.history).toBe(false));
    await act(async () => { await expect(result.current.addOfficial(record(1))).rejects.toThrow('응답 유실'); });
    await waitFor(() => expect(result.current.history).toEqual([record(1)]));
    expect(request.mock.calls.filter(call => call[2]?.method === 'POST')).toHaveLength(1);
  });

  it('a retained old account callback cannot start a read or mutation for the new account', async () => {
    const request = vi.fn(() => Promise.resolve([]));
    const { result, rerender } = renderHook(({ owner }) => useUserHistory(owner, request as Request), { initialProps: { owner: 'a' } });
    await waitFor(() => expect(result.current.loading.history).toBe(false));
    const previous = result.current;
    rerender({ owner: 'b' });
    await waitFor(() => expect(result.current.loading.history).toBe(false));
    const calls = request.mock.calls.length;
    await act(async () => {
      await expect(previous.addOfficial(record(1))).rejects.toThrow('로그인 계정이 변경');
      await previous.reload('history');
    });
    expect(request.mock.calls).toHaveLength(calls);
    expect(result.current.loading.history).toBe(false);
  });
});
