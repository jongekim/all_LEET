// Service Worker for PWA
// 목표: "웹앱처럼" 동작 (항상 네트워크 우선 / 캐시로 인해 업데이트가 막히지 않게)

// 설치 시 즉시 대기(skip) 없이 활성화되도록
self.addEventListener("install", () => {
  self.skipWaiting();
});

// 활성화 시 즉시 클라이언트 점유 + (기존에 남아있을 수 있는) 캐시 정리
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((names) =>
        Promise.all(names.map((name) => caches.delete(name)))
      ),
    ]),
  );
});

// fetch 핸들러를 두지 않아서: 네트워크 동작은 브라우저 기본값(웹앱처럼)으로 유지

importScripts("/push-core.js");
const PUSH_API =
  "https://jkxxtyaanyhmjbdtybkp.supabase.co/functions/v1/push-subscriptions";
async function notifyPushClients() {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  clients.forEach((client) =>
    client.postMessage({ type: "PUSH_STATE_CHANGED" })
  );
}
async function confirmRegistration() {
  const local = await self.LEETPushCore.read();
  if (!local?.ack || local.apiBase !== PUSH_API) return;
  try {
    const response = await fetch(PUSH_API + "/verify", {
      method: "POST",
      headers: { apikey: local.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        installationId: local.installationId,
        capability: local.capability,
        requestId: local.ack.requestId,
        nonce: local.ack.nonce,
      }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (response.ok) {
      const state = await response.json();
      await self.LEETPushCore.mutate((old) =>
        old?.requestId === local.ack.requestId
          ? { ...old, state, ack: undefined }
          : old
      );
      await notifyPushClients();
    }
  } catch { /* Keep the ACK intent for the next online wakeup. */ }
}
self.addEventListener("message", (event) => {
  if (event.data?.type === "PUSH_SYNC") event.waitUntil(confirmRegistration());
});
self.addEventListener("push", (event) =>
  event.waitUntil((async () => {
    let data;
    try {
      const text = event.data?.text() || "";
      if (new TextEncoder().encode(text).length > 3072) throw new Error();
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    const valid = data?.version === 1 &&
      Number.isFinite(Date.parse(data.expiresAt)) &&
      Date.parse(data.expiresAt) > Date.now();
    if (valid && data.type === "registration") {
      await self.registration.showNotification("알림 등록 확인", {
        body: "all LEET 운영 안내 알림 등록을 확인합니다.",
        icon: "/push-icon.png",
        tag: "leet-push-registration",
        data: { path: "/" },
      });
      const local = await self.LEETPushCore.read(),
        subscription = await self.registration.pushManager.getSubscription();
      if (
        !local || !subscription ||
        local.installationId !== data.installationId ||
        local.requestId !== data.requestId ||
        local.fingerprint !== data.fingerprint ||
        typeof data.nonce !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/.test(data.nonce) ||
        await self.LEETPushCore.fingerprint(subscription) !==
          data.fingerprint ||
        local.registrationRevision !== undefined &&
          local.registrationRevision !== data.revision
      ) return;
      await self.LEETPushCore.mutate((old) =>
        old?.requestId === data.requestId
          ? {
            ...old,
            registrationRevision: data.revision,
            ack: { requestId: data.requestId, nonce: data.nonce },
          }
          : old
      );
      await confirmRegistration();
      return;
    }
    const ordinary = valid && data.type === "notification" &&
      typeof data.title === "string" && [...data.title].length >= 1 &&
      [...data.title].length <= 50 && typeof data.body === "string" &&
      [...data.body].length >= 1 && [...data.body].length <= 200 &&
      typeof data.deliveryId === "string" &&
      /^[0-9a-f-]{36}$/i.test(data.deliveryId);
    await self.registration.showNotification(
      ordinary ? data.title : "all LEET 서비스 안내",
      {
        body: ordinary ? data.body : "사이트에서 최신 안내를 확인해주세요.",
        icon: "/push-icon.png",
        tag: ordinary ? "leet-push-" + data.deliveryId : "leet-push-fallback",
        data: { path: ordinary ? self.LEETPushCore.safePath(data.path) : "/" },
      },
    );
  })()));
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const path = self.LEETPushCore.safePath(event.notification.data?.path),
      url = new URL(path, self.location.origin).href;
    const windows = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    const client = windows.find((c) =>
      new URL(c.url).origin === self.location.origin
    );
    if (client) {
      try {
        const navigated = await client.navigate(url);
        if (navigated) await navigated.focus();
        else await client.focus();
      } catch {
        await self.clients.openWindow(url);
      }
    } else await self.clients.openWindow(url);
  })());
});
self.addEventListener(
  "pushsubscriptionchange",
  (event) =>
    event.waitUntil((async () => {
      await self.LEETPushCore.mutate((old) =>
        old ? { ...old, dirty: true } : old
      );
      await notifyPushClients();
    })()),
);
