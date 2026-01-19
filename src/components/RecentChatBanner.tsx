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
        setLoading(false);
        return;
      }

      const desc = (data as ChatMessage[]) || [];
      const asc = [...desc].reverse();
      setMessages(asc);
      setDisplayIndex(asc.length > 0 ? asc.length - 1 : 0);
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
      className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg shadow-lg p-5 text-white cursor-pointer hover:shadow-xl transition-shadow"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') navigate('/chat');
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="bg-white/20 backdrop-blur rounded-full p-2 mt-0.5">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold">실시간 채팅</h3>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">전체</span>
            </div>

            {loading ? (
              <p className="text-sm text-white/90 mt-1">최근 메시지 불러오는 중…</p>
            ) : displayed ? (
              <p className="text-sm text-white/95 mt-1 truncate">
                <span className="font-semibold">{displayed.nickname}</span>
                <span className="text-white/80"> · {formatTimeAgoKorean(displayed.created_at)}</span>
                <span className="text-white/90"> — </span>
                <span className="text-white/95">{displayed.content}</span>
              </p>
            ) : (
              <p className="text-sm text-white/90 mt-1">아직 채팅이 없어요. 첫 메시지를 남겨보세요!</p>
            )}

            <p className="text-xs text-white/80 mt-2">배너를 눌러 채팅방으로 이동</p>
          </div>
        </div>
        <div className="hidden sm:block text-white/80 mt-1">→</div>
      </div>
    </div>
  );
}
