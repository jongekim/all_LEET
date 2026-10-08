import { Hono, type MiddlewareHandler } from "npm:hono@4.13.9";
import { cors } from "npm:hono@4.13.9/cors";
import { bodyLimit } from "npm:hono@4.13.9/body-limit";
import type { UserVerifier } from "./auth.ts";
import { answerEditPatch } from "../_shared/user-data-rules/answerEdit.ts";
import type { GradingResult } from "../_shared/user-data-rules/types.ts";

interface HistoryStore {
  get(key: string): Promise<any>;
  mutate(owner: string, kind: "history" | "mock_history", action: "append" | "clear" | "delete", input?: any): Promise<any>;
  updateAnswers(owner: string, timestamp: number, expected: unknown, patch: unknown): Promise<GradingResult>;
}

type HistoryEnv = { Variables: { historyOwner: string } };

// JSONB ignores object key order. Compare the client snapshot to the exact record
// used for calculation, then compare that server snapshot again inside the lock.
const recordSnapshot = (record: unknown) => JSON.stringify(record, (_key, value) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
    : value
);

// Dependencies are explicit so route tests cannot reach production Auth or KV.
export function createHistoryApp({ kv, verifyUser, log }: {
  kv: HistoryStore;
  verifyUser: UserVerifier;
  log?: (event: { method: string; route: string; status: number }) => void;
}) {
  const app = new Hono<HistoryEnv>();

  app.use("*", async (c, next) => {
    await next();
    // Log the route template, never the token or the URL's user ID.
    log?.({
      method: c.req.method,
      route: c.req.routePath,
      status: c.res.status,
    });
  });

  // Enable CORS for all routes and methods
  app.use(
    "/*",
    cors({
      origin: "*",
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      exposeHeaders: ["Content-Length"],
      maxAge: 600,
    }),
  );

  const requireOwner: MiddlewareHandler<HistoryEnv> = async (c, next) => {
    c.header("Cache-Control", "no-store");
    const match = /^Bearer[ \t]+([^\s,]+)$/i.exec(
      c.req.header("Authorization") || "",
    );
    if (!match) {
      return c.json({
        success: false,
        code: "AUTH_REQUIRED",
        error: "로그인이 필요합니다.",
      }, 401);
    }
    try {
      const verified = await verifyUser(match[1]);
      if (verified.unavailable) {
        return c.json({
          success: false,
          code: "AUTH_UNAVAILABLE",
          error: "인증 확인이 지연되고 있습니다. 잠시 후 다시 시도해주세요.",
        }, 503);
      }
      if (!verified.userId) {
        return c.json({
          success: false,
          code: "AUTH_REQUIRED",
          error: "로그인을 다시 확인해주세요.",
        }, 401);
      }
      if (verified.userId !== c.req.param("userId")) {
        return c.json({
          success: false,
          code: "OWNER_MISMATCH",
          error: "본인의 성적 이력만 사용할 수 있습니다.",
        }, 403);
      }
      c.set("historyOwner", verified.userId);
    } catch {
      // An Auth outage must never become anonymous access to service-role KV.
      return c.json({
        success: false,
        code: "AUTH_UNAVAILABLE",
        error: "인증을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
      }, 503);
    }
    await next();
  };

  // CORS handles OPTIONS before this boundary. Both collection and record routes
  // (including Hono's implicit HEAD dispatch) pass through the same guard.
  for (const kind of ["history", "mock-history"]) {
    // In Hono this wildcard also matches the collection path. Registering both
    // patterns would call Auth twice for every collection request.
    app.use(`/make-server-cd835c22/${kind}/:userId/*`, requireOwner);
  }

  // Health check endpoint
  app.get("/make-server-cd835c22/health", (c) => {
    return c.json({ status: "ok" });
  });

  // Get user's grading history
  app.get("/make-server-cd835c22/history/:userId", async (c) => {
    try {
      const userId = c.get("historyOwner");
      const key = `history:${userId}`;
      const history = await kv.get(key);

      return c.json({
        success: true,
        data: history || [],
      });
    } catch (error) {
      console.error("Failed to fetch history:", error);
      return c.json({
        success: false,
        error: "Failed to fetch history",
      }, 500);
    }
  });

  // Add grading result to history
  app.post("/make-server-cd835c22/history/:userId", async (c) => {
    try {
      const userId = c.get("historyOwner");
      const result = await c.req.json();

      const resultWithRound = await kv.mutate(userId, "history", "append", result);

      return c.json({
        success: true,
        data: resultWithRound,
      });
    } catch (error) {
      console.error("Failed to add history:", error);
      return c.json({
        success: false,
        error: "Failed to add history",
      }, 500);
    }
  });

  // Update one existing attempt. Scores and answer keys never come from the client.
  app.put("/make-server-cd835c22/history/:userId/:timestamp",
    bodyLimit({ maxSize: 64 * 1024, onError: c => c.json({ success: false, code: "INVALID_INPUT" }, 413) }),
    async (c) => {
      try {
        const rawTimestamp = c.req.param("timestamp");
        const timestamp = Number(rawTimestamp);
        if (!/^[1-9]\d*$/.test(rawTimestamp) || !Number.isSafeInteger(timestamp)) throw new Error("INVALID_INPUT");
        const input = await c.req.json().catch(() => { throw new Error("INVALID_INPUT"); });
        if (!input || typeof input !== "object" || Array.isArray(input) ||
          Object.keys(input).some(key => !["expected", "userAnswers"].includes(key)) ||
          !input.expected || typeof input.expected !== "object" || Array.isArray(input.expected) || input.expected.timestamp !== timestamp) {
          throw new Error("INVALID_INPUT");
        }
        const owner = c.get("historyOwner");
        const history = await kv.get(`history:${owner}`);
        if (history != null && !Array.isArray(history)) throw new Error("STORAGE_UNAVAILABLE");
        const matches = (history || []).filter((record: GradingResult) => record.timestamp === timestamp);
        if (!matches.length) throw new Error("RECORD_NOT_FOUND");
        if (matches.length !== 1) throw new Error("AMBIGUOUS_RECORD");
        if (recordSnapshot(matches[0]) !== recordSnapshot(input.expected)) throw new Error("HISTORY_CONFLICT");
        const patch = answerEditPatch(matches[0], input.userAnswers);
        const saved = await kv.updateAnswers(owner, timestamp, matches[0], patch);
        return c.json({ success: true, data: saved });
      } catch (error) {
        const code = error instanceof Error ? error.message : "STORAGE_UNAVAILABLE";
        if (["HISTORY_CONFLICT", "AMBIGUOUS_RECORD"].includes(code)) return c.json({ success: false, code }, 409);
        if (code === "RECORD_NOT_FOUND") return c.json({ success: false, code }, 404);
        if (code === "INVALID_INPUT") return c.json({ success: false, code }, 400);
        if (code === "CALCULATION_UNAVAILABLE") return c.json({ success: false, code }, 422);
        console.error("답안 수정 저장 실패", code);
        return c.json({ success: false, code: "STORAGE_UNAVAILABLE" }, 503);
      }
    });

  // Clear user's history
  app.delete("/make-server-cd835c22/history/:userId", async (c) => {
    try {
      const userId = c.get("historyOwner");

      await kv.mutate(userId, "history", "clear");

      return c.json({
        success: true,
      });
    } catch (error) {
      console.error("Failed to clear history:", error);
      return c.json({
        success: false,
        error: "Failed to clear history",
      }, 500);
    }
  });

  // Delete specific record from history
  app.delete("/make-server-cd835c22/history/:userId/:timestamp", async (c) => {
    try {
      const userId = c.get("historyOwner");
      const timestamp = parseInt(c.req.param("timestamp"));

      await kv.mutate(userId, "history", "delete", { timestamp });

      return c.json({
        success: true,
      });
    } catch (error) {
      console.error("Failed to delete record:", error);
      return c.json({
        success: false,
        error: "Failed to delete record",
      }, 500);
    }
  });

  // -----------------------------------------------------------------------------
  // Mock exam history (separate storage)
  // -----------------------------------------------------------------------------

  // Get user's mock exam history
  app.get("/make-server-cd835c22/mock-history/:userId", async (c) => {
    try {
      const userId = c.get("historyOwner");
      const key = `mock_history:${userId}`;
      const history = await kv.get(key);

      return c.json({
        success: true,
        data: history || [],
      });
    } catch (error) {
      console.error("Failed to fetch mock history:", error);
      return c.json({
        success: false,
        error: "Failed to fetch mock history",
      }, 500);
    }
  });

  // Add mock exam record
  app.post("/make-server-cd835c22/mock-history/:userId", async (c) => {
    try {
      const userId = c.get("historyOwner");
      const input = await c.req.json();

      const record = await kv.mutate(userId, "mock_history", "append", input);

      return c.json({
        success: true,
        data: record,
      });
    } catch (error) {
      console.error("Failed to add mock history:", error);
      return c.json({
        success: false,
        error: "Failed to add mock history",
      }, 500);
    }
  });

  // Clear user's mock history
  app.delete("/make-server-cd835c22/mock-history/:userId", async (c) => {
    try {
      const userId = c.get("historyOwner");
      await kv.mutate(userId, "mock_history", "clear");

      return c.json({
        success: true,
      });
    } catch (error) {
      console.error("Failed to clear mock history:", error);
      return c.json({
        success: false,
        error: "Failed to clear mock history",
      }, 500);
    }
  });

  // Delete specific mock record by id
  app.delete("/make-server-cd835c22/mock-history/:userId/:id", async (c) => {
    try {
      const userId = c.get("historyOwner");
      const id = c.req.param("id");

      await kv.mutate(userId, "mock_history", "delete", { id });

      return c.json({
        success: true,
      });
    } catch (error) {
      console.error("Failed to delete mock history record:", error);
      return c.json({
        success: false,
        error: "Failed to delete mock history record",
      }, 500);
    }
  });

  return app;
}
