import { validateSnapshot, PUBLIC_STATISTICS_SELECT } from '../src/utils/questionStatisticsModel';
import type { StatisticsSnapshot } from '../src/types/questionStatistics';
import { projectId, publicAnonKey } from '../src/utils/supabase/info';

export function validatePublicStatistics(value: unknown): StatisticsSnapshot[] {
  if (!Array.isArray(value)) throw new Error('공개 문항 통계 응답은 배열이어야 합니다.');
  const rows = value.map(validateSnapshot);
  const keys = rows.map(row => `${row.year}:${row.subject}:${row.exam_type}`);
  if (new Set(keys).size !== rows.length) throw new Error('공개 문항 통계에 중복 시험 조합이 있습니다.');
  if (new Set(rows.map(row => row.snapshot_id)).size > 1
    || new Set(rows.map(row => row.source_snapshot_at)).size > 1
    || new Set(rows.map(row => row.published_at)).size > 1) throw new Error('공개 문항 통계의 발행본이 섞여 있습니다.');
  return rows;
}

// 세션·service role·개인 이력 없이 기존 anon SELECT/RLS로 현재 발행본을 한 번 읽는다.
export async function loadPublicStatistics(fetcher: typeof fetch = fetch): Promise<StatisticsSnapshot[]> {
  const url = new URL(`https://${projectId}.supabase.co/rest/v1/question_statistics_snapshots`);
  url.searchParams.set('select', PUBLIC_STATISTICS_SELECT);
  url.searchParams.set('order', 'year,subject,exam_type');
  const response = await fetcher(url, {
    method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000),
    headers: { apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}`, Prefer: 'count=exact', Range: '0-999' },
  });
  if (!response.ok) throw new Error(`공개 문항 통계 조회 실패 (HTTP ${response.status}).`);
  const rows = validatePublicStatistics(await response.json());
  const range = response.headers.get('content-range')?.match(/^(?:0-\d+|\*)\/(\d+)$/);
  if (!range || Number(range[1]) !== rows.length) throw new Error('공개 문항 통계 응답이 누락되었거나 전체 건수를 확인할 수 없습니다.');
  return rows;
}
