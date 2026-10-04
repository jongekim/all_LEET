import { calculateConfiguredDday } from './examScheduleModel';

export function calculateDday(examDate: string, now = new Date()): { dday: number; examDate: string } {
  const value = calculateConfiguredDday(examDate, now);
  return { dday: value.dday, examDate: value.examDate };
}

export function getDdayText(examDate: string, now = new Date()): string {
  return calculateConfiguredDday(examDate, now).ddayText;
}
