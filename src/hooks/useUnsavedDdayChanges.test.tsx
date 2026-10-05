import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useUnsavedDdayChanges } from './useUnsavedDdayChanges';
import { installUnsavedDdayNavigationGuard } from '../utils/unsavedDdayNavigation';

let removeGuard: () => void;
const router = vi.fn();

beforeEach(() => {
  window.history.replaceState({ idx: 3 }, '');
  removeGuard = installUnsavedDdayNavigationGuard(window);
  window.addEventListener('popstate', router);
  vi.spyOn(window.history, 'go').mockImplementation(() => {});
  vi.spyOn(window, 'confirm').mockReturnValue(false);
});
afterEach(() => {
  cleanup();
  removeGuard();
  window.removeEventListener('popstate', router);
  vi.restoreAllMocks();
  router.mockClear();
});

function pop(idx: number | undefined) {
  window.history.replaceState({ idx }, '');
  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
}

it.each([1, 5])('취소와 이력 복구는 라우터에 전달하지 않는다 (이동 위치 %i)', idx => {
  renderHook(() => useUnsavedDdayChanges(true));
  pop(idx);
  expect(window.confirm).toHaveBeenCalledTimes(1);
  expect(window.history.go).toHaveBeenCalledWith(3 - idx);
  expect(router).not.toHaveBeenCalled();
  pop(3);
  expect(router).not.toHaveBeenCalled();
  // Restoration must not leave the next user navigation silently unguarded.
  vi.mocked(window.confirm).mockReturnValue(true);
  pop(idx);
  expect(window.confirm).toHaveBeenCalledTimes(2);
  expect(router).toHaveBeenCalledTimes(1);
});

it('변경이 없거나 폼이 제거되면 경고 없이 이동한다', () => {
  const hook = renderHook(({ dirty }) => useUnsavedDdayChanges(dirty), { initialProps: { dirty: true } });
  hook.rerender({ dirty: false });
  pop(2);
  expect(window.confirm).not.toHaveBeenCalled();
  expect(router).toHaveBeenCalledTimes(1);
  hook.rerender({ dirty: true });
  hook.unmount();
  pop(1);
  expect(window.confirm).not.toHaveBeenCalled();
  expect(router).toHaveBeenCalledTimes(2);
});

it('인덱스 없는 이력과 같은 위치의 이벤트는 복구 이동을 만들지 않는다', () => {
  renderHook(() => useUnsavedDdayChanges(true));
  pop(3);
  pop(undefined);
  expect(window.confirm).not.toHaveBeenCalled();
  expect(window.history.go).not.toHaveBeenCalled();
  expect(router).toHaveBeenCalledTimes(2);
});

it('새로고침 경고는 미저장 상태에만 제공한다', () => {
  const hook = renderHook(({ dirty }) => useUnsavedDdayChanges(dirty), { initialProps: { dirty: true } });
  const dirtyEvent = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(dirtyEvent);
  expect(dirtyEvent.defaultPrevented).toBe(true);
  hook.rerender({ dirty: false });
  const cleanEvent = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(cleanEvent);
  expect(cleanEvent.defaultPrevented).toBe(false);
});
