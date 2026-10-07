import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  PushApiError,
  pushEnabled,
  pushErrorMessage,
  type PushState,
} from "../utils/pushApi";
import { registerPush, syncPushInstallation } from "../utils/pushInstallation";
export function usePushSubscription() {
  const { currentUser } = useAuth();
  const [state, setState] = useState<PushState | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [checked, setChecked] = useState(false),
    [permission, setPermission] = useState<NotificationPermission>(() =>
      typeof Notification === "undefined" ? "default" : Notification.permission
    );
  const enabled = pushEnabled(), userId = currentUser?.id || null;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const supported = enabled && typeof navigator !== "undefined" &&
    isSecureContext && "serviceWorker" in navigator &&
    "PushManager" in window && "Notification" in window;
  const ios = typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  const needsInstall = ios && typeof window !== "undefined" &&
    !window.matchMedia("(display-mode: standalone)").matches &&
    !(navigator as Navigator & { standalone?: boolean }).standalone;
  const refresh = useCallback(async () => {
    if (!supported || needsInstall) return;
    try {
      navigator.serviceWorker.controller?.postMessage({ type: "PUSH_SYNC" });
      const result = await syncPushInstallation(userId);
      if (mounted.current) {
        setState(result);
        setError("");
      }
    } catch (e) {
      console.warn("push", {
        code: e instanceof PushApiError ? e.code : "SYNC_PENDING",
      });
      if (mounted.current) {
        setError(
          pushErrorMessage(e, "알림 등록 상태를 확인하지 못했습니다."),
        );
      }
    } finally {
      if (mounted.current) {
        setChecked(true);
        setPermission(Notification.permission);
      }
    }
  }, [supported, needsInstall, userId]);
  useEffect(() => {
    let active = true;
    const wake = () => {
      if (active && document.visibilityState === "visible") void refresh();
    };
    wake();
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    const message = (e: MessageEvent) => {
      if (e.data?.type === "PUSH_STATE_CHANGED") wake();
    };
    navigator.serviceWorker?.addEventListener("message", message);
    return () => {
      active = false;
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
      navigator.serviceWorker?.removeEventListener("message", message);
    };
  }, [refresh]);
  async function subscribe(onPermissionGranted?: () => void) {
    if (!supported || needsInstall) return;
    setBusy(true);
    setError("");
    try {
      const permission = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
      if (mounted.current) setPermission(permission);
      if (permission !== "granted") {
        setError("브라우저 사이트 설정에서 알림 권한을 변경할 수 있습니다.");
        return;
      }
      if (mounted.current) onPermissionGranted?.();
      const result = await registerPush();
      if (mounted.current) setState(result);
      await refresh();
    } catch (e) {
      console.warn("push", {
        code: e instanceof PushApiError ? e.code : "REGISTRATION_FAILED",
      });
      if (mounted.current) {
        setError(
          pushErrorMessage(e, "알림을 등록하지 못했습니다. 다시 확인해주세요."),
        );
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return {
    enabled,
    supported,
    needsInstall,
    state,
    error,
    busy,
    checked,
    subscribe,
    refresh,
    permission,
  };
}
