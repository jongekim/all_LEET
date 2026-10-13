import { useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../contexts/AuthContext';
import { PrerenderStatisticsContext } from '../contexts/PrerenderStatisticsContext';
import type { ExamStatisticsSelection } from '../types/questionStatistics';
import type { CanonicalStatistics, CanonicalStatisticsState } from '../types/canonicalStatistics';
import { CATALOG_ID, MAPPING_SHA256 } from '../../supabase/functions/_shared/user-data-rules/questionIdentity';
import { answerKeyVersion } from '../utils/questionStatisticsModel';

import { CANONICAL_STATISTICS_SELECT, canonicalStateForSelection, validateCanonicalSnapshot, validateCanonicalGeneration } from '../utils/canonicalStatisticsModel';

const TTL = 5 * 60 * 1000;
type Group = { time: number; rows: CanonicalStatistics[] };
const cache = new Map<string, Group>();
const pending = new Map<string, Promise<Group>>();
let generation: string | undefined;

function loadGroup(year: string, key: string): Promise<Group> {
  const stored = cache.get(key);
  if (stored && Date.now() - stored.time < TTL) return Promise.resolve(stored);
  const ongoing = pending.get(key);
  if (ongoing) return ongoing;
  const request = (async () => {
    // Both subjects are read together so a result page cannot mix generations.
    const { data, error } = await supabase.from('question_statistics_snapshots_v2')
      .select(CANONICAL_STATISTICS_SELECT)
      .eq('year', year);
    if (error && error.code !== 'PGRST205' && error.code !== '42P01') throw error;
    const rows = error ? [] : (data ?? []).map(validateCanonicalSnapshot);
    validateCanonicalGeneration(rows);
    if (rows.some(row => row.year !== year) || (rows.length > 0 && rows.length !== 2)) throw new Error('과목 통계가 누락되었습니다.');
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
  const groupKey = `${year}:pooled_saved_answers_v2:${CATALOG_ID}:${MAPPING_SHA256}`;
  const key = `${groupKey}:${subject}:${examType}:${version}`;
  const prerenderRows = useContext(PrerenderStatisticsContext);
  const [result, setResult] = useState<{ key: string; state: CanonicalStatisticsState } | undefined>(() =>
    prerenderRows ? { key, state: canonicalStateForSelection(prerenderRows, selection) } : undefined);
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => { cache.delete(groupKey); setRevision(value => value + 1); }, [groupKey]);
  useEffect(() => {
    if (!enabled || year === '2027') return;
    let active = true;
    void loadGroup(year, groupKey).then(group => {
      if (!active) return;
      const state = canonicalStateForSelection(group.rows, { year, subject, examType });
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
  return { state: year === '2027' ? {status:'unavailable'} as CanonicalStatisticsState : result?.key === key && enabled ? result.state : { status: 'loading' } as CanonicalStatisticsState, retry };
}
