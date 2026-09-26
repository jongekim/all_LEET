import { expect, test } from '@playwright/test';

test.describe('공개 읽기 전용 화면', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://*.supabase.co/**', route => route.fulfill({ json: [] }));
  });

  test('홈에서 채점 입력 UI를 표시한다', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /리트 채점은 all LEET/ })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('main').getByRole('button', { name: '채점하기' })).toBeVisible({ timeout: 15_000 });
  });

  test('로그인 화면은 제출하지 않고 입력 UI를 표시한다', async ({ page }) => {
    await page.goto('/login');

    const emailInput = page.getByPlaceholder('your');
    const passwordInput = page.getByPlaceholder('••••••••');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();

    await emailInput.fill('readonly-e2e');
    await passwordInput.fill('not-submitted');
    await expect(emailInput).toHaveValue('readonly-e2e');
    await expect(passwordInput).toHaveValue('not-submitted');
  });

  test('회원가입과 정책 화면을 표시한다', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: '간편가입' })).toBeVisible();

    await page.goto('/privacy-policy');
    await expect(page.getByRole('heading', { name: '개인정보처리방침' })).toBeVisible();
  });

  test('로그인하지 않은 사용자는 관리자 공지 화면에 접근할 수 없다', async ({ page }) => {
    await page.goto('/admin/announcements');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
  });
});
