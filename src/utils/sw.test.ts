// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
const source = readFileSync(
  new URL("../public/sw.js", import.meta.url),
  "utf8",
);
const install = "00000000-0000-4000-8000-000000000001",
  request = "00000000-0000-4000-8000-000000000002";
function setup() {
  let local: Record<string, unknown> = {
    installationId: install,
    requestId: request,
    capability: "C".repeat(43),
    fingerprint: "fingerprint",
    registrationRevision: 2,
    apiBase:
      "https://jkxxtyaanyhmjbdtybkp.supabase.co/functions/v1/push-subscriptions",
    apiKey: "public",
  };
  const listeners: Record<string, (event: Record<string, unknown>) => void> =
    {};
  const notifications: Array<
      { title: string; options: Record<string, unknown> }
    > = [],
    requests: Array<RequestInit> = [],
    opened: string[] = [];
  let offline = false;
  const core = {
    read: async () => local,
    mutate: async (
      fn: (s: Record<string, unknown>) => Record<string, unknown>,
    ) => local = fn(local),
    fingerprint: async () => "fingerprint",
    safePath: (p: unknown) =>
      typeof p === "string" && ["/", "/community"].includes(p) ? p : "/",
  };
  const self = {
    addEventListener: (type: string, fn: typeof listeners[string]) =>
      listeners[type] = fn,
    LEETPushCore: core,
    location: { origin: "https://app.invalid" },
    registration: {
      showNotification: async (
        title: string,
        options: Record<string, unknown>,
      ) => {
        notifications.push({ title, options });
      },
      pushManager: { getSubscription: async () => ({}) },
    },
    clients: {
      matchAll: async () => [],
      openWindow: async (url: string) => {
        opened.push(url);
      },
    },
  };
  runInNewContext(source, {
    self,
    importScripts: () => {},
    Date,
    JSON,
    TextEncoder,
    URL,
    AbortSignal,
    fetch: async (_url: string, init: RequestInit) => {
      requests.push(init);
      if (offline) throw Error("offline");
      return new Response(
        JSON.stringify({ status: "active", installationRevision: 2 }),
        { status: 200 },
      );
    },
  });
  const emit = async (type: string, event: Record<string, unknown>) => {
    let task: Promise<unknown> | undefined;
    listeners[type]({ ...event, waitUntil: (p: Promise<unknown>) => task = p });
    await task;
  };
  const push = async (patch: Record<string, unknown> = {}) =>
    emit("push", {
      data: {
        text: () =>
          JSON.stringify({
            version: 1,
            type: "registration",
            installationId: install,
            requestId: request,
            fingerprint: "fingerprint",
            revision: 2,
            nonce: "N".repeat(43),
            expiresAt: new Date(Date.now() + 60000).toISOString(),
            ...patch,
          }),
      },
    });
  return {
    push,
    emit,
    requests,
    notifications,
    opened,
    get local() {
      return local;
    },
    setOffline: (value: boolean) => offline = value,
  };
}
describe("service worker ownership and visible push", () => {
  it("다른 installation의 challenge는 표시만 하고 ACK하지 않는다", async () => {
    const s = setup();
    await s.push({ installationId: request });
    expect(s.notifications).toHaveLength(1);
    expect(s.requests).toHaveLength(0);
  });
  it("현재 challenge만 공개키와 capability로 확인하고 로그인 JWT를 보내지 않는다", async () => {
    const s = setup();
    await s.push();
    expect(s.notifications[0].title).toBe("알림 등록 확인");
    expect(s.local.state).toEqual({
      status: "active",
      installationRevision: 2,
    });
    expect(s.requests[0].headers).not.toHaveProperty("Authorization");
    expect(JSON.parse(String(s.requests[0].body)).capability).toBe(
      "C".repeat(43),
    );
    expect(s.local.ack).toBeUndefined();
  });
  it("오프라인 ACK를 보존하고 온라인 wake에서 같은 request로 재시도한다", async () => {
    const s = setup();
    s.setOffline(true);
    await s.push();
    expect(s.local.ack).toMatchObject({ requestId: request });
    s.setOffline(false);
    await s.emit("message", { data: { type: "PUSH_SYNC" } });
    expect(s.local.ack).toBeUndefined();
    expect(s.requests).toHaveLength(2);
    expect(s.requests[0].body).toBe(s.requests[1].body);
  });
  it("만료·깨진 payload는 보이는 홈 안내로 대체한다", async () => {
    const s = setup();
    await s.push({ expiresAt: "2000-01-01" });
    expect(s.requests).toHaveLength(0);
    expect(s.notifications[0].options.data).toEqual({ path: "/" });
  });
  it("알림 클릭의 외부 링크는 홈으로 제한한다", async () => {
    const s = setup();
    await s.emit("notificationclick", {
      notification: { close: () => {}, data: { path: "https://evil.invalid" } },
    });
    expect(s.opened).toEqual(["https://app.invalid/"]);
  });
});
