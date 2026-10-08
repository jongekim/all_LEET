import {
  base64url,
  composition,
  message,
  PushError,
  record,
  uuid,
} from "./contracts.ts";
import {
  decode,
  type Envelope,
  fingerprint,
  hash,
  randomSecret,
} from "./crypto.ts";
export interface Identity {
  userId: string;
  sessionId: string;
}
export interface PushDependencies {
  enabled: boolean;
  origins: string[];
  apiKey: string;
  publicKey: string;
  publicKeys?: Record<string, string>;
  keyId: string;
  hosts: string[];
  internalSecret: string;
  verify(token: string): Promise<Identity>;
  isAdmin(token: string): Promise<boolean>;
  rpc(name: string, args: Record<string, unknown>): Promise<unknown>;
  encrypt(data: unknown, provider: string): Promise<Envelope>;
  rateKey(request: Request): Promise<string>;
  kick(): Promise<void>;
  dispatch(): Promise<unknown>;
  log(code: string): void;
}
const adminActions = new Set([
  "statistics",
  "draft-save",
  "draft-list",
  "draft-load",
  "members",
  "test",
  "test-confirm",
  "preview",
  "campaigns",
  "campaign-status",
  "campaign-history",
  "stop",
  "retry-unknown",
]);
const subActions = new Set([
  "register",
  "verify",
  "state",
  "bind",
  "detach",
  "sync",
]);
export function createPushHandler(
  kind: "subscriptions" | "admin" | "dispatch",
  dep: PushDependencies,
) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    const cors: Record<string, string> = {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "Vary": "Origin",
    };
    if (origin && dep.origins.includes(origin)) {
      cors["Access-Control-Allow-Origin"] = origin;
      cors["Access-Control-Allow-Headers"] =
        "authorization,apikey,content-type";
      cors["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS";
    }
    const response = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: cors });
    try {
      if (origin && !dep.origins.includes(origin)) {
        throw new PushError("ORIGIN_DENIED", 403);
      }
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors });
      }
      const action = new URL(request.url).pathname.split("/").filter(Boolean)
        .at(-1)!;
      if (kind === "dispatch") {
        if (
          request.method !== "POST" || action !== "run" || origin ||
          !dep.internalSecret ||
          request.headers.get("x-push-internal") !== dep.internalSecret
        ) throw new PushError("AUTH_REQUIRED", 401);
        return response(await dep.dispatch());
      }
      if (!dep.apiKey || request.headers.get("apikey") !== dep.apiKey) {
        throw new PushError("AUTH_REQUIRED", 401);
      }
      const authorization = request.headers.get("authorization");
      let identity: Identity | null = null;
      let token = "";
      if (authorization) {
        if (!/^Bearer [^\s]+$/.test(authorization)) {
          throw new PushError("AUTH_REQUIRED", 401);
        }
        token = authorization.slice(7);
        identity = await dep.verify(token);
      }
      if (
        kind === "subscriptions" && action === "config" &&
        request.method === "GET"
      ) {
        return response({
          enabled: dep.enabled && !!dep.publicKey,
          publicKey: dep.publicKey,
          keyId: dep.keyId,
          publicKeys: dep.publicKeys || { [dep.keyId]: dep.publicKey },
        });
      }
      if (
        request.method !== "POST" ||
        !(kind === "admin" ? adminActions : subActions).has(action)
      ) throw new PushError("INVALID_INPUT");
      const input = record(await readBody(request));
      if (kind === "admin") {
        if (!identity) throw new PushError("AUTH_REQUIRED", 401);
        if (!await dep.isAdmin(token)) {
          throw new PushError("ADMIN_REQUIRED", 403);
        }
        if (action === "statistics") {
          return response(
            await dep.rpc("push_subscriber_statistics", {
              p_actor: identity.userId,
              p_session: identity.sessionId,
            }),
          );
        }
        const args = { ...input };
        delete args.userId;
        delete args.sessionId;
        args.verifiedSessionId = identity.sessionId;
        if (
          ["draft-save", "preview", "campaigns", "test", "test-confirm"]
            .includes(action)
        ) {
          args.content = ["test", "test-confirm"].includes(action)
            ? { ...message(input.content), audience: "all", members: [] }
            : composition(input.content, action === "draft-save");
        }
        for (
          const name of [
            "id",
            "requestId",
            "testId",
            "previewId",
            "draftId",
            "idempotencyKey",
          ]
        ) {
          if (input[name] !== undefined && input[name] !== null) {
            args[name] = uuid(input[name]);
          }
        }
        if (
          [
            "draft-save",
            "preview",
            "campaigns",
            "test",
            "test-confirm",
            "stop",
            "retry-unknown",
          ].includes(action)
        ) {
          args.requestId = uuid(input.requestId);
          args.id = uuid(input.id);
        }
        if (
          input.revision !== undefined &&
          (!Number.isSafeInteger(input.revision) || Number(input.revision) < 1)
        ) throw new PushError("INVALID_INPUT");
        if (
          action === "members" &&
          (typeof input.search !== "string" || input.search.length > 100)
        ) throw new PushError("INVALID_INPUT");
        if (input.after) args.after = uuid(input.after);
        for (const name of ["before", "since"]) {
          if (
            input[name] &&
            (typeof input[name] !== "string" ||
              !Number.isFinite(Date.parse(input[name] as string)))
          ) throw new PushError("INVALID_INPUT");
        }
        if (
          ["test", "test-confirm", "preview"].includes(action) &&
          input.installationId
        ) await proof(args, input);
        if (
          ["test", "test-confirm"].includes(action) && !input.installationId
        ) throw new PushError("REGISTRATION_REQUIRED");
        if (
          ["preview", "campaigns", "test", "retry-unknown"].includes(action) &&
          !dep.enabled
        ) throw new PushError("PUSH_DISABLED", 503);
        let previewToken: string | undefined;
        if (action === "preview") {
          previewToken = randomSecret();
          args.tokenHash = await hash(previewToken);
        }
        if (action === "campaigns") {
          base64url(input.previewToken, 32);
          args.tokenHash = await hash(input.previewToken as string);
          delete args.previewToken;
        }
        const result = await dep.rpc("push_admin_action", {
          p_actor: identity.userId,
          p_action: action,
          p_input: args,
        });
        if (record(result).code === "DUPLICATE_REQUIRED") {
          return response(result, 409);
        }
        if (["campaigns", "test", "retry-unknown"].includes(action)) {
          void dep.kick().catch(() => dep.log("KICK_PENDING"));
        }
        return response(
          previewToken ? { ...record(result), previewToken } : result,
          ["campaigns", "test"].includes(action) ? 202 : 200,
        );
      }
      const args: Record<string, unknown> = {};
      await proof(args, input);
      if (action !== "state") args.requestId = uuid(input.requestId);
      if (action === "register") {
        if (!dep.enabled) throw new PushError("PUSH_DISABLED", 503);
        const { subscription } = await import("./contracts.ts");
        const data = subscription(input.subscription, dep.hosts);
        // Reject malformed recipient points before creating any worker job.
        // Otherwise a preparation error could pause a healthy provider/key for everyone.
        try {
          const recipientKey = await crypto.subtle.importKey(
            "raw",
            decode(data.keys.p256dh),
            { name: "ECDH", namedCurve: "P-256" },
            false,
            [],
          );
          // Some Web Crypto runtimes defer curve validation until key agreement.
          const checkKey = await crypto.subtle.generateKey(
            { name: "ECDH", namedCurve: "P-256" },
            false,
            ["deriveBits"],
          );
          await crypto.subtle.deriveBits(
            { name: "ECDH", public: recipientKey },
            checkKey.privateKey,
            256,
          );
        } catch {
          throw new PushError("INVALID_ENDPOINT");
        }
        const fp = await fingerprint(data),
          nonce = randomSecret(),
          provider = new URL(data.endpoint).hostname;
        args.endpointHash = await hash(data.endpoint);
        args.fingerprint = fp;
        const keys = dep.publicKeys || { [dep.keyId]: dep.publicKey };
        const requestedKey = input.vapidKeyId === undefined
          ? dep.keyId
          : input.vapidKeyId;
        if (
          typeof requestedKey !== "string" || !Object.hasOwn(keys, requestedKey)
        ) throw new PushError("INVALID_INPUT");
        args.keyId = requestedKey;
        args.provider = provider;
        args.rateKey = await dep.rateKey(request);
        args.nonceHash = await hash(nonce);
        args.encryptedData = await dep.encrypt(
          { subscription: data, nonce },
          provider,
        );
        args.requestHash = await hash(
          JSON.stringify([args.installationId, args.requestId, fp, args.keyId]),
        );
      } else if (action === "verify") {
        args.nonceHash = await hash(base64url(input.nonce, 32));
        args.requestHash = await hash(
          JSON.stringify([args.installationId, args.requestId, args.nonceHash]),
        );
      } else if (action !== "state") {
        for (
          const name of [
            "installationRevision",
            "bindingRevision",
            "subscriptionRevision",
          ]
        ) {
          if (!Number.isSafeInteger(input[name]) || Number(input[name]) < 0) {
            throw new PushError("INVALID_INPUT");
          }
          args[name] = input[name];
        }
        if (action === "bind") {
          if (!identity) throw new PushError("AUTH_REQUIRED", 401);
          args.userId = identity.userId;
          args.sessionId = identity.sessionId;
        }
        if (action === "sync") {
          if (
            !["default", "denied", "granted"].includes(
              String(input.permission),
            ) || typeof input.hasSubscription !== "boolean"
          ) throw new PushError("INVALID_INPUT");
          args.permission = input.permission;
          args.hasSubscription = input.hasSubscription;
          if (input.hasSubscription) {
            const { subscription } = await import("./contracts.ts");
            args.fingerprint = await fingerprint(
              subscription(input.subscription, dep.hosts),
            );
          }
        }
        args.requestHash = await hash(JSON.stringify(args));
      }
      const result = await dep.rpc("push_subscription_action", {
        p_action: action,
        p_input: args,
      });
      if (action === "register") {
        void dep.kick().catch(() => dep.log("KICK_PENDING"));
      }
      return response(result);
    } catch (error) {
      const e = error instanceof PushError
        ? error
        : new PushError("STORAGE_UNAVAILABLE", 503);
      dep.log(e.code);
      return response({ code: e.code }, e.status);
    }
  };
}
async function proof(
  args: Record<string, unknown>,
  input: Record<string, unknown>,
) {
  args.installationId = uuid(input.installationId);
  args.capabilityHash = await hash(base64url(input.capability, 32));
  delete args.capability;
}
async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > 16384) {
    throw new PushError("INVALID_INPUT");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new PushError("INVALID_INPUT");
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 16384) {
        await reader.cancel();
        throw new PushError("INVALID_INPUT");
      }
      chunks.push(value);
    }
    const all = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      all.set(chunk, offset);
      offset += chunk.length;
    }
    return JSON.parse(new TextDecoder().decode(all));
  } catch (error) {
    if (error instanceof PushError) throw error;
    throw new PushError("INVALID_INPUT");
  } finally {
    reader.releaseLock();
  }
}
