import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../contexts/AuthContext';
import type { ExamStatisticsSelection, StatisticsSnapshot, StatisticsState } from '../types/questionStatistics';
import { answerKeyVersion, validateSnapshot } from '../utils/questionStatisticsModel';

const TTL = 5 * 60 * 1000;
type Group = { time: number; rows: StatisticsSnapshot[] };
const cache = new Map<string, Group>();
const pending = new Map<string, Promise<Group>>();
let generation: string | undefined;

function loadGroup(year: string, examType: string, key: string): Promise<Group> {
  const stored = cache.get(key);
  if (stored && Date.now() - stored.time < TTL) return Promise.resolve(stored);
  const ongoing = pending.get(key);
  if (ongoing) return ongoing;
  const request = (async () => {
    // Both subjects are read together so a result page cannot mix generations.
    const { data, error } = await supabase.from('question_statistics_snapshots')
      .select('year,subject,exam_type,snapshot_id::text,answer_key_version,aggregation_version,question_count,sample_count::text,items,source_snapshot_at,published_at')
      .eq('year', year).eq('exam_type', examType);
    if (error && error.code !== 'PGRST205' && error.code !== '42P01') throw error;
    const rows = error ? [] : (data ?? []).map(validateSnapshot);
    if (rows.some(row => row.year !== year || row.exam_type !== examType)
      || new Set(rows.map(row => row.subject)).size !== rows.length
      || new Set(rows.map(row => row.snapshot_id)).size > 1) throw new Error('통계의 시험 조합 또는 세대가 다릅니다.');
    if (rows.length && generation !== rows[0].snapshot_id) { cache.clear(); generation = rows[0].snapshot_id; }
    const group = { time: Date.now(), rows };
    cache.set(key, group);
    return group;
  })();
  pending.set(key, request);
  void request.finally(() => pending.delete(key)).catch(() => { /* handled by subscribers */ });
  return request;
}

export function useQuestionStatistics(selection: ExamStatisticsSelection, enabled = true) {
  const { year, subject, examType } = selection;
  const version = answerKeyVersion(selection);
  const groupKey = `${year}:${examType}`;
  const key = `${groupKey}:${subject}:${version}`;
  const [result, setResult] = useState<{ key: string; state: StatisticsState }>();
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => { cache.delete(groupKey); setRevision(value => value + 1); }, [groupKey]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void loadGroup(year, examType, groupKey).then(group => {
      if (!active) return;
      const snapshot = group.rows.find(row => row.subject === subject);
      const state: StatisticsState = !snapshot ? { status: 'unavailable' }
        : snapshot.answer_key_version === version ? { status: 'ready', data: snapshot } : { status: 'mismatch' };
      setResult({ key, state });
    }).catch(error => {
      if (!active) return;
      console.error('문항 통계 조회 실패', error);
      setResult({ key, state: { status: 'error' } });
    });
    const onFocus = () => {
      const stored = cache.get(groupKey);
      if (!stored || Date.now() - stored.time >= TTL) setRevision(value => value + 1);
    };
    window.addEventListener('focus', onFocus);
    return () => { active = false; window.removeEventListener('focus', onFocus); };
  }, [year, subject, examType, version, key, groupKey, enabled, revision]);
  return { state: result?.key === key && enabled ? result.state : { status: 'loading' } as StatisticsState, retry };
}
