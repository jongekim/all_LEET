// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';
import { createCommunityHandler } from './communityHtml';
import rows from '../../e2e/fixtures/community-public.json';

const template = '<html><head><title>home</title><meta name="description" content="home" /><script id="ldjson-website" type="application/ld+json">{}</script></head><body><div id="root"></div></body></html>';
const render = (url: string, value: { post: { title: string } | null }) => `<h1>${value.post?.title ?? '커뮤니티 게시판'}</h1><p>${url}</p>`;

describe('요청별 공개 커뮤니티 HTML', () => {
  test('요청 인증을 전달하지 않고 anon GET만 사용하며 저장·캐시를 만들지 않는다', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(rows)).mockResolvedValueOnce(Response.json([]));
    const handle = createCommunityHandler(template, render, fetcher);
    const request = () => new Request(`https://all-leet.vercel.app/community/${rows[0].id}`, { headers: { Cookie: 'private=session', Authorization: 'Bearer private-user-token' } });
    const first = await handle(request());
    expect(first.status).toBe(200);
    expect(first.headers.get('cache-control')).toContain('no-store');
    expect(first.headers.get('vercel-cdn-cache-control')).toBe('no-store');
    const html = await first.text();
    expect(html).toContain(`<title>${rows[0].title} | all LEET 커뮤니티</title>`);
    expect(html).toContain('<h1>');
    const [input, options] = fetcher.mock.calls[0];
    expect(String(input)).toContain('/rest/v1/community_posts?');
    expect(String(input)).toContain(`id=eq.${rows[0].id}`);
    expect(options).toMatchObject({ method: 'GET', cache: 'no-store', redirect: 'error' });
    expect(options?.headers).not.toHaveProperty('Cookie');
    expect((options?.headers as Record<string, string>).Authorization).not.toContain('private-user-token');
    const deleted = await handle(request());
    expect(deleted.status).toBe(404);
    expect(await deleted.text()).not.toContain(rows[0].title);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test('잘못된 식별자·쓰기 메서드에는 DB 요청을 하지 않는다', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const handle = createCommunityHandler(template, render, fetcher);
    for (const path of ['/community/not-a-uuid', '/api/community?postId=invalid', '/api/community?postId=a&postId=b']) {
      expect((await handle(new Request(`https://all-leet.vercel.app${path}`))).status).toBe(404);
    }
    expect((await handle(new Request('https://all-leet.vercel.app/community', { method: 'POST' }))).status).toBe(405);
    expect(fetcher).not.toHaveBeenCalled();
  });

  test('네트워크·권한·잘못된 데이터·응답 크기 오류는 정상 빈 목록 대신 503을 반환한다', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      for (const reply of [new Response('denied', { status: 403 }), Response.json({ error: true }), Response.json([{ id: 'bad' }]), new Response(' '.repeat(2_000_001))]) {
        const handle = createCommunityHandler(template, render, vi.fn<typeof fetch>().mockResolvedValue(reply));
        const response = await handle(new Request('https://all-leet.vercel.app/community'));
        expect(response.status).toBe(503);
        expect(response.headers.get('retry-after')).toBe('60');
        expect(response.headers.get('x-robots-tag')).toContain('noindex');
        expect(await response.text()).toContain('<div id="root"></div>');
      }
      const handle = createCommunityHandler(template, render, vi.fn<typeof fetch>().mockRejectedValue(new Error('timeout')));
      expect((await handle(new Request('https://all-leet.vercel.app/community'))).status).toBe(503);
    } finally { quiet.mockRestore(); }
  });

  test('HEAD는 GET과 같은 상태·헤더를 유지하며 본문이 없다', async () => {
    const handle = createCommunityHandler(template, render, vi.fn<typeof fetch>().mockResolvedValue(Response.json(rows)));
    const response = await handle(new Request(`https://all-leet.vercel.app/api/community?postId=${rows[0].id}`, { method: 'HEAD' }));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
  });
});
