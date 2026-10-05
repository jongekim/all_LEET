type NavigationGuard = (event: PopStateEvent) => void;

let activeGuard: NavigationGuard | undefined;

// Install before BrowserRouter subscribes: native window popstate listeners can
// run in registration order even when the later listener uses capture.
export function installUnsavedDdayNavigationGuard(target: Window) {
  const listener = (event: PopStateEvent) => activeGuard?.(event);
  target.addEventListener('popstate', listener);
  return () => target.removeEventListener('popstate', listener);
}

export function registerUnsavedDdayNavigationGuard(guard: NavigationGuard) {
  activeGuard = guard;
  return () => { if (activeGuard === guard) activeGuard = undefined; };
}
