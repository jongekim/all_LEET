import { useEffect, useState } from "react";
import { Bell } from "lucide-react@0.487.0";
import { usePushSubscription } from "../hooks/usePushSubscription";
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
  const push = usePushSubscription();
  if (!push.enabled || push.state?.status === "active") return null;
  return <PushConsentPrompt push={push} />;
}

function PushConsentPrompt({ push }: {
  push: ReturnType<typeof usePushSubscription>;
}) {
  const [open, setOpen] = useState(false);
  const [permissionAccepted, setPermissionAccepted] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState(() => readSnooze());
  const [wake, setWake] = useState(0);
  const active = push.state?.status === "active";
  const pending = push.state?.status === "pending";
  const denied = push.permission === "denied";
  // 권한이 없으면 서버 확인 실패와 관계없이 동의/설치 안내를 제공한다.
  // 이미 허용한 기기는 등록 상태 확인이 끝난 뒤 미등록일 때만 안내한다.
  const canPrompt = push.enabled && !active && !pending && !permissionAccepted &&
    (push.permission !== "granted" || !push.supported || push.needsInstall ||
      push.checked);

  useEffect(() => {
    if (!push.enabled) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      setSnoozedUntil((previous) => readSnooze(previous));
      setWake((previous) => previous + 1);
    };
    const storage = (event: StorageEvent) => {
      if (event.key !== SNOOZE_KEY && event.key !== null) return;
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
      if (readSnooze(snoozedUntil) > Date.now()) return;
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

  const title = push.needsInstall
    ? "홈 화면에 추가하고 알림을 받아보세요"
    : denied
    ? "이 기기의 알림이 차단되어 있어요"
    : !push.supported
    ? "이 브라우저에서는 알림을 받을 수 없어요"
    : pending
    ? "알림 등록을 확인하고 있어요"
    : "all LEET 소식을 놓치지 마세요";
  const description = push.needsInstall
    ? "공유 메뉴에서 홈 화면에 추가한 뒤, 추가한 all LEET 앱에서 알림 받기를 눌러주세요."
    : denied
    ? "브라우저의 사이트 설정에서 알림 권한을 변경한 뒤 다시 확인해주세요."
    : !push.supported
    ? "웹 푸시를 지원하는 브라우저에서 다시 확인해주세요."
    : pending
    ? "권한은 허용됐습니다. 등록 확인 알림과 서버 확인이 끝나면 발송 대상에 포함됩니다."
    : "운영 안내와 서비스 소식을 이 기기의 알림으로 받아보세요.";

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        className="push-consent-popup"
        overlayClassName="push-modal-overlay"
        closeLabel="나중에 안내 받기"
      >
        <div className="push-consent-icon" aria-hidden="true">
          <Bell />
        </div>
        <p className="push-consent-brand">all LEET</p>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {!push.needsInstall && !denied && push.supported && !pending && (
          <div className="push-consent-benefit">
            <p>로그인 없이도 받을 수 있어요</p>
            <p>브라우저·OS 설정에서 언제든 철회할 수 있어요</p>
          </div>
        )}
        {push.error && <p className="push-error" role="alert">{push.error}</p>}
        <div className="push-consent-buttons">
          {push.supported && !push.needsInstall && !denied && (
            <button
              className="push-consent-allow"
              type="button"
              disabled={push.busy}
              onClick={() => void (pending ? push.refresh() : push.subscribe(() => {
                // 허용 직후 닫고 등록은 계속한다. '나중에' 유예는 기록하지 않는다.
                setPermissionAccepted(true);
                setOpen(false);
              }))}
            >
              {push.busy
                ? "등록 중…"
                : pending
                ? "등록 상태 확인"
                : push.permission === "granted"
                ? "등록 다시 확인"
                : "알림 받을게요"}
            </button>
          )}
          <button
            className="push-consent-later"
            type="button"
            onClick={() => changeOpen(false)}
          >
            나중에
          </button>
        </div>
        <p className="push-consent-footnote">
          {push.permission === "default" && push.supported && !push.needsInstall
            ? "다음 단계에서 브라우저의 알림 허용을 선택해주세요."
            : "브라우저·OS의 사이트 설정에서 알림 권한을 철회할 수 있습니다."}
        </p>
      </DialogContent>
    </Dialog>
  );
}
