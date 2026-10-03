import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { build } from 'vite';
import { pathToFileURL } from 'node:url';
import { getPageSeo, WEBSITE_SCHEMA } from '../src/utils/pageSeo';
import { getPrerenderPages, getPrerenderRewrites } from './prerenderRoutes';

async function prerender() {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const actual = config.rewrites.filter((rule: { destination: string }) => rule.destination.startsWith('/prerender/'));
  if (JSON.stringify(actual) !== JSON.stringify(getPrerenderRewrites())) throw new Error('사전 렌더링 라우팅이 등록 자료와 다릅니다. npm run prerender:routes를 실행하세요.');

  const template = readFileSync('build/index.html', 'utf8');
  if (!template.includes('<div id="root"></div>')) throw new Error('빌드 HTML에 사전 렌더링 삽입 위치가 없습니다.');
  // 공개 HTML을 로그인·개인 페이지 fallback으로 사용하지 않는다.
  writeFileSync('build/app.html', template);
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  process.env.NODE_ENV = 'production';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('사전 렌더링 중 외부 네트워크 요청은 허용하지 않습니다.'); };
  const serverOutput = resolve('build/.prerender');
  try {
    await build({
      logLevel: 'warn',
      build: {
        ssr: 'src/entry-prerender.tsx', outDir: serverOutput, emptyOutDir: true,
        rollupOptions: { output: { entryFileNames: 'entry.mjs' } },
      },
    });
    const { renderPublicPage } = await import(pathToFileURL(resolve(serverOutput, 'entry.mjs')).href) as { renderPublicPage: (url: string) => string };
    const pages = getPrerenderPages();
    for (const page of pages) {
      const url = new URL(page.url, 'https://all-leet.vercel.app');
      const seo = getPageSeo(url.pathname, url.search);
      let html = template.replace(/<title>.*?<\/title>/s, `<title>${escape(seo.title)}</title>`);
      for (const [attribute, key, value] of [
        ['name', 'description', seo.description], ['property', 'og:title', seo.title],
        ['property', 'og:description', seo.description], ['property', 'og:url', seo.canonical],
        ['name', 'twitter:title', seo.title], ['name', 'twitter:description', seo.description],
      ]) html = html.replace(new RegExp(`<meta ${attribute}="${key}"[^>]*>`), `<meta ${attribute}="${key}" content="${escape(value)}" />`);
      html = html.replace(/<script id="ldjson-website" type="application\/ld\+json">.*?<\/script>/s,
        `<script id="ldjson-website" type="application/ld+json">${JSON.stringify(WEBSITE_SCHEMA).replace(/</g, '\\u003c')}</script>`);
      html = html.replace('</head>', `<link rel="canonical" href="${escape(seo.canonical)}" /></head>`);
      const body = renderPublicPage(page.url);
      if (!body.includes('<h1')) throw new Error(`공개 페이지 본문이 생성되지 않았습니다: ${page.url}`);
      html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
      const output = resolve('build', '.' + page.output);
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, html);
    }
    console.log(`공개 페이지 ${pages.length}개 본문·메타데이터를 HTML로 생성했습니다.`);
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(serverOutput, { recursive: true, force: true });
  }
}
void prerender().catch(error => { console.error(error); process.exitCode = 1; });
