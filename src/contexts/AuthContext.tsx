import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient, User, Session } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface AuthContextType {
  currentUser: User | null;
  signup: (email: string, password: string, name: string, birthDate: string, university: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

// Supabase client 초기화
const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function signup(email: string, password: string, name: string, birthDate: string, university: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
          birth_date: birthDate,
          university: university,
        }
      }
    });

    if (error) {
      throw error;
    }

    // 자동 확인 설정이 되어 있지 않으면 이메일 확인 필요
    if (data.user && !data.user.confirmed_at) {
      alert('회원가입이 완료되었습니다. 이메일을 확인해주세요.');
    }
  }

  async function login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // 이메일 미인증 에러 체크
      if (error.message?.includes('Email not confirmed')) {
        throw new Error('이메일 인증이 필요합니다. 메일함을 확인해주세요.');
      }
      throw error;
    }

    // 이메일 인증 상태 확인
    if (data.user && !data.user.email_confirmed_at) {
      await supabase.auth.signOut();
      throw new Error('이메일 인증이 필요합니다. 메일함을 확인해주세요.');
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }

  useEffect(() => {
    // 현재 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
      setLoading(false);
    });

    // 인증 상태 변경 리스너
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = {
    currentUser,
    signup,
    login,
    logout,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export { supabase };