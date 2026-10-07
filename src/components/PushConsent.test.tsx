import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PushConsent } from "./PushConsent";

const mock = vi.hoisted(() => ({
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
  () => ({ usePushSubscription: () => mock.value }),
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
  it("권한 허용 즉시 닫고 등록 지연·실패에도 같은 방문에서 자동으로 다시 열지 않는다", () => {
    const view = render(<PushConsent />);
    wait();
    fireEvent.click(screen.getByRole("button", { name: "알림 받을게요" }));
    const onGranted = mock.value.subscribe.mock.calls[0][0] as () => void;
    Object.assign(mock.value, { permission: "granted", busy: true });
    act(() => onGranted());
    view.rerender(<PushConsent />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(key)).toBeNull();
    Object.assign(mock.value, { busy: false, error: "등록 실패" });
    view.rerender(<PushConsent />);
    fireEvent.focus(window);
    wait(10000);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    view.unmount();
    render(<PushConsent />);
    wait();
    expect(screen.getByRole("alert")).toHaveTextContent("등록 실패");
    mock.value.subscribe.mockImplementation((callback: () => void) => callback());
    fireEvent.click(screen.getByRole("button", { name: "등록 다시 확인" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(key)).toBeNull();
  });
  it("알림 권한을 거절하면 팝업과 차단 안내를 유지한다", () => {
    const view = render(<PushConsent />);
    wait();
    fireEvent.click(screen.getByRole("button", { name: "알림 받을게요" }));
    Object.assign(mock.value, { permission: "denied" });
    view.rerender(<PushConsent />);
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("heading", { name: "이 기기의 알림이 차단되어 있어요" })).toBeVisible();
    expect(window.localStorage.getItem(key)).toBeNull();
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
    { state: { status: "active" } },
    { state: { status: "pending" } },
    { enabled: false },
  ])(
    "허용한 기기의 확인 전·등록 완료·대기·비활성에는 자동 표시하지 않는다: %j",
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
    { permission: "granted", error: "서버 확인 실패" },
    { permission: "denied" },
    { needsInstall: true, supported: false, checked: false },
    { supported: false, checked: false },
  ])(
    "미동의·미등록·차단·설치 필요는 직접 누르지 않아도 안내한다: %j",
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
