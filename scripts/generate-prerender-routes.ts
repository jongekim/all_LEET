import { readFileSync, writeFileSync } from 'node:fs';
import { getPrerenderRewrites } from './prerenderRoutes';

const file = new URL('../vercel.json', import.meta.url);
const config = JSON.parse(readFileSync(file, 'utf8'));
config.trailingSlash = false;
const existing = config.rewrites.filter((rule: { source: string; destination: string }) => !rule.destination.startsWith('/prerender/') && rule.source !== '/(.*)');
config.rewrites = [...existing, ...getPrerenderRewrites(), { source: '/(.*)', destination: '/app.html' }];
for (const source of ['/prerender/(.*)', '/past-exams', '/history', '/mock-history', '/privacy-policy', '/terms', '/', '/app.html']) {
  if (!config.headers.some((rule: { source: string }) => rule.source === source)) config.headers.push({ source, headers: [{ key: 'Cache-Control', value: 'no-store' }] });
}
const json = JSON.stringify(config, null, 2).replace(/ {2}"rewrites": \[\n[\s\S]*?\n {2}\]/, () =>
  '  "rewrites": [\n' + config.rewrites.map((rule: object) => '    ' + JSON.stringify(rule)).join(',\n') + '\n  ]');
writeFileSync(file, json + '\n');
console.log('공개 페이지 사전 렌더링 라우팅을 갱신했습니다.');
