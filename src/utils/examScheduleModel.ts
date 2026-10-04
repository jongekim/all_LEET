import type { ExamSchedule, ExamScheduleForm } from '../types/examSchedule';
import { templateError } from './ddayTemplate';

const DAY_MS = 86400000;
const KST_MS = 9 * 3600000;

export function isExamDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || value < '2000-01-01' || value > '2099-12-31') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function kstDate(now: Date): string {
  return new Date(now.getTime() + KST_MS).toISOString().slice(0, 10);
}

export function nextKstMidnight(now: Date): number {
  return Date.parse(`${kstDate(now)}T00:00:00+09:00`) + DAY_MS;
}

export function calculateConfiguredDday(examDate: string, now = new Date()) {
  if (!isExamDate(examDate)) throw new Error('시험일은 2000~2099년의 올바른 날짜여야 합니다.');
  const dday = (Date.parse(`${examDate}T00:00:00Z`) - Date.parse(`${kstDate(now)}T00:00:00Z`)) / DAY_MS;
  return {
    examDate: examDate.replace(/-/gu, '.'),
    dday,
    ddayText: dday > 0 ? `D-${dday}` : dday === 0 ? 'D-Day' : `D+${Math.abs(dday)}`,
  };
}

export function scheduleFormError(form: ExamScheduleForm): string | null {
  if (!isExamDate(form.exam_date)) return '시험일은 2000~2099년의 올바른 날짜로 입력해주세요.';
  return templateError(form.display_template);
}

export function normalizeScheduleForm(form: ExamScheduleForm): ExamScheduleForm {
  const error = scheduleFormError(form);
  if (error) throw new Error(error);
  return { exam_date: form.exam_date, display_template: form.display_template.trim() };
}

export function parseExamSchedule(value: unknown): ExamSchedule {
  if (!value || typeof value !== 'object') throw new Error('디데이 설정이 없습니다.');
  const row = value as Record<string, unknown>;
  if (row.key !== 'leet' || typeof row.exam_date !== 'string' || typeof row.display_template !== 'string'
    || scheduleFormError({ exam_date: row.exam_date, display_template: row.display_template })
    || row.display_template !== row.display_template.trim()
    || typeof row.revision !== 'number' || !Number.isInteger(row.revision) || row.revision < 1 || row.revision > 2147483647
    || typeof row.updated_at !== 'string' || !Number.isFinite(Date.parse(row.updated_at))) {
    throw new Error('디데이 설정 응답이 올바르지 않습니다.');
  }
  return { key: 'leet', exam_date: row.exam_date, display_template: row.display_template, revision: row.revision, updated_at: row.updated_at };
}

export function sameScheduleForm(a: ExamScheduleForm, b: ExamScheduleForm): boolean {
  return a.exam_date === b.exam_date && a.display_template === b.display_template;
}
