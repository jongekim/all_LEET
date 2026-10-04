import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { projectId } from '../utils/supabase/info';
import { examScheduleApi } from '../utils/examScheduleApi';
import { ExamScheduleStore } from '../utils/examScheduleStore';
import { ExamScheduleContext } from './examScheduleContextValue';

export function ExamScheduleProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new ExamScheduleStore(examScheduleApi.read, `all-leet:${projectId}:exam-schedule:v1`));
  const { pathname } = useLocation();
  const active = ['/', '/login', '/signup'].includes(pathname);

  useEffect(() => {
    if (!active) return;
    store.restore();
    const refresh = () => { if (document.visibilityState !== 'hidden') void store.refresh(); };
    const storage = (event: StorageEvent) => { if (event.key === store.cacheKey || event.key === null) refresh(); };
    refresh();
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', refresh);
      store.cancel();
    };
  }, [active, pathname, store]);

  return <ExamScheduleContext.Provider value={store}>{children}</ExamScheduleContext.Provider>;
}
