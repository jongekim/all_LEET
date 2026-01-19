import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { supabase } from '../contexts/AuthContext';
import type { ChatMessage } from '../types/chat';
import { formatTimeAgoKorean } from '../utils/timeAgo';

interface RecentChatBannerProps {
  roomId?: string;
  limit?: number;
}

export function RecentChatBanner({ roomId = 'global', limit = 10 }: RecentChatBannerProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [lastInsertAt, setLastInsertAt] = useState(0);

  const displayed = useMemo(() => {
    if (messages.length === 0) return null;
    const safeIndex = ((displayIndex % messages.length) + messages.length) % messages.length;
    return messages[safeIndex];
  }, [messages, displayIndex]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id,room_id,user_id,nickname,content,created_at')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(Math.max(1, limit));

      if (cancelled) return;
      if (error) {
        console.error('Failed to load recent chat:', error);
        setMessages([]);
        setLoadError(error.message || '최근 채팅을 불러오지 못했습니다.');
        setLoading(false);
        return;
      }

      const desc = (data as ChatMessage[]) || [];
      // room_id 필터 결과가 비어있으면(운영 중 데이터/필터 불일치 대비) 최신 1건을 재조회
      if (desc.length === 0) {
        const { data: anyData, error: anyError } = await supabase
          .from('chat_messages')
          .select('id,room_id,user_id,nickname,content,created_at')
          .order('created_at', { ascending: false })
          .limit(1);

        if (!cancelled) {
          if (anyError) {
            console.error('Failed to load recent chat (fallback):', anyError);
          }

          const one = ((anyData as ChatMessage[]) || []).slice().reverse();
          setMessages(one);
          setDisplayIndex(one.length > 0 ? one.length - 1 : 0);
        }
      } else {
        const asc = [...desc].reverse();
        setMessages(asc);
        setDisplayIndex(asc.length > 0 ? asc.length - 1 : 0);
      }
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel(`recent-chat:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const next = payload.new as ChatMessage;
          setLastInsertAt(Date.now());
          setMessages((prev) => {
            const merged = [...prev, next];
            const trimmed = merged.slice(Math.max(0, merged.length - limit));
            // 새 메시지 유입 시 바로 최신으로 점프
            setDisplayIndex(Math.max(0, trimmed.length - 1));
            return trimmed;
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId, limit]);

  // 새 메시지 유입이 없을 때 최근 10개를 순서대로 순환 표시
  useEffect(() => {
    const intervalMs = 2000;
    const idleMs = 2000;

    const id = window.setInterval(() => {
      if (messages.length <= 1) return;
      const now = Date.now();
      const isIdle = now - lastInsertAt > idleMs;
      if (!isIdle) return;

      setDisplayIndex((prev) => (prev + 1) % messages.length);
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [messages.length, lastInsertAt]);

  return (
    <div
      onClick={() => navigate('/chat')}
      className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg p-6 text-white cursor-pointer hover:shadow-xl transition-shadow"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') navigate('/chat');
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div className="bg-white/20 backdrop-blur rounded-full p-3">
            <MessageCircle className="w-8 h-8" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold mb-1">실시간 채팅</h3>
              <span className="text-xs bg-white/20 px-3 py-1 rounded-full">전체</span>
            </div>

            {loading ? (
              <p className="text-sm text-blue-100">최근 메시지 불러오는 중…</p>
            ) : loadError ? (
              <p className="text-sm text-blue-100 whitespace-normal break-words">
                최근 채팅을 불러오지 못했어요. (권한/정책 설정 확인)
              </p>
            ) : displayed ? (
              <p className="text-sm text-blue-100 whitespace-normal break-words">
                <span className="text-white/70">{displayed.nickname}</span>
                <span className="text-white/60"> · {formatTimeAgoKorean(displayed.created_at)}</span>
                <span className="text-white/60"> — </span>
                <span className="font-semibold text-white">{displayed.content}</span>
              </p>
            ) : (
              <p className="text-sm text-blue-100">아직 채팅이 없어요. 첫 메시지를 남겨보세요!</p>
            )}

            <p className="text-xs text-white/80 mt-2">배너를 눌러 채팅방으로 이동</p>
          </div>
        </div>

        <div className="hidden sm:block text-white/80">→</div>
      </div>
    </div>
  );
}
