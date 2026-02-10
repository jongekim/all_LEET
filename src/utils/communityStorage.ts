import type { CommunityPost, CommunityComment } from '../types/community';

const STORAGE_KEY = 'allleet-community-posts';
const LIKED_KEY = 'allleet-community-liked';
const COMMENT_LIKED_KEY = 'allleet-community-comment-liked';

const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const parsePosts = (raw: string | null): CommunityPost[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CommunityPost[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((post) => ({
        ...post,
        comments: Array.isArray(post.comments)
          ? post.comments.map((comment) => ({
              ...comment,
              likes: typeof comment.likes === 'number' ? comment.likes : 0,
              reports: typeof comment.reports === 'number' ? comment.reports : 0,
            }))
          : [],
        commentsCount: typeof post.commentsCount === 'number'
          ? post.commentsCount
          : Array.isArray(post.comments)
            ? post.comments.length
            : 0,
        likes: typeof post.likes === 'number' ? post.likes : 0,
        views: typeof post.views === 'number' ? post.views : 0,
        reports: typeof post.reports === 'number' ? post.reports : 0,
      }))
      .filter((post) => Boolean(post.id && post.title && post.content && post.tag));
  } catch {
    return [];
  }
};

export const loadCommunityPosts = (): CommunityPost[] => {
  if (!isBrowser()) return [];
  const posts = parsePosts(window.localStorage.getItem(STORAGE_KEY));
  return [...posts].sort((a, b) => b.createdAt - a.createdAt);
};

export const saveCommunityPosts = (posts: CommunityPost[]) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
};

export const createCommunityId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const addCommunityPost = (post: CommunityPost) => {
  const posts = loadCommunityPosts();
  const next = [post, ...posts];
  saveCommunityPosts(next);
  return next;
};

export const addCommunityComment = (postId: string, comment: CommunityComment) => {
  const posts = loadCommunityPosts();
  const next = posts.map((post) => {
    if (post.id !== postId) return post;
    return {
      ...post,
      comments: [...post.comments, comment],
    };
  });
  saveCommunityPosts(next);
  return next;
};

const loadLikedIds = (): Set<string> => {
  if (!isBrowser()) return new Set();
  try {
    const raw = window.localStorage.getItem(LIKED_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
  } catch {
    return new Set();
  }
};

const saveLikedIds = (ids: Set<string>) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(LIKED_KEY, JSON.stringify(Array.from(ids)));
};

export const getCommunityLikedIds = () => loadLikedIds();

export const toggleCommunityLike = (postId: string) => {
  const posts = loadCommunityPosts();
  const liked = loadLikedIds();
  const isLiked = liked.has(postId);

  const next = posts.map((post) => {
    if (post.id !== postId) return post;
    const likes = Math.max(0, post.likes + (isLiked ? -1 : 1));
    return { ...post, likes };
  });

  if (isLiked) liked.delete(postId);
  else liked.add(postId);
  saveLikedIds(liked);
  saveCommunityPosts(next);

  return { posts: next, liked };
};

const loadCommentLikedIds = (): Set<string> => {
  if (!isBrowser()) return new Set();
  try {
    const raw = window.localStorage.getItem(COMMENT_LIKED_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
  } catch {
    return new Set();
  }
};

const saveCommentLikedIds = (ids: Set<string>) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(COMMENT_LIKED_KEY, JSON.stringify(Array.from(ids)));
};

export const getCommunityCommentLikedIds = () => loadCommentLikedIds();

export const toggleCommunityCommentLike = (postId: string, commentId: string) => {
  const posts = loadCommunityPosts();
  const liked = loadCommentLikedIds();
  const isLiked = liked.has(commentId);

  const next = posts.map((post) => {
    if (post.id !== postId) return post;
    return {
      ...post,
      comments: post.comments.map((comment) => {
        if (comment.id !== commentId) return comment;
        const likes = Math.max(0, comment.likes + (isLiked ? -1 : 1));
        return { ...comment, likes };
      }),
    };
  });

  if (isLiked) liked.delete(commentId);
  else liked.add(commentId);
  saveCommentLikedIds(liked);
  saveCommunityPosts(next);

  return { posts: next, liked };
};

export const reportCommunityComment = (postId: string, commentId: string) => {
  const posts = loadCommunityPosts();
  const next = posts.map((post) => {
    if (post.id !== postId) return post;
    return {
      ...post,
      comments: post.comments.map((comment) => {
        if (comment.id !== commentId) return comment;
        return { ...comment, reports: comment.reports + 1 };
      }),
    };
  });
  saveCommunityPosts(next);
  return next;
};

export const incrementCommunityView = (postId: string) => {
  const posts = loadCommunityPosts();
  const next = posts.map((post) => {
    if (post.id !== postId) return post;
    return { ...post, views: post.views + 1 };
  });
  saveCommunityPosts(next);
  return next;
};

export const reportCommunityPost = (postId: string) => {
  const posts = loadCommunityPosts();
  const next = posts.map((post) => {
    if (post.id !== postId) return post;
    return { ...post, reports: post.reports + 1 };
  });
  saveCommunityPosts(next);
  return next;
};

export const deleteCommunityPost = (postId: string) => {
  const posts = loadCommunityPosts();
  const next = posts.filter((post) => post.id !== postId);
  saveCommunityPosts(next);
  return next;
};

export const deleteCommunityComment = (postId: string, commentId: string) => {
  const posts = loadCommunityPosts();
  const next = posts.map((post) => {
    if (post.id !== postId) return post;
    return {
      ...post,
      comments: post.comments.filter((comment) => comment.id !== commentId),
    };
  });
  saveCommunityPosts(next);
  return next;
};
