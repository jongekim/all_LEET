import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateDday, getDdayText } from './dday';

describe('D-day 계산', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('시험일에는 D-Day를 반환한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T12:00:00+09:00'));

    expect(calculateDday()).toEqual({ dday: 0, examDate: '2026.07.19' });
    expect(getDdayText()).toBe('D-Day');
  });

  it('시험일 전후의 표시를 계산한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T12:00:00+09:00'));
    expect(getDdayText()).toBe('D-1');

    vi.setSystemTime(new Date('2026-07-20T12:00:00+09:00'));
    expect(getDdayText()).toBe('D+1');
  });
});
