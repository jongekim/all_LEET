import { addDays, kstDay } from '../../supabase/functions/_shared/dashboard';
import type { AnalyticsFilters } from '../types/analytics';
/** Detailed events retain a 90-day boundary even when the dashboard covers a year. */
export function detailPeriod(input: Pick<AnalyticsFilters, 'start' | 'end' | 'channel'>, now = new Date()) {
  const oldest = addDays(kstDay(now), -90);
  const start = [input.start, oldest, addDays(input.end, -89)].sort().pop()!;
  if (start > input.end) return null;
  return { filters: { ...input, start }, clipped: start !== input.start };
}
