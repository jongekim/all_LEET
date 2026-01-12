import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Mail, ArrowLeft } from 'lucide-react';
import { supabase } from '../contexts/AuthContext';

export function ForgotPasswordPage() {
  const [emailId, setEmailId] = useState('');
  const [emailDomain, setEmailDomain] = useState('@naver.com');
  const [customDomain, setCustomDomain] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

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
      setLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(fullEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError('비밀번호 재설정 이메일 전송에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    const displayEmail = getFullEmail();
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-full mb-4">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">이메일을 확인해주세요</h1>
              <p className="text-gray-600">
                {displayEmail}
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 font-semibold mb-2">📧 비밀번호 재설정 이메일 ���</p>
                <p className="text-sm text-blue-700">
                  비밀번호 재설정 링크를 이메일로 발송했습니다.<br />
                  이메일의 링크를 클릭하여 새 비밀번호를 설정하세요.
                </p>
              </div>

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-semibold mb-2">⚠️ 참고사항</p>
                <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                  <li>스팸 메일함도 확인해주세요</li>
                  <li>이메일이 도착하기까지 1-2분 소요될 수 있습니다</li>
                  <li>링크는 1시간 동안 유효합니다</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => navigate('/login')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              로그인 페이지로 이동
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">리트 채점은 all LEET</h1>
            <p className="text-gray-600">
              가입한 이메일 주소를 입력하세요
            </p>
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? '전송 중...' : '비밀번호 재설정 이메일 받기'}
            </button>
          </form>

          <div className="mt-6">
            <button
              onClick={() => navigate('/login')}
              className="flex items-center justify-center gap-2 w-full text-gray-600 hover:text-gray-800 font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              로그인으로 돌아가기
            </button>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800 font-semibold mb-1">💡 안내</p>
            <p className="text-xs text-blue-700">
              가입한 이메일로 비밀번호 재설정 링크를 보내드립니다.<br />
              이메일에서 링크를 클릭하여 새 비밀번호를 설정하세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}