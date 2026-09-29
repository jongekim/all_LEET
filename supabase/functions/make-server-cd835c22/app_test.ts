import { createHistoryApp } from "./app.ts";
import type { UserVerifier } from "./auth.ts";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

const prefix = "/make-server-cd835c22";
const routes = [
  ["GET", "history", ""],
  ["POST", "history", ""],
  ["DELETE", "history", ""],
  ["DELETE", "history", "/123"],
  ["GET", "mock-history", ""],
  ["POST", "mock-history", ""],
  ["DELETE", "mock-history", ""],
  ["DELETE", "mock-history", "/mock-1"],
] as const;

function fixture(
  verifyUser: UserVerifier = async (token) => ({
    userId: token === "owner-token" ? "owner-a" : null,
  }),
) {
  const values = new Map<string, any>([
    ["history:owner-a", [{
      year: "2026",
      subject: "verbal",
      round: 2,
      timestamp: 123,
      groupTimestamp: 99,
      userAnswers: { 1: 3 },
    }]],
    ["history:owner-b", [{ timestamp: 456, privateScore: 101 }]],
    ["mock_history:owner-a", [{
      id: "mock-1",
      createdAt: 123,
      provider: "테스트",
      examDate: "2026-09-01",
    }]],
    ["mock_history:owner-b", [{ id: "victim-mock" }]],
  ]);
  const calls: string[] = [];
  const kv = {
    get(key: string) {
      calls.push(`get:${key}`);
      return Promise.resolve(structuredClone(values.get(key)));
    },
    set(key: string, value: any) {
      calls.push(`set:${key}`);
      values.set(key, structuredClone(value));
      return Promise.resolve();
    },
  };
  return { app: createHistoryApp({ kv, verifyUser }), calls, values };
}

for (const [method, kind, suffix] of routes) {
  for (
    const credential of [
      undefined,
      "Basic owner-token",
      "Bearer",
      "Bearer token, Bearer owner-token",
      "Bearer anon-key",
      "Bearer expired-token",
      "Bearer other-project-token",
    ]
  ) {
    Deno.test(`${method} ${kind}${suffix}: rejects ${credential ?? "no token"} before KV/body`, async () => {
      const { app, calls } = fixture();
      const response = await app.request(`${prefix}/${kind}/owner-a${suffix}`, {
        method,
        headers: credential ? { Authorization: credential } : {},
        ...(method === "POST" ? { body: "invalid JSON" } : {}),
      });
      equal(response.status, 401);
      equal((await response.json()).code, "AUTH_REQUIRED");
      equal(response.headers.get("Cache-Control"), "no-store");
      equal(calls, []);
    });
  }
  Deno.test(`${method} ${kind}${suffix}: A cannot access B`, async () => {
    const { app, calls, values } = fixture();
    const before = structuredClone([...values]);
    const response = await app.request(`${prefix}/${kind}/owner-b${suffix}`, {
      method,
      headers: { Authorization: "Bearer owner-token" },
      ...(method === "POST" ? { body: "invalid JSON" } : {}),
    });
    equal(response.status, 403);
    equal(calls, []);
    equal([...values], before);
  });
  for (const fail of ["unavailable", "throw"] as const) {
    Deno.test(`${method} ${kind}${suffix}: Auth ${fail} fails closed`, async () => {
      const { app, calls } = fixture(async () => {
        if (fail === "throw") throw new Error("isolated Auth outage");
        return { userId: null, unavailable: true };
      });
      const response = await app.request(`${prefix}/${kind}/owner-a${suffix}`, {
        method,
        headers: { Authorization: "Bearer owner-token" },
      });
      equal(response.status, 503);
      equal(calls, []);
    });
  }
  Deno.test(`${method} ${kind}${suffix}: owner succeeds with unchanged contract`, async () => {
    const { app, calls, values } = fixture();
    const victimBefore = structuredClone([
      values.get("history:owner-b"),
      values.get("mock_history:owner-b"),
    ]);
    const response = await app.request(
      `${prefix}/${kind}/owner-a${suffix}?userId=owner-b`,
      {
        method,
        headers: {
          Authorization: "bearer owner-token",
          "Content-Type": "application/json",
        },
        ...(method === "POST"
          ? {
            body: JSON.stringify({
              year: "2026",
              subject: "verbal",
              timestamp: 700,
              groupTimestamp: 700,
              id: "mock-new",
              userId: "owner-b",
            }),
          }
          : {}),
      },
    );
    equal(response.status, 200);
    const payload = await response.json();
    equal(payload.success, true);
    equal(calls.every((key) => key.endsWith(":owner-a")), true);
    equal(
      [values.get("history:owner-b"), values.get("mock_history:owner-b")],
      victimBefore,
    );
    if (method === "GET") {
      equal(
        payload.data,
        kind === "history"
          ? values.get("history:owner-a")
          : values.get("mock_history:owner-a"),
      );
    }
    if (method === "POST" && kind === "history") {
      equal(payload.data.round, 3);
      equal(payload.data.groupTimestamp, 700);
      equal(typeof payload.data.timestamp, "number");
      equal(values.get("history:owner-a").length, 2);
      equal(values.get("history:owner-a")[0].userAnswers, { 1: 3 });
    }
    if (method === "POST" && kind === "mock-history") {
      equal(payload.data.id, "mock-new");
      equal(typeof payload.data.createdAt, "number");
      equal(values.get("mock_history:owner-a").length, 2);
    }
    if (method === "DELETE") {
      equal(
        values.get(
          kind === "history" ? "history:owner-a" : "mock_history:owner-a",
        ),
        [],
      );
    }
  });
}

Deno.test("encoded victim ID, implicit HEAD and nested paths never bypass ownership", async () => {
  for (
    const path of [
      "history/%6fwner-b",
      "mock-history/%6fwner-b",
      "history/owner-b/123",
      "history/owner-b/extra/path",
    ]
  ) {
    const { app, calls } = fixture();
    const response = await app.request(`${prefix}/${path}`, {
      method: "HEAD",
      headers: { Authorization: "Bearer owner-token" },
    });
    equal(response.status, 403);
    equal(calls, []);
  }
  const { app, calls } = fixture();
  equal(
    (await app.request(`${prefix}/history/owner-a`, { method: "HEAD" })).status,
    401,
  );
  equal(calls, []);
});

Deno.test("public health and browser OPTIONS do not require Auth or touch KV", async () => {
  let verifications = 0;
  const { app, calls } = fixture(async () => {
    verifications++;
    throw new Error("must not verify preflight");
  });
  equal((await app.request(`${prefix}/health`)).status, 200);
  for (const kind of ["history", "mock-history"]) {
    const response = await app.request(`${prefix}/${kind}/owner-a`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://frontend.invalid",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
      },
    });
    equal(response.status, 204);
    equal(
      response.headers.get("Access-Control-Allow-Headers"),
      "Content-Type,Authorization",
    );
  }
  equal(verifications, 0);
  equal(calls, []);
});

Deno.test("request logs use route templates without user IDs or bearer values", async () => {
  const events: unknown[] = [];
  const app = createHistoryApp({
    kv: { get: async () => [], set: async () => {} },
    verifyUser: async () => ({ userId: "owner-a" }),
    log: (event) => events.push(event),
  });
  await app.request(`${prefix}/history/owner-a`, {
    headers: { Authorization: "Bearer confidential-token" },
  });
  const serialized = JSON.stringify(events);
  equal(serialized.includes("owner-a"), false);
  equal(serialized.includes("confidential-token"), false);
  equal(events.length, 1);
});

Deno.test("each legitimate collection or record request verifies Auth exactly once", async () => {
  for (const [method, kind, suffix] of routes) {
    let verifications = 0;
    const { app } = fixture(async () => {
      verifications++;
      return { userId: "owner-a" };
    });
    const response = await app.request(`${prefix}/${kind}/owner-a${suffix}`, {
      method,
      headers: {
        Authorization: "Bearer owner-token",
        "Content-Type": "application/json",
      },
      ...(method === "POST"
        ? {
          body: JSON.stringify({
            year: "2026",
            subject: "verbal",
            timestamp: 700,
          }),
        }
        : {}),
    });
    equal(response.status, 200);
    equal(verifications, 1);
  }
});
