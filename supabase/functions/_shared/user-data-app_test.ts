import {
  createUserDataApp,
  type UserDataDependencies,
} from "./user-data-app.ts";
import { createCursorCodec } from "./analytics-cursor.ts";
import { mutationPatch } from "./user-data-validation.ts";
import { getCorrectAnswers } from "./user-data-rules/answerData.ts";
import { gradeAnswers } from "./user-data-rules/grading.ts";
import { analyzeLawSchools } from "./user-data-rules/lawschool.ts";
import { type DataRow, USER_DATA_RULES_VERSION } from "./user-data-contract.ts";
const actor = "00000000-0000-4000-8000-000000000001",
  target = "00000000-0000-4000-8000-000000000002",
  operation = "00000000-0000-4000-8000-000000000003";
function equal(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
}
function assert(value: unknown) {
  if (!value) throw new Error("Assertion failed");
}
function fixture(overrides: Partial<UserDataDependencies> = {}) {
  const calls: { name: string; args: DataRow }[] = [];
  const d: UserDataDependencies = {
    verify: async (token) => ({
      userId: token === "admin-token" ? actor : null,
    }),
    isAdmin: async () => true,
    codec: createCursorCodec("synthetic-secret"),
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { items: [], total: 0 };
    },
    updateName: async () => {},
    getName: async () => null,
    removeImage: async () => {},
    ...overrides,
  };
  const app = createUserDataApp("admin", d);
  const request = (
    path: string,
    body: DataRow = {},
    token: string | null = "admin-token",
  ) =>
    app.request(`/admin-user-data/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  return { d, app, calls, request };
}
for (
  const path of ["members", "read", "notes", "prepare", "commit", "operation"]
) {
  Deno.test(`userdata ${path}: missing/invalid token never accesses storage`, async () => {
    for (const token of [null, "anon-token"]) {
      const f = fixture();
      equal((await f.request(path, {}, token)).status, 401);
      equal(f.calls, []);
    }
  });
}
Deno.test("valid user without administrator role cannot call data RPCs", async () => {
  const f = fixture({ isAdmin: async () => false });
  equal((await f.request("members")).status, 403);
  equal(f.calls, []);
});
Deno.test("verified actor is authoritative and personal filters stay in POST bodies", async () => {
  const f = fixture();
  equal(
    (await f.request("members", { query: "name@example.test", actor: target }))
      .status,
    200,
  );
  equal(f.calls[0].args.p_actor, actor);
  equal(f.calls[0].args.p_query, "name@example.test");
});
Deno.test("HMAC references cannot be moved to another target or another domain", async () => {
  const f = fixture();
  const reference = await f.d.codec.encode({
    id: operation,
    snapshot: "synthetic",
  }, JSON.stringify([actor, target, "posts", "user-data-v1"]));
  equal(
    (await f.request("prepare", {
      target: actor,
      domain: "posts",
      action: "delete",
      references: [reference],
    })).status,
    400,
  );
  equal(
    (await f.request("prepare", {
      target,
      domain: "comments",
      action: "delete",
      references: [reference],
    })).status,
    400,
  );
  equal(f.calls, []);
});
Deno.test("commit requires exact approval and never repeats an external name update", async () => {
  let state = "prepared", updates = 0;
  const f = fixture({
    rpc: async (name) => {
      if (name === "user_data_commit") {
        if (state === "prepared") {
          state = "executing";
          return {
            state,
            external: true,
            target,
            payload: { name: "새 이름" },
          };
        }
        return { state };
      }
      if (name === "user_data_operation") {
        state = "succeeded";
        return { state };
      }
      return {};
    },
    updateName: async () => {
      updates++;
    },
  });
  for (const approval of ["", " 승인", "승인 ", "承認"]) {
    equal(
      (await f.request("commit", { operation_id: operation, approval })).status,
      400,
    );
  }
  equal(
    (await f.request("commit", { operation_id: operation, approval: "승인" }))
      .status,
    200,
  );
  equal(
    (await f.request("commit", { operation_id: operation, approval: "승인" }))
      .status,
    200,
  );
  equal(updates, 1);
});
Deno.test("response loss leaves external mutation unknown and reconciliation does not retry it", async () => {
  let state = "prepared", updates = 0;
  const f = fixture({
    rpc: async (name, args) => {
      if (name === "user_data_commit") {
        if (state === "prepared") {
          state = "executing";
          return {
            state,
            external: true,
            target,
            payload: { name: "새 이름" },
          };
        }
        return { state };
      }
      if (name === "user_data_operation") {
        state = String(args.p_finalize || state);
        return {
          state,
          domain: "account",
          target,
          payload: { name: "새 이름" },
        };
      }
      return {};
    },
    updateName: async () => {
      updates++;
      throw new Error("response lost");
    },
    getName: async () => "새 이름",
  });
  equal(
    (await (await f.request("commit", {
      operation_id: operation,
      approval: "승인",
    })).json()).state,
    "unknown",
  );
  equal(
    (await (await f.request("operation", { operation_id: operation })).json())
      .state,
    "succeeded",
  );
  equal(updates, 1);
});
Deno.test("nickname collisions and denied DB access use safe error codes", async () => {
  for (const code of ["NICKNAME_TAKEN", "ADMIN_REQUIRED"]) {
    const f = fixture({
      rpc: async () => {
        throw new Error(code);
      },
    });
    const response = await f.request("members");
    equal(response.status, code === "ADMIN_REQUIRED" ? 403 : 400);
    equal(await response.json(), { code });
  }
});
Deno.test("field allow-list and selected recalculation preserve identity and manual scores", () => {
  const answers = getCorrectAnswers("2026", "verbal", "odd");
  const original = gradeAnswers("2026", "verbal", answers, 30, "odd");
  const patch = mutationPatch("history", original as unknown as DataRow, {
    userAnswers: { ...answers, 1: 0 },
    percentile: 47,
  }, ["correct", "fieldAnalysis", "standardScore"]);
  equal(patch.correct, 29);
  equal(patch.percentile, 47);
  equal(Object.keys(patch).includes("timestamp"), false);
  equal(Object.keys(patch).includes("round"), false);
  for (
    const payload of [{ year: "2025" }, { timestamp: 3 }, { round: 9 }, {
      email: "new@example.test",
    }]
  ) {
    let failed = false;
    try {
      mutationPatch("history", original as unknown as DataRow, payload, []);
    } catch {
      failed = true;
    }
    assert(failed);
  }
  let failed = false;
  try {
    mutationPatch(
      "history",
      original as unknown as DataRow,
      { percentile: 34 },
      ["percentile"],
    );
  } catch (e) {
    equal((e as Error).message, "CALCULATION_CONFLICT");
    failed = true;
  }
  assert(failed);
  equal(mutationPatch("account", {}, { name: "허용된 이름" }, []), {
    name: "허용된 이름",
  });
});
Deno.test("admission persistence validates owner/version and recomputes the public rules", async () => {
  const f = fixture();
  const app = createUserDataApp("admission", f.d);
  const response = await app.request("/admission-history/save", {
    method: "POST",
    headers: {
      Authorization: "Bearer admin-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      execution_id: operation,
      user_id: target,
      input: { leet: 130, gpa: 97 },
      analyses: [{ injected: true }],
      rules_version: USER_DATA_RULES_VERSION,
    }),
  });
  equal(response.status, 200);
  equal(f.calls[0].args.p_owner, actor);
  equal(f.calls[0].args.p_analyses, analyzeLawSchools(130, 97));
});
Deno.test("admission save diagnostics do not depend on product analytics", async () => {
  const calls: DataRow[] = [];
  const f = fixture({
    rpc: async (_name, args) => {
      calls.push(args);
      if (!args.p_code) throw new Error("STORAGE_UNAVAILABLE");
      return {};
    },
  });
  const app = createUserDataApp("admission", f.d);
  const response = await app.request("/admission-history/save", {
    method: "POST",
    headers: {
      Authorization: "Bearer admin-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      execution_id: operation,
      input: { leet: 130, gpa: 97 },
      rules_version: USER_DATA_RULES_VERSION,
    }),
  });
  equal(response.status, 503);
  equal(calls[1].p_code, "SAVE_FAILED");
  equal(calls[1].p_input, {});
  equal(calls[1].p_analyses, []);
});
Deno.test("approved image bytes must match the manifest before any mutation or upload", async () => {
  const { imageHash } = await import("./user-data-images.ts");
  const file = new File(
    [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
    "test.png",
    { type: "image/png" },
  );
  let commits = 0, uploads = 0;
  const plan = {
    id: target,
    name: file.name,
    mime: file.type,
    size: file.size,
    sha256: await imageHash(file),
    path: "synthetic.png",
    url: "https://synthetic.test/synthetic.png",
  };
  const f = fixture({
    storageBase: "https://synthetic.test",
    uploadImage: async () => {
      uploads++;
    },
    imageMatches: async () => true,
    rpc: async (name, args) => {
      if (name === "user_data_operation") {
        return {
          operation_id: operation,
          state: "executing",
          domain: "posts",
          uploads: [plan],
        };
      }
      if (name === "user_data_commit") {
        commits++;
        return args.p_finalize_images
          ? { state: "succeeded" }
          : { state: "executing", external: "post_images", uploads: [plan] };
      }
      return {};
    },
  });
  const form = new FormData();
  form.set("operation_id", operation);
  form.set("approval", "승인");
  form.set(target, new File(["wrong"], file.name, { type: file.type }));
  const send = () =>
    f.app.request("/admin-user-data/commit", {
      method: "POST",
      headers: { Authorization: "Bearer admin-token" },
      body: form,
    });
  equal((await send()).status, 400);
  equal(commits, 0);
  equal(uploads, 0);
  form.set(target, file);
  equal((await (await send()).json()).state, "succeeded");
  equal(commits, 2);
  equal(uploads, 1);
});
Deno.test("image upload response loss reconciles existing bytes without uploading again", async () => {
  let uploads = 0, finalized = 0;
  const f = fixture({
    imageMatches: async () => true,
    uploadImage: async () => {
      uploads++;
    },
    rpc: async (name, args) => {
      if (name === "user_data_operation") {
        return {
          state: "unknown",
          domain: "posts",
          uploads: [{ path: "synthetic.png" }],
        };
      }
      if (name === "user_data_commit" && args.p_finalize_images) {
        finalized++;
        return { state: "succeeded" };
      }
      return {};
    },
  });
  equal(
    (await (await f.request("operation", { operation_id: operation })).json())
      .state,
    "succeeded",
  );
  equal(uploads, 0);
  equal(finalized, 1);
});
Deno.test("unconfirmed image files leave durable unknown status and never finalize a post", async () => {
  const f = fixture({
    imageMatches: async () => false,
    rpc: async (name, args) => {
      if (name === "user_data_operation") {
        return {
          state: args.p_finalize || "unknown",
          domain: "posts",
          uploads: [{ path: "missing.png" }],
        };
      }
      throw new Error("Unexpected finalization");
    },
  });
  equal(
    (await (await f.request("operation", { operation_id: operation })).json())
      .state,
    "unknown",
  );
});
Deno.test("a prepared operation exposes only its proposed patch for fresh review", async () => {
  const f = fixture({
    rpc: async () => ({
      state: "prepared",
      target,
      payload: { name: "proposed only" },
      impact: { account: 1 },
    }),
  });
  const result =
    await (await f.request("operation", { operation_id: operation })).json();
  equal(result.payload, { name: "proposed only" });
  equal(result.target, target);
});
