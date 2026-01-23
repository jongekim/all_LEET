import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { HomePage } from './pages/HomePage';
// NOTE: 채팅 기능 비활성화 중 (배포 시 아래 주석 제거)
// import { ChatPage } from './pages/ChatPage';
import { ResultPage } from './pages/ResultPage';
import { HistoryPage } from './pages/HistoryPage';
import { AdmissionPage } from './pages/AdmissionPage';
import { AdmissionResultPage } from './pages/AdmissionResultPage';
import { MockExamInputPage } from './pages/MockExamInputPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { PWAInstallButton } from './components/PWAInstallButton';
import { projectId, publicAnonKey } from './utils/supabase/info';
import { Analytics } from "@vercel/analytics/react"
import type { MockExamRecord } from './types/mockExam';

// --- 타입 정의 ---
export type Subject = 'verbal' | 'reasoning';
export type Year = string;
export type ExamType = 'odd' | 'even';

export interface User {
  email: string;
}

export interface GradingResult {
  year: string;
  subject: Subject;
  correct: number;
  total: number;
  standardScore: number;
  percentile: number;
  fieldAnalysis: { field: string; correct: number; total: number; questions: number[] }[];
  timestamp: number;
  groupTimestamp?: number;
  userAnswers?: Record<number, number>;
  correctAnswers?: Record<number, number>;
  round: number;
  examType: ExamType;
  adjustedScore?: number;
}

// --- 인증 보호 라우트 ---
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  return currentUser ? <>{children}</> : <Navigate to="/login" />;
}

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-cd835c22`;

function AppContent() {
  const { currentUser, logout } = useAuth();
  const [history, setHistory] = useState<GradingResult[]>([]);
  const [mockHistory, setMockHistory] = useState<MockExamRecord[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loading, setLoading] = useState(true);

  // ----------------------------------------------------------------
  // ✅ PWA 필수 설정 주입 (index.html이 없는 환경 대응)
  // ----------------------------------------------------------------
  useEffect(() => {
    // 1. Manifest 연결 (안드로이드 설치 필수)
    let manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement;
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = '/manifest.json';
      document.head.appendChild(manifestLink);
    }

    // 2. 테마 컬러 설정 (브라우저 상단바 색상)
    let themeMeta = document.querySelector("meta[name='theme-color']") as HTMLMetaElement;
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.name = 'theme-color';
      themeMeta.content = '#2563eb';
      document.head.appendChild(themeMeta);
    }

    // 3. 뷰포트 설정 (모바일 확대/축소 방지 및 최적화)
    let viewportMeta = document.querySelector("meta[name='viewport']") as HTMLMetaElement;
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.name = 'viewport';
      viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      document.head.appendChild(viewportMeta);
    }

    // 4. 아이콘 설정 (iOS 및 즐겨찾기용)
    let iconLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
    if (!iconLink) {
      iconLink = document.createElement('link');
      iconLink.rel = 'apple-touch-icon';
      iconLink.href = '/icon.svg';
      document.head.appendChild(iconLink);
    }
    
    // 5. 기본 파비콘
    let faviconLink = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (!faviconLink) {
      faviconLink = document.createElement('link');
      faviconLink.rel = 'icon';
      faviconLink.type = 'image/svg+xml';
      faviconLink.href = '/icon.svg';
      document.head.appendChild(faviconLink);
    }

    // 6. 구조화데이터(WebSite) 설정
    const ldJsonId = 'ldjson-website';
    let ldJsonScript = document.getElementById(ldJsonId) as HTMLScriptElement | null;
    if (!ldJsonScript) {
      ldJsonScript = document.createElement('script');
      ldJsonScript.id = ldJsonId;
      ldJsonScript.type = 'application/ld+json';
      document.head.appendChild(ldJsonScript);
    }

    const canonicalOrigin = 'https://all-leet.vercel.app';
    ldJsonScript.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: '올리트',
      alternateName: ['all LEET', 'ALL LEET', '올리트 (ALL LEET)'],
      url: canonicalOrigin,
      inLanguage: 'ko-KR',
      sameAs: [canonicalOrigin + '/'],
    });

    // 7. 페이지 타이틀 설정
    document.title = '리트 채점은 all LEET';
  }, []);

  // ----------------------------------------------------------------
  // 데이터 로딩 및 핸들러
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!currentUser) {
      setHistory([]);
      setMockHistory([]);
      setLoading(false);
      return;
    }

    const loadHistory = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/history/${currentUser.id}`, {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to load history');
        }
        
        const data = await response.json();
        setHistory(data.data || []);
      } catch (error) {
        console.error('Failed to load history:', error);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    const loadMockHistory = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/mock-history/${currentUser.id}`, {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to load mock history');
        }

        const data = await response.json();
        setMockHistory(data.data || []);
      } catch (error) {
        console.error('Failed to load mock history:', error);
        setMockHistory([]);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
    loadMockHistory();
  }, [currentUser]);

  const handleAddToHistory = async (result: GradingResult) => {
    if (!currentUser) return;

    try {
      const response = await fetch(`${API_BASE_URL}/history/${currentUser.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(result)
      });

      if (!response.ok) {
        throw new Error('Failed to save history');
      }

      const data = await response.json();
      setHistory(prev => [...prev, data.data]);
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  };

  const handleClearHistory = async () => {
    if (!currentUser) return;
    
    if (window.confirm('모든 채점 기록을 삭제하시겠습니까?')) {
      try {
        const response = await fetch(`${API_BASE_URL}/history/${currentUser.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to clear history');
        }

        setHistory([]);
      } catch (error) {
        console.error('Failed to clear history:', error);
        alert('채점 기록 삭제에 실패했습니다. 다시 시도해주세요.');
      }
    }
  };

  const handleDeleteRecord = async (timestamps: number[]) => {
    if (!currentUser) return;

    const uniqueTimestamps = Array.from(new Set(timestamps));
    if (uniqueTimestamps.length === 0) return;
    
    if (window.confirm('이 채점 기록을 삭제하시겠습니까?')) {
      try {
        // 서버에서 삭제 (timestamp로 식별) - 그룹 내 모든 timestamp를 삭제
        for (const timestamp of uniqueTimestamps) {
          const response = await fetch(`${API_BASE_URL}/history/${currentUser.id}/${timestamp}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`
            }
          });

          if (!response.ok) {
            throw new Error('Failed to delete record from server');
          }
        }

        const toDelete = new Set(uniqueTimestamps);
        // 서버 삭제 성공 시 로컬 상태 업데이트
        setHistory(prev => prev.filter(record => !toDelete.has(record.timestamp)));
      } catch (error) {
        console.error('Failed to delete record:', error);
        alert('채점 기록 삭제에 실패했습니다. 다시 시도해주세요.');
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    setHistory([]);
    setMockHistory([]);
  };

  const handleAddMockRecord = async (record: Omit<MockExamRecord, 'id' | 'createdAt'>) => {
    if (!currentUser) return;

    try {
      const response = await fetch(`${API_BASE_URL}/mock-history/${currentUser.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(record)
      });

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new Error(`Failed to save mock history: ${response.status} ${response.statusText}${bodyText ? ` - ${bodyText}` : ''}`);
      }

      const data = await response.json();
      setMockHistory(prev => [...prev, data.data]);
    } catch (error) {
      console.error('Failed to save mock history:', error);
      throw error;
    }
  };

  const handleClearMockHistory = async () => {
    if (!currentUser) return;

    if (window.confirm('모든 사설 모의고사 기록을 삭제하시겠습니까?')) {
      try {
        const response = await fetch(`${API_BASE_URL}/mock-history/${currentUser.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to clear mock history');
        }

        setMockHistory([]);
      } catch (error) {
        console.error('Failed to clear mock history:', error);
        alert('사설 기록 삭제에 실패했습니다. 다시 시도해주세요.');
      }
    }
  };

  const handleDeleteMockRecord = async (ids: string[]) => {
    if (!currentUser) return;

    const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
    if (uniqueIds.length === 0) return;

    if (window.confirm('이 사설 기록을 삭제하시겠습니까?')) {
      try {
        for (const id of uniqueIds) {
          const response = await fetch(`${API_BASE_URL}/mock-history/${currentUser.id}/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`
            }
          });

          if (!response.ok) {
            throw new Error('Failed to delete mock record');
          }
        }

        const toDelete = new Set(uniqueIds);
        setMockHistory(prev => prev.filter(r => !toDelete.has(r.id)));
      } catch (error) {
        console.error('Failed to delete mock record:', error);
        alert('사설 기록 삭제에 실패했습니다. 다시 시도해주세요.');
      }
    }
  };

  const user: User = currentUser ? { email: currentUser.email || '' } : { email: '' };

  // ----------------------------------------------------------------
  // 라우팅 렌더링
  // ----------------------------------------------------------------
  return (
    <Routes>
      {/* 인증 불필요 페이지 */}
      <Route path="/login" element={currentUser ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/signup" element={currentUser ? <Navigate to="/" /> : <SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      
      {/* 메인 페이지 (로그인 상태에 따라 다르게 보일 수 있음) */}
      <Route
        path="/"
        element={<HomePage user={user} onLogout={handleLogout} onAddToHistory={handleAddToHistory} />}
      />

      {/* 채팅 기능 비활성화 중 (배포 시 아래 주석 제거) */}
      {/* <Route path="/chat" element={<ChatPage />} /> */}
      <Route path="/chat" element={<Navigate to="/" replace />} />
      <Route
        path="/result"
        element={<ResultPage />}
      />

      {/* 인증 필요 페이지 (PrivateRoute) */}
      <Route
        path="/history"
        element={
          <HistoryPage
            history={history}
            onClearHistory={handleClearHistory}
            onDeleteRecord={handleDeleteRecord}
            mockHistory={mockHistory}
            onClearMockHistory={handleClearMockHistory}
            onDeleteMockRecord={handleDeleteMockRecord}
          />
        }
      />
      <Route
        path="/admission"
        element={
          <PrivateRoute>
            <AdmissionPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/admission-result"
        element={
          <PrivateRoute>
            <AdmissionResultPage />
          </PrivateRoute>
        }
      />

      <Route
        path="/mock-input"
        element={
          <PrivateRoute>
            <MockExamInputPage existingRecords={mockHistory} onAddRecord={handleAddMockRecord} />
          </PrivateRoute>
        }
      />
      <Route
        path="/mock-history"
        element={<Navigate to="/history?tab=mock" replace />}
      />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
        {/* PWA 설치 버튼은 앱 전체에 띄웁니다 */}
        <PWAInstallButton />
        <Analytics />
      </AuthProvider>
    </Router>
  );
}