import type { CommunityPost, CommunityTag } from '../types/community';
import { COMMUNITY_TAGS } from '../types/community';
import { projectId, publicAnonKey } from '../utils/supabase/info';

// 현재 브라우저와 같은 공개 SELECT. 세션·요청 Cookie·service role을 전달하지 않는다.
const SELECT = 'id,user_id,tag,title,content,image_urls,created_at,likes_count,views_count,reports_count,comments_count,like_count:community_post_likes(count),comment_count:community_comments(count),community_comments(id,user_id,content,created_at,likes_count,reports_count)';
export const COMMUNITY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('공개 게시글 형식이 잘못되었습니다.');
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('공개 게시글 문자열이 잘못되었습니다.');
  return value;
}
function date(value: unknown) {
  const parsed = Date.parse(string(value));
  if (!Number.isFinite(parsed)) throw new Error('공개 게시글 날짜가 잘못되었습니다.');
  return parsed;
}
function count(value: unknown): number {
  if (value == null) return 0;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('공개 게시글 건수가 잘못되었습니다.');
  return value;
}
function joinedCount(value: unknown): number | undefined {
  return Array.isArray(value) && value.length ? count(record(value[0]).count) : undefined;
}

export function parseCommunityRows(value: unknown): CommunityPost[] {
  if (!Array.isArray(value)) throw new Error('공개 게시글 응답은 배열이어야 합니다.');
  return value.map(item => {
    const row = record(item);
    const id = string(row.id);
    const tag = string(row.tag);
    if (!COMMUNITY_ID.test(id) || !(COMMUNITY_TAGS as readonly string[]).includes(tag)) throw new Error('공개 게시글 식별자가 잘못되었습니다.');
    const comments = ((row.community_comments ?? []) as unknown[]).map(item => {
      const comment = record(item);
      return { id: string(comment.id), postId: id, author: string(comment.user_id), content: string(comment.content), createdAt: date(comment.created_at), likes: count(comment.likes_count), reports: count(comment.reports_count) };
    });
    const images = row.image_urls ?? [];
    if (!Array.isArray(images) || images.some(image => typeof image !== 'string')) throw new Error('공개 게시글 이미지 형식이 잘못되었습니다.');
    return {
      id, tag: tag as CommunityTag, title: string(row.title), content: string(row.content),
      imageUrls: images as string[], author: string(row.user_id), createdAt: date(row.created_at), comments,
      commentsCount: joinedCount(row.comment_count) ?? count(row.comments_count ?? comments.length),
      likes: joinedCount(row.like_count) ?? count(row.likes_count), views: count(row.views_count), reports: count(row.reports_count),
    };
  });
}

export async function loadPublicCommunity(id: string | undefined, fetcher: typeof fetch = fetch) {
  const url = new URL(`https://${projectId}.supabase.co/rest/v1/community_posts`);
  url.searchParams.set('select', SELECT);
  url.searchParams.set('order', 'created_at.desc');
  if (id) url.searchParams.set('id', `eq.${id}`);
  const response = await fetcher(url, {
    method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8_000),
    headers: { apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` },
  });
  if (!response.ok) throw new Error(`공개 게시글 조회 실패 (HTTP ${response.status}).`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('공개 게시글 응답 본문이 없습니다.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2_000_000) throw new Error('공개 게시글 응답 크기 제한을 초과했습니다.');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const posts = parseCommunityRows(JSON.parse(new TextDecoder().decode(bytes)));
  if (id && (posts.length > 1 || posts.some(post => post.id !== id))) throw new Error('조회한 게시글 식별자가 일치하지 않습니다.');
  return posts;
}
