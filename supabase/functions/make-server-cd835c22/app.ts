import { Hono, type MiddlewareHandler } from "npm:hono@4.13.9";
import { cors } from "npm:hono@4.13.9/cors";
import type { UserVerifier } from "./auth.ts";

interface HistoryStore {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
}

type HistoryEnv = { Variables: { historyOwner: string } };

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
      const key = `history:${userId}`;
      const result = await c.req.json();

      // Get existing history
      const history = await kv.get(key) || [];

      // Calculate round number
      const sameYearSubject = history.filter(
        (h: any) => h.year === result.year && h.subject === result.subject,
      );
      const maxRound = sameYearSubject.length > 0
        ? Math.max(...sameYearSubject.map((h: any) => h.round || 1))
        : 0;

      const resultWithRound = {
        ...result,
        round: maxRound + 1,
        timestamp: Date.now(),
        groupTimestamp: typeof result.groupTimestamp === "number"
          ? result.groupTimestamp
          : result.timestamp,
      };

      // Add new result
      const updatedHistory = [...history, resultWithRound];
      await kv.set(key, updatedHistory);

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

  // Clear user's history
  app.delete("/make-server-cd835c22/history/:userId", async (c) => {
    try {
      const userId = c.get("historyOwner");
      const key = `history:${userId}`;

      await kv.set(key, []);

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
      const key = `history:${userId}`;

      // Get current history
      const history = await kv.get(key) || [];

      // Filter out the record with matching timestamp
      const updatedHistory = history.filter((record: any) =>
        record.timestamp !== timestamp
      );

      // Save updated history
      await kv.set(key, updatedHistory);

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
      const key = `mock_history:${userId}`;
      const input = await c.req.json();

      const history = await kv.get(key) || [];

      const generatedId = typeof input?.id === "string"
        ? input.id
        : (globalThis.crypto?.randomUUID
          ? globalThis.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

      const record = {
        ...input,
        id: generatedId,
        createdAt: Date.now(),
      };

      const updatedHistory = [...history, record];
      await kv.set(key, updatedHistory);

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
      const key = `mock_history:${userId}`;
      await kv.set(key, []);

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
      const key = `mock_history:${userId}`;

      const history = await kv.get(key) || [];
      const updatedHistory = history.filter((record: any) => record?.id !== id);
      await kv.set(key, updatedHistory);

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
