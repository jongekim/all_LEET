export interface ChatProfile {
  user_id: string;
  nickname: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  nickname: string;
  content: string;
  created_at: string;
}
