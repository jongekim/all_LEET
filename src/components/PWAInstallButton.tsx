import { useEffect, useRef, useState } from 'react';
import { Download, Share, X, Tablet, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// 디바이스 타입 정확히 구분하는 함수
function getDeviceType(): 'iPad' | 'iPhone' | 'Android' | 'Desktop' {
  const ua = navigator.userAgent;
  
  // 1. 구형 아이패드거나 설정에서 '모바일 웹사이트 요청'을 켠 경우
  const isIPadBasic = /iPad/.test(ua);

  // 2. 신형 아이패드 (맥북인 척하지만 터치 포인트가 있음)
  const isIPadOS = (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 0);

  if (isIPadBasic || isIPadOS) {
    return 'iPad';
  } else if (/iPhone|iPod/.test(ua)) {
    return 'iPhone';
  } else if (/Android/i.test(ua)) {
    return 'Android';
  } else {
    return 'Desktop';
  }
}

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showButton, setShowButton] = useState(true);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [deviceType, setDeviceType] = useState<'iPad' | 'iPhone' | 'Android' | 'Desktop'>('Desktop');
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // 앱 설치 버튼이 다른 버튼/컨텐츠를 가리는 것을 방지하기 위해,
  // 버튼이 화면에서 차지하는 하단 영역(버튼 상단~뷰포트 하단)을 CSS 변수로 노출합니다.
  // 전역 스크롤 컨테이너(body)에 padding-bottom으로 적용되어 추가 스크롤이 가능해집니다.
  useEffect(() => {
    const CSS_VAR_NAME = '--pwa-install-bottom-padding';

    if (isInstalled || !showButton) {
      document.documentElement.style.setProperty(CSS_VAR_NAME, '0px');
      return;
    }

    const updatePadding = () => {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const bottomInset = Math.max(0, Math.ceil(window.innerHeight - rect.top));
      document.documentElement.style.setProperty(CSS_VAR_NAME, `${bottomInset}px`);
    };

    updatePadding();

    window.addEventListener('resize', updatePadding);
    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener('resize', updatePadding);
    visualViewport?.addEventListener('scroll', updatePadding);

    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updatePadding());
      if (buttonRef.current) resizeObserver.observe(buttonRef.current);
    }

    return () => {
      window.removeEventListener('resize', updatePadding);
      visualViewport?.removeEventListener('resize', updatePadding);
      visualViewport?.removeEventListener('scroll', updatePadding);
      resizeObserver?.disconnect();
      document.documentElement.style.setProperty(CSS_VAR_NAME, '0px');
    };
  }, [isInstalled, showButton]);

  useEffect(() => {
    const device = getDeviceType();
    setDeviceType(device);
    console.log('🔍 Detected device type:', device);

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as any).standalone === true;
    
    if (isStandalone) {
      setIsInstalled(true);
      setShowButton(false);
      return;
    }

    if (device === 'iPad' || device === 'iPhone') {
      setShowButton(true);
    } else {
      setShowButton(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    const isIOS = deviceType === 'iPad' || deviceType === 'iPhone';

    if (deviceType === 'Desktop') {
      alert('데스크탑 환경에서는 이 사이트를 즐겨찾기에 추가하면 더 빠르게 공부를 시작할 수 있습니다!');
      return;
    }

    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setShowButton(false);
      }
      setDeferredPrompt(null);
    } else {
      alert('브라우저 설정에서 "홈 화면에 추가"를 선택해주세요.');
    }
  };

  if (isInstalled || !showButton) {
    return null;
  }

  // ✅ 기기별 안내 텍스트 분리
  const getGuideContent = () => {
    if (deviceType === 'iPad') {
      return {
        title: '아이패드 설치 방법',
        icon: <Tablet className="w-8 h-8 text-blue-600" />,
        step1Title: '상단 공유 버튼 누르기',
        step1Desc: 'Safari 화면 상단 주소창 우측에 있는 공유 버튼을 누르세요.',
      };
    }
    return {
      title: '아이폰 설치 방법',
      icon: <Smartphone className="w-8 h-8 text-blue-600" />,
      step1Title: '하단 공유 버튼 누르기',
      step1Desc: 'Safari 화면 하단 우측에 있는 "..."을 누른 뒤, 공유 버튼을 누르세요.',
    };
  };

  const guideContent = getGuideContent();

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleInstallClick}
        className="fixed right-4 sm:right-6 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2 z-40"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
      >
        <Download className="w-5 h-5" />
        <span className="text-xs sm:text-sm">앱 설치</span>
      </button>

      {showIOSGuide && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 relative animate-slide-up">
            <button
              onClick={() => setShowIOSGuide(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                {guideContent.icon}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                📲 {guideContent.title}
              </h2>
            </div>

            

            <div className="space-y-4">
              {/* Step 1: 기기별로 다름 */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">{guideContent.step1Title}</p>
                    <p className="text-sm text-gray-700">
                      {guideContent.step1Desc} <Share className="w-4 h-4 inline mx-1" />
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2: 공통 (하지만 설명은 살짝 다듬음) */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">'홈 화면에 추가' 선택</p>
                    <p className="text-sm text-gray-700">
                      나타나는 메뉴 리스트에서 <strong>"더보기"</strong>를 누른 뒤 <strong>"홈 화면에 추가"</strong>를 찾아 선택하세요.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 3: 공통 */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">추가 버튼 누르기</p>
                    <p className="text-sm text-gray-700">
                      우측 상단의 <strong>'추가'</strong> 버튼을 눌러 완료하세요.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>💡 팁:</strong> 설치 후 홈 화면의 아이콘을 통해 접속하면 전체 화면으로 이용할 수 있습니다!
              </p>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}