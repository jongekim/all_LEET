import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePushSubscription } from "./usePushSubscription";
import { PUSH_PERMISSION_HISTORY_KEY } from "../utils/pushPromptPreferences";

const mock = vi.hoisted(() => ({ register: vi.fn(), sync: vi.fn(), standalone: false }));
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ currentUser: null }) }));
vi.mock("../utils/pushInstallation", () => ({ registerPush: mock.register, syncPushInstallation: mock.sync }));
vi.mock("../utils/pushApi", () => ({
  pushEnabled: () => true,
  PushApiError: class extends Error {},
  pushErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

let notification: { permission: NotificationPermission; requestPermission: ReturnType<typeof vi.fn> };
beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      clear: () => values.clear(),
    },
  });
  mock.standalone = false;
  mock.register.mockReset();
  mock.sync.mockReset().mockResolvedValue(null);
  notification = { permission: "default", requestPermission: vi.fn(async () => {
    notification.permission = "granted";
    return "granted";
  }) };
  vi.stubGlobal("Notification", notification);
  vi.stubGlobal("PushManager", function () {});
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("matchMedia", () => ({ matches: mock.standalone }));
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (navigator as unknown as Record<string, unknown>).serviceWorker;
});

describe("알림 허용 이력과 실제 지원 여부", () => {
  it("접속 때 이미 허용된 권한도 이력으로 기록한다", async () => {
    notification.permission = "granted";
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.checked).toBe(true));
    expect(window.localStorage.getItem(PUSH_PERMISSION_HISTORY_KEY)).toBe("1");
    expect(notification.requestPermission).not.toHaveBeenCalled();
  });
  it("등록 실패 전 허용 이력을 기록하고 허용 콜백을 실행한다", async () => {
    mock.register.mockRejectedValue(new Error("server unavailable"));
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.checked).toBe(true));
    const accepted = vi.fn(() => expect(window.localStorage.getItem(PUSH_PERMISSION_HISTORY_KEY)).toBe("1"));
    await act(async () => { await result.current.subscribe(accepted); });
    expect(accepted).toHaveBeenCalledOnce();
    expect(result.current.permission).toBe("granted");
    expect(result.current.error).toContain("등록하지 못했습니다");
  });
  it("기존 설치 기록으로도 과거 허용 이력을 보존한다", async () => {
    mock.sync.mockResolvedValue({ status: "disabled" });
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.checked).toBe(true));
    expect(result.current.permission).toBe("default");
    expect(window.localStorage.getItem(PUSH_PERMISSION_HISTORY_KEY)).toBe("1");
  });
  it("API 이름이 존재해도 iOS 일반 브라우저는 실제 구독 지원으로 판단하지 않는다", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone) Safari/604.1");
    const { result } = renderHook(() => usePushSubscription());
    expect(result.current.needsInstall).toBe(true);
    expect(result.current.supported).toBe(false);
    await act(async () => { await result.current.subscribe(); });
    expect(mock.sync).not.toHaveBeenCalled();
    expect(mock.register).not.toHaveBeenCalled();
    expect(notification.requestPermission).not.toHaveBeenCalled();
  });
  it("iOS 홈 화면 앱은 API가 있으면 구독을 지원한다", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone) Safari/604.1");
    mock.standalone = true;
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.checked).toBe(true));
    expect(result.current.needsInstall).toBe(false);
    expect(result.current.supported).toBe(true);
  });
  it("이력 저장이 차단되어도 권한 허용과 구독 등록을 계속한다", async () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    mock.register.mockResolvedValue({ status: "pending" });
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.checked).toBe(true));
    await act(async () => { await result.current.subscribe(); });
    expect(mock.register).toHaveBeenCalledOnce();
    expect(result.current.permission).toBe("granted");
  });
});
