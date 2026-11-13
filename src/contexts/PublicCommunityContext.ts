import { createContext } from 'react';
import type { CommunityPost } from '../types/community';

// 요청별 서버 렌더링 전용. 브라우저는 기존 조회·필터·좋아요·조회수 흐름을 유지한다.
export const PublicCommunityContext = createContext<{ posts: CommunityPost[]; post: CommunityPost | null } | undefined>(undefined);
