import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomeSearchContent, INDEXABLE_EXAM_YEARS, PastExamIndexContent, PastExamYearContent, QuestionRatesContent } from '../src/components/seo/PastExamSearchContent';
import { getRouteSeo, SITE_ORIGIN } from '../src/seo/routeSeo';
import seoRates from '../src/data/seoQuestionRates.json';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function replaceRequired(html: string, pattern: RegExp, replacement: string) {
  if (!pattern.test(html)) throw new Error(`SEO HTML template is missing ${pattern}`);
  return html.replace(pattern, replacement);
}

function renderPage(template: string, pathname: string, body: string) {
  const seo = getRouteSeo(pathname);
  if (!seo.indexable || !seo.canonicalPath) throw new Error(`Not an indexable SEO path: ${pathname}`);
  const canonical = `${SITE_ORIGIN}${seo.canonicalPath}`;
  const title = escapeHtml(seo.title);
  const description = escapeHtml(seo.description);
  let html = template;
  html = replaceRequired(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`);
  html = replaceRequired(html, /<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${description}" />`);
  html = replaceRequired(html, /<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${canonical}" />`);
  html = replaceRequired(html, /<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${canonical}" />`);
  html = replaceRequired(html, /<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${title}" />`);
  html = replaceRequired(html, /<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${description}" />`);
  html = replaceRequired(html, /<meta name="twitter:title" content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${title}" />`);
  html = replaceRequired(html, /<meta name="twitter:description" content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${description}" />`);
  html = replaceRequired(html, /<div id="root"><\/div>/, `<div id="root">${body}</div>`);
  return html;
}

async function main() {
const output = path.resolve('build');
const template = await readFile(path.join(output, 'index.html'), 'utf8');

const home = renderToStaticMarkup(<div className="min-h-screen bg-gray-50">
  <header className="bg-white border-b"><div className="max-w-4xl mx-auto px-4 py-6">
    <h1 className="text-3xl font-bold text-gray-900">리트 채점은 all LEET</h1>
    <p className="text-sm text-gray-700 mt-2">LEET 언어이해·추리논증 답안을 입력해 채점하고 기출문제와 문항별 정답률을 확인하세요.</p>
  </div></header>
  <main className="max-w-4xl mx-auto p-4 sm:p-6"><HomeSearchContent /></main>
</div>);

const catalog = renderToStaticMarkup(<div className="min-h-screen bg-gray-50">
  <header className="bg-white border-b"><div className="max-w-4xl mx-auto px-4 py-6"><h1 className="text-3xl font-bold text-gray-900">리트 기출문제·정답표</h1><p className="text-sm text-gray-700 mt-2">학년도별 LEET 언어이해·추리논증 기출문제 PDF와 정답표를 찾아보세요.</p></div></header>
  <main className="past-exam-main"><PastExamIndexContent /></main>
</div>);

const rates = renderToStaticMarkup(<div className="min-h-screen bg-gray-50">
  <header className="bg-white border-b"><div className="max-w-4xl mx-auto px-4 py-6"><h1 className="text-3xl font-bold text-gray-900">리트 문항별 정답률</h1><p className="text-sm text-gray-700 mt-2">학년도·과목·문형별 정답률과 선지별 응답 분포를 확인하세요.</p></div></header>
  <main className="past-exam-main"><QuestionRatesContent /></main>
</div>);

await writeFile(path.join(output, 'index.html'), renderPage(template, '/', home));
await writeFile(path.join(output, 'past-exams.html'), renderPage(template, '/past-exams', catalog));
await writeFile(path.join(output, 'question-rates.html'), renderPage(template, '/question-rates', rates));
await mkdir(path.join(output, 'past-exams'), { recursive: true });

for (const year of INDEXABLE_EXAM_YEARS) {
  const pathname = `/past-exams/${year}`;
  const html = renderPage(template, pathname, renderToStaticMarkup(<PastExamYearContent year={year} />));
  const published = seoRates.cohorts.find(cohort => cohort.year === year);
  if (published && (!html.includes(`${year}학년도 문항별 정답률`) || !html.includes(published.rates[0]))) {
    throw new Error(`${year}학년도 공개 정답률이 초기 HTML에 없습니다.`);
  }
  await writeFile(path.join(output, 'past-exams', `${year}.html`), html);
}

const app = template
  .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, '')
  .replace('<title>리트 채점·기출문제 | all LEET</title>', '<title>all LEET 앱</title>')
  .replace('</head>', '  <meta name="robots" content="noindex,follow" />\n    </head>');
await writeFile(path.join(output, 'app.html'), app);

const notFound = app.replace('<div id="root"></div>', '<div id="root"><main class="max-w-4xl mx-auto p-8"><h1>페이지를 찾을 수 없습니다</h1><a href="/">홈으로 이동</a></main></div>');
await writeFile(path.join(output, '404.html'), notFound);

const urls = ['/', '/past-exams', '/question-rates', ...INDEXABLE_EXAM_YEARS.map(year => `/past-exams/${year}`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${SITE_ORIGIN}${url}</loc></url>`).join('\n')}\n</urlset>\n`;
await writeFile(path.join(output, 'sitemap.xml'), sitemap);

for (const [file, phrase] of [['index.html', '리트 채점은 all LEET'], ['past-exams.html', '학년도별 리트 기출문제'], ['question-rates.html', '리트 문항별 정답률'], ['past-exams/2025.html', '2025학년도 리트 기출문제와 정답표']] as const) {
  const html = await readFile(path.join(output, file), 'utf8');
  if (!html.includes(phrase) || !html.includes('rel="canonical"') || !html.includes('<h1')) throw new Error(`SEO output verification failed: ${file}`);
}
const rateExample = seoRates.cohorts.find(cohort => cohort.year === '2025' && cohort.subject === 'verbal' && cohort.examType === 'odd');
if (!rateExample || !rates.includes(rateExample.rates[0])) throw new Error('2025학년도 공개 정답률 데이터가 없습니다.');
const rateHtml = await readFile(path.join(output, 'question-rates.html'), 'utf8');
if (!rateHtml.includes(rateExample.rates[0]) || !rateHtml.includes(`${rateExample.sampleCount.toLocaleString('ko-KR')}건`)) {
  throw new Error('문항별 정답률 초기 HTML에 공개 수치와 표본이 없습니다.');
}
if (app.includes('rel="canonical"') || !app.includes('name="robots" content="noindex,follow"')) throw new Error('App fallback must be noindex');
if (urls.length !== new Set(urls).size) throw new Error('Duplicate sitemap URL');
console.log(`Generated and verified ${urls.length} indexable HTML pages and sitemap.xml`);
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
