import { expect, test } from '@playwright/test';

test('공개 게시글은 기존 조회 결과로 검색 메타데이터를 설정한다', async ({ page }) => {
  const post = {
    id: 'seo-example', user_id: 'sample-user', tag: '질문',
    title: 'LEET 공부 방법', content: '언어이해와 추리논증 학습 경험을 공유합니다.',
    image_urls: [], created_at: '2026-09-20T00:00:00Z',
    likes_count: 0, views_count: 0, reports_count: 0, comments_count: 0,
    like_count: [{ count: 0 }], comment_count: [{ count: 0 }], community_comments: [],
  };
  await page.route('https://*.supabase.co/**', route => {
    const url = route.request().url();
    if (url.includes('/rest/v1/community_posts') && route.request().method() === 'GET') {
      return route.fulfill({ json: new URL(url).searchParams.has('id') ? post : [post] });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto('/community');
  const postLink = page.getByRole('link', { name: 'LEET 공부 방법' });
  await expect(postLink).toHaveAttribute('href', '/community/seo-example');
  await postLink.click();
  await expect(page).toHaveURL('/community/seo-example');
  await expect(page.getByRole('heading', { name: 'LEET 공부 방법' })).toBeVisible();
  await expect(page).toHaveTitle('LEET 공부 방법 | all LEET 커뮤니티');
  await expect(page.locator("meta[name='description']")).toHaveAttribute('content', '언어이해와 추리논증 학습 경험을 공유합니다.');
  await expect(page.locator("link[rel='canonical']")).toHaveAttribute('href', 'https://all-leet.vercel.app/community/seo-example');

  await page.goto('/past-exams');
  await expect(page).toHaveTitle('2027학년도 언어이해 단일 문형 리트(LEET) 기출문제·정답표 | all LEET');
});

test('기출문제 선택에 따라 검색 메타데이터와 정규 URL을 갱신한다', async ({ page }) => {
  await page.route('https://*.supabase.co/**', route => route.fulfill({ json: [] }));
  await page.goto('/past-exams?type=odd&subject=verbal&year=2018&campaign=preview');

  const title = '2018학년도 언어이해 홀수형 리트(LEET) 기출문제·정답표 | all LEET';
  const description = '2018학년도 언어이해 홀수형 리트(LEET) 기출문제 PDF와 정답표를 확인하세요.';
  const canonical = 'https://all-leet.vercel.app/past-exams?year=2018&subject=verbal&type=odd';
  await expect(page).toHaveTitle(title);
  await expect(page.locator("meta[name='description']")).toHaveAttribute('content', description);
  await expect(page.locator("link[rel='canonical']")).toHaveAttribute('href', canonical);
  await expect(page.locator("meta[property='og:title']")).toHaveAttribute('content', title);
  await expect(page.locator("meta[property='og:url']")).toHaveAttribute('content', canonical);
  await expect(page.getByRole('button', { name: '정답표·점수 환산표 보기' })).toHaveAttribute('aria-expanded', 'false');

  await page.getByRole('button', { name: '추리논증', exact: true }).click();
  await page.getByRole('button', { name: '짝수형', exact: true }).click();
  await expect(page).toHaveTitle('2018학년도 추리논증 짝수형 리트(LEET) 기출문제·정답표 | all LEET');
  await expect(page.locator("link[rel='canonical']")).toHaveAttribute('href', 'https://all-leet.vercel.app/past-exams?year=2018&subject=reasoning&type=even');
  await expect(page.getByRole('button', { name: '정답표·점수 환산표 보기' })).toHaveAttribute('aria-expanded', 'false');
});

test('예비시험과 단일 문형의 canonical은 보정된 선택을 사용한다', async ({ page }) => {
  await page.route('https://*.supabase.co/**', route => route.fulfill({ json: [] }));
  await page.goto('/past-exams?year=09예비&subject=reasoning&type=even');
  await expect(page).toHaveTitle('09학년도 예비시험 추리논증 짝수형 리트(LEET) 기출문제·정답표 | all LEET');
  await expect(page.locator("link[rel='canonical']")).toHaveAttribute('href', 'https://all-leet.vercel.app/past-exams?year=09%EC%98%88%EB%B9%84&subject=reasoning&type=even');

  await page.goto('/past-exams?year=2027&subject=reasoning&type=even');
  await expect(page).toHaveURL('/past-exams?year=2027&subject=reasoning&type=odd');
  await expect(page).toHaveTitle('2027학년도 추리논증 단일 문형 리트(LEET) 기출문제·정답표 | all LEET');
  await expect(page.locator("link[rel='canonical']")).toHaveAttribute('href', 'https://all-leet.vercel.app/past-exams?year=2027&subject=reasoning&type=odd');
});
