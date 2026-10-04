import { expect, it, vi } from 'vitest';
import { AdminAnalyticsError, AnalyticsAuthorizationScope, canKeepPreviousAnalytics } from './adminAnalyticsErrors';
it('한 영역의 권한 거절은 전 요청 취소·세대 상승·늦은 성공 차단·재조회 차단',()=>{
  const scope=new AnalyticsAuthorizationScope('admin'),a=scope.begin('admin'),b=scope.begin('admin'),listener=vi.fn();scope.subscribe(listener);
  const error=new AdminAnalyticsError('ADMIN_REQUIRED',403,false,'권한 없음');scope.reject(error,a.generation);
  expect(a.controller.signal.aborted).toBe(true);expect(b.controller.signal.aborted).toBe(true);expect(listener).toHaveBeenCalledOnce();expect(()=>scope.assertCurrent(b.generation)).toThrow(error);expect(()=>scope.begin('admin')).toThrow(error);
});
it('폐기된 세대의 거절과 다른 계정의 거절은 새 계정 조회를 훼손하지 않는다',()=>{
  const old=new AnalyticsAuthorizationScope('old'),request=old.begin('old');old.dispose();old.reject(new AdminAnalyticsError('ADMIN_REQUIRED',403,false,'거절'),request.generation);expect(old.error).toBeNull();
  const current=new AnalyticsAuthorizationScope('new');expect(()=>current.begin('old')).toThrow('계정이 변경');expect(current.error).toBeNull();expect(current.begin('new').controller.signal.aborted).toBe(false);
});
it('일시적 typed 오류만 이전 자료 보존, 일반 오류·권한 거절·취소는 보존하지 않는다',()=>{
  expect(canKeepPreviousAnalytics(new AdminAnalyticsError('UNAVAILABLE',503,true,'일시 실패'))).toBe(true);expect(canKeepPreviousAnalytics(new Error('network'))).toBe(false);expect(canKeepPreviousAnalytics(new AdminAnalyticsError('DENIED',403,true,'거절'))).toBe(false);
});
