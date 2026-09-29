import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { supabase } from '../contexts/AuthContext';
import { projectId } from '../utils/supabase/info';
import { createHistoryApi, type HistoryKind } from '../utils/historyApi';
import type { GradingResult } from '../App';
import type { MockExamRecord } from '../types/mockExam';

const historyApi = createHistoryApi(supabase.auth, `https://${projectId}.supabase.co/functions/v1/make-server-cd835c22`);
type Records = { history: GradingResult[]; 'mock-history': MockExamRecord[] };
type State = {
  ownerId: string | null;
  records: Records;
  errors: Record<HistoryKind, string | null>;
  loading: Record<HistoryKind, boolean>;
};
const emptyState = (ownerId: string | null): State => ({
  ownerId, records: { history: [], 'mock-history': [] },
  errors: { history: null, 'mock-history': null },
  loading: { history: !!ownerId, 'mock-history': !!ownerId },
});
const messageFor = (error: unknown) => error instanceof Error ? error.message : '이력 요청에 실패했습니다. 잠시 후 다시 시도해주세요.';

export function useUserHistory(ownerId: string | null, request = historyApi) {
  const [state, setState] = useState<State>(() => emptyState(ownerId));
  const identity = useRef({ ownerId, versions: { history: 0, 'mock-history': 0 }, reads: { history: 0, 'mock-history': 0 } });
  useLayoutEffect(() => {
    identity.current = { ownerId, versions: { history: 0, 'mock-history': 0 }, reads: { history: 0, 'mock-history': 0 } };
  }, [ownerId]);

  const load = useCallback(async (kind: HistoryKind, signal?: AbortSignal) => {
    if (!ownerId) return;
    const started = identity.current;
    if (started.ownerId !== ownerId) return;
    const version = started.versions[kind];
    const read = ++started.reads[kind];
    const isCurrent = () => identity.current === started && !signal?.aborted && started.reads[kind] === read && started.versions[kind] === version;
    setState(prev => identity.current === started ? ({ ...(prev.ownerId === ownerId ? prev : emptyState(ownerId)), loading: { ...(prev.ownerId === ownerId ? prev.loading : emptyState(ownerId).loading), [kind]: true } }) : prev);
    try {
      const records = await request<GradingResult[] | MockExamRecord[]>(ownerId, kind, { signal });
      if (!Array.isArray(records)) throw new Error('이력 응답을 확인하지 못했습니다. 다시 시도해주세요.');
      if (isCurrent()) setState(prev => isCurrent() ? ({
        ...prev, records: { ...prev.records, [kind]: records },
        errors: { ...prev.errors, [kind]: null }, loading: { ...prev.loading, [kind]: false },
      }) : prev);
    } catch (error) {
      if (isCurrent()) {
        console.error('성적 이력 조회 실패', error);
        setState(prev => isCurrent() ? ({ ...prev, errors: { ...prev.errors, [kind]: messageFor(error) }, loading: { ...prev.loading, [kind]: false } }) : prev);
      }
    }
  }, [ownerId, request]);

  useEffect(() => {
    setState(prev => prev.ownerId === ownerId ? prev : emptyState(ownerId));
    if (!ownerId) return;
    const controller = new AbortController();
    void load('history', controller.signal);
    void load('mock-history', controller.signal);
    return () => controller.abort();
  }, [ownerId, load]);

  const add = async <K extends HistoryKind>(kind: K, body: unknown) => {
    if (!ownerId) throw new Error('로그인 상태를 다시 확인해주세요.');
    const started = identity.current;
    if (started.ownerId !== ownerId) throw new Error('로그인 계정이 변경되었습니다.');
    let saved: Records[K][number];
    try {
      saved = await request<Records[K][number]>(ownerId, kind, { method: 'POST', body });
    } catch (error) {
      // A lost POST response may have committed. Read back without resubmitting,
      // so the history screen cannot mistake stale empty state for no record.
      if (identity.current === started) void load(kind);
      throw error;
    }
    if (identity.current !== started) throw new Error('로그인 계정이 변경되었습니다. 이력을 다시 확인해주세요.');
    started.versions[kind]++;
    setState(prev => identity.current === started ? ({ ...prev, records: { ...prev.records, [kind]: [...prev.records[kind], saved] } }) : prev);
    // If the initial read was still running, reconcile instead of losing older records.
    if (state.loading[kind]) void load(kind);
  };

  const remove = async (kind: HistoryKind, recordIds?: Array<string | number>) => {
    if (!ownerId) return;
    if (identity.current.ownerId !== ownerId) return;
    const prompt = recordIds
      ? (kind === 'history' ? '이 채점 기록을 삭제하시겠습니까?' : '이 사설 기록을 삭제하시겠습니까?')
      : (kind === 'history' ? '모든 채점 기록을 삭제하시겠습니까?' : '모든 사설 모의고사 기록을 삭제하시겠습니까?');
    if (!window.confirm(prompt)) return;
    const started = identity.current;
    try {
      for (const recordId of recordIds ? Array.from(new Set(recordIds)) : [undefined]) {
        if (identity.current !== started) throw new Error('로그인 계정이 변경되었습니다.');
        await request(ownerId, kind, { method: 'DELETE', recordId });
        if (identity.current !== started) return;
        started.versions[kind]++;
        setState(prev => identity.current === started ? ({
          ...prev, records: { ...prev.records, [kind]: recordId === undefined ? [] : prev.records[kind].filter(record => (
            kind === 'history' ? (record as GradingResult).timestamp !== recordId : (record as MockExamRecord).id !== recordId
          )) },
        }) : prev);
      }
      if (state.loading[kind]) void load(kind);
    } catch (error) {
      console.error('성적 이력 삭제 실패', error);
      if (identity.current === started) {
        // A group may have been partially deleted, or a response may be lost.
        await load(kind);
        if (identity.current === started) alert(`삭제 요청을 완료하지 못했습니다. 이력을 확인해주세요.\n${messageFor(error)}`);
      }
    }
  };

  const visible = state.ownerId === ownerId ? state : emptyState(ownerId);
  return {
    history: visible.records.history,
    mockHistory: visible.records['mock-history'],
    errors: visible.errors,
    loading: visible.loading,
    reload: load,
    addOfficial: (result: GradingResult) => ownerId ? add('history', result) : Promise.resolve(),
    addMock: (record: Omit<MockExamRecord, 'id' | 'createdAt'>) => add('mock-history', record),
    clearOfficial: () => remove('history'),
    clearMock: () => remove('mock-history'),
    deleteOfficial: (ids: number[]) => ids.length ? remove('history', ids) : Promise.resolve(),
    deleteMock: (ids: string[]) => ids.filter(Boolean).length ? remove('mock-history', ids.filter(Boolean)) : Promise.resolve(),
  };
}
