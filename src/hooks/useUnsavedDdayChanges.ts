import { useLayoutEffect } from 'react';
import { registerUnsavedDdayNavigationGuard } from '../utils/unsavedDdayNavigation';

// BrowserRouter entries contain an idx; reject a browser back/forward before its
// popstate reaches the router, then restore the entry without unmounting the form.
export function useUnsavedDdayChanges(dirty: boolean) {
  useLayoutEffect(() => {
    if (!dirty) return;
    const initialIndex: unknown = window.history.state?.idx;
    let restoring = false;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const pop = (event: PopStateEvent) => {
      if (restoring) {
        event.stopImmediatePropagation();
        restoring = false;
        return;
      }
      const nextIndex: unknown = event.state?.idx;
      if (typeof initialIndex !== 'number' || typeof nextIndex !== 'number' || initialIndex === nextIndex) return;
      if (window.confirm('저장하지 않은 변경사항을 버리고 이동할까요?')) return;
      event.stopImmediatePropagation();
      restoring = true;
      window.history.go(initialIndex - nextIndex);
    };
    const unregister = registerUnsavedDdayNavigationGuard(pop);
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      unregister();
    };
  }, [dirty]);
}
