import { getCommunityPostSeo, getPageSeo } from '../utils/pageSeo';
import { renderSeoHtml } from '../utils/seoHtml';
import { COMMUNITY_ID, loadPublicCommunity } from './publicCommunity';
import type { CommunityPost } from '../types/community';

type Render = (url: string, community: { posts: CommunityPost[]; post: CommunityPost | null }) => string;

export function createCommunityHandler(template: string, render: Render, fetcher: typeof fetch = fetch) {
  return async (request: Request) => {
    const headers: Record<string, string> = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'Vercel-CDN-Cache-Control': 'no-store' };
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
    const url = new URL(request.url);
    const ids = url.searchParams.getAll('postId');
    const pathname = url.pathname.replace(/\/$/, '');
    // 로컬 preview에서는 원래 경로를 사용하고 Vercel rewrite에서는 명시적 postId를 사용한다.
    const pathId = pathname.startsWith('/community/') ? pathname.slice('/community/'.length) : undefined;
    const id = (pathId ?? ids[0])?.toLowerCase();
    let status = 200;
    let posts: CommunityPost[] = [];
    let post: CommunityPost | null = null;
    let failed = false;
    if ((pathId === undefined && ids.length > 1) || (id !== undefined && !COMMUNITY_ID.test(id))) status = 404;
    else {
      try {
        posts = await loadPublicCommunity(id, fetcher);
        post = id ? posts[0] ?? null : null;
        if (id && !post) status = 404;
      } catch (error) {
        console.error('공개 커뮤니티 HTML 조회 실패:', error instanceof Error ? error.message : 'unknown');
        status = 503; failed = true;
      }
    }
    const pageUrl = id ? `/community/${encodeURIComponent(id)}` : '/community';
    const seo = post ? getCommunityPostSeo(post.id, post) : getPageSeo(pageUrl);
    let html = renderSeoHtml(template, seo, status !== 200);
    // 장애를 정상 빈 목록으로 고정하지 않는다. 기존 앱은 그대로 시작해 다시 조회한다.
    if (!failed) {
      try {
        html = html.replace('<div id="root"></div>', () => `<div id="root">${render(pageUrl, { posts, post })}</div>`);
        if (new TextEncoder().encode(html).byteLength > 4_000_000) throw new Error('공개 HTML 크기 제한을 초과했습니다.');
      } catch {
        console.error('공개 커뮤니티 HTML 렌더링에 실패했습니다.');
        status = 503;
        html = renderSeoHtml(template, seo, true);
      }
    }
    if (status !== 200) headers['X-Robots-Tag'] = 'noindex, follow';
    if (status === 503) headers['Retry-After'] = '60';
    return new Response(request.method === 'HEAD' ? null : html, { status, headers });
  };
}
