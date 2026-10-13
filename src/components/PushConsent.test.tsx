import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PushConsent } from "./PushConsent";
import { PUSH_PERMISSION_HISTORY_KEY } from "../utils/pushPromptPreferences";

const mock = vi.hoisted(() => ({
  useSubscription: vi.fn(),
  value: {
    enabled: true,
    supported: true,
    needsInstall: false,
    checked: true,
    permission: "default" as NotificationPermission,
    state: null as { status: string } | null,
    error: "",
    busy: false,
    subscribe: vi.fn(),
    refresh: vi.fn(),
  },
}));
vi.mock(
  "../hooks/usePushSubscription",
  () => ({ usePushSubscription: mock.useSubscription }),
);
const key = "all-leet:push-prompt-snooze:v1", week = 7 * 24 * 60 * 60 * 1000;
beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (name: string) => values.get(name) ?? null,
      setItem: (name: string, value: string) => values.set(name, String(value)),
      removeItem: (name: string) => values.delete(name),
      clear: () => values.clear(),
    },
  });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-07T00:00:00Z"));
  window.localStorage.clear();
  Object.assign(mock.value, {
    enabled: true,
    supported: true,
    needsInstall: false,
    checked: true,
    permission: "default",
    state: null,
    error: "",
    busy: false,
  });
  mock.value.subscribe.mockReset();
  mock.useSubscription.mockReset().mockReturnValue(mock.value);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function wait(ms = 3000) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}
describe("알림 동의 팝업", () => {
  it.each([
    "Mozilla/5.0 (iPhone) Mobile/15E148 Safari/604.1 NAVER(inapp; search; 620; 10.10.2; XR)",
    "Mozilla/5.0 (Linux; Android 14; wv) Mobile Safari/537.36 NAVER (inapp; search; 550; 8.2.0)",
    "Mozilla/5.0 (Linux; Android 14) Mobile Safari/537.36 NAVER (higgs; search; 550; 8.2.0; 20.50.533.26)",
  ])("네이버앱에서는 알림 hook과 자동 안내를 실행하지 않는다: %s", (ua) => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
    const view = render(<PushConsent />);
    wait(10000);
    fireEvent.focus(window);
    wait(week);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mock.useSubscription).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(key)).toBeNull();
    view.unmount();
    render(<PushConsent />);
    wait();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mock.useSubscription).not.toHaveBeenCalled();
  });
  it("웹 알림을 지원하지 않는 Safari에서는 설치 안내도 표시하지 않는다", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone) Version/18.0 Mobile/15E148 Safari/604.1",
    );
    Object.assign(mock.value, { needsInstall: true, supported: false });
    render(<PushConsent />);
    wait();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("표시 조건은 홈 화면 실행 여부 대신 웹 알림 지원과 동의 상태를 사용한다", () => {
    Object.assign(mock.value, { needsInstall: true, supported: true });
    render(<PushConsent />);
    wait();
    expect(screen.getByRole("heading", { name: "all LEET 소식을 놓치지 마세요" })).toBeVisible();
    expect(screen.getByRole("button", { name: "알림 받을게요" })).toBeVisible();
    expect(screen.queryByText("홈 화면에 추가하고 알림을 받아보세요")).not.toBeInTheDocument();
  });
  it("3초 뒤 안내만 표시하고 버튼을 눌렀을 때만 권한 요청을 시작한다", () => {
    render(<PushConsent />);
    expect(screen.queryByRole("button", { name: "서비스 알림 받기" })).not.toBeInTheDocument();
    wait(2999);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    wait(1);
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(mock.value.subscribe).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "알림 받을게요" }));
    expect(mock.value.subscribe).toHaveBeenCalledTimes(1);
  });
  it("나중에는 새로고침에도 유지되며 7일 경과 뒤 다시 안내한다", () => {
    let view = render(<PushConsent />);
    wait();
    fireEvent.click(
      screen.getByRole("button", { name: "나중에" }),
    );
    const until = Date.now() + week;
    expect(window.localStorage.getItem(key)).toBe(String(until));
    view.unmount();
    vi.setSystemTime(until - 10000);
    view = render(<PushConsent />);
    wait();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    view.unmount();
    vi.setSystemTime(until + 1);
    render(<PushConsent />);
    wait();
    expect(screen.getByRole("dialog")).toBeVisible();
  });
  it("권한 허용 이력을 남기고 등록 실패·재접속·권한 초기화 뒤에도 자동으로 다시 열지 않는다", () => {
    const view = render(<PushConsent />);
    wait();
    fireEvent.click(screen.getByRole("button", { name: "알림 받을게요" }));
    const onGranted = mock.value.subscribe.mock.calls[0][0] as () => void;
    Object.assign(mock.value, { permission: "granted", busy: true });
    act(() => onGranted());
    view.rerender(<PushConsent />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(key)).toBeNull();
    expect(window.localStorage.getItem(PUSH_PERMISSION_HISTORY_KEY)).toBe("1");
    Object.assign(mock.value, { busy: false, error: "등록 실패" });
    view.rerender(<PushConsent />);
    fireEvent.focus(window);
    wait(10000);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    view.unmount();
    Object.assign(mock.value, { permission: "default" });
    render(<PushConsent />);
    wait(week + 10000);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(key)).toBeNull();
  });
  it("알림 권한을 거절하면 팝업을 숨기고 차단 안내와 7일 유예를 남기지 않는다", () => {
    const view = render(<PushConsent />);
    wait();
    fireEvent.click(screen.getByRole("button", { name: "알림 받을게요" }));
    Object.assign(mock.value, { permission: "denied" });
    view.rerender(<PushConsent />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(key)).toBeNull();
    expect(window.localStorage.getItem(PUSH_PERMISSION_HISTORY_KEY)).toBeNull();
  });
  it("닫기 버튼도 7일 유예를 저장하며 별도 재진입 링크는 없다", () => {
    render(<PushConsent />);
    wait();
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "나중에 안내 받기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(key)).toBe(String(Date.now() + week));
    expect(screen.queryByRole("button", { name: "서비스 알림 받기" })).not.toBeInTheDocument();
  });
  it.each([
    { checked: false, permission: "granted" },
    { checked: true, permission: "granted", error: "서버 등록 실패" },
    { needsInstall: true, permission: "granted" },
    { permission: "denied" },
    { supported: false, checked: false },
    { supported: false, checked: true },
    { needsInstall: true, supported: false, checked: false },
    { state: { status: "active" } },
    { state: { status: "pending" } },
    { enabled: false },
  ])(
    "허용·차단·미지원·등록 완료·대기·비활성에는 자동 표시하지 않는다: %j",
    (condition) => {
      Object.assign(mock.value, condition);
      render(<PushConsent />);
      wait();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(mock.value.subscribe).not.toHaveBeenCalled();
    },
  );
  it.each([
    { checked: false },
    { checked: true, error: "서버 확인 실패" },
  ])(
    "웹 알림 지원·미결정·허용 이력 없음에만 자동 안내한다: %j",
    (condition) => {
      Object.assign(mock.value, condition);
      render(<PushConsent />);
      expect(screen.queryByRole("button", { name: "서비스 알림 받기" })).not
        .toBeInTheDocument();
      wait();
      expect(screen.getByRole("dialog")).toBeVisible();
      expect(mock.value.subscribe).not.toHaveBeenCalled();
    },
  );
  it("다른 탭에서 허용 이력이 기록되면 열린 팝업도 즉시 숨긴다", () => {
    render(<PushConsent />);
    wait();
    expect(screen.getByRole("dialog")).toBeVisible();
    window.localStorage.setItem(PUSH_PERMISSION_HISTORY_KEY, "1");
    fireEvent(window, new StorageEvent("storage", { key: PUSH_PERMISSION_HISTORY_KEY, newValue: "1" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(key)).toBeNull();
    wait(week + 10000);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("저장소가 차단되어도 현재 화면에서는 나중에를 반복 표시하지 않는다", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<PushConsent />);
    wait();
    fireEvent.click(
      screen.getByRole("button", { name: "나중에" }),
    );
    wait(10000);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
