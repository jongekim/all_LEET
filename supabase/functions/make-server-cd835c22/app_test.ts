import { createHistoryApp } from "./app.ts";
import type { UserVerifier } from "./auth.ts";
import { gradeAnswers } from "../_shared/user-data-rules/grading.ts";

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
  ["PUT", "history", "/123"],
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
      ...structuredClone(gradeAnswers("2026", "verbal", { 1: 3 }, 30, "odd")),
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
    async mutate(owner: string, kind: "history" | "mock_history", action: "append" | "clear" | "delete", input: any = {}) {
      const key = `${kind}:${owner}`;
      const history = await this.get(key) || [];
      let result;
      if (action === "append") {
        result = kind === "history" ? { ...input, round: Math.max(0, ...history.filter((h: any) => h.year === input.year && h.subject === input.subject).map((h: any) => h.round || 1)) + 1, timestamp: Date.now(), groupTimestamp: typeof input.groupTimestamp === "number" ? input.groupTimestamp : input.timestamp } : { ...input, id: typeof input.id === "string" ? input.id : crypto.randomUUID(), createdAt: Date.now() };
        await this.set(key, [...history, result]);
      } else await this.set(key, action === "clear" ? [] : history.filter((h: any) => kind === "history" ? h.timestamp !== input.timestamp : h.id !== input.id));
      return result || {};
    },
    async updateAnswers(owner: string, timestamp: number, expected: unknown, patch: any) {
      const key = `history:${owner}`;
      const records = values.get(key) || [];
      const found = records.find((r: any) => r.timestamp === timestamp);
      if (JSON.stringify(found) !== JSON.stringify(expected)) throw new Error("HISTORY_CONFLICT");
      const saved = { ...found, ...patch };
      await this.set(key, records.map((r: any) => r.timestamp === timestamp ? saved : r));
      return saved;
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
        ...(method === "PUT" ? { body: JSON.stringify({ expected: values.get('history:owner-a')[0], userAnswers: { 1: 4 } }) } : {}),
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
    kv: { get: async () => [], mutate: async () => ({}), updateAnswers: async () => ({} as any) },
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
    const { app, values } = fixture(async () => {
      verifications++;
      return { userId: "owner-a" };
    });
    const response = await app.request(`${prefix}/${kind}/owner-a${suffix}`, {
      method,
      headers: {
        Authorization: "Bearer owner-token",
        "Content-Type": "application/json",
      },
      ...(method === "PUT" ? { body: JSON.stringify({ expected: values.get('history:owner-a')[0], userAnswers: { 1: 4 } }) } : {}),
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

Deno.test("answer edit recalculates on server and preserves record identity and other records", async () => {
  const { app, values } = fixture();
  const expected = Object.fromEntries(Object.entries(structuredClone(values.get('history:owner-a')[0])).reverse());
  values.get('history:owner-a').push({ ...expected, subject: 'reasoning', timestamp: 124 });
  const other = structuredClone(values.get('history:owner-a')[1]);
  const response = await app.request(`${prefix}/history/owner-a/123`, {
    method: 'PUT', headers: { Authorization: 'Bearer owner-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ expected, userAnswers: { 1: 4 } }),
  });
  equal(response.status, 200);
  const saved = (await response.json()).data;
  equal(saved.correct, 1);
  equal([saved.timestamp, saved.groupTimestamp, saved.round], [123, 99, 2]);
  equal(saved.standardScore, gradeAnswers('2026', 'verbal', { 1: 4 }, 30, 'odd').standardScore);
  equal(values.get('history:owner-a').length, 2);
  equal(values.get('history:owner-a')[1], other);
});

for (const answers of [{ 0: 2 }, { 31: 2 }, { '01': 2 }, { 1: 6 }, { 1: '2' }, { 1: 1.5 }, [], null]) {
  Deno.test(`answer edit rejects invalid answers ${JSON.stringify(answers)}`, async () => {
    const { app, values, calls } = fixture();
    const expected = structuredClone(values.get('history:owner-a')[0]);
    const response = await app.request(`${prefix}/history/owner-a/123`, {
      method: 'PUT', headers: { Authorization: 'Bearer owner-token' },
      body: JSON.stringify({ expected, userAnswers: answers }),
    });
    equal(response.status, 400);
    equal(calls.some(c => c.startsWith('set:')), false);
  });
}

Deno.test('answer edit rejects oversized input before accessing history', async () => {
  const { app, values, calls } = fixture();
  const expected = structuredClone(values.get('history:owner-a')[0]);
  const response = await app.request(`${prefix}/history/owner-a/123`, {
    method: 'PUT', headers: { Authorization: 'Bearer owner-token' },
    body: JSON.stringify({ expected, userAnswers: { ['1'.repeat(65536)]: 4 } }),
  });
  equal(response.status, 413);
  equal(calls.length, 0);
});

Deno.test('answer edit rejects stale, missing, ambiguous records and injected score fields', async () => {
  for (const scenario of ['conflict', 'missing', 'duplicate', 'injection', 'answer-version']) {
    const { app, values, calls } = fixture();
    const expected = structuredClone(values.get('history:owner-a')[0]);
    if (scenario === 'conflict') values.get('history:owner-a')[0].round++;
    if (scenario === 'missing') values.set('history:owner-a', []);
    if (scenario === 'duplicate') values.get('history:owner-a').push(expected);
    if (scenario === 'answer-version') {
      values.get('history:owner-a')[0].correctAnswers[1] = 1;
      expected.correctAnswers[1] = 1;
    }
    const response = await app.request(`${prefix}/history/owner-a/123`, {
      method: 'PUT', headers: { Authorization: 'Bearer owner-token' },
      body: JSON.stringify({ expected, userAnswers: { 1: 4 }, ...(scenario === 'injection' ? { standardScore: 300 } : {}) }),
    });
    equal(response.status, scenario === 'missing' ? 404 : scenario === 'injection' ? 400 : scenario === 'answer-version' ? 422 : 409);
    equal(calls.some(c => c.startsWith('set:')), false);
  }
});
