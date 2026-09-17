import { useLocation, useNavigate } from 'react-router-dom';
import { History, BookOpen, Brain, MessagesSquare, MessageCircle, Files, GraduationCap } from 'lucide-react';
import type { ComponentType } from 'react';
import '../styles/navigation.css';

type NavItem = {
  key: string;
  label: string;
  path: string;
  center?: boolean;
  icon: ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { key: 'history', label: '성적분석', path: '/history', icon: History },
  { key: 'past-exams', label: '기출문제', path: '/past-exams', icon: Files },
  { key: 'mock', label: '사설입력', path: '/mock-input', icon: BookOpen },
  { key: 'grading', label: '채점하기', path: '/', center: true, icon: Brain },
  { key: 'admission', label: '합격예측', path: '/admission', icon: GraduationCap },
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

  if (path === '/admission') return pathname === path || pathname === '/admission-result';
  if (path === '/history') return pathname === path || pathname === '/mock-history';

  return pathname === path;
};

export function GlobalBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div
      className="bottom-nav-container"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 60,
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
          <ul className="bottom-nav-items">
            {NAV_ITEMS.map((item) => {
              const isActive = isActivePath(location.pathname, item.path);
              const Icon = item.icon;

              if (item.center) {
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => navigate(item.path)}
                      aria-current={isActive ? 'page' : undefined}
                      className="bottom-nav-button bottom-nav-center"
                      style={{
                        color: isActive ? '#1d4ed8' : '#334155',
                      }}
                    >
                      <span
                        className="bottom-nav-center-icon inline-flex items-center justify-center shadow"
                        style={{
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
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => navigate(item.path)}
                    aria-current={isActive ? 'page' : undefined}
                    className="bottom-nav-button"
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
