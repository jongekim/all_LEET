import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { build } from 'vite';
import { pathToFileURL } from 'node:url';
import { getPageSeo } from '../src/utils/pageSeo';
import { shouldNoindex } from '../src/utils/appRoutes';
import { renderSeoHtml } from '../src/utils/seoHtml';
import { getAppRewrites, getPrerenderPages, getShellPages } from './prerenderRoutes';
import { loadPublicStatistics, validatePublicStatistics } from './prerenderStatistics';
import type { CanonicalStatistics } from '../src/types/canonicalStatistics';

async function prerender() {
  const args = process.argv.slice(2);
  const fixtureArgument = '--statistics-fixture=e2e/fixtures/question-statistics-v2.json';
  if (args.some(arg => arg !== fixtureArgument) || args.length > 1) throw new Error('지원하지 않는 사전 렌더링 옵션입니다.');
  if (args.length && process.env.VERCEL) throw new Error('Vercel 배포에서는 테스트 통계 파일을 사용할 수 없습니다.');
  const statistics = args.length
    ? validatePublicStatistics(JSON.parse(readFileSync('e2e/fixtures/question-statistics-v2.json', 'utf8')))
    : await loadPublicStatistics();
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const actual = config.rewrites.filter((rule: { destination: string }) => rule.destination.startsWith('/prerender/') || rule.destination.startsWith('/shells/') || rule.destination.startsWith('/api/community'));
  if (JSON.stringify(actual) !== JSON.stringify(getAppRewrites()) || config.rewrites.some((rule: { source: string }) => rule.source === '/(.*)')) throw new Error('사전 렌더링 라우팅이 등록 자료와 다릅니다. npm run prerender:routes를 실행하세요.');

  const template = readFileSync('build/index.html', 'utf8');
  if (!template.includes('<div id="root"></div>')) throw new Error('빌드 HTML에 사전 렌더링 삽입 위치가 없습니다.');
  // 공개 HTML을 로그인·개인 페이지 fallback으로 사용하지 않는다.
  writeFileSync('build/app.html', template);
  writeFileSync('build/404.html', renderSeoHtml(template, { ...getPageSeo('/'), title: '페이지를 찾을 수 없습니다 | all LEET' }, true));
  for (const page of getShellPages()) {
    const output = resolve('build', '.' + page.output);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, renderSeoHtml(template, getPageSeo(page.url), shouldNoindex(page.url)));
  }
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
    const { renderPublicPage } = await import(pathToFileURL(resolve(serverOutput, 'entry.mjs')).href) as {
      renderPublicPage: (url: string, statistics: readonly CanonicalStatistics[]) => string;
    };
    const pages = getPrerenderPages();
    for (const page of pages) {
      const url = new URL(page.url, 'https://all-leet.vercel.app');
      const seo = getPageSeo(url.pathname, url.search);
      let html = renderSeoHtml(template, seo);
      const body = renderPublicPage(page.url, statistics);
      if (!body.includes('<h1')) throw new Error(`공개 페이지 본문이 생성되지 않았습니다: ${page.url}`);
      html = html.replace('<div id="root"></div>', () => `<div id="root">${body}</div>`);
      const output = resolve('build', '.' + page.output);
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, html);
    }
    console.log(`공개 페이지 ${pages.length}개 본문·메타데이터를 HTML로 생성했습니다.`);
    console.log(`공개 문항 통계: ${statistics.length}개 조합, 발행본 ${statistics[0]?.snapshot_id ?? '없음'}${args.length ? ' (테스트 파일)' : ''}`);
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(serverOutput, { recursive: true, force: true });
  }
  // 런타임 커뮤니티 HTML은 공개 디렉터리 밖에 번들한다. 게시글은 빌드에 저장하지 않는다.
  const communityOutput = resolve('.generated/community');
  await build({
    logLevel: 'warn', ssr: { noExternal: true },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      ssr: 'src/server/communityEntry.tsx', outDir: communityOutput, emptyOutDir: true, copyPublicDir: false,
      rollupOptions: { output: { entryFileNames: 'handler.mjs', inlineDynamicImports: true } },
    },
  });
  writeFileSync(resolve(communityOutput, 'template.html'), template);
}
void prerender().catch(error => { console.error(error); process.exitCode = 1; });
