import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { serviceActivityClient } from '../utils/serviceActivity';

// Headless and independent of administrator/test-account analytics exclusions.
export function useServiceActivity() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const client = useMemo(() => serviceActivityClient(), []);
  useLayoutEffect(() => {
    client.configure(currentUser?.id || null);
    client.activity();
  }, [client, currentUser?.id, location.key]);
  useEffect(() => {
    const activity = (event: Event) => {
      if (event.isTrusted && (event.type !== 'focus' || event.target === window)) client.activity();
    };
    const visibility = () => {
      if (document.visibilityState === 'visible') client.activity(); else client.pause();
    };
    const actions = ['pointerdown', 'keydown', 'input', 'scroll', 'focus', 'pageshow'];
    actions.forEach(name => window.addEventListener(name, activity, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', client.pause);
    return () => {
      actions.forEach(name => window.removeEventListener(name, activity, true));
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', client.pause);
      client.dispose();
    };
  }, [client]);
}
