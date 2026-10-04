import { useDday } from '../hooks/useDday';

export function DdayText() {
  const { schedule, displayText, error } = useDday();
  return <span data-dday-display="true" style={{ overflowWrap: 'anywhere' }} aria-live="polite">
    {displayText}{schedule && error ? ' · 마지막 확인한 설정 기준' : ''}
  </span>;
}
