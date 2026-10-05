import { expect, type Page, test } from "@playwright/test";
const admin = "00000000-0000-4000-8000-000000000001",
  member = "00000000-0000-4000-8000-000000000002",
  op = "00000000-0000-4000-8000-000000000003";
async function mock(page: Page, allowed = true) {
  const requests: { path: string; body: Record<string, unknown> }[] = [];
  await page.addInitScript(
    ({ admin }) =>
      localStorage.setItem(
        "sb-jkxxtyaanyhmjbdtybkp-auth-token",
        JSON.stringify({
          access_token: "mock-token",
          refresh_token: "mock-refresh",
          token_type: "bearer",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: {
            id: admin,
            email: "admin@example.test",
            user_metadata: {},
            app_metadata: {},
            aud: "authenticated",
          },
        }),
      ),
    { admin },
  );
  await page.route("https://*.supabase.co/**", async (route) => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (path.includes("/rpc/current_user_is_admin")) {
      return route.fulfill({ json: allowed });
    }
    if (!path.includes("/admin-user-data/")) return route.fulfill({ json: [] });
    expect(req.method()).toBe("POST");
    expect(req.headers().authorization).toBe("Bearer mock-token");
    const body = req.postDataJSON() as Record<string, unknown>;
    requests.push({ path, body });
    if (path.endsWith("/members")) {
      return route.fulfill({
        json: {
          items: [{
            user_id: member,
            name: "합성 회원",
            email: "member@example.test",
            created_at: null,
          }, {
            user_id: admin,
            name: "관리자 계정",
            email: "admin@example.test",
            created_at: null,
          }],
          next_cursor: null,
        },
      });
    }
    if (path.endsWith("/read")) {
      const items = body.domain === "account"
        ? [{
          user_id: String(body.target),
          name: body.target === member ? "기존 이름" : "관리자 계정 이름",
          email: "member@example.test",
          birth_date: "2000-01-01",
          university: "합성 대학",
          _reference: "account-ref",
        }]
        : body.domain === "posts"
        ? [{
          id: op,
          user_id: member,
          title: "합성 게시글",
          content: "본문",
          tag: "질문",
          image_urls: [],
          _reference: "post-ref",
        }]
        : [];
      return route.fulfill({
        json: { items, total: items.length, next_offset: null },
      });
    }
    if (path.endsWith("/prepare")) {
      return route.fulfill({
        json: {
          operation_id: op,
          state: "prepared",
          domain: body.domain,
          impact: { [String(body.domain)]: 1 },
          payload: body.payload,
          rules_version: "service-2026-10-05",
        },
      });
    }
    if (path.endsWith("/commit")) {
      return route.fulfill({
        json: { operation_id: op, state: "succeeded", impact: { account: 1 } },
      });
    }
    return route.fulfill({ json: { items: [], total: 0 } });
  });
  return requests;
}
for (const width of [390, 1280]) {
  test(
    `사용자 데이터 승인·실제 0건·새로고침 초기화 ${width}`,
    async ({ page }, info) => {
      const requests = await mock(page);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin");
      await page.getByRole("link", { name: /사용자 데이터/ }).click();
      await page.getByLabel("사용자 선택", { exact: true }).selectOption(
        member,
      );
      await expect(page.getByText(/예시 미리보기/)).toHaveCount(0);
      await expect(page.getByText(/실제 기록 0건/).first()).toBeVisible();
      await page.getByRole("button", { name: "계정 정보", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "기존 이름",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("member@example.test", { exact: true }).last(),
      ).toBeVisible();
      await page.getByRole("button", { name: "수정", exact: true }).click();
      await expect(page.getByLabel("이메일", { exact: true })).toHaveCount(0);
      await page.getByLabel("이름", { exact: true }).fill("변경 이름");
      await page.getByRole("button", { name: "변경 내용 확인", exact: true })
        .click();
      await expect(
        page.getByText(
          "이 과정은 데이터 수정을 수반합니다. 정말로 진행하시겠습니까?",
          { exact: true },
        ),
      ).toBeVisible();
      expect(requests.filter((r) => r.path.endsWith("/commit"))).toHaveLength(
        0,
      );
      const apply = page.getByRole("button", {
        name: "승인 후 적용",
        exact: true,
      });
      await expect(apply).toBeDisabled();
      await page.getByLabel("승인 직접 입력", { exact: true }).fill("승인 ");
      await expect(apply).toBeDisabled();
      await page.getByLabel("승인 직접 입력", { exact: true }).fill("승인");
      await expect(apply).toBeEnabled();
      await apply.click();
      await expect(page.getByText("변경을 완료했습니다.", { exact: true }))
        .toBeVisible();
      expect(requests.filter((r) => r.path.endsWith("/commit"))).toHaveLength(
        1,
      );
      await page.getByRole("button", { name: "닫기", exact: true }).first()
        .click();
      await page.screenshot({
        path: info.outputPath("user-data-account.png"),
        fullPage: true,
      });
      expect(
        await page.evaluate(() =>
          document.documentElement.scrollWidth <= innerWidth
        ),
      ).toBe(true);
      await page.reload();
      await expect(page.getByLabel("사용자 선택", { exact: true })).toHaveValue(
        "",
      );
      expect(errors).toEqual([]);
    },
  );
}
test("이미지 선택은 승인 전 업로드하지 않고 로컬 미리보기만 생성", async ({ page }) => {
  const requests = await mock(page);
  await page.goto("/admin/user-data");
  await page.getByLabel("사용자 선택", { exact: true }).selectOption(member);
  await page.getByRole("button", { name: "게시글", exact: true }).click();
  await page.getByRole("button", { name: "수정", exact: true }).click();
  await page.getByLabel("새 이미지 선택", { exact: true }).setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1kAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByAltText("추가 이미지 1", { exact: true }))
    .toBeVisible();
  expect(
    requests.filter((r) =>
      r.path.endsWith("/commit") || r.path.endsWith("/prepare")
    ),
  ).toHaveLength(0);
  await page.getByRole("button", { name: "변경 내용 확인", exact: true })
    .click();
  await expect(page.getByLabel("승인 직접 입력", { exact: true }))
    .toBeVisible();
  expect(requests.filter((r) => r.path.endsWith("/commit"))).toHaveLength(0);
});
test("권한 없는 사용자와 조회 도중 권한 상실은 개인 화면을 비운다", async ({ page }) => {
  const requests = await mock(page, false);
  await page.goto("/admin/user-data");
  await expect(page).toHaveURL("/");
  expect(requests).toHaveLength(0);
});
test("서버 403 후 선택·입력·개인 기록 제거", async ({ page }) => {
  await mock(page);
  await page.goto("/admin/user-data");
  await page.getByLabel("사용자 선택", { exact: true }).selectOption(member);
  await page.getByRole("button", { name: "계정 정보", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "기존 이름",
      exact: true,
    }),
  )
    .toBeVisible();
  await page.route(
    "https://*.supabase.co/functions/v1/admin-user-data/read",
    (r) => r.fulfill({ status: 403, contentType: "text/html", body: "denied" }),
  );
  await page.getByRole("button", { name: "문항 메모", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("관리자 권한");
  await expect(page.getByText("기존 이름", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("사용자 선택", { exact: true })).toBeDisabled();
});
test("지원 분석 저장 실패에도 기존 결과 화면과 사용자 안내 유지", async ({ page }) => {
  await mock(page);
  await page.route(
    "https://*.supabase.co/functions/v1/admission-history/**",
    (r) => r.fulfill({ status: 503, json: { code: "STORAGE_UNAVAILABLE" } }),
  );
  await page.goto("/admission");
  await page.getByPlaceholder("예: 120", { exact: true }).fill("130");
  await page.getByPlaceholder(/예: 95/).fill("97");
  await page.getByRole("button", { name: /분석하기/ }).click();
  await expect(page).toHaveURL("/admission-result");
  await expect(page.getByText(/저장 실패|서버 저장/)).toHaveCount(0);
  await expect(page.getByText("LEET 130 / GPA 97", { exact: true }))
    .toBeVisible();
});

test("대상 전환 후 늦은 개인정보 응답이 새 화면에 섞이지 않는다", async ({ page }) => {
  await mock(page);
  let finish: (() => Promise<void>) | undefined;
  await page.route(
    "https://*.supabase.co/functions/v1/admin-user-data/read",
    async (route) => {
      const body = route.request().postDataJSON();
      if (body.domain !== "account") {
        return route.fulfill({
          json: { items: [], total: 0 },
        });
      }
      const result = {
        items: [{
          user_id: body.target,
          name: body.target === member
            ? "늦은 이전 개인정보"
            : "현재 관리자 정보",
          _reference: "synthetic-ref",
        }],
        total: 1,
      };
      if (body.target === member) {
        finish = () => route.fulfill({ json: result });
        return;
      }
      await route.fulfill({ json: result });
    },
  );
  await page.goto("/admin/user-data");
  await page.getByLabel("사용자 선택", { exact: true }).selectOption(member);
  await page.getByRole("button", { name: "계정 정보", exact: true }).click();
  await expect.poll(() => Boolean(finish)).toBe(true);
  await page.getByLabel("사용자 선택", { exact: true }).selectOption(admin);
  await expect(
    page.getByRole("heading", { name: "현재 관리자 정보", exact: true }),
  ).toBeVisible();
  await finish!();
  await expect(page.getByText("늦은 이전 개인정보", { exact: true }))
    .toHaveCount(0);
});

test("감사는 현재 대상의 승인된 작업만 확인하며 다른 대상 응답은 확인창에 넣지 않는다", async ({ page }) => {
  await mock(page);
  await page.route(
    "https://*.supabase.co/functions/v1/admin-user-data/read",
    async (route) => {
      const body = route.request().postDataJSON();
      if (body.domain !== "audit") return route.fallback();
      const items = [
        { id: 1, target: member, actor: admin, status: "prepared" },
        { id: 2, target: admin, actor: admin, status: "unknown" },
        { id: 3, target: member, actor: member, status: "unknown" },
        { id: 4, target: member, actor: admin, status: "unknown" },
      ].map((row) => ({
        ...row,
        operation_id: op,
        _reference: `audit-${row.id}`,
      }));
      await route.fulfill({ json: { items, total: 4 } });
    },
  );
  await page.route(
    "https://*.supabase.co/functions/v1/admin-user-data/operation",
    (route) =>
      route.fulfill({
        json: {
          operation_id: op,
          target: admin,
          state: "unknown",
          impact: { account: 1 },
        },
      }),
  );
  await page.goto("/admin/user-data");
  await page.getByLabel("사용자 선택", { exact: true }).selectOption(member);
  await page.getByRole("button", { name: "관리자 감사", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "처리 결과 확인", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "처리 결과 확인", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "현재 선택 사용자와 승인 작업 대상이 다릅니다",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
