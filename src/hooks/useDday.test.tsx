import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DdayText } from '../components/DdayText';
import { ExamScheduleContext } from '../contexts/examScheduleContextValue';
import { ExamScheduleStore } from '../utils/examScheduleStore';

afterEach(()=>{ cleanup();vi.useRealTimers(); });
it('KST 자정을 넘기면 열린 화면의 표시를 갱신한다',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-07-18T14:59:59Z'));
  const store=new ExamScheduleStore(async()=>{throw new Error('unused');},'dday-hook-test');
  store.publish({key:'leet',exam_date:'2026-07-19',display_template:'시험까지 {dday}',revision:1,updated_at:'2026-07-01T00:00:00Z'});
  render(<ExamScheduleContext.Provider value={store}><DdayText/></ExamScheduleContext.Provider>);
  expect(screen.getByText('시험까지 D-1')).toBeVisible();
  act(()=>vi.advanceTimersByTime(1000));expect(screen.getByText('시험까지 D-Day')).toBeVisible();
  act(()=>{vi.setSystemTime(new Date('2026-07-19T15:00:00Z'));window.dispatchEvent(new Event('focus'));});
  expect(screen.getByText('시험까지 D+1')).toBeVisible();
});
it('일정이 없는 서버 렌더링 상태와 HTML처럼 생긴 문구를 텍스트로 표시한다',()=>{
  const store=new ExamScheduleStore(async()=>{throw new Error('unused');},'dday-hook-test');
  const view=render(<ExamScheduleContext.Provider value={store}><DdayText/></ExamScheduleContext.Provider>);
  expect(screen.getByText('불러오는 중…')).toBeVisible();
  act(()=>store.publish({key:'leet',exam_date:'2026-07-19',display_template:'<img src=x onerror=alert(1)> {dday}',revision:1,updated_at:'2026-07-01T00:00:00Z'}));
  expect(view.container.querySelector('img')).toBeNull();expect(view.container.textContent).toContain('<img src=x onerror=alert(1)>');
});
