import { Hono } from "npm:hono@4.13.9";
import { cors } from "npm:hono@4.13.9/cors";
import { bodyLimit } from "npm:hono@4.13.9/body-limit";
import {
  DATA_DOMAINS,
  type DataDomain,
  type DataPage,
  type DataRow,
  type ImageUpload,
  UUID_PATTERN,
} from "./user-data-contract.ts";
import type { CursorCodec } from "./analytics-cursor.ts";
import type { UserVerifier } from "../make-server-cd835c22/auth.ts";
import {
  admissionInput,
  mutationPatch,
  RULES_VERSION,
} from "./user-data-validation.ts";
import { imagePlans, verifyImageFile } from "./user-data-images.ts";
import { analyzeLawSchools } from "./user-data-rules/lawschool.ts";
export interface UserDataDependencies {
  verify: UserVerifier;
  isAdmin(token: string): Promise<boolean>;
  codec: CursorCodec;
  rpc(name: string, args: DataRow): Promise<any>;
  updateName(target: string, name: string): Promise<void>;
  getName(target: string): Promise<string | null>;
  removeImage(url: string, target: string): Promise<void>;
  storageBase?: string;
  uploadImage?(file: File, plan: ImageUpload): Promise<void>;
  imageMatches?(plan: ImageUpload): Promise<boolean>;
  log?(code: string): void;
}
const uuid = (v: unknown): string => {
  if (typeof v !== "string" || !UUID_PATTERN.test(v)) {
    throw new Error("INVALID_INPUT");
  }
  return v;
};
const row = (v: unknown): DataRow => {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error("INVALID_INPUT");
  }
  return v as DataRow;
};
const fieldKeys: Partial<Record<DataDomain, string>> = {
  account: "user_id",
  profile: "user_id",
  post_likes: "post_id",
  post_reports: "post_id",
  comment_likes: "comment_id",
  comment_reports: "comment_id",
  announcement_likes: "announcement_id",
  admission: "execution_id",
  usage: "event_id",
};
const context = (actor: string, target: string, domain: string) =>
  JSON.stringify([actor, target, domain, "user-data-v1"]);
export function createUserDataApp(
  kind: "admin" | "admission",
  d: UserDataDependencies,
) {
  const app = new Hono<{ Variables: { actor: string } }>();
  app.use(
    "*",
    cors({
      origin: "*",
      allowHeaders: ["Content-Type", "Authorization", "apikey"],
      allowMethods: ["POST", "OPTIONS"],
    }),
  );
  app.use(
    "*",
    async (c, next) =>
      bodyLimit({
        maxSize: c.req.path.endsWith("/commit") ? 26 * 1024 * 1024 : 256 * 1024,
        onError: (ctx) => ctx.json({ code: "INVALID_INPUT" }, 413),
      })(c, next),
  );
  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    if (c.req.method === "OPTIONS") return c.body(null, 204);
    const token = /^Bearer[ \t]+([^\s,]+)$/i.exec(
      c.req.header("Authorization") || "",
    )?.[1];
    if (!token) return c.json({ code: "AUTH_REQUIRED" }, 401);
    try {
      const identity = await d.verify(token);
      if (identity.unavailable) {
        return c.json({ code: "AUTH_UNAVAILABLE" }, 503);
      }
      if (!identity.userId) return c.json({ code: "AUTH_REQUIRED" }, 401);
      if (kind === "admin" && !await d.isAdmin(token)) {
        return c.json({ code: "ADMIN_REQUIRED" }, 403);
      }
      c.set("actor", identity.userId);
      await next();
    } catch (error) {
      d.log?.(error instanceof Error ? error.message : "AUTH_UNAVAILABLE");
      return c.json({ code: "AUTH_UNAVAILABLE" }, 503);
    }
  });
  app.onError((error, c) => {
    const known = [
      "INVALID_INPUT",
      "INVALID_STATE",
      "INVALID_FIELD",
      "INVALID_DOMAIN",
      "INVALID_SELECTOR",
      "CONFLICT",
      "NOT_FOUND",
      "EXPIRED",
      "APPROVAL_REQUIRED",
      "CALCULATION_CONFLICT",
      "CALCULATION_UNAVAILABLE",
      "INVALID_CURSOR",
      "NICKNAME_TAKEN",
      "ADMIN_REQUIRED",
      "OWNER_MISMATCH",
      "IMAGE_MISMATCH",
      "FILE_IN_USE",
    ];
    const code = known.includes(error.message)
      ? error.message
      : "STORAGE_UNAVAILABLE";
    d.log?.(code);
    return c.json(
      { code },
      code === "ADMIN_REQUIRED"
        ? 403
        : code === "NOT_FOUND"
        ? 404
        : code === "CONFLICT"
        ? 409
        : known.includes(code)
        ? 400
        : 503,
    );
  });
  const prefix = kind === "admin" ? "/admin-user-data" : "/admission-history";
  if (kind === "admission") {
    app.post(`${prefix}/save`, async (c) => {
      const body = row(await c.req.json());
      const execution = uuid(body.execution_id);
      const actor = c.get("actor");
      if (body.code !== undefined) {
        if (
          !["NETWORK_FAILED", "SAVE_FAILED", "VERSION_MISMATCH"].includes(
            String(body.code),
          )
        ) throw new Error("INVALID_INPUT");
        return c.json(
          await d.rpc("admission_execution_save", {
            p_owner: actor,
            p_execution: execution,
            p_input: {},
            p_analyses: [],
            p_version: RULES_VERSION,
            p_code: body.code,
          }),
        );
      }
      const input = admissionInput(body.input);
      if (body.rules_version !== RULES_VERSION) {
        await d.rpc("admission_execution_save", {
          p_owner: actor,
          p_execution: execution,
          p_input: {},
          p_analyses: [],
          p_version: RULES_VERSION,
          p_code: "VERSION_MISMATCH",
        });
        throw new Error("CALCULATION_UNAVAILABLE");
      }
      try {
        return c.json(
          await d.rpc("admission_execution_save", {
            p_owner: actor,
            p_execution: execution,
            p_input: input,
            p_analyses: analyzeLawSchools(input.leet, input.gpa),
            p_version: RULES_VERSION,
          }),
        );
      } catch (error) {
        try {
          await d.rpc("admission_execution_save", {
            p_owner: actor,
            p_execution: execution,
            p_input: {},
            p_analyses: [],
            p_version: RULES_VERSION,
            p_code: "SAVE_FAILED",
          });
        } catch {
          d.log?.("DIAGNOSTIC_UNAVAILABLE");
        }
        throw error;
      }
    });
    return app;
  }
  app.post(`${prefix}/members`, async (c) => {
    const b = row(await c.req.json());
    if (
      b.query !== undefined &&
      (typeof b.query !== "string" || b.query.length > 120)
    ) throw new Error("INVALID_INPUT");
    return c.json(
      await d.rpc("user_data_members", {
        p_actor: c.get("actor"),
        p_query: b.query || "",
        p_after: b.cursor ? uuid(b.cursor) : null,
      }),
    );
  });
  const targetDomain = (b: DataRow) => {
    const target = uuid(b.target);
    if (
      typeof b.domain !== "string" ||
      !Object.prototype.hasOwnProperty.call(DATA_DOMAINS, b.domain) &&
        !["history_summary", "mock_summary"].includes(b.domain)
    ) throw new Error("INVALID_DOMAIN");
    return { target, domain: b.domain as DataDomain };
  };
  async function decode(
    actor: string,
    target: string,
    domain: string,
    reference: unknown,
  ): Promise<DataRow> {
    if (typeof reference !== "string") throw new Error("INVALID_SELECTOR");
    return row(await d.codec.decode(reference, context(actor, target, domain)));
  }
  async function decorate(
    page: DataPage,
    actor: string,
    target: string,
    domain: string,
  ) {
    const referenceDomain = domain === "history_summary"
      ? "history"
      : domain === "mock_summary"
      ? "mock_history"
      : domain;
    if (
      ["history", "mock_history"].includes(referenceDomain) && page.snapshot
    ) {
      page.collection_reference = await d.codec.encode({
        all: true,
        snapshot: page.snapshot,
      }, context(actor, target, referenceDomain));
    }
    for (const item of page.items) {
      const selector: DataRow =
        referenceDomain === "history" || referenceDomain === "mock_history"
          ? { indices: [item.index], snapshot: page.snapshot }
          : {
            id: String(item[fieldKeys[domain as DataDomain] || "id"]),
            snapshot: item._snapshot,
          };
      if (domain === "storage_images") {
        selector.url =
          `${d.storageBase}/storage/v1/object/public/community-post-images/${
            String(item.name).split("/").map(encodeURIComponent).join("/")
          }`;
        item.url = selector.url;
      }
      item._reference = await d.codec.encode(
        selector,
        context(actor, target, referenceDomain),
      );
      delete item._snapshot;
    }
    return page;
  }
  app.post(`${prefix}/read`, async (c) => {
    const b = row(await c.req.json());
    const { target, domain } = targetDomain(b);
    const actor = c.get("actor");
    const offset = b.offset ?? 0;
    if (
      !Number.isInteger(offset) || Number(offset) < 0 ||
      Number(offset) > 1000000
    ) throw new Error("INVALID_INPUT");
    let selector: DataRow | null = null;
    if (b.references !== undefined) {
      if (
        !Array.isArray(b.references) || b.references.length < 1 ||
        b.references.length > 100
      ) throw new Error("INVALID_SELECTOR");
      const selectors = await Promise.all(
        b.references.map((ref) => decode(actor, target, domain, ref)),
      );
      if (domain === "history" || domain === "mock_history") {
        if (selectors.some((s) => s.snapshot !== selectors[0].snapshot)) {
          throw new Error("CONFLICT");
        }
        selector = selectors.length === 1 && selectors[0].all ? selectors[0] : {
          indices: selectors.flatMap((s) => s.indices as number[]),
          snapshot: selectors[0].snapshot,
        };
      } else {
        if (selectors.length !== 1) throw new Error("INVALID_SELECTOR");
        selector = selectors[0];
      }
    }
    if (selector && b.context_offset !== undefined) {
      if (
        !Number.isInteger(b.context_offset) || Number(b.context_offset) < 0 ||
        Number(b.context_offset) > 1000000
      ) throw new Error("INVALID_INPUT");
      selector = { ...selector, context_offset: b.context_offset };
    }
    const page = await d.rpc("user_data_read", {
      p_actor: actor,
      p_target: target,
      p_domain: domain,
      p_offset: offset,
      p_selector: selector,
    }) as DataPage;
    return c.json(await decorate(page, actor, target, domain));
  });
  app.post(`${prefix}/notes`, async (c) => {
    const b = row(await c.req.json());
    const actor = c.get("actor");
    const target = uuid(b.target);
    if (
      typeof b.group !== "number" || !Number.isSafeInteger(b.group) ||
      b.group < 0
    ) throw new Error("INVALID_INPUT");
    const page = await d.rpc("user_data_notes", {
      p_actor: actor,
      p_target: target,
      p_group: b.group,
    }) as DataPage;
    return c.json(await decorate(page, actor, target, "notes"));
  });
  app.post(`${prefix}/prepare`, async (c) => {
    const b = row(await c.req.json());
    const { target, domain } = targetDomain(b);
    const actor = c.get("actor");
    if (
      !["update", "delete"].includes(String(b.action)) ||
      !Array.isArray(b.references) || !b.references.length ||
      b.references.length > 100
    ) throw new Error("INVALID_INPUT");
    const selectors = await Promise.all(
      b.references.map((ref) => decode(actor, target, domain, ref)),
    );
    let selector: DataRow;
    if (domain === "history" || domain === "mock_history") {
      if (selectors.some((s) => s.snapshot !== selectors[0].snapshot)) {
        throw new Error("CONFLICT");
      }
      selector = selectors.length === 1 && selectors[0].all ? selectors[0] : {
        indices: selectors.flatMap((s) => s.indices as number[]),
        snapshot: selectors[0].snapshot,
      };
    } else {
      if (selectors.length !== 1) throw new Error("INVALID_INPUT");
      selector = selectors[0];
    }
    let patch: DataRow = {};
    let uploads: ImageUpload[] = [];
    if (b.action === "update") {
      const page = await d.rpc("user_data_read", {
        p_actor: actor,
        p_target: target,
        p_domain: domain,
        p_selector: selector,
      }) as DataPage;
      if (page.items.length !== 1) throw new Error("CONFLICT");
      const original = (domain === "history" || domain === "mock_history"
        ? page.items[0].record
        : page.items[0]) as DataRow;
      if (domain === "posts") {
        uploads = imagePlans(
          b.uploads,
          target,
          String(original.id),
          d.storageBase || "",
        );
        if (
          uploads.length &&
          (!d.storageBase || !d.uploadImage || !d.imageMatches)
        ) {
          throw new Error("STORAGE_UNAVAILABLE");
        }
      } else if (
        b.uploads !== undefined &&
        (!Array.isArray(b.uploads) || b.uploads.length)
      ) {
        throw new Error("INVALID_INPUT");
      }
      patch = mutationPatch(domain, original, b.payload, b.recalculate);
      if (uploads.length) {
        const kept =
          (patch.image_urls || original.image_urls || []) as string[];
        if (kept.length + uploads.length > 5) {
          throw new Error("INVALID_INPUT");
        }
        patch.image_urls = [
          ...kept,
          ...uploads.map((file) =>
            file.url
          ),
        ];
      }
    }
    return c.json(
      await d.rpc("user_data_prepare", {
        p_actor: actor,
        p_target: target,
        p_domain: domain,
        p_action: b.action,
        p_selector: selector,
        p_payload: patch,
        p_expected: selector.snapshot || null,
        p_uploads: uploads,
        p_rules_version: RULES_VERSION,
      }),
    );
  });
  async function cleanup(actor: string, operation: string) {
    const page = await d.rpc("user_data_cleanup", {
      p_actor: actor,
      p_operation: operation,
    });
    for (const item of page.items as DataRow[]) {
      if (item.state !== "succeeded") {
        let state = "succeeded", code: null | string = null;
        try {
          await d.removeImage(String(item.url), String(item.target));
        } catch (error) {
          state =
            error instanceof Error && error.message === "STORAGE_PATH_INVALID"
              ? "blocked"
              : "failed";
          code = state === "blocked"
            ? "STORAGE_PATH_INVALID"
            : "STORAGE_DELETE_FAILED";
        }
        await d.rpc("user_data_cleanup", {
          p_actor: actor,
          p_operation: operation,
          p_url: item.url,
          p_state: state,
          p_code: code,
        });
      }
    }
  }
  async function finalizeImages(
    actor: string,
    operation: string,
    uploads: ImageUpload[],
  ) {
    if (!d.imageMatches) throw new Error("STORAGE_UNAVAILABLE");
    const checks = await Promise.allSettled(
      uploads.map((plan) => d.imageMatches!(plan)),
    );
    if (
      checks.every((result) => result.status === "fulfilled" && result.value)
    ) {
      return d.rpc("user_data_commit", {
        p_actor: actor,
        p_operation: operation,
        p_approval: "승인",
        p_finalize_images: true,
      });
    }
    return d.rpc("user_data_operation", {
      p_actor: actor,
      p_operation: operation,
      p_finalize: "unknown",
      p_code: "IMAGE_UPLOAD_UNCONFIRMED",
    });
  }
  app.post(`${prefix}/commit`, async (c) => {
    const multipart = (c.req.header("Content-Type") || "").startsWith(
      "multipart/form-data",
    );
    const form = multipart ? await c.req.formData() : null;
    const b = form
      ? {
        operation_id: form.get("operation_id"),
        approval: form.get("approval"),
      }
      : row(await c.req.json());
    const actor = c.get("actor");
    const operation = uuid(b.operation_id);
    if (b.approval !== "승인") throw new Error("APPROVAL_REQUIRED");
    const intent = form
      ? await d.rpc("user_data_operation", {
        p_actor: actor,
        p_operation: operation,
      })
      : null;
    const plans = (intent?.uploads || []) as ImageUpload[];
    if (form) {
      for (const plan of plans) {
        const file = form.get(plan.id);
        if (!(file instanceof File)) throw new Error("IMAGE_MISMATCH");
        await verifyImageFile(file, plan);
      }
    }
    let result = await d.rpc("user_data_commit", {
      p_actor: actor,
      p_operation: operation,
      p_approval: b.approval,
    });
    if (result.external === "post_images") {
      if (form && d.uploadImage) {
        const uploads = result.uploads as ImageUpload[];
        await Promise.allSettled(
          uploads.map((plan) =>
            d.uploadImage!(form.get(plan.id) as File, plan)
          ),
        );
      }
      result = await finalizeImages(actor, operation, result.uploads);
    } else if (result.external) {
      let state = "succeeded", code: null | string = null;
      try {
        await d.updateName(result.target, String(result.payload.name));
      } catch {
        state = "unknown";
        code = "AUTH_UPDATE_UNCONFIRMED";
      }
      result = await d.rpc("user_data_operation", {
        p_actor: actor,
        p_operation: operation,
        p_finalize: state,
        p_code: code,
      });
    }
    if (result.state === "partial" || result.cleanup) {
      await cleanup(actor, operation);
      result = await d.rpc("user_data_operation", {
        p_actor: actor,
        p_operation: operation,
      });
    }
    delete result.payload;
    return c.json(result);
  });
  app.post(`${prefix}/operation`, async (c) => {
    const b = row(await c.req.json());
    const actor = c.get("actor");
    const operation = uuid(b.operation_id);
    let result = await d.rpc("user_data_operation", {
      p_actor: actor,
      p_operation: operation,
    });
    if (
      result.domain === "posts" && result.uploads?.length &&
      ["executing", "unknown"].includes(result.state)
    ) {
      result = await finalizeImages(actor, operation, result.uploads);
      if (result.cleanup || result.state === "partial") {
        await cleanup(actor, operation);
        result = await d.rpc("user_data_operation", {
          p_actor: actor,
          p_operation: operation,
        });
      }
    }
    if (
      result.domain === "account" &&
      ["executing", "unknown"].includes(result.state)
    ) {
      try {
        const name = await d.getName(result.target);
        result = await d.rpc("user_data_operation", {
          p_actor: actor,
          p_operation: operation,
          p_finalize: name === result.payload.name ? "succeeded" : "unknown",
          p_code: name === result.payload.name
            ? null
            : "AUTH_UPDATE_UNCONFIRMED",
        });
      } catch {
        d.log?.("AUTH_UPDATE_UNCONFIRMED");
      }
    }
    if (result.state !== "prepared") delete result.payload;
    return c.json(result);
  });
  return app;
}
