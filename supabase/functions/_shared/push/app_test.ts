import assert from "node:assert/strict";
const assertEquals: typeof assert.deepEqual = assert.deepEqual;
const assertRejects: typeof assert.rejects = assert.rejects;
import { createPushHandler, type PushDependencies } from "./app.ts";
import { PushError, safePath } from "./contracts.ts";
import { PushVault, randomSecret } from "./crypto.ts";
import { runPushWorker } from "./worker.ts";
import webpush from "npm:web-push@3.6.7";
import { Buffer } from "node:buffer";
import { createECDH, randomBytes } from "node:crypto";
const actor = "00000000-0000-4000-8000-000000000001",
  session = "00000000-0000-4000-8000-000000000002",
  id = "00000000-0000-4000-8000-000000000003";
function setup() {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const dep: PushDependencies = {
    enabled: true,
    origins: ["https://app.invalid"],
    apiKey: "public-key",
    publicKey: "vapid",
    keyId: "v1",
    hosts: ["fcm.googleapis.com"],
    internalSecret: "internal-secret",
    verify: async () => ({ userId: actor, sessionId: session }),
    isAdmin: async () => true,
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { id };
    },
    encrypt: async () => ({
      v: 1,
      keyId: "v1",
      iv: "iv",
      ciphertext: "cipher",
      provider: "fcm.googleapis.com",
    }),
    rateKey: async () => "rate",
    kick: async () => {},
    dispatch: async () => ({ accepted: true }),
    log: () => {},
  };
  return { dep, calls };
}
const request = (
  action: string,
  input: unknown,
  headers: Record<string, string> = {},
) =>
  new Request("https://edge.invalid/functions/v1/admin-push/" + action, {
    method: "POST",
    headers: {
      apikey: "public-key",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(input),
  });
Deno.test("무효 JWT·익명·공개키로 관리자/내부 작업에 접근할 수 없다", async () => {
  const { dep, calls } = setup();
  const handler = createPushHandler("admin", dep);
  assertEquals((await handler(request("members", { search: "" }))).status, 401);
  dep.verify = async () => {
    throw new PushError("AUTH_REQUIRED", 401);
  };
  assertEquals(
    (await createPushHandler("subscriptions", dep)(
      request("state", { installationId: id, capability: randomSecret() }, {
        authorization: "Bearer anon-key",
      }),
    )).status,
    401,
  );
  assertEquals(calls.length, 0);
  assertEquals(
    (await createPushHandler("dispatch", dep)(request("run", {}))).status,
    401,
  );
});
Deno.test("클라이언트의 사용자·세션 위조 대신 검증한 신원으로 RPC한다", async () => {
  const { dep, calls } = setup();
  await createPushHandler("admin", dep)(
    request("members", {
      search: "",
      userId: id,
      sessionId: id,
      verifiedSessionId: id,
    }, { authorization: "Bearer token" }),
  );
  assertEquals(calls[0].args.p_actor, actor);
  assertEquals(
    (calls[0].args.p_input as Record<string, unknown>).verifiedSessionId,
    session,
  );
});
Deno.test("구독 통계는 관리자·검증 세션만 사용하며 발송 비활성에서도 읽기 전용 조회한다", async () => {
  const { dep, calls } = setup();
  dep.enabled = false;
  const data = {
    members: 2,
    devices: 5,
    memberDevices: 3,
    anonymousDevices: 2,
    queriedAt: new Date().toISOString(),
  };
  let kicks = 0;
  dep.kick = async () => {
    kicks++;
  };
  dep.rpc = async (name, args) => {
    calls.push({ name, args });
    return data;
  };
  const handler = createPushHandler("admin", dep);
  assertEquals((await handler(request("statistics", {}))).status, 401);
  dep.isAdmin = async () => false;
  assertEquals(
    (await handler(
      request("statistics", {}, { authorization: "Bearer token" }),
    )).status,
    403,
  );
  assertEquals(calls.length, 0);
  dep.isAdmin = async () => true;
  const response = await handler(
    request("statistics", {
      p_actor: id,
      p_session: id,
      userId: id,
      sessionId: id,
    }, { authorization: "Bearer token" }),
  );
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("cache-control"), "no-store");
  assertEquals(await response.json(), data);
  assertEquals(calls, [{
    name: "push_subscriber_statistics",
    args: { p_actor: actor, p_session: session },
  }]);
  assertEquals(kicks, 0);
});
Deno.test("private 초안·권한 회수·서버 비활성은 명시적으로 차단한다", async () => {
  const { dep, calls } = setup();
  dep.isAdmin = async () => false;
  assertEquals(
    (await createPushHandler("admin", dep)(
      request("draft-list", {}, { authorization: "Bearer token" }),
    )).status,
    403,
  );
  assertEquals(calls.length, 0);
  dep.isAdmin = async () => true;
  dep.enabled = false;
  assertEquals(
    (await createPushHandler("admin", dep)(
      request("test", {
        id,
        requestId: id,
        content: { title: "A", body: "B", path: "/" },
        installationId: id,
        capability: randomSecret(),
      }, { authorization: "Bearer token" }),
    )).status,
    503,
  );
});
Deno.test("외부 링크·비밀 query·인코딩 우회는 허용하지 않는다", () => {
  for (
    const value of [
      "//evil.invalid",
      "/admin",
      "/reset-password?token=secret",
      "/community?email=a",
      "/%2f%2fevil",
      "/past-exams?year=2027&year=2026",
      "/past-exams?token=x",
    ]
  ) {
    let rejected = false;
    try {
      safePath(value);
    } catch {
      rejected = true;
    }
    assertEquals(rejected, true, value);
  }
  assertEquals(
    safePath("/past-exams?type=odd&year=2027"),
    "/past-exams?year=2027&type=odd",
  );
});
Deno.test("AES-GCM key ID/provider 변조와 키 없는 복호화는 실패한다", async () => {
  const key = randomSecret(),
    vault = new PushVault({ v1: key }, "v1"),
    cipher = await vault.encrypt({ endpoint: "private" }, "fcm.googleapis.com");
  assertEquals(await vault.decrypt(cipher), { endpoint: "private" });
  await assertRejects(() =>
    vault.decrypt({ ...cipher, provider: "evil.invalid" })
  );
  await assertRejects(() => new PushVault({}, "v1").decrypt(cipher));
});
Deno.test("고정 Web Push 라이브러리가 Deno에서 암호화/VAPID 요청을 만든다", () => {
  const receiver = createECDH("prime256v1");
  receiver.generateKeys();
  const vapid = webpush.generateVAPIDKeys();
  const details = webpush.generateRequestDetails(
    {
      endpoint: "https://fcm.googleapis.com/fcm/send/synthetic",
      keys: {
        p256dh: receiver.getPublicKey().toString("base64url"),
        auth: randomBytes(16).toString("base64url"),
      },
    },
    "synthetic notification",
    {
      TTL: 30,
      vapidDetails: { subject: "https://all-leet.vercel.app", ...vapid },
    },
  );
  assertEquals(details.method, "POST");
  assertEquals(details.headers["Content-Encoding"], "aes128gcm");
  assertEquals(details.body.length > 0, true);
});
Deno.test("worker timeout은 unknown이고 새 외부 시도는 자동 생성하지 않는다", async () => {
  const ec = createECDH("prime256v1");
  ec.generateKeys();
  const s = {
    endpoint: "https://fcm.googleapis.com/fcm/send/test",
    keys: {
      p256dh: ec.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    },
  };
  const calls: Array<{ action: string; input: Record<string, unknown> }> = [];
  let claims = 0;
  await runPushWorker({
    enabled: true,
    hosts: ["fcm.googleapis.com"],
    now: () => Date.now(),
    rpc: async (action, input) => {
      calls.push({ action, input });
      if (action === "claim") {
        return {
          slot: 1,
          slotToken: id,
          jobs: claims++ ? [] : [{
            id,
            attemptId: id,
            leaseToken: id,
            keyId: "v1",
            provider: "fcm.googleapis.com",
            encryptedData: {},
            registration: false,
            content: { title: "A", body: "B", path: "/" },
            expiresAt: new Date(Date.now() + 60000).toISOString(),
          }],
        };
      }
      if (action === "start") return { allowed: true };
      return {};
    },
    decrypt: async () => ({ subscription: s }),
    prepare: async () => ({
      endpoint: s.endpoint,
      headers: {},
      body: new Uint8Array(1),
    }),
    fetch: async () => {
      throw new Error("timeout");
    },
    log: () => {},
  });
  assertEquals(
    calls.find((c) => c.action === "finish")?.input.outcome,
    "unknown",
  );
  assertEquals(calls.filter((c) => c.action === "start").length, 1);
});
Deno.test("worker slot/lease 시작 거절 뒤 provider를 호출하지 않는다", async () => {
  let claims = 0, fetches = 0;
  const ec = createECDH("prime256v1");
  ec.generateKeys();
  const s = {
    endpoint: "https://fcm.googleapis.com/fcm/send/test",
    keys: {
      p256dh: ec.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    },
  };
  await runPushWorker({
    enabled: true,
    hosts: ["fcm.googleapis.com"],
    now: Date.now,
    rpc: async (action) =>
      action === "claim"
        ? {
          slot: 1,
          slotToken: id,
          jobs: claims++ ? [] : [{
            id,
            attemptId: id,
            leaseToken: id,
            keyId: "v1",
            encryptedData: {},
            registration: false,
            content: { title: "A", body: "B", path: "/" },
            expiresAt: new Date(Date.now() + 60000).toISOString(),
          }],
        }
        : action === "start"
        ? { allowed: false }
        : {},
    decrypt: async () => ({ subscription: s }),
    prepare: async () => ({
      endpoint: s.endpoint,
      headers: {},
      body: new Uint8Array(1),
    }),
    fetch: async () => {
      fetches++;
      return new Response(null, { status: 201 });
    },
    log: () => {},
  });
  assertEquals(fetches, 0);
});

Deno.test("등록은 보존 VAPID key ID만 허용하고 임의 key ID를 거절한다", async () => {
  const { dep, calls } = setup();
  dep.publicKeys = { v1: "old-public", v2: "new-public" };
  dep.keyId = "v2";
  const receiver = createECDH("prime256v1");
  receiver.generateKeys();
  const handler = createPushHandler("subscriptions", dep),
    input = {
      installationId: id,
      capability: randomSecret(),
      requestId: id,
      vapidKeyId: "v1",
      subscription: {
        endpoint: "https://fcm.googleapis.com/fcm/send/synthetic",
        keys: {
          p256dh: receiver.getPublicKey().toString("base64url"),
          auth: Buffer.from(new Uint8Array(16)).toString("base64url"),
        },
      },
    };
  assertEquals((await handler(request("register", input))).status, 200);
  assertEquals((calls[0].args.p_input as Record<string, unknown>).keyId, "v1");
  assertEquals(
    (await handler(
      request("register", { ...input, vapidKeyId: "unconfigured" }),
    )).status,
    400,
  );
  assertEquals(calls.length, 1);
});

Deno.test("잘못된 수신 EC 점은 등록에서 거절하고 전체 provider를 막을 job을 만들지 않는다", async () => {
  const { dep, calls } = setup();
  const input = {
    installationId: id,
    capability: randomSecret(),
    requestId: id,
    subscription: {
      endpoint: "https://fcm.googleapis.com/fcm/send/synthetic",
      keys: {
        p256dh: Buffer.from([4, ...new Uint8Array(64)]).toString("base64url"),
        auth: Buffer.from(new Uint8Array(16)).toString("base64url"),
      },
    },
  };
  const response = await createPushHandler("subscriptions", dep)(
    request("register", input),
  );
  assertEquals(response.status, 400);
  assertEquals((await response.json()).code, "INVALID_ENDPOINT");
  assertEquals(calls.length, 0);
});
