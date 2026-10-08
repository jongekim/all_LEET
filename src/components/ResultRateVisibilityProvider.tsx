import { useEffect, useState, type ReactNode } from 'react';
import { ResultRateVisibilityContext } from '../contexts/ResultRateVisibilityContext';

const storageKey = 'allleet:result:question-rate-visible:v1';

export function ResultRateVisibilityProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem(storageKey) === 'true'; } catch { return false; }
  });

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) setVisible(event.newValue === 'true');
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const toggle = () => {
    const next = !visible;
    setVisible(next);
    try { localStorage.setItem(storageKey, String(next)); } catch { /* Keep the choice for this screen when storage is blocked. */ }
  };

  return <ResultRateVisibilityContext.Provider value={{ visible, toggle }}>{children}</ResultRateVisibilityContext.Provider>;
}
