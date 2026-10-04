import { useContext, useSyncExternalStore } from 'react';
import { ExamScheduleContext } from '../contexts/examScheduleContextValue';

export function useExamScheduleStore() {
  const store = useContext(ExamScheduleContext);
  if (!store) throw new Error('ExamScheduleProvider가 필요합니다.');
  return store;
}

export function useExamSchedule() {
  const store = useExamScheduleStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
