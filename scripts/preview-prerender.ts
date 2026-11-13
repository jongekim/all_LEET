import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { preview } from 'vite';
import type { Rewrite } from './prerenderRoutes';

const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
const rules: Rewrite[] = config.rewrites.filter((rule: Rewrite) => rule.destination.startsWith('/prerender/') || rule.destination.startsWith('/shells/'));
const fixture = process.argv.includes('--community-fixture');
if (fixture && process.env.VERCEL) throw new Error('Vercel 환경에서는 커뮤니티 테스트 파일을 사용할 수 없습니다.');
const fixtureRows = fixture ? JSON.parse(readFileSync('e2e/fixtures/community-public.json', 'utf8')) as { id: string }[] : [];
const fetcher: typeof fetch = fixture ? async (input) => {
  const url = new URL(String(input));
  const id = url.searchParams.get('id')?.replace(/^eq\./, '');
  return Response.json(id ? fixtureRows.filter(row => row.id === id) : fixtureRows);
} : fetch;
const template = readFileSync('.generated/community/template.html', 'utf8');
const renderer = import(pathToFileURL(resolve('.generated/community/handler.mjs')).href) as Promise<{
  handleCommunityRequest: (request: Request, template: string, fetcher: typeof fetch) => Promise<Response>;
}>;
void preview({
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, open: false },
  plugins: [{
    name: 'preview-public-html',
    configurePreviewServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1:4173');
        const path = url.pathname.replace(/\/$/, '') || '/';
        if (path === '/community' || /^\/community\/[^/]+$/.test(path)) {
          try {
            const result = await (await renderer).handleCommunityRequest(new Request(url, { method: request.method }), template, fetcher);
            response.statusCode = result.status;
            result.headers.forEach((value, key) => response.setHeader(key, value));
            response.end(await result.text());
          } catch (error) { next(error); }
          return;
        }
        const rule = rules.find(candidate => candidate.source === path
          && (candidate.has ?? []).every(condition => url.searchParams.get(condition.key) === condition.value)
          && (candidate.missing ?? []).every(condition => url.searchParams.get(condition.key) !== condition.value));
        if (rule) request.url = rule.destination;
        else if (path !== '/' && !existsSync(resolve('build', '.' + path))) {
          response.statusCode = 404;
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.setHeader('Cache-Control', 'no-store');
          response.end(request.method === 'HEAD' ? undefined : readFileSync('build/404.html'));
          return;
        }
        next();
      });
    },
  }],
}).then(server => server.printUrls()).catch(error => { console.error(error); process.exitCode = 1; });
