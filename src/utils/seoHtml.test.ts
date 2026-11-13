import { describe, expect, test } from 'vitest';
import { renderSeoHtml } from './seoHtml';
import { getCommunityPostSeo, getPageSeo } from './pageSeo';

const template = '<html><head><title>old</title><meta name="description" content="old" /><script id="ldjson-website" type="application/ld+json">{}</script></head><body><div id="root"></div></body></html>';

describe('첫 HTML 검색 지시·구조화 데이터', () => {
  test('게시글 제목과 script 문자열이 HTML을 벗어나지 않는다', () => {
    const seo = getCommunityPostSeo('example', { title: '</title><script>alert(1)</script>', content: '" onmouseover="alert(2)' });
    const doc = new DOMParser().parseFromString(renderSeoHtml(template, seo), 'text/html');
    expect(doc.title).toBe(seo.title);
    expect(doc.querySelectorAll('script')).toHaveLength(2);
    expect(doc.querySelector('[onmouseover]')).toBeNull();
    const page = JSON.parse(doc.querySelector('#ldjson-webpage')!.textContent!);
    expect(page.name).toBe(seo.title);
    expect(page.url).toBe(seo.canonical);
    expect(page.isPartOf['@id']).toBe('https://all-leet.vercel.app/#website');
  });

  test('공유 템플릿을 재사용해도 로그인 noindex가 공개 페이지에 남지 않는다', () => {
    const login = renderSeoHtml(template, getPageSeo('/login'), true);
    expect(login).toContain('noindex, follow');
    const home = renderSeoHtml(login, getPageSeo('/'));
    expect(home).not.toContain('noindex');
    const doc = new DOMParser().parseFromString(home, 'text/html');
    expect(doc.querySelectorAll('link[rel=canonical]')).toHaveLength(1);
    expect(doc.querySelectorAll('#ldjson-webpage')).toHaveLength(1);
  });

  test('제목·본문의 달러 기호를 정규식 치환자로 해석하지 않는다', () => {
    const content = "가격 $& $` $' $1";
    const seo = getCommunityPostSeo('example', { title: content, content });
    const html = renderSeoHtml(template, seo);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.title).toBe(seo.title);
    expect(doc.querySelector('meta[name=description]')!.getAttribute('content')).toBe(content);
    expect(JSON.parse(doc.querySelector('#ldjson-webpage')!.textContent!).name).toBe(seo.title);
    expect(doc.querySelectorAll('#root')).toHaveLength(1);
  });
});
