import { useEffect } from 'react';

// BrowserRouter entries contain an idx; reject a browser back/forward before its
// popstate reaches the router, then restore the entry without unmounting the form.
export function useUnsavedDdayChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const initialIndex: unknown = window.history.state?.idx;
    let restoring = false;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const pop = (event: PopStateEvent) => {
      if (restoring) { restoring = false; return; }
      const nextIndex: unknown = event.state?.idx;
      if (typeof initialIndex !== 'number' || typeof nextIndex !== 'number' || initialIndex === nextIndex) return;
      if (window.confirm('저장하지 않은 변경사항을 버리고 이동할까요?')) return;
      event.stopImmediatePropagation();
      restoring = true;
      window.history.go(initialIndex - nextIndex);
    };
    window.addEventListener('beforeunload', warn);
    window.addEventListener('popstate', pop, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('popstate', pop, true);
    };
  }, [dirty]);
}
