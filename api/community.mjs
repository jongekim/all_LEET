import { readFile } from 'node:fs/promises';

export default async function community(request, response) {
  try {
    const url = new URL(request.url, 'https://all-leet.vercel.app');
    const [renderer, template] = await Promise.all([
      import('../.generated/community/handler.mjs'),
      readFile(new URL('../.generated/community/template.html', import.meta.url), 'utf8'),
    ]);
    const result = await renderer.handleCommunityRequest(new Request(url, { method: request.method }), template);
    response.statusCode = result.status;
    result.headers.forEach((value, name) => response.setHeader(name, value));
    response.end(request.method === 'HEAD' ? undefined : await result.text());
  } catch (error) {
    console.error('커뮤니티 함수 실행 실패:', error);
    response.statusCode = 503;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Robots-Tag', 'noindex, follow');
    response.setHeader('Retry-After', '60');
    response.end();
  }
}
