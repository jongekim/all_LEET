import { useExamSchedule } from './useExamSchedule';
import { useKstNow } from './useKstNow';
import { calculateConfiguredDday } from '../utils/examScheduleModel';
import { renderDdayTemplate } from '../utils/ddayTemplate';

export function useDday() {
  const state = useExamSchedule();
  const now = useKstNow();
  const value = state.schedule ? calculateConfiguredDday(state.schedule.exam_date, now) : null;
  const displayText = value && state.schedule
    ? renderDdayTemplate(state.schedule.display_template, value.examDate, value.ddayText)
    : state.error || '불러오는 중…';
  return { ...state, ...value, displayText };
}
