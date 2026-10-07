import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
// Hosted Edge environments are read-only. Require logging to be disabled before import.
if (Deno.env.get("ECE_KEYLOG") !== "0") {
  throw new Error("Push key logging must be disabled in server configuration");
}
const { default: webpush } = await import("npm:web-push@3.6.7");
import { createUserVerifier } from "../../make-server-cd835c22/auth.ts";
import { PushError, uuid } from "./contracts.ts";
import { decode, hash, PushVault } from "./crypto.ts";
import { runPushWorker } from "./worker.ts";
import type { PushDependencies } from "./app.ts";
const codes: Record<string, number> = {
  AUTH_REQUIRED: 401,
  INVALID_INPUT: 400,
  CONFLICT: 409,
  EXPIRED: 410,
  ADMIN_REQUIRED: 403,
  REGISTRATION_REQUIRED: 409,
  NO_RECIPIENTS: 400,
  TEST_REQUIRED: 409,
  DUPLICATE_REQUIRED: 409,
  RATE_LIMITED: 429,
  PUSH_DISABLED: 503,
};
function objectEnv(name: string): Record<string, string> {
  try {
    return JSON.parse(Deno.env.get(name) || "{}");
  } catch {
    return {};
  }
}
function background(promise: Promise<unknown>) {
  const runtime = (globalThis as unknown as {
    EdgeRuntime?: { waitUntil(p: Promise<unknown>): void };
  }).EdgeRuntime;
  if (runtime) runtime.waitUntil(promise);
  return promise;
}
export function pushDependencies(): PushDependencies {
  const url = Deno.env.get("SUPABASE_URL") || "",
    anon = Deno.env.get("SUPABASE_ANON_KEY") || "",
    secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const enabled = Deno.env.get("PUSH_ENABLED") === "true";
  const keyId = Deno.env.get("PUSH_VAPID_KEY_ID") || "v1";
  const privateKeys = objectEnv("PUSH_VAPID_PRIVATE_KEYS"),
    publicKeys = objectEnv("PUSH_VAPID_PUBLIC_KEYS");
  const publicKey = publicKeys[keyId] || "";
  const vault = new PushVault(
    objectEnv("PUSH_DATA_KEYS"),
    Deno.env.get("PUSH_DATA_KEY_ID") || "v1",
  );
  const configuredSecret = Deno.env.get("PUSH_INTERNAL_DISPATCH_SECRET") || "";
  const internalSecret = /^[A-Za-z0-9_-]{43,128}$/.test(configuredSecret)
    ? configuredSecret
    : "";
  const hosts = (Deno.env.get("PUSH_PROVIDER_HOSTS") ||
    "fcm.googleapis.com,updates.push.services.mozilla.com,web.push.apple.com")
    .split(",").map((x) => x.trim()).filter(Boolean);
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
    },
  };
  const server = url && secret ? createClient(url, secret, options) : null;
  const verify = createUserVerifier({ url, anonKey: anon });
  const rpc = async (name: string, args: Record<string, unknown>) => {
    if (!server) throw new PushError("STORAGE_UNAVAILABLE", 503);
    const { data, error } = await server.rpc(name, args);
    if (error) {
      const status = codes[error.message];
      if (!status) {
        console.warn("push", {
          code: "RPC_UNAVAILABLE",
          rpc: name,
          databaseCode: /^[A-Z0-9_]{1,20}$/.test(error.code || "")
            ? error.code
            : "unknown",
        });
      }
      throw new PushError(
        status ? error.message : "STORAGE_UNAVAILABLE",
        status || 503,
      );
    }
    return data;
  };
  const log = (code: string) => console.warn("push", { code });
  const worker = () =>
    runPushWorker({
      enabled,
      hosts,
      now: Date.now,
      rpc: (action, input) =>
        rpc("push_worker_action", { p_action: action, p_input: input }),
      decrypt: (env) => vault.decrypt(env),
      async prepare(data, payload, id, ttl) {
        if (!publicKeys[id] || !privateKeys[id]) {
          throw new PushError("STORAGE_UNAVAILABLE", 503);
        }
        const details = webpush.generateRequestDetails(data, payload, {
          TTL: ttl,
          contentEncoding: "aes128gcm",
          vapidDetails: {
            subject: Deno.env.get("PUSH_VAPID_SUBJECT") || "",
            publicKey: publicKeys[id],
            privateKey: privateKeys[id],
          },
        });
        return {
          endpoint: details.endpoint,
          headers: details.headers,
          body: new Uint8Array(details.body),
        };
      },
      fetch,
      log,
    });
  return {
    enabled,
    apiKey: Deno.env.get("PUSH_PUBLIC_API_KEY") || anon,
    publicKey,
    publicKeys,
    keyId,
    hosts,
    internalSecret,
    origins: (Deno.env.get("PUSH_ALLOWED_ORIGINS") || "").split(",").filter(
      Boolean,
    ),
    async verify(token) {
      const checked = await verify(token);
      if (checked.unavailable) throw new PushError("STORAGE_UNAVAILABLE", 503);
      if (!checked.userId) throw new PushError("AUTH_REQUIRED", 401);
      try {
        const claims = JSON.parse(
          new TextDecoder().decode(decode(token.split(".")[1])),
        );
        if (claims.sub !== checked.userId) throw new Error();
        return { userId: checked.userId, sessionId: uuid(claims.session_id) };
      } catch {
        throw new PushError("AUTH_REQUIRED", 401);
      }
    },
    async isAdmin(token) {
      if (!url || !anon) throw new PushError("STORAGE_UNAVAILABLE", 503);
      const client = createClient(url, anon, {
        ...options,
        global: {
          ...options.global,
          headers: { Authorization: `Bearer ${token}` },
        },
      });
      const { data, error } = await client.rpc("current_user_is_admin");
      if (error) throw new PushError("STORAGE_UNAVAILABLE", 503);
      return data === true;
    },
    rpc,
    encrypt: (data, provider) => vault.encrypt(data, provider),
    rateKey: (request) =>
      hash(
        secret + ":" + Math.floor(Date.now() / 3600000) + ":" +
          (request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
            "unknown"),
      ),
    async kick() {
      if (!enabled || !internalSecret) return;
      await background(
        fetch(url + "/functions/v1/push-dispatch/run", {
          method: "POST",
          headers: { "x-push-internal": internalSecret },
          signal: AbortSignal.timeout(3000),
        }).then((r) => {
          if (!r.ok) throw new Error();
        }),
      );
    },
    async dispatch() {
      const runtime =
        (globalThis as unknown as { EdgeRuntime?: unknown }).EdgeRuntime;
      if (runtime) {
        background(worker().catch(() => log("WORKER_RECOVERY_PENDING")));
        return { accepted: true };
      }
      return worker();
    },
    log,
  };
}
