import { expect, type Page, test } from "@playwright/test";
const actor = "00000000-0000-4000-8000-000000000001",
  member = "00000000-0000-4000-8000-000000000002",
  session = "00000000-0000-4000-8000-000000000003",
  installation = "00000000-0000-4000-8000-000000000004";
const active = {
  status: "active",
  installationRevision: 1,
  bindingRevision: 1,
  subscriptionRevision: 1,
  linkedUserId: actor,
  linkedSessionId: session,
};
async function mock(page: Page, guest = false, unsubscribed = false) {
  const pushRequests: string[] = [];
  const requests: Array<{ action: string; input: Record<string, unknown> }> =
    [];
  const campaigns = new Map<string, Record<string, unknown>>();
  let lose = false, denied = false;
  let statisticsMode: "normal" | "zero" | "failed" | "malformed" | "denied" =
    "normal";
  let draft: Record<string, unknown> | undefined;
  await page.addInitScript(({ actor, session, guest, unsubscribed }) => {
    if (!guest) {
      const token = "mock." + btoa(JSON.stringify({ session_id: session })) +
        ".signature";
      localStorage.setItem(
        "sb-jkxxtyaanyhmjbdtybkp-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "mock-refresh",
          token_type: "bearer",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: {
            id: actor,
            email: "admin@example.test",
            user_metadata: {},
            app_metadata: {},
            aud: "authenticated",
          },
        }),
      );
    }
    Object.defineProperty(window, "Notification", {
      value: class {
        static permission = guest || unsubscribed
          ? localStorage.getItem("mock-push-permission") || "default"
          : "granted";
        static requests = 0;
        static async requestPermission() {
          this.requests += 1;
          this.permission = "granted";
          localStorage.setItem("mock-push-permission", "granted");
          return "granted";
        }
      },
      configurable: true,
    });
    const sub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/synthetic",
      keys: {
        p256dh: btoa(String.fromCharCode(4, ...new Uint8Array(64))),
        auth: btoa(String.fromCharCode(...new Uint8Array(16))),
      },
    };
    const subscription = { toJSON: () => sub };
    const registration = {
      pushManager: {
        getSubscription: async () =>
          guest || unsubscribed ? null : subscription,
        subscribe: async () => subscription,
      },
    };
    Object.defineProperty(navigator.serviceWorker, "ready", {
      value: Promise.resolve(registration),
    });
    Object.defineProperty(navigator.serviceWorker, "register", {
      value: async () => registration,
    });
    Object.defineProperty(window, "PushManager", { value: function () {} });
  }, { actor, session, guest, unsubscribed });
  await page.route("https://*.supabase.co/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname,
      action = path.split("/").at(-1)!;
    const input = req.postDataJSON() || {};
    if (path.includes("/push-subscriptions/")) {
      pushRequests.push(action);
      let data: unknown = guest
        ? {
          ...active,
          status: "pending",
          linkedUserId: null,
          linkedSessionId: null,
        }
        : active;
      if (action === "config") {
        data = {
          enabled: true,
          publicKey: btoa(String.fromCharCode(4, ...new Uint8Array(64))),
        };
      }
      if (action === "register") {
        data = { ...active, status: "pending", requestId: input.requestId };
      }
      await route.fulfill({ json: data });
      return;
    }
    if (path.includes("/admin-push/")) {
      requests.push({ action, input });
      if (action === "statistics") {
        if (statisticsMode === "failed" || statisticsMode === "denied") {
          await route.fulfill({
            status: statisticsMode === "denied" ? 403 : 503,
            json: {
              code: statisticsMode === "denied"
                ? "ADMIN_REQUIRED"
                : "STORAGE_UNAVAILABLE",
            },
          });
        } else {
          await route.fulfill({
            json: {
              members: statisticsMode === "zero" ? 0 : 42,
              devices: statisticsMode === "zero" ? 0 : 75,
              memberDevices: statisticsMode === "zero" ? 0 : 60,
              anonymousDevices: statisticsMode === "zero"
                ? 0
                : statisticsMode === "malformed"
                ? 100
                : 15,
              queriedAt: "2026-10-07T14:00:00.000Z",
            },
          });
        }
        return;
      }
      if (denied && action === "draft-list") {
        await route.fulfill({
          status: 403,
          contentType: "text/html",
          body: "denied",
        });
        return;
      }
      let data: unknown = {};
      if (action === "test" || action === "campaigns") {
        const content = input.content as Record<string, unknown>;
        data = {
          ...content,
          id: input.id,
          kind: action === "test" ? "test" : "manual",
          state: "queued",
          revision: 1,
          count: 2,
          candidateCount: 2,
          excludedBefore: 0,
          counts: action === "test" ? { accepted: 1 } : { pending: 2 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        };
        campaigns.set(
          input.requestId as string,
          data as Record<string, unknown>,
        );
        if (lose) {
          lose = false;
          await route.fulfill({
            status: 503,
            json: { code: "STORAGE_UNAVAILABLE" },
          });
          return;
        }
      } else if (action === "test-confirm") data = { confirmed: true };
      else if (action === "preview") {
        data = {
          id: input.id,
          previewToken: "token",
          count: 2,
          members: 1,
          anonymous: 1,
          expiresAt: new Date(Date.now() + 300000).toISOString(),
          duplicates: [],
          duplicateDigest: "digest",
        };
      } else if (action === "campaign-history") {
        data = { items: [...campaigns.values()] };
      } else if (action === "campaign-status") {
        data = input.idempotencyKey
          ? campaigns.get(input.idempotencyKey as string) || { found: false }
          : [...campaigns.values()].find((c) => c.id === input.id);
      } else if (action === "stop") {
        data = {
          ...[...campaigns.values()].find((c) => c.id === input.id),
          state: "stopping",
          revision: 2,
        };
      } else if (action === "members") {
        data = {
          items: [{
            id: member,
            name: "회원 이름",
            email: "member@example.test",
            subscriptions: 2,
          }],
        };
      } else if (action === "draft-save") {
        draft = { ...input, revision: 1 };
        data = { id: input.id, revision: 1 };
      } else if (action === "draft-list") {
        data = {
          items: draft
            ? [{
              id: draft.id,
              title: (draft.content as Record<string, unknown>).title,
              revision: 1,
            }]
            : [],
        };
      } else if (action === "draft-load") {
        data = { ...draft, removedMembers: 0 };
      }
      await route.fulfill({ json: data });
      return;
    }
    if (path.includes("/rpc/current_user_is_admin")) {
      await route.fulfill({ json: true });
      return;
    }
    await route.fulfill({ json: [] });
  });
  await page.goto("/");
  if (!guest && !unsubscribed) {
    await page.evaluate(async ({ installation, active }) => {
      const r = indexedDB.open("leet-push-v1", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("installation");
      await new Promise<void>((resolve, reject) => {
        r.onsuccess = () => resolve();
        r.onerror = () => reject(r.error);
      });
      const tx = r.result.transaction("installation", "readwrite");
      tx.objectStore("installation").put({
        installationId: installation,
        capability: "A".repeat(43),
        intent: 0,
        desiredUserId: active.linkedUserId,
        state: active,
      }, "current");
      await new Promise<void>((resolve) => tx.oncomplete = () => resolve());
      r.result.close();
    }, { installation, active });
    await page.goto("/admin/push");
  }
  return {
    setStatisticsMode: (mode: typeof statisticsMode) => {
      statisticsMode = mode;
    },
    requests,
    pushRequests,
    loseNext: () => {
      lose = true;
    },
    deny: () => {
      denied = true;
    },
  };
}
async function compose(page: Page) {
  await page.getByLabel("제목", { exact: true }).fill("운영 안내");
  await page.getByLabel("본문", { exact: true }).fill("새로운 안내입니다.");
}
async function confirm(page: Page) {
  await page.getByRole("button", { name: "내 기기로 테스트", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "기기에서 표시·이동 확인했습니다" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "기기에서 표시·이동 확인했습니다" })
    .click();
}
for (const width of [390, 1280]) {
  test(
    `푸시 구독 통계·새로고침·실패/0 구분·권한 회수 ${width}`,
    async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      const state = await mock(page);
      const summary = page.getByRole("region", { name: "푸시 구독 현황" });
      await expect(summary).toContainText("42명");
      await expect(summary).toContainText("75개");
      await expect(summary).toContainText("60개");
      await expect(summary).toContainText("15개");
      await expect(summary).toContainText("한국 시간");
      expect(
        await page.evaluate(() =>
          document.documentElement.scrollWidth <= window.innerWidth
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath("push-statistics.png"),
        fullPage: true,
      });
      await compose(page);
      state.setStatisticsMode("failed");
      await summary.getByRole("button", { name: "통계 새로고침" }).click();
      await expect(summary.getByRole("alert")).toContainText(
        "불러오지 못했습니다",
      );
      await expect(summary).not.toContainText("0명");
      await expect(page.getByLabel("제목", { exact: true })).toHaveValue(
        "운영 안내",
      );
      state.setStatisticsMode("malformed");
      await summary.getByRole("button", { name: "통계 새로고침" }).click();
      await expect(summary.getByRole("alert")).toContainText(
        "불러오지 못했습니다",
      );
      state.setStatisticsMode("zero");
      await summary.getByRole("button", { name: "통계 새로고침" }).click();
      await expect(summary).toContainText("0명");
      await expect(summary.getByRole("alert")).toHaveCount(0);
      await page.getByRole("tab", { name: "초안", exact: true }).click();
      await expect(summary).toBeVisible();
      state.setStatisticsMode("denied");
      await summary.getByRole("button", { name: "통계 새로고침" }).click();
      await expect(page.getByRole("alert")).toContainText("관리자 권한이 변경");
      await expect(summary).toHaveCount(0);
      expect(
        state.requests.every((item) =>
          ["statistics", "draft-list"].includes(item.action)
        ),
      ).toBe(true);
    },
  );
}
for (const width of [390, 1280]) {
  test(
    `필수 테스트·동일 내용 확인·발송 대상 확인·중단 ${width}`,
    async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      const state = await mock(page);
      await compose(page);
      await page.getByRole("button", { name: "발송 내용 확인" }).click();
      await expect(page.getByRole("alert")).toContainText("기기 테스트");
      expect(state.requests.filter((r) => r.action === "preview")).toHaveLength(
        0,
      );
      await confirm(page);
      await page.getByRole("button", { name: "발송 내용 확인" }).click();
      await expect(page.getByRole("dialog")).toContainText("비로그인 구독 1개");
      await page.screenshot({
        path: info.outputPath("push-confirm.png"),
        fullPage: true,
      });
      expect(
        await page.evaluate(() =>
          document.documentElement.scrollWidth <= innerWidth
        ),
      ).toBe(true);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.getByRole("button", { name: "발송 내용 확인" }).click();
      await page.getByRole("button", { name: "발송 접수", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "발송 이력", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "미전송 중단" }).last().click();
      await expect(page.getByText(/중단 처리 중/)).toBeVisible();
    },
  );
}
test("내용 수정은 테스트를 무효화하고 초안·선택 회원을 유지한다", async ({ page }) => {
  const state = await mock(page);
  await compose(page);
  await confirm(page);
  await page.getByLabel("제목", { exact: true }).fill("변경 제목");
  await expect(
    page.getByRole("button", { name: "기기에서 표시·이동 확인했습니다" }),
  ).toBeDisabled();
  await page.getByLabel("발송 대상", { exact: true }).selectOption("selected");
  await page.getByRole("button", { name: "발송 내용 확인" }).click();
  expect(state.requests.filter((r) => r.action === "preview")).toHaveLength(0);
  await page.getByRole("button", { name: "회원 검색", exact: true }).click();
  await page.getByRole("checkbox").check();
  await expect(page.getByLabel("선택한 회원")).toContainText("회원 이름");
  await page.getByRole("button", { name: "초안 저장", exact: true }).click();
  await page.getByRole("tab", { name: "초안", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "불러오기" }).click();
  await expect(page.getByLabel("제목", { exact: true })).toHaveValue(
    "변경 제목",
  );
  await expect(
    page.getByRole("button", { name: "기기에서 표시·이동 확인했습니다" }),
  ).toBeDisabled();
});
test("접수 응답 유실은 기존 요청을 대조하고 권한 회수 시 입력을 제거한다", async ({ page }) => {
  const state = await mock(page);
  await compose(page);
  state.loseNext();
  await page.getByRole("button", { name: "내 기기로 테스트" }).click();
  await expect(page.getByRole("button", { name: "기존 요청 접수 확인" }))
    .toBeVisible();
  await expect(page.getByLabel("제목", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "기존 요청 접수 확인" }).click();
  expect(state.requests.filter((r) => r.action === "test")).toHaveLength(1);
  state.deny();
  await page.getByRole("tab", { name: "초안", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("관리자 권한");
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.getByLabel("제목", { exact: true })).toHaveCount(0);
});
test(
  "비로그인 최초 허용 직후 닫고 링크 없이 서버 등록을 계속한다",
  async ({ page }, info) => {
    const state = await mock(page, true);
    let configSeen = false;
    let releaseConfig!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseConfig = resolve;
    });
    await page.route(
      "https://*.supabase.co/functions/v1/push-subscriptions/config",
      async (route) => {
        configSeen = true;
        await gate;
        await route.fulfill({
          json: {
            enabled: true,
            publicKey: btoa(String.fromCharCode(4, ...new Uint8Array(64))),
          },
        });
      },
    );
    try {
      await page.getByRole("button", { name: "알림 받을게요", exact: true })
        .click();
      await expect.poll(() => configSeen).toBe(true);
      // 서버 설정 응답을 아직 받지 않았어도 브라우저의 허용 직후 닫혀야 한다.
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(
        await page.evaluate(() =>
          localStorage.getItem("all-leet:push-prompt-snooze:v1")
        ),
      ).toBeNull();
      await page.screenshot({
        path: info.outputPath("push-permission-accepted.png"),
      });
    } finally {
      releaseConfig();
    }
    await expect.poll(() => state.pushRequests.includes("register")).toBe(true);
    await expect.poll(() => state.pushRequests.includes("state")).toBe(true);
    await expect(
      page.getByRole("button", { name: "서비스 알림 받기", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  },
);

for (const guest of [true, false]) {
  test(`홈 밖 서비스 접속도 미동의 ${guest ? "비회원" : "회원"}에게 팝업을 자동 표시한다`, async ({ page }) => {
    await mock(page, guest, true);
    await page.goto("/community");
    await expect(
      page.getByRole("button", { name: "서비스 알림 받기", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: "all LEET 소식을 놓치지 마세요" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        (Notification as unknown as { requests: number }).requests
      ),
    ).toBe(0);
  });
}

test("권한만 허용하고 서버 등록에 실패한 기기도 재접속 시 자동 안내한다", async ({ page }) => {
  await mock(page, true);
  await page.route(
    "https://*.supabase.co/functions/v1/push-subscriptions/config",
    (route) =>
      route.fulfill({ status: 503, json: { code: "STORAGE_UNAVAILABLE" } }),
  );
  await page.getByRole("button", { name: "알림 받을게요", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("all-leet:push-prompt-snooze:v1")
    ),
  ).toBeNull();
  await page.reload();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("button", { name: "등록 다시 확인", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      (Notification as unknown as { requests: number }).requests
    ),
  ).toBe(0);
});

for (const width of [390, 1280]) {
  test(
    `알림 팝업은 7일 유예를 유지하고 만료 후 다시 안내한다 ${width}`,
    async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await mock(page, true);
      await page.clock.install({ time: new Date("2026-10-07T00:00:00Z") });
      await expect(
        page.getByRole("heading", {
          name: "리트 채점은 all LEET",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "서비스 알림 받기", exact: true }),
      ).toHaveCount(0);
      await page.clock.runFor(3000);
      await expect(page.getByRole("dialog")).toBeVisible();
      expect(
        await page.evaluate(() =>
          (Notification as unknown as { requests: number }).requests
        ),
      ).toBe(0);
      await page.screenshot({
        path: info.outputPath(`push-popup-${width}.png`),
      });
      const box = await page.getByRole("dialog").boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      const beforeClose = await page.evaluate(() => Date.now());
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const until = await page.evaluate((beforeClose) => {
        const value = Number(
          localStorage.getItem("all-leet:push-prompt-snooze:v1"),
        );
        const week = 7 * 24 * 60 * 60 * 1000;
        if (value < beforeClose + week || value > Date.now() + week) {
          throw new Error("7일 유예 불일치");
        }
        return value;
      }, beforeClose);
      await page.reload();
      await expect(
        page.getByRole("heading", {
          name: "리트 채점은 all LEET",
          exact: true,
        }),
      ).toBeVisible();
      await page.clock.runFor(3000);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "서비스 알림 받기", exact: true }),
      ).toHaveCount(0);
      await page.clock.setSystemTime(until + 1);
      await page.reload();
      await expect(
        page.getByRole("heading", {
          name: "리트 채점은 all LEET",
          exact: true,
        }),
      ).toBeVisible();
      await page.clock.runFor(3000);
      await expect(page.getByRole("dialog")).toBeVisible();
      expect(
        await page.evaluate(() =>
          (Notification as unknown as { requests: number }).requests
        ),
      ).toBe(0);
    },
  );
}

test("확인창에서 접수 응답이 유실되어도 기존 요청 조회 버튼에 접근할 수 있다", async ({ page }) => {
  const state = await mock(page);
  await compose(page);
  await confirm(page);
  await page.getByRole("button", { name: "발송 내용 확인" }).click();
  state.loseNext();
  await page.getByRole("button", { name: "발송 접수", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "기존 요청 접수 확인" }))
    .toBeVisible();
  await page.getByRole("button", { name: "기존 요청 접수 확인" }).click();
  await expect(page.getByRole("heading", { name: "발송 이력", exact: true }))
    .toBeVisible();
  expect(state.requests.filter((r) => r.action === "campaigns")).toHaveLength(
    1,
  );
});
