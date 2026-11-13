import { getWebPageSchema, WEBSITE_SCHEMA, type getPageSeo } from './pageSeo';

export function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderSeoHtml(template: string, seo: ReturnType<typeof getPageSeo>, noindex = false) {
  let html = template.replace(/<title>.*?<\/title>/s, () => `<title>${escapeHtml(seo.title)}</title>`);
  for (const [attribute, key, value] of [
    ['name', 'description', seo.description], ['property', 'og:title', seo.title],
    ['property', 'og:description', seo.description], ['property', 'og:url', seo.canonical],
    ['name', 'twitter:title', seo.title], ['name', 'twitter:description', seo.description],
  ]) html = html.replace(new RegExp(`<meta ${attribute}="${key}"[^>]*>`), () => `<meta ${attribute}="${key}" content="${escapeHtml(value)}" />`);
  html = html.replace(/<link rel="canonical"[^>]*>/g, '').replace(/<meta name="robots"[^>]*>/g, '')
    .replace(/<script id="ldjson-webpage" type="application\/ld\+json">.*?<\/script>/sg, '');
  const json = (value: object) => JSON.stringify(value).replace(/</g, '\\u003c');
  html = html.replace(/<script id="ldjson-website" type="application\/ld\+json">.*?<\/script>/s,
    () => `<script id="ldjson-website" type="application/ld+json">${json(WEBSITE_SCHEMA)}</script>`);
  return html.replace('</head>', () => [
    `<link rel="canonical" href="${escapeHtml(seo.canonical)}" />`,
    noindex ? '<meta name="robots" content="noindex, follow" />' : '',
    noindex ? '' : `<script id="ldjson-webpage" type="application/ld+json">${json(getWebPageSchema(seo))}</script>`,
    '</head>',
  ].join(''));
}
