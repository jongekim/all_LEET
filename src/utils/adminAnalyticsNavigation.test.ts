import { expect, it } from 'vitest';
import { detailPeriod } from './adminAnalyticsNavigation';
const now=new Date('2026-10-04T02:00:00Z');
it('장기 대시보드에서 상세로 이동할 때 최근 90일과 교집합, 채널 유지',()=>{
  const result=detailPeriod({start:'2025-10-04',end:'2026-10-03',channel:'pwa'},now)!;
  expect(result.filters).toEqual({start:'2026-07-06',end:'2026-10-03',channel:'pwa'});expect(result.clipped).toBe(true);
});
it('짧은 기간은 유지하고 최근 원본과 겹치지 않는 과거 기간은 조회하지 않는다',()=>{
  expect(detailPeriod({start:'2026-09-27',end:'2026-10-03'},now)?.clipped).toBe(false);
  expect(detailPeriod({start:'2025-01-01',end:'2025-01-31'},now)).toBeNull();
});
