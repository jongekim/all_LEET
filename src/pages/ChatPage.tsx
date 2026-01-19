import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../contexts/AuthContext';
import type { ChatMessage, ChatProfile } from '../types/chat';
import { ensureChatProfile } from '../utils/chatProfile';
import { formatTimeAgoKorean } from '../utils/timeAgo';

const ROOM_ID = 'global';
const INITIAL_LIMIT = 50;

export function ChatPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [profile, setProfile] = useState<ChatProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [content, setContent] = useState('');

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => {
    return Boolean(currentUser && content.trim().length > 0 && !sending && !profileLoading);
  }, [currentUser, content, sending, profileLoading]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      setLoading(true);
      try {
        // Load initial messages
        const { data, error } = await supabase
          .from('chat_messages')
          .select('id,room_id,user_id,nickname,content,created_at')
          .eq('room_id', ROOM_ID)
          .order('created_at', { ascending: false })
          .limit(INITIAL_LIMIT);

        if (cancelled) return;
        if (error) throw error;

        const desc = (data as ChatMessage[]) || [];
        const asc = [...desc].reverse();
        setMessages(asc);
      } catch (e) {
        console.error('Failed to load chat messages:', e);
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Ensure nickname/profile (only for logged in users)
      if (currentUser) {
        setProfileLoading(true);
        try {
          const p = await ensureChatProfile(currentUser.id);
          if (!cancelled) setProfile(p);
        } catch (e) {
          console.error('Failed to ensure chat profile:', e);
        } finally {
          if (!cancelled) setProfileLoading(false);
        }
      } else {
        setProfile(null);
        setProfileLoading(false);
      }
    };

    boot();

    const channel = supabase
      .channel(`chat:${ROOM_ID}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${ROOM_ID}` },
        (payload) => {
          const next = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === next.id)) return prev;
            return [...prev, next];
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const text = content.trim();
    if (!text) return;

    let activeProfile = profile;
    if (!activeProfile) {
      setProfileLoading(true);
      try {
        activeProfile = await ensureChatProfile(currentUser.id);
        setProfile(activeProfile);
      } catch (e) {
        console.error('Failed to ensure chat profile on send:', e);
        alert('닉네임 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
        return;
      } finally {
        setProfileLoading(false);
      }
    }

    setSending(true);
    try {
      const { error } = await supabase.from('chat_messages').insert({
        room_id: ROOM_ID,
        user_id: currentUser.id,
        nickname: activeProfile.nickname,
        content: text,
      });

      if (error) throw error;
      setContent('');
    } catch (e) {
      console.error('Failed to send message:', e);
      alert('메시지 전송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">돌아가기</span>
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <MessageCircle className="w-6 h-6" />
                  전체 채팅
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  {profile
                    ? `${profile.nickname}로 참여 중`
                    : (profileLoading ? '닉네임 생성 중…' : '메시지 보기는 가능, 작성은 로그인 필요')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 sm:p-6 border-b">
            <p className="text-sm text-gray-700">
              홈에서 보이던 최근 채팅을 여기서 바로 확인하고 참여할 수 있어요.
            </p>
          </div>

          <div className="h-[60vh] overflow-y-auto px-4 sm:px-6 py-4">
            {loading ? (
              <div className="text-sm text-gray-600">채팅 불러오는 중…</div>
            ) : messages.length === 0 ? (
              <div className="text-sm text-gray-600">아직 메시지가 없어요. 첫 메시지를 남겨보세요!</div>
            ) : (
              messages.map((m, idx) => {
                const isMine = Boolean(currentUser && m.user_id === currentUser.id);
                const prev = idx > 0 ? messages[idx - 1] : null;
                const next = idx < messages.length - 1 ? messages[idx + 1] : null;
                const isFirstInStreak = !prev || prev.user_id !== m.user_id;
                const isLastInStreak = !next || next.user_id !== m.user_id;
                const marginTop = idx === 0 ? 0 : isFirstInStreak ? 12 : 4;

                return (
                  <div
                    key={m.id}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    style={{ marginTop }}
                  >
                    <div
                      className="max-w-[85%]"
                      style={{ maxWidth: '85%', display: 'inline-flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}
                    >
                      {!isMine && isFirstInStreak && (
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-gray-900">{m.nickname}</span>
                        </div>
                      )}

                      <div
                        className={`${!isMine && isFirstInStreak ? 'mt-1' : ''} px-3 py-2 rounded-lg text-sm whitespace-pre-wrap break-words ${
                          isMine ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
                        }`}
                        style={{ display: 'inline-block' }}
                      >
                        {m.content}
                      </div>

                      {isLastInStreak && (
                        <div className={`mt-1 flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-xs text-gray-500">{formatTimeAgoKorean(m.created_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-4 sm:p-6 border-t">
            {!currentUser ? (
              <div className="flex items-center justify-between gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="text-sm text-yellow-900">로그인하면 채팅에 참여할 수 있어요.</div>
                <button
                  onClick={() => navigate('/login')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  로그인
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (canSend) void handleSend();
                    }
                  }}
                  placeholder="메시지를 입력하세요"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={sending || profileLoading}
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={!canSend}
                  className={`px-4 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors ${
                    canSend ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  {profileLoading ? '준비 중…' : '전송'}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
