import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usageAnalytics } from '../utils/usageAnalytics';

// Headless: no changes to user-facing text, forms or navigation.
export function useUsageTracking() {
  const { currentUser, isAdmin, adminLoading, adminError } = useAuth();
  const location = useLocation();
  useLayoutEffect(() => {
    const client = usageAnalytics();
    client.configure(currentUser?.id || null, isAdmin || adminLoading || adminError);
    client.page(location.pathname, location.key);
  }, [currentUser?.id, isAdmin, adminLoading, adminError, location.pathname, location.key]);
  useEffect(() => {
    const client = usageAnalytics();
    const timer = setInterval(() => { void client.flush(); }, 5000);
    const action = () => client.activity();
    const key = (event: KeyboardEvent) => { if (!event.metaKey && !event.ctrlKey && (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement)) client.activity(); };
    const flush = () => { void client.flush(); };
    const prompt = () => client.track('install_prompt_available', 'install', {}, `${location.key}:prompt`, false);
    const installed = () => client.track('install_event_observed', 'install', {}, undefined, false);
    const channelChanged = () => client.track('execution_channel_changed', 'navigation', {}, undefined, false);
    const queries = ['standalone', 'window-controls-overlay', 'browser', 'fullscreen', 'minimal-ui'].map(mode => window.matchMedia(`(display-mode: ${mode})`));
    queries.forEach(query => query.addEventListener?.('change', channelChanged));
    window.addEventListener('pointerdown', action, { passive: true });
    window.addEventListener('keydown', key);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeinstallprompt', prompt);
    window.addEventListener('appinstalled', installed);
    return () => { clearInterval(timer); queries.forEach(query => query.removeEventListener?.('change', channelChanged)); window.removeEventListener('pointerdown', action); window.removeEventListener('keydown', key); window.removeEventListener('pagehide', flush); window.removeEventListener('beforeinstallprompt', prompt); window.removeEventListener('appinstalled', installed); };
  }, [location.key]);
}
