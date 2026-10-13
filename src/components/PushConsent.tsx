import { useEffect, useState } from "react";
import { Bell } from "lucide-react@0.487.0";
import { usePushSubscription } from "../hooks/usePushSubscription";
import { isNaverInAppBrowser } from "../utils/naverBrowser";
import {
  hasPushPermissionHistory,
  PUSH_PERMISSION_HISTORY_KEY,
  rememberPushPermissionGranted,
} from "../utils/pushPromptPreferences";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import "../styles/push.css";

const SNOOZE_KEY = "all-leet:push-prompt-snooze:v1";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
function readSnooze(fallback = 0): number {
  try {
    const until = Number(window.localStorage.getItem(SNOOZE_KEY));
    return Number.isFinite(until) && until > 0 ? until : 0;
  } catch {
    return fallback;
  }
}

export function PushConsent() {
  if (typeof navigator !== "undefined" && isNaverInAppBrowser(navigator.userAgent)) {
    return null;
  }
  return <PushConsentAvailable />;
}

function PushConsentAvailable() {
  const push = usePushSubscription();
  if (
    !push.enabled || !push.supported || push.permission !== "default" ||
    push.state?.status === "active" || push.state?.status === "pending" ||
    hasPushPermissionHistory()
  ) return null;
  return <PushConsentPrompt push={push} />;
}

function PushConsentPrompt({ push }: {
  push: ReturnType<typeof usePushSubscription>;
}) {
  const [open, setOpen] = useState(false);
  const [permissionAccepted, setPermissionAccepted] = useState(hasPushPermissionHistory);
  const [snoozedUntil, setSnoozedUntil] = useState(() => readSnooze());
  const [wake, setWake] = useState(0);
  const active = push.state?.status === "active";
  const pending = push.state?.status === "pending";
  const canPrompt = push.enabled && push.supported &&
    push.permission === "default" && !active && !pending && !permissionAccepted;

  useEffect(() => {
    if (!push.enabled) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      setSnoozedUntil((previous) => readSnooze(previous));
      setPermissionAccepted((previous) => previous || hasPushPermissionHistory());
      setWake((previous) => previous + 1);
    };
    const storage = (event: StorageEvent) => {
      if (event.key !== SNOOZE_KEY && event.key !== PUSH_PERMISSION_HISTORY_KEY && event.key !== null) return;
      refresh();
      if (readSnooze() > Date.now()) setOpen(false);
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", storage);
    document.addEventListener("visibilitychange", refresh);
    document.addEventListener("focusout", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", storage);
      document.removeEventListener("visibilitychange", refresh);
      document.removeEventListener("focusout", refresh);
    };
  }, [push.enabled]);

  useEffect(() => {
    if (!canPrompt || open) return;
    let timer: number;
    const show = () => {
      if (document.visibilityState !== "visible") return;
      // 먼저 열린 팝업이 닫힌 뒤에도 자동 표시를 다시 시도한다.
      if (document.querySelector('[role="dialog"]')) {
        timer = window.setTimeout(show, 1000);
        return;
      }
      if (hasPushPermissionHistory() || readSnooze(snoozedUntil) > Date.now()) return;
      setOpen(true);
    };
    timer = window.setTimeout(show, Math.max(3000, snoozedUntil - Date.now()));
    return () => window.clearTimeout(timer);
  }, [canPrompt, open, snoozedUntil, wake]);

  function changeOpen(next: boolean) {
    if (next) {
      setOpen(true);
      return;
    }
    const until = Date.now() + SNOOZE_MS;
    setSnoozedUntil(until);
    try {
      window.localStorage.setItem(SNOOZE_KEY, String(until));
    } catch {
      /* 저장소가 차단되어도 현재 화면에서는 반복해서 표시하지 않는다. */
    }
    setOpen(false);
  }

  return (
    <Dialog open={open && canPrompt} onOpenChange={changeOpen}>
      <DialogContent
        className="push-consent-popup"
        overlayClassName="push-modal-overlay"
        closeLabel="나중에 안내 받기"
      >
        <div className="push-consent-icon" aria-hidden="true">
          <Bell />
        </div>
        <p className="push-consent-brand">all LEET</p>
        <DialogTitle>all LEET 소식을 놓치지 마세요</DialogTitle>
        <DialogDescription>운영 안내와 서비스 소식을 이 기기의 알림으로 받아보세요.</DialogDescription>
        <div className="push-consent-benefit">
          <p>로그인 없이도 받을 수 있어요</p>
          <p>브라우저·OS 설정에서 언제든 철회할 수 있어요</p>
        </div>
        {push.error && <p className="push-error" role="alert">{push.error}</p>}
        <div className="push-consent-buttons">
          <button
            className="push-consent-allow"
            type="button"
            disabled={push.busy}
            onClick={() => void push.subscribe(() => {
              // 허용 직후 닫고 등록은 계속한다. '나중에' 유예는 기록하지 않는다.
              rememberPushPermissionGranted();
              setPermissionAccepted(true);
              setOpen(false);
            })}
          >
            {push.busy ? "등록 중…" : "알림 받을게요"}
          </button>
          <button
            className="push-consent-later"
            type="button"
            onClick={() => changeOpen(false)}
          >
            나중에
          </button>
        </div>
        <p className="push-consent-footnote">
          다음 단계에서 브라우저의 알림 허용을 선택해주세요.
        </p>
      </DialogContent>
    </Dialog>
  );
}
