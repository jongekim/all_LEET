import { useLocation, useNavigate } from 'react-router-dom';
import { History, BookOpen, Brain, MessagesSquare, MessageCircle } from 'lucide-react';
import type { ComponentType } from 'react';

type NavItem = {
  key: string;
  label: string;
  path: string;
  center?: boolean;
  icon: ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { key: 'history', label: '성적분석', path: '/history', icon: History },
  { key: 'mock', label: '사설 입력', path: '/mock-input', icon: BookOpen },
  { key: 'grading', label: '채점하기', path: '/', center: true, icon: Brain },
  { key: 'community', label: '커뮤니티', path: '/community', icon: MessagesSquare },
  { key: 'chat', label: '채팅', path: '/chat', icon: MessageCircle },
];

const isActivePath = (pathname: string, path: string) => {
  if (path === '/') {
    return pathname === '/' || pathname.startsWith('/result');
  }

  if (path === '/community') {
    return pathname === '/community' || pathname.startsWith('/community/');
  }

  return pathname === path;
};

export function GlobalBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 60,
        padding: '8px 12px calc(env(safe-area-inset-bottom, 0px) + 10px)',
        pointerEvents: 'none',
      }}
    >
      <div className="max-w-4xl mx-auto" style={{ pointerEvents: 'auto' }}>
        <nav
          aria-label="주요 페이지 이동"
          className="border border-gray-200 shadow-lg"
          style={{
            borderRadius: 18,
            backgroundColor: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <ul className="flex items-end justify-between px-2 py-2">
            {NAV_ITEMS.map((item) => {
              const isActive = isActivePath(location.pathname, item.path);
              const Icon = item.icon;

              if (item.center) {
                return (
                  <li key={item.key} className="flex-1 flex justify-center">
                    <button
                      type="button"
                      onClick={() => navigate(item.path)}
                      aria-current={isActive ? 'page' : undefined}
                      className="flex flex-col items-center justify-center gap-1 text-xs font-semibold"
                      style={{
                        color: isActive ? '#1d4ed8' : '#334155',
                        minWidth: 74,
                      }}
                    >
                      <span
                        className="inline-flex items-center justify-center shadow"
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 999,
                          background: isActive
                            ? 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)'
                            : 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)',
                          color: '#fff',
                        }}
                      >
                        <Icon className="w-5 h-5" />
                      </span>
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              }

              return (
                <li key={item.key} className="flex-1">
                  <button
                    type="button"
                    onClick={() => navigate(item.path)}
                    aria-current={isActive ? 'page' : undefined}
                    className="w-full flex flex-col items-center justify-center gap-1 py-1 text-xs font-medium"
                    style={{ color: isActive ? '#1d4ed8' : '#64748b' }}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
