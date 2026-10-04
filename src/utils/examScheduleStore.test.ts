import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExamScheduleStore } from './examScheduleStore';
import type { ExamSchedule } from '../types/examSchedule';

const row = (revision=1): ExamSchedule => ({ key:'leet',exam_date:'2026-07-19',display_template:'{date} {dday}',revision,updated_at:'2026-10-04T00:00:00Z' });
beforeEach(() => {
  const values = new Map<string,string>();
  vi.stubGlobal('localStorage', { getItem:(key:string)=>values.get(key)??null, setItem:(key:string,value:string)=>{ values.set(key,value); }, clear:()=>values.clear() });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('디데이 공통 캐시', () => {
  it('요청을 합치고 저장 전의 늦은 조회가 저장 결과를 덮지 못하게 한다', async () => {
    let complete!: (value:ExamSchedule) => void;
    const read=vi.fn(() => new Promise<ExamSchedule>(resolve => { complete=resolve; }));
    const store=new ExamScheduleStore(read,'test');
    const first=store.refresh();
    expect(store.refresh()).toBe(first);
    store.publish({...row(2),display_template:'새 문구 {dday}'});
    complete(row()); await first;
    expect(read).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().schedule?.display_template).toBe('새 문구 {dday}');
    expect(store.publish(row())).toBe(false);
  });
  it('캐시의 높은 버전보다 최초 서버 응답을 우선한다', async () => {
    window.localStorage.setItem('test',JSON.stringify({version:1,schedule:row(999),fetched_at:1}));
    const store=new ExamScheduleStore(async () => row(),'test');
    store.restore(); expect(store.getSnapshot().schedule?.revision).toBe(999);
    await store.refresh(); expect(store.getSnapshot().schedule?.revision).toBe(1);
  });
  it('손상 캐시와 저장소 장애를 무시하고 조회 실패에는 마지막 설정을 유지한다', async () => {
    vi.spyOn(console,'error').mockImplementation(() => {});
    window.localStorage.setItem('test','broken');
    const read=vi.fn().mockResolvedValueOnce(row()).mockRejectedValueOnce(new Error('offline'));
    const store=new ExamScheduleStore(read,'test');
    store.restore(); expect(store.getSnapshot().schedule).toBeNull();
    vi.spyOn(window.localStorage,'setItem').mockImplementation(() => { throw new Error('blocked'); });
    await store.refresh(); await store.refresh();
    expect(store.getSnapshot().schedule).toEqual(row());
    expect(store.getSnapshot().error).toBeTruthy();
    expect(store.getSnapshot().loading).toBe(false);
  });
  it('화면을 떠난 뒤 도착한 응답을 무시한다', async () => {
    let complete!: (value:ExamSchedule) => void;
    const store=new ExamScheduleStore(() => new Promise(resolve => { complete=resolve; }),'test');
    const pending=store.refresh(); store.cancel(); complete(row()); await pending;
    expect(store.getSnapshot().schedule).toBeNull();
  });
});
