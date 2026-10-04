import { useEffect, useState } from 'react';
import { nextKstMidnight } from '../utils/examScheduleModel';

export function useKstNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      const current = new Date();
      setNow(current);
      timer = setTimeout(update, Math.max(1, nextKstMidnight(current) - current.getTime()));
    };
    timer = setTimeout(update, Math.max(1, nextKstMidnight(now) - now.getTime()));
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [now]);
  return now;
}
