export const COMMUNITY_TAGS = ['자유', '모의고사', '입시', '질문', '스터디 모집', '사고팔고'] as const;

export type CommunityTag = typeof COMMUNITY_TAGS[number];

export interface CommunityComment {
  id: string;
  postId: string;
  author: string;
  content: string;
  createdAt: number;
  likes: number;
  reports: number;
}

export interface CommunityPost {
  id: string;
  tag: CommunityTag;
  title: string;
  content: string;
  imageUrls: string[];
  author: string;
  createdAt: number;
  comments: CommunityComment[];
  commentsCount: number;
  likes: number;
  views: number;
  reports: number;
}
