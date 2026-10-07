import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
const mock = vi.hoisted(() => ({ request: vi.fn(), session: vi.fn() }));
vi.mock(
  "./pushApi",
  () => ({ pushEnabled: () => true, pushRequest: mock.request }),
);
vi.mock(
  "../contexts/AuthContext",
  () => ({ supabase: { auth: { getSession: mock.session } } }),
);
let local: Record<string, unknown>;
const actor = "00000000-0000-4000-8000-000000000001";
const active = {
  status: "active",
  installationRevision: 2,
  bindingRevision: 1,
  subscriptionRevision: 2,
  linkedUserId: actor,
  linkedSessionId: "session",
};
beforeEach(() => {
  vi.resetModules();
  mock.request.mockReset();
  mock.session.mockReset();
  vi.stubGlobal("crypto", webcrypto);
  local = {
    installationId: crypto.randomUUID(),
    capability: "C".repeat(43),
    intent: 0,
    desiredUserId: actor,
    state: active,
  };
  vi.stubGlobal("LEETPushCore", {
    read: async () => structuredClone(local),
    mutate: async (
      fn: (old: Record<string, unknown>) => Record<string, unknown>,
    ) => {
      local = fn(local);
      return structuredClone(local);
    },
    fingerprint: async () => "fingerprint",
  });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      ready: Promise.resolve({
        pushManager: {
          getSubscription: async () => ({
            toJSON: () => ({ endpoint: "synthetic" }),
            options: {
              applicationServerKey:
                new Uint8Array([4, ...new Uint8Array(64)]).buffer,
            },
          }),
        },
      }),
    },
  });
  vi.stubGlobal("PushManager", function () {});
  vi.stubGlobal("Notification", { permission: "granted" });
  mock.session.mockResolvedValue({
    data: {
      session: {
        user: { id: actor },
        access_token: "mock." +
          btoa(JSON.stringify({ session_id: "session" })) + ".sig",
      },
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (navigator as unknown as Record<string, unknown>).serviceWorker;
});
describe("installation races", () => {
  it("등록 ACK가 먼저 도착하면 늦은 pending 응답이 active를 덮지 않는다", async () => {
    mock.request.mockImplementation(async (_kind: string, action: string) => {
      if (action === "config") {
        return {
          enabled: true,
          publicKey: btoa(String.fromCharCode(4, ...new Uint8Array(64))),
        };
      }
      local = { ...local, state: active };
      return { ...active, status: "pending" };
    });
    const { registerPush } = await import("./pushInstallation");
    expect((await registerPush()).status).toBe("active");
    expect(local.state).toEqual(active);
  });
  it("현재 VAPID 키가 바뀌어도 기존 구독은 원래 보존 키로 확인한다", async () => {
    const oldKey = btoa(String.fromCharCode(4, ...new Uint8Array(64))).replace(
      /=/g,
      "",
    ).replace(/\+/g, "-").replace(/\//g, "_");
    mock.request.mockImplementation(async (_kind: string, action: string) =>
      action === "config"
        ? {
          enabled: true,
          publicKey: oldKey,
          keyId: "v2",
          publicKeys: { v1: oldKey, v2: "different-key" },
        }
        : active
    );
    const { registerPush } = await import("./pushInstallation");
    await registerPush();
    expect(
      mock.request.mock.calls.find((c) => c[1] === "register")?.[2].vapidKeyId,
    ).toBe("v1");
  });
  it("대기 중인 A 로그아웃 뒤 B 로그인으로 바뀌면 A의 늦은 detach를 보내지 않는다", async () => {
    mock.request.mockResolvedValue(active);
    mock.session.mockResolvedValueOnce({
      data: { session: { user: { id: actor }, access_token: "token" } },
    }).mockResolvedValue({
      data: {
        session: { user: { id: "another-account" }, access_token: "token" },
      },
    });
    const { syncPushInstallation } = await import("./pushInstallation");
    expect(await syncPushInstallation(null)).toBeNull();
    expect(mock.request.mock.calls).toHaveLength(0);
  });
  it("로그아웃은 느린 네트워크를 3초 뒤 취소하고 미완료 의도를 남긴다", async () => {
    vi.useFakeTimers();
    mock.request.mockImplementation((
      _kind: string,
      _action: string,
      _input: unknown,
      signal: AbortSignal,
    ) =>
      new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(new Error("aborted")))
      )
    );
    const { detachPushBeforeLogout } = await import("./pushInstallation");
    const detached = detachPushBeforeLogout();
    await vi.advanceTimersByTimeAsync(3000);
    await detached;
    expect(local.desiredUserId).toBeNull();
    expect(local.dirty).toBe(true);
  });
});
