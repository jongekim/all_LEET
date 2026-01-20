import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Calendar, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { calculateDday, getDdayText } from '../utils/dday';

export function SignupPage() {
  const [emailId, setEmailId] = useState('');
  const [emailDomain, setEmailDomain] = useState('@naver.com');
  const [customDomain, setCustomDomain] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [universityPreset, setUniversityPreset] = useState('');
  const [universityCustom, setUniversityCustom] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signup } = useAuth();
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

  const universityOptions = [
    '서울대학교',
    '연세대학교',
    '고려대학교',
    '성균관대학교',
    '한양대학교',
    '서강대학교',
    '중앙대학교',
    '경희대학교',
    '한국외국어대학교',
    '서울시립대학교',
    '이화여자대학교',
    'KAIST',
    'POSTECH',
    '기타'
  ];

  const getFullEmail = () => {
    if (emailDomain === 'custom') {
      return `${emailId}@${customDomain}`;
    }
    return `${emailId}${emailDomain}`;
  };

  const getUniversityValue = () => {
    if (universityPreset === '기타') {
      return universityCustom.trim();
    }
    return universityPreset;
  };

  // 단계별 입력 노출
  const isEmailIdReady = emailId.trim().length > 0;
  const isEmailDomainReady = emailDomain !== 'custom' || customDomain.trim().length > 0;
  const canShowPassword = isEmailIdReady && isEmailDomainReady;
  const canShowConfirmPassword = canShowPassword && password.length > 0;
  const isPasswordConfirmed =
    password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const canShowName = canShowConfirmPassword && isPasswordConfirmed;
  const canShowBirthDate = canShowName && name.trim().length > 0;
  const canShowUniversity = canShowBirthDate && Boolean(birthDate);
  const isUniversityReady =
    universityPreset.length > 0 && (universityPreset !== '기타' || universityCustom.trim().length > 0);
  const canShowSubmit = canShowUniversity && isUniversityReady;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fullEmail = getFullEmail();
    const university = getUniversityValue();

    if (!emailId.trim()) {
      return setError('이메일 아이디를 입력해주세요.');
    }

    if (emailDomain === 'custom' && !customDomain.trim()) {
      return setError('이메일 도메인을 입력해주세요.');
    }

    if (password !== confirmPassword) {
      return setError('비밀번호가 일치하지 않습니다.');
    }

    if (password.length < 6) {
      return setError('비밀번호는 최소 6자 이상이어야 합니다.');
    }

    if (!name.trim()) {
      return setError('이름을 입력해주세요.');
    }

    if (!birthDate) {
      return setError('생년월일을 입력해주세요.');
    }

    if (!universityPreset) {
      return setError('대학교를 선택해주세요.');
    }

    if (universityPreset === '기타' && !university) {
      return setError('대학교명을 입력해주세요.');
    }

    try {
      setError('');
      setLoading(true);
      await signup(fullEmail, password, name, birthDate, university);
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('already registered')) {
        setError('이미 사용 중인 이메일입니다.');
      } else if (err.message?.includes('Invalid email')) {
        setError('유효하지 않은 이메일 주소입니다.');
      } else if (err.message?.includes('Password')) {
        setError('비밀번호가 너무 약합니다. 6자 이상 입력해주세요.');
      } else {
        setError('회원가입에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 회원가입 성공 화면
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
                <p className="text-sm text-blue-800 font-semibold mb-2">📧 인증 이메일 발송 완료</p>
                <p className="text-sm text-blue-700">
                  회원가입이 완료되었습니다!<br />
                  {displayEmail}로 인증 메일을 발송했습니다.<br />
                  이메일에서 인증 링크를 클릭하시면 로그인할 수 있습니다.
                </p>
              </div>

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-semibold mb-2">⚠️ 참고사항</p>
                <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                  <li>스팸 메일함도 확인해주세요</li>
                  <li>인증 이메일이 도착하기까지 1-2분 소요될 수 있습니다</li>
                  <li>이메일 인증 후 로그인이 가능합니다</li>
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">간편가입</h1>
            <div className="flex items-center justify-center gap-2">
              <Calendar className="w-4 h-4 text-red-600" />
              <p className="text-sm font-semibold text-red-600">
                {examDate} 시험일 {ddayText}
              </p>
            </div>
            <p className="mt-3 text-base font-semibold text-gray-900 leading-snug">
              5초 간단 가입 후
              <br />
              간단 채점, 성적 분석, 지원가능 로스쿨 정보로
              <br />
              리트 대박!
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

            {canShowPassword && (
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
            )}

            {canShowConfirmPassword && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  비밀번호 확인
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="••••••••"
                  required
                />
                {confirmPassword && (
                  <div className="mt-2">
                    {password === confirmPassword ? (
                      <p className="text-sm text-green-600 flex items-center gap-1">
                        <span className="text-green-600">✓</span> 비밀번호가 일치합니다
                      </p>
                    ) : (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <span className="text-red-600">✗</span> 비밀번호가 일치하지 않습니다
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {canShowName && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  이름
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="홍길동"
                  required
                />
              </div>
            )}

            {canShowBirthDate && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  생년월일
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  required
                />
              </div>
            )}

            {canShowUniversity && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  대학교
                </label>
                <select
                  value={universityPreset}
                  onChange={(e) => {
                    const next = e.target.value;
                    setUniversityPreset(next);
                    if (next !== '기타') {
                      setUniversityCustom('');
                    }
                  }}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  required
                >
                  <option value="" disabled>
                    선택해주세요
                  </option>
                  {universityOptions.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                {universityPreset === '기타' && (
                  <input
                    type="text"
                    value={universityCustom}
                    onChange={(e) => setUniversityCustom(e.target.value)}
                    className="w-full mt-2 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="대학교명을 입력해주세요"
                    required
                  />
                )}
              </div>
            )}

            {canShowSubmit && (
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {loading ? '가입 처리 중...' : '개인정보 처리방침에 동의하고 가입하기'}
              </button>
            )}
          </form>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-600">
              회원가입을 진행하면 개인정보 처리방침에 동의한 것으로 간주됩니다.
              <br />
              <a
                href="/privacy-policy"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                개인정보 처리방침 보기
              </a>
            </p>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              이미 계정이 있으신가요?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                로그인
              </button>
            </p>
          </div>

          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs text-green-800 font-semibold mb-1">✅ 빠른 시작</p>
            <p className="text-xs text-green-700">
              원하는 이메일과 비밀번호로 회원가입하세요.<br />
              지금 바로 all LEET를 사용할 수 있습니다!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}