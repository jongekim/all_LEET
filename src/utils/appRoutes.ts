// React Router와 배포 직접 진입을 함께 검증하는 등록 경로 목록.
export const APP_STATIC_PATHS = [
  '/', '/login', '/signup', '/forgot-password', '/reset-password',
  '/privacy-policy', '/terms', '/admin', '/admin/push', '/admin/user-data',
  '/admin/analytics', '/admin/dday', '/admin/announcements', '/community',
  '/past-exams', '/past-exams/data-guide', '/chat', '/result', '/history', '/admission',
  '/admission-result', '/mock-input', '/mock-history',
] as const;

export const NOINDEX_PATHS = [
  '/login', '/signup', '/forgot-password', '/reset-password', '/chat',
  '/result', '/admission', '/admission-result', '/mock-input',
] as const;

export function isAppPath(path: string) {
  return (APP_STATIC_PATHS as readonly string[]).includes(path) || /^\/community\/[^/]+$/.test(path);
}

export function shouldNoindex(path: string) {
  return path === '/admin' || path.startsWith('/admin/')
    || (NOINDEX_PATHS as readonly string[]).includes(path) || !isAppPath(path);
}
