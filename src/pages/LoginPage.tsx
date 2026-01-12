import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Calendar, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { calculateDday, getDdayText } from '../utils/dday';
import { supabase } from '../contexts/AuthContext';

export function LoginPage() {
  const [emailId, setEmailId] = useState('');
  const [emailDomain, setEmailDomain] = useState('@naver.com');
  const [customDomain, setCustomDomain] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const { dday, examDate } = calculateDday();
  const ddayText = getDdayText();

  const emailDomains = [
    '@naver.com',
    '@gmail.com',
    '@daum.net',
    '@kakao.com',
    '@hanmail.net',
    'custom'
  ];

  const getFullEmail = () => {
    if (emailDomain === 'custom') {
      return `${emailId}@${customDomain}`;
    }
    return `${emailId}${emailDomain}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fullEmail = getFullEmail();

    if (!emailId.trim()) {
      return setError('이메일 아이디를 입력해주세요.');
    }

    if (emailDomain === 'custom' && !customDomain.trim()) {
      return setError('이메일 도메인을 입력해주세요.');
    }

    try {
      setError('');
      setResendSuccess(false);
      setLoading(true);
      await login(fullEmail, password);
      navigate('/');
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('이메일 인증')) {
        setError(err.message);
      } else if (err.message?.includes('Invalid login credentials')) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else if (err.message?.includes('Email not confirmed')) {
        setError('이메일 인증이 필요합니다. 메일함을 확인해주세요.');
      } else {
        setError(err.message || '로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    const fullEmail = getFullEmail();

    if (!emailId.trim()) {
      setError('이메일 아이디를 입력해주세요.');
      return;
    }

    if (emailDomain === 'custom' && !customDomain.trim()) {
      setError('이메일 도메인을 입력해주세요.');
      return;
    }

    try {
      setError('');
      setResendSuccess(false);
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: fullEmail,
      });

      if (error) {
        throw error;
      }

      setResendSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError('인증 메일 재전송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">리트 채점은 all LEET</h1>
            <div className="flex items-center justify-center gap-2">
              <Calendar className="w-4 h-4 text-red-600" />
              <p className="text-sm font-semibold text-red-600">
                {examDate} (예상)시험일 {ddayText}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                이메일
              </label>
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={emailId}
                    onChange={(e) => setEmailId(e.target.value)}
                    className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="your"
                    required
                  />
                  <span className="text-gray-500 text-sm">@</span>
                </div>
                <select
                  value={emailDomain}
                  onChange={(e) => setEmailDomain(e.target.value)}
                  className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:min-w-[140px]"
                >
                  {emailDomains.map((domain) => (
                    <option key={domain} value={domain}>
                      {domain === 'custom' ? '직접입력' : domain.replace('@', '')}
                    </option>
                  ))}
                </select>
              </div>
              {emailDomain === 'custom' && (
                <input
                  type="text"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  className="w-full mt-2 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="domain.com"
                  required
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              계정이 없으신가요?{' '}
              <button
                onClick={() => navigate('/signup')}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                회원가입
              </button>
            </p>
            <p className="text-sm text-gray-600 mt-2">
              <button
                onClick={() => navigate('/forgot-password')}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                비밀번호를 잊으셨나요?
              </button>
            </p>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800 font-semibold mb-1">💡 개인 정보는 안전하게 보관됩니다!</p>
            <p className="text-xs text-blue-700">
              비밀번호는 운영진도 알 수 없어요! Supabase에 안전하게 저장됩니다.
            </p>
          </div>

          {resendSuccess && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs text-green-800 font-semibold mb-1">✉️ 인증 메일 재전송 성공</p>
              <p className="text-xs text-green-700">
                메일함을 확인해주세요. 인증 메일이 도착했는지 확인하세요.
              </p>
            </div>
          )}

          <div className="mt-4 text-center">
            <button
              onClick={handleResendEmail}
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              인증 메일 재전송
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}