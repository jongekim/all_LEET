import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Megaphone } from 'lucide-react';

interface NoticeItem {
  id: string;
  text: string;
  date: string;
}

const notices: NoticeItem[] = [
  {
    id: '2026-03-04-answer-fix',
    text: '‼️24년도 언어이해의 일부 정답 오류를 수정했습니다. 3/4 이전 채점 결과는 다시 채점해주세요.',
    date: '2026.03.04',
  },
  {
    id: '2026-03-03-answer-fix',
    text: '‼️09예비 회차의 일부 정답 오류를 수정했습니다. 3/3 이전 채점 결과는 다시 채점해주세요.',
    date: '2026.03.03',
  },
  {
    id: '2026-03-03-visit-user',
    text: '지난 한달 간 all LEET에 방문한 사용자 수가 1,000명을 돌파했습니다! 앞으로도 유용한 정보와 서비스를 제공하기 위해 노력하겠습니다.',
    date: '2026.03.03',
  },
  {
    id: '2026-03-03-notice-device',
    text: 'all LEET는 PC와 태블릿에서 가장 쾌적하게 이용하실 수 있습니다!',
    date: '2026.03.03',
  },
];

export function NoticeBanner() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldMarquee, setShouldMarquee] = useState(false);
  const [marqueeDistance, setMarqueeDistance] = useState(0);
  const [marqueeDuration, setMarqueeDuration] = useState(6);
  const currentIndexRef = useRef(0);
  const currentTextRef = useRef<HTMLParagraphElement | null>(null);

  const noticeCount = notices.length;
  const transitionMs = 450;
  const staticDisplayMs = 4000;
  const afterMarqueeDelayMs = 2000;
  const marqueeStartDelayMs = 1000;

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const textElement = currentTextRef.current;
      if (!textElement) return;

      const overflowDistance = textElement.scrollWidth - textElement.clientWidth;
      const needMarquee = overflowDistance > 6;

      setShouldMarquee(needMarquee);
      if (needMarquee) {
        setMarqueeDistance(overflowDistance);
        setMarqueeDuration(overflowDistance / 35);
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [currentIndex, isAnimating]);

  useEffect(() => {
    if (noticeCount <= 1) return;
    if (isAnimating) return;

    const displayDelay = shouldMarquee
      ? marqueeStartDelayMs + Math.ceil(marqueeDuration * 1000) + afterMarqueeDelayMs
      : staticDisplayMs;

    const timeoutId = window.setTimeout(() => {
      const previous = currentIndexRef.current;
      const next = (previous + 1) % noticeCount;

      setPrevIndex(previous);
      setCurrentIndex(next);
      setIsAnimating(true);
    }, displayDelay);

    return () => window.clearTimeout(timeoutId);
  }, [noticeCount, isAnimating, shouldMarquee, marqueeDuration]);

  useEffect(() => {
    if (!isAnimating) return;

    const timeoutId = window.setTimeout(() => {
      setPrevIndex(null);
      setIsAnimating(false);
    }, transitionMs);

    return () => window.clearTimeout(timeoutId);
  }, [isAnimating]);

  if (notices.length === 0) return null;

  const currentNotice = notices[currentIndex];
  const previousNotice = prevIndex !== null ? notices[prevIndex] : null;

  return (
    <section className="bg-white rounded-lg shadow p-4 sm:p-5 border border-gray-200">
      <div className="flex items-center gap-3 mb-3">
        <div className="bg-blue-100 rounded-full p-2">
          <Megaphone className="w-4 h-4 text-blue-700" />
        </div>
        <h2 className="text-sm font-semibold text-gray-900">공지사항</h2>
      </div>

      <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 overflow-hidden">
        <div className="notice-rotator">
          {previousNotice && (
            <div className="notice-row notice-row-exit" key={`prev-${previousNotice.id}`}>
              <p className="notice-text text-sm text-blue-900 font-medium">{previousNotice.text}</p>
              <span className="hidden sm:inline text-xs text-blue-700 font-medium shrink-0">{previousNotice.date}</span>
            </div>
          )}

          <div
            className={`notice-row ${isAnimating ? 'notice-row-enter' : 'notice-row-current'}`}
            key={`current-${currentNotice.id}`}
          >
            <p
              ref={currentTextRef}
              className={`notice-text text-sm text-blue-900 font-medium ${shouldMarquee ? 'notice-text-marquee-container' : ''}`}
            >
              {shouldMarquee ? (
                <span
                  className="notice-text-marquee-track"
                  style={
                    {
                      '--notice-marquee-distance': `${marqueeDistance}px`,
                      '--notice-marquee-duration': `${marqueeDuration}s`,
                      '--notice-marquee-delay': `${marqueeStartDelayMs}ms`,
                    } as CSSProperties
                  }
                >
                  {currentNotice.text}
                </span>
              ) : (
                currentNotice.text
              )}
            </p>
            <span className="hidden sm:inline text-xs text-blue-700 font-medium shrink-0">{currentNotice.date}</span>
          </div>
        </div>
        </div>
    </section>
  );
}