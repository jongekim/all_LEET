import { describe, expect, it, vi } from 'vitest';
import { createUsageClient, detectEnvironment } from './analyticsClient';
import { parseFilters, validateEvent } from '../../supabase/functions/_shared/analytics-contract';
import type { Ack, UsageEvent } from '../types/analytics';

function fixture() {
  let now = Date.parse('2026-10-03T01:00:00Z'), next = 1, visible = true;
  const values = new Map<string, string>();
  const send = vi.fn(async (events: UsageEvent[]): Promise<Ack[]> => events.map(e => ({ event_id: e.event_id, status: 'accepted' })));
  const options = { enabled: true, now: () => now, uuid: () => `00000000-0000-4000-8000-${String(next++).padStart(12, '0')}`, visible: () => visible,
    storage: { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); } },
    environment: () => ({ execution_channel: 'browser' as const, display_mode: 'browser', detection_method: 'media_query', detection_version: 1, os_family: 'android' as const, device_class: 'mobile' as const }), send };
  const client = createUsageClient(options); client.configure(null, false); client.page('/', 'entry-1');
  return { client, options, send, advance: (minutes: number) => { now += minutes * 60_000; }, hide: () => { visible = false; } };
}
describe('optional usage collection', () => {
  it('40분 동안 계속 입력하면 같은 세션이며 개별 답안을 보내지 않는다', () => {
    const f = fixture(); f.client.input('2027', 'odd', false);
    const before = f.client.pending().find(e => e.event_name === 'grading_input_started')!;
    for (let i = 0; i < 40; i++) { f.advance(1); f.client.input('2027', 'odd', true); }
    const run = f.client.beginGrading('2027', 'odd', 'both');
    expect(run.session_id).toBe(before.session_id); expect(run.input_flow_id).toBe(before.attributes.input_flow_id);
    expect(f.client.pending().filter(e => e.event_name === 'grading_input_started')).toHaveLength(1);
    expect(JSON.stringify(f.client.pending())).not.toContain('answers');
  });
  it('40분 방치 후 즉시 채점하면 새 세션과 재개 입력 흐름으로 연결한다', () => {
    const f = fixture(); const previous = f.client.input('2027', 'odd', false); f.advance(40);
    const run = f.client.beginGrading('2027', 'odd', 'verbal');
    const resumed = f.client.pending().find(e => e.event_name === 'grading_input_resumed')!;
    expect(resumed.attributes.previous_input_flow_id).toBe(previous); expect(run.input_flow_id).not.toBe(previous); expect(run.session_id).toBe(resumed.session_id);
  });
  it('입력 초기화는 새 흐름이며 같은 답안 재채점은 서로 다른 실행이다', () => {
    const f = fixture(); const first = f.client.input('2027', 'odd', false); f.client.resetInput();
    expect(f.client.input('2026', 'even', false)).not.toBe(first);
    const a = f.client.beginGrading('2026', 'even', 'both'), b = f.client.beginGrading('2026', 'even', 'both');
    expect(a.grading_run_id).not.toBe(b.grading_run_id); expect(a.input_flow_id).toBe(b.input_flow_id);
  });
  it('계정 전환은 이전 큐·결과를 버리고 비로그인 흐름을 회원에게 소급하지 않는다', () => {
    const f = fixture(); const run = f.client.beginGrading('2027', 'odd', 'both'); f.client.configure('member-a', false);
    f.client.trackGrading('grading_completed', run); expect(f.client.pending()).toHaveLength(0);
    f.client.beginGrading('2027', 'odd', 'both');
    const resumed = f.client.pending().find(e => e.event_name === 'grading_input_resumed')!;
    expect(resumed.attributes.resume_reason).toBe('identity_changed'); expect(resumed.attributes.previous_input_flow_id).toBeUndefined();
  });
  it('일부 처리 실패만 같은 이벤트 ID로 최대 두 번 재시도한다', async () => {
    const f = fixture(); f.client.track('past_exam_file_clicked', 'past_exams', { year: '2027' });
    const ids = f.client.pending().map(e => e.event_id);
    f.send.mockImplementation(async events => events.map(e => ({ event_id: e.event_id, status: e.event_id === ids[0] ? 'accepted' : 'processing_failed' })));
    await f.client.flush(); expect(f.client.pending().map(e => e.event_id)).toEqual([ids[1]]);
    await f.client.flush(); await f.client.flush(); expect(f.client.pending()).toHaveLength(0);
    expect(f.send.mock.calls[1][0][0].event_id).toBe(ids[1]);
  });
  it('여러 탭은 저장소 세션을 공유하며 문서 ID와 순서는 독립적이다', () => {
    const f = fixture(); const second = createUsageClient(f.options); second.page('/', 'entry-2');
    const a = f.client.pending()[0], b = second.pending()[0];
    expect(a.session_id).toBe(b.session_id); expect(a.page_instance_id).not.toBe(b.page_instance_id); expect(b.event_sequence).toBe(1);
  });
  it('백그라운드 키 입력으로 세션이 연장되지 않고 관리자 화면은 수집하지 않는다', () => {
    const f = fixture(); const session = f.client.pending()[0].session_id;
    f.hide(); f.advance(29); f.client.activity(); f.advance(2); f.client.page('/', 'entry-2');
    expect(f.client.pending()[f.client.pending().length - 1]?.session_id).not.toBe(session);
    f.client.configure('admin', true); f.client.page('/admin/analytics', 'admin'); expect(f.client.pending()).toHaveLength(0);
  });
  it('전송 중 계정 변경 뒤 이전 실패 응답이 큐를 복원하지 않는다', async () => {
    const f = fixture(); let finish!: (acks: Ack[]) => void;
    f.send.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const flushing = f.client.flush(); f.client.configure('other', false); finish([]); await flushing;
    expect(f.client.pending()).toHaveLength(0);
  });
  it('새 문서에서 세대 번호가 같아도 다른 계정의 보존된 결과 상태를 재귀속하지 않는다', () => {
    const f = fixture(); f.client.configure('member-a', false);
    const saved = f.client.beginGrading('2027', 'single', 'both');
    const fresh = createUsageClient(f.options); fresh.configure('member-b', false);
    fresh.trackGrading('grading_result_viewed', saved, { entry_source: 'new_grading' });
    expect(fresh.pending()).toHaveLength(0);
  });
});
describe('metric contract', () => {
  it('사용자·출처 위조와 비허용 개인정보 속성을 거절한다', () => {
    const e = fixture().client.pending()[0]; expect(validateEvent(e)).not.toBeNull();
    for (const addition of [{ user_id: 'victim' }, { source: 'server' }]) expect(validateEvent({ ...e, ...addition })).toBeNull();
    expect(validateEvent({ ...e, attributes: { email: 'private@example.test' } })).toBeNull();
    expect(validateEvent({ ...e, route: '/community/member-name?q=secret' })).toBeNull();
  });
  it('불가능한 날짜·미래·90일 초과를 거절하고 완료된 7일을 기본으로 한다', () => {
    const now = new Date('2026-10-03T01:00:00Z');
    expect(parseFilters(new URLSearchParams(), now)).toEqual({ start: '2026-09-26', end: '2026-10-02' });
    for (const s of ['start=2026-02-30&end=2026-03-01', 'start=2026-01-01&end=2026-10-03', 'start=2026-10-03&end=2026-10-04']) expect(parseFilters(new URLSearchParams(s), now)).toBeNull();
  });
  it('단순 모바일·fullscreen을 PWA로 간주하지 않고 Apple standalone은 별도로 판별한다', () => {
    const win = (mode: string) => ({ matchMedia: (q: string) => ({ matches: q === `(display-mode: ${mode})` }) }) as Window;
    const nav = { userAgent: 'iPhone Mobile', maxTouchPoints: 5 } as Navigator;
    expect(detectEnvironment(win('browser'), nav).execution_channel).toBe('browser');
    expect(detectEnvironment(win('fullscreen'), nav).execution_channel).toBe('other');
    expect(detectEnvironment(win('fullscreen'), nav, 'browser').execution_channel).toBe('browser');
    expect(detectEnvironment(win('unknown'), { ...nav, standalone: true } as Navigator).execution_channel).toBe('pwa');
    expect(detectEnvironment(win('unknown'), nav).execution_channel).toBe('unknown');
  });
});
