import { supabase } from '../contexts/AuthContext';
import type { ChatProfile } from '../types/chat';
import { generateRandomChatNickname } from './chatNickname';

export async function getChatProfile(userId: string): Promise<ChatProfile | null> {
  const { data, error } = await supabase
    .from('chat_profiles')
    .select('user_id,nickname,created_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as ChatProfile | null;
}

export async function ensureChatProfile(userId: string): Promise<ChatProfile> {
  const existing = await getChatProfile(userId);
  if (existing) return existing;

  const maxAttempts = 50;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const nickname = generateRandomChatNickname();

    const { data, error } = await supabase
      .from('chat_profiles')
      .insert({ user_id: userId, nickname })
      .select('user_id,nickname,created_at')
      .single();

    if (!error && data) return data as ChatProfile;

    // Unique violation (nickname collision)
    // Postgres: 23505
    if ((error as any)?.code === '23505') {
      continue;
    }

    throw error;
  }

  throw new Error('닉네임 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
}
