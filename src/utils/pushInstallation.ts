import { supabase } from "../contexts/AuthContext";
import { projectId, publicAnonKey } from "./supabase/info";
import {
  type InstallationProof,
  pushEnabled,
  pushRequest,
  type PushState,
} from "./pushApi";
interface LocalInstallation extends InstallationProof {
  intent: number;
  desiredUserId: string | null;
  state?: PushState;
  dirty?: boolean;
  requestId?: string;
  fingerprint?: string;
  registrationRevision?: number;
  apiBase?: string;
  apiKey?: string;
  ack?: { requestId: string; nonce: string };
}
interface Core {
  read(): Promise<LocalInstallation | null>;
  mutate(
    fn: (old: LocalInstallation | null) => LocalInstallation | null,
  ): Promise<LocalInstallation | null>;
  fingerprint(s: PushSubscription): Promise<string>;
}
const core = () =>
  (globalThis as unknown as { LEETPushCore: Core }).LEETPushCore;
let tail: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> =>
    navigator.locks
      ? await navigator.locks.request("leet-push-installation", fn)
      : fn();
  const next = tail.catch(() => {}).then(run);
  tail = next;
  return next;
}
const base64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/=/g, "").replace(/\+/g, "-")
    .replace(/\//g, "_");
async function pushRegistration(): Promise<ServiceWorkerRegistration> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() =>
          reject(
            new Error(
              "알림 처리 준비가 지연되고 있습니다. 온라인 상태에서 다시 확인해주세요.",
            ),
          ), 8000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export const readPushInstallation = () => core().read();
export async function installationProof(): Promise<InstallationProof> {
  const local = await core().read();
  if (!local || local.state?.status !== "active") {
    throw new Error("현재 기기에서 알림 등록 확인을 완료해주세요.");
  }
  return { installationId: local.installationId, capability: local.capability };
}
export async function registerPush(): Promise<PushState> {
  return serial(async () => {
    if (!pushEnabled()) {
      throw new Error("알림 기능이 아직 활성화되지 않았습니다.");
    }
    const config = await pushRequest<
      {
        enabled: boolean;
        publicKey: string;
        keyId?: string;
        publicKeys?: Record<string, string>;
      }
    >(
      "push-subscriptions",
      "config",
    );
    if (!config.enabled) {
      throw new Error("알림 기능이 아직 활성화되지 않았습니다.");
    }
    let local = await core().read();
    if (!local) {
      await core().mutate((old) =>
        old ||
        ({
          installationId: crypto.randomUUID(),
          capability: base64(crypto.getRandomValues(new Uint8Array(32))),
          intent: 0,
          desiredUserId: null,
        })
      );
    }
    const reg = await pushRegistration();
    const bytes = Uint8Array.from(
      atob(
        config.publicKey.replace(/-/g, "+").replace(/_/g, "/") +
          "=".repeat((4 - config.publicKey.length % 4) % 4),
      ),
      (c) => c.charCodeAt(0),
    );
    const existing = await reg.pushManager.getSubscription();
    let vapidKeyId = config.keyId;
    if (existing && config.publicKeys) {
      const applicationKey = existing.options?.applicationServerKey;
      if (!applicationKey) {
        throw new Error(
          "기존 알림 등록 키를 확인하지 못했습니다. 브라우저 사이트 설정을 확인해주세요.",
        );
      }
      const storedKey = base64(new Uint8Array(applicationKey));
      vapidKeyId = Object.entries(config.publicKeys).find(([, key]) =>
        key === storedKey
      )?.[0];
      if (!vapidKeyId) {
        throw new Error(
          "이 기기의 알림 등록 키가 운영 키 목록에 없습니다. 운영자에게 문의해주세요.",
        );
      }
    }
    const subscription = existing ||
      await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      });
    const fp = await core().fingerprint(subscription),
      requestId = crypto.randomUUID();
    local = (await core().mutate((old) => ({
      ...old!,
      requestId,
      fingerprint: fp,
      registrationRevision: undefined,
      ack: undefined,
      apiBase:
        `https://${projectId}.supabase.co/functions/v1/push-subscriptions`,
      apiKey: publicAnonKey,
    })))!;
    const state = await pushRequest<PushState>(
      "push-subscriptions",
      "register",
      {
        installationId: local.installationId,
        capability: local.capability,
        requestId,
        subscription: subscription.toJSON(),
        vapidKeyId,
      },
    );
    const merged = await core().mutate((old) =>
      old?.requestId === requestId
        ? {
          ...old,
          state: old.state?.status === "active" &&
              old.state.installationRevision >= state.installationRevision
            ? old.state
            : state,
          registrationRevision: state.installationRevision,
        }
        : old
    );
    return merged?.state || state;
  });
}
export async function syncPushInstallation(
  userId?: string | null,
  signal?: AbortSignal,
): Promise<PushState | null> {
  if (
    !pushEnabled() || !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) return null;
  const { data: { session: initiator } } = await supabase.auth.getSession();
  signal?.throwIfAborted();
  return serial(async () => {
    signal?.throwIfAborted();
    if (
      !pushEnabled() || !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) return null;
    let local = await core().read();
    if (!local) return null;
    const { data: { session } } = await supabase.auth.getSession();
    if (
      (session?.user.id || null) !== (initiator?.user.id || null) ||
      sessionId(session?.access_token) !== sessionId(initiator?.access_token)
    ) return null;
    const wanted = userId === undefined ? session?.user.id || null : userId;
    local = (await core().mutate((old) =>
      old
        ? { ...old, intent: old.intent + 1, desiredUserId: wanted, dirty: true }
        : null
    ))!;
    const intent = local.intent;
    let state = await pushRequest<PushState>("push-subscriptions", "state", {
      installationId: local.installationId,
      capability: local.capability,
    }, signal);
    const reg = await pushRegistration(),
      sub = await reg.pushManager.getSubscription();
    signal?.throwIfAborted();
    if (state.status === "active") {
      state = await pushRequest<PushState>("push-subscriptions", "sync", {
        installationId: local.installationId,
        capability: local.capability,
        requestId: crypto.randomUUID(),
        installationRevision: state.installationRevision,
        bindingRevision: state.bindingRevision,
        subscriptionRevision: state.subscriptionRevision,
        permission: Notification.permission,
        hasSubscription: !!sub,
        subscription: sub?.toJSON(),
      }, signal);
      const current = await core().read();
      const { data: { session: latest } } = await supabase.auth.getSession();
      if (
        current?.intent !== intent ||
        (wanted !== null && latest?.user.id !== wanted) ||
        (wanted === null &&
          (latest?.user.id || null) !== (session?.user.id || null))
      ) {
        return null;
      }
      signal?.throwIfAborted();
      if (
        state.status === "active" && (wanted
          ? state.linkedUserId !== wanted ||
            state.linkedSessionId !== sessionId(latest?.access_token)
          : !!state.linkedUserId)
      ) {
        state = await pushRequest<PushState>(
          "push-subscriptions",
          wanted ? "bind" : "detach",
          {
            installationId: local.installationId,
            capability: local.capability,
            requestId: crypto.randomUUID(),
            installationRevision: state.installationRevision,
            bindingRevision: state.bindingRevision,
            subscriptionRevision: state.subscriptionRevision,
          },
          signal,
        );
      }
    }
    await core().mutate((old) =>
      old?.intent === intent ? { ...old, state, dirty: false } : old
    );
    return state;
  });
}
export async function detachPushBeforeLogout(): Promise<void> {
  if (!pushEnabled()) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    await Promise.race([
      syncPushInstallation(null, controller.signal),
      new Promise<never>((_, reject) =>
        controller.signal.addEventListener(
          "abort",
          () => reject(new Error("DETACH_PENDING")),
          { once: true },
        )
      ),
    ]);
  } catch {
    console.warn("push", { code: "DETACH_PENDING" });
    await core().mutate((old) =>
      old
        ? { ...old, intent: old.intent + 1, desiredUserId: null, dirty: true }
        : null
    ).catch(() => {});
  } finally {
    clearTimeout(timeout);
  }
}
function sessionId(token?: string) {
  try {
    return JSON.parse(
      atob((token || "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    ).session_id as string;
  } catch {
    return null;
  }
}
