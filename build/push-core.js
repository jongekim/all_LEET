/* Shared page/SW storage. No auth token, endpoint, or administrator content is stored here. */
(function (root) {
  const DB = "leet-push-v1", STORE = "installation";
  async function open() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () =>
        reject(
          new Error(
            "이 브라우저에 알림 등록 정보를 저장하지 못했습니다. 사이트 저장소 설정을 확인해주세요.",
          ),
        );
    });
  }
  async function mutate(change) {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite"),
          store = tx.objectStore(STORE),
          get = store.get("current");
        let result;
        get.onsuccess = () => {
          try {
            result = change(get.result || null);
            if (result) store.put(result, "current");
          } catch (e) {
            tx.abort();
            reject(e);
          }
        };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () =>
          reject(
            new Error(
              "이 브라우저에 알림 등록 정보를 저장하지 못했습니다. 사이트 저장소 설정을 확인해주세요.",
            ),
          );
        tx.onabort = () =>
          reject(
            new Error(
              "이 브라우저에 알림 등록 정보를 저장하지 못했습니다. 사이트 저장소 설정을 확인해주세요.",
            ),
          );
      });
    } finally {
      db.close();
    }
  }
  async function read() {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly"),
          r = tx.objectStore(STORE).get("current");
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () =>
          reject(
            new Error(
              "이 브라우저에 알림 등록 정보를 저장하지 못했습니다. 사이트 저장소 설정을 확인해주세요.",
            ),
          );
      });
    } finally {
      db.close();
    }
  }
  async function fingerprint(subscription) {
    const s = subscription.toJSON ? subscription.toJSON() : subscription;
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        JSON.stringify([s.endpoint, s.keys.p256dh, s.keys.auth]),
      ),
    );
    return [...new Uint8Array(digest)].map((x) =>
      x.toString(16).padStart(2, "0")
    ).join("");
  }
  function safePath(path) {
    try {
      if (
        typeof path !== "string" || path.length > 1000 ||
        /[\x00-\x20\x7f\\#%]/.test(path) || !path.startsWith("/") ||
        path.startsWith("//")
      ) return "/";
      const url = new URL(path, root.location.origin);
      if (url.origin !== root.location.origin) return "/";
      if (
        !["/", "/terms", "/privacy-policy", "/community", "/past-exams"]
          .includes(url.pathname) &&
        !/^\/community\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          .test(url.pathname)
      ) return "/";
      if (url.search && url.pathname !== "/past-exams") return "/";
      const keys = new Set();
      for (const [k, v] of url.searchParams) {
        if (keys.has(k) || !["year", "subject", "type"].includes(k)) return "/";
        keys.add(k);
        if (k === "year" && !/^(2009|201[0-9]|202[0-7])$/.test(v)) return "/";
        if (k === "subject" && !["verbal", "reasoning"].includes(v)) return "/";
        if (k === "type" && !["odd", "even"].includes(v)) return "/";
      }
      return url.pathname + url.search;
    } catch {
      return "/";
    }
  }
  root.LEETPushCore = { read, mutate, fingerprint, safePath };
})(globalThis);
