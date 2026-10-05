export type DataRow = Record<string, unknown>;
export const DATA_DOMAINS = {
  account: "계정 정보",
  history: "기출 채점",
  mock_history: "사설 성적",
  notes: "문항 메모",
  admission: "지원 분석",
  admission_errors: "지원 분석 저장 실패",
  storage_images: "저장 이미지",
  posts: "게시글",
  comments: "댓글",
  post_likes: "게시글 좋아요",
  comment_likes: "댓글 좋아요",
  post_reports: "게시글 신고",
  comment_reports: "댓글 신고",
  announcement_comments: "공지 댓글",
  announcement_likes: "공지 좋아요",
  profile: "채팅 닉네임",
  chat: "채팅 메시지",
  usage: "이용 기록",
  activity_days: "일별 이용",
  first_usage: "최초 이용",
  usage_facts: "집계된 이용 기록",
  chat_limits: "채팅 이용 제한 기록",
  usage_sessions: "관측된 이용 세션",
  audit: "관리자 감사",
} as const;
export type DataDomain = keyof typeof DATA_DOMAINS;
export interface DataPage {
  items: DataRow[];
  total: number;
  next_offset?: number | null;
  snapshot?: string;
  context_posts?: DataRow[];
  context_total?: number;
  context_offset?: number;
  context_next_offset?: number | null;
  collection_reference?: string;
  context?: DataRow[];
  edit?: string[];
  readonly?: boolean;
}
export interface DataMember {
  user_id: string;
  name: string | null;
  email: string | null;
  created_at: string | null;
}
export interface DataMembers {
  items: DataMember[];
  next_cursor: string | null;
}
export interface DataOperation {
  selection?: DataRow[];
  target?: string;
  operation_id: string;
  domain?: DataDomain;
  uploads?: ImageUpload[];
  state:
    | "prepared"
    | "executing"
    | "succeeded"
    | "failed"
    | "unknown"
    | "conflict"
    | "partial";
  impact: Record<string, number>;
  payload?: DataRow;
  expires_at?: string;
  rules_version?: string;
  code?: string;
}
export const RECALCULATE_FIELDS = {
  correct: "정답 수·정답률",
  fieldAnalysis: "분야 분석",
  standardScore: "표준점수",
  percentile: "백분위",
  adjustedScore: "보정 점수",
  correctAnswers: "현재 정답표",
} as const;
export type RecalculateField = keyof typeof RECALCULATE_FIELDS;
export const EDIT_FIELDS: Partial<Record<DataDomain, string[]>> = {
  account: ["name"],
  profile: ["nickname"],
  history: [
    "userAnswers",
    "correct",
    "standardScore",
    "percentile",
    "adjustedScore",
  ],
  mock_history: ["examDate", "provider", "round", "verbal", "reasoning"],
  notes: ["content"],
  posts: ["title", "content", "tag"],
  comments: ["content"],
  announcement_comments: ["content"],
  chat: ["content"],
  admission: ["input"],
};
export const FIELD_LABELS: Record<string, string> = {
  name: "이름",
  nickname: "채팅 닉네임",
  email: "이메일",
  birth_date: "생년월일",
  university: "대학교",
  created_at: "등록 시각",
  confirmed_at: "인증 시각",
  title: "제목",
  content: "내용",
  tag: "분류",
  userAnswers: "문항 답안",
  correct: "정답 수",
  standardScore: "표준점수",
  percentile: "백분위",
  adjustedScore: "보정 점수",
  examDate: "시험일",
  provider: "시험사",
  round: "회차",
  verbal: "언어이해",
  reasoning: "추리논증",
  input: "분석 입력",
};
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const USER_DATA_RULES_VERSION = "service-2026-10-05";

export interface ImageUpload {
  id: string;
  name: string;
  mime: string;
  size: number;
  sha256: string;
  path?: string;
  url?: string;
}
