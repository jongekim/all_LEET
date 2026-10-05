// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import fixture from '../../e2e/fixtures/question-statistics-2026.json';
import { loadPublicStatistics, validatePublicStatistics } from '../../scripts/prerenderStatistics';
import { statisticsStateForSelection } from './questionStatisticsModel';

const response = (data: unknown, range = `0-3/4`) => new Response(JSON.stringify(data), {
  headers: { 'Content-Type': 'application/json', 'Content-Range': range },
});

describe('사전 HTML 공개 통계 조회', () => {
  it('기존 anon GET 하나로 전체 발행본을 읽으며 개인정보 필드는 제거한다', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(fixture.map(row => ({ ...row, user_id: 'must-not-export' }))));
    const rows = await loadPublicStatistics(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    expect(String(url)).toContain('/rest/v1/question_statistics_snapshots?');
    expect(options).toMatchObject({ method: 'GET', redirect: 'error', cache: 'no-store', headers: { Prefer: 'count=exact', Range: '0-999' } });
    const headers = options!.headers as Record<string, string>;
    const payload = JSON.parse(Buffer.from(headers.apikey.split('.')[1], 'base64url').toString());
    expect(payload.role).toBe('anon');
    expect(JSON.stringify(rows)).not.toContain('must-not-export');
    expect(rows).toHaveLength(4);
    expect(rows[0].sample_count).toBe(31);
  });

  it('HTTP 오류를 빈 통계나 과거 파일로 대체하지 않는다', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('unavailable', { status: 503 }));
    await expect(loadPublicStatistics(fetcher)).rejects.toThrow('HTTP 503');
  });

  it('시간 초과/네트워크 오류를 빌드 호출자에게 전달한다', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('timeout'));
    await expect(loadPublicStatistics(fetcher)).rejects.toThrow('timeout');
  });

  it.each(['0-3/76', '*/*', ''])('누락되거나 검증할 수 없는 응답 범위 %s를 거절한다', async range => {
    await expect(loadPublicStatistics(vi.fn<typeof fetch>().mockResolvedValue(response(fixture, range)))).rejects.toThrow('전체 건수');
  });

  it('미발행 빈 응답은 정답률을 만들어내지 않는다', async () => {
    const rows = await loadPublicStatistics(vi.fn<typeof fetch>().mockResolvedValue(response([], '*/0')));
    expect(statisticsStateForSelection(rows, { year: '2027', subject: 'verbal', examType: 'odd' })).toEqual({ status: 'unavailable' });
  });

  it('같은 시험 조합 중복과 서로 다른 발행본을 거절한다', () => {
    expect(() => validatePublicStatistics([...fixture, fixture[0]])).toThrow('중복');
    expect(() => validatePublicStatistics(fixture.map((row, i) => ({ ...row, snapshot_id: i ? '2' : '1' })))).toThrow('발행본');
    expect(() => validatePublicStatistics(fixture.map((row, i) => ({ ...row, published_at: i ? '2026-10-05T00:00:00Z' : row.published_at })))).toThrow('발행본');
  });

  it('문항 합계 오류와 배열이 아닌 응답을 거절한다', () => {
    const rows = structuredClone(fixture);
    rows[0].items[0].choice_counts[0] += 1;
    expect(() => validatePublicStatistics(rows)).toThrow('합계');
    expect(() => validatePublicStatistics({ error: 'invalid' })).toThrow('배열');
  });

  it('학년도·과목·문형을 구분하고 정답 버전이 다르면 표시하지 않는다', () => {
    const rows = validatePublicStatistics(fixture);
    const selection = { year: '2026', subject: 'verbal', examType: 'odd' } as const;
    const state = statisticsStateForSelection(rows, selection);
    expect(state.status).toBe('ready');
    if (state.status !== 'ready') throw new Error('fixture missing');
    expect(statisticsStateForSelection([{ ...state.data, answer_key_version: 'old-version' }], selection)).toEqual({ status: 'mismatch' });
    expect(statisticsStateForSelection(rows, { ...selection, year: '2027' })).toEqual({ status: 'unavailable' });
  });
});
