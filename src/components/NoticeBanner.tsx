import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { supabase } from '../contexts/AuthContext';

interface NoticeItem {
  id: string;
  text: string;
}

export function NoticeBanner() {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
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
    const loadNotices = async () => {
      const { data, error } = await supabase
        .from('home_announcements')
        .select('id,title,banner_text')
        .eq('is_published', true)
        .eq('show_in_banner', true)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('홈 공지를 불러오지 못했습니다.', error);
        setNotices([]);
        return;
      }

      setNotices((data ?? []).map((notice) => ({
        id: notice.id,
        text: notice.banner_text.trim() || notice.title,
      })));
    };

    void loadNotices();
  }, []);

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
    <section className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 overflow-hidden">
        <div className="notice-rotator">
          {previousNotice && (
            <div className="notice-row notice-row-exit" key={`prev-${previousNotice.id}`}>
              <span className="shrink-0" style={{ fontSize: 18, lineHeight: 1 }} aria-hidden>
                📣
              </span>
              <p className="notice-text text-sm text-blue-900 font-medium">{previousNotice.text}</p>
            </div>
          )}

          <div
            className={`notice-row ${isAnimating ? 'notice-row-enter' : 'notice-row-current'}`}
            key={`current-${currentNotice.id}`}
          >
            <span className="shrink-0" style={{ fontSize: 18, lineHeight: 1 }} aria-hidden>
              📣
            </span>
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
          </div>
        </div>
    </section>
  );
}
