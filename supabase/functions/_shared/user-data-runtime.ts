import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { createUserVerifier } from "../make-server-cd835c22/auth.ts";
import { createCursorCodec } from "./analytics-cursor.ts";
import { imageHash } from "./user-data-images.ts";
import type { UserDataDependencies } from "./user-data-app.ts";
export function userDataDependencies(): UserDataDependencies {
  const url = Deno.env.get("SUPABASE_URL") || "",
    anon = Deno.env.get("SUPABASE_ANON_KEY") || "",
    secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(12_000) }),
    },
  };
  const server = createClient(url, secret, options);
  return {
    storageBase: url,
    async imageMatches(plan) {
      const { data, error } = await server.storage.from("community-post-images")
        .download(plan.path!);
      if (error) {
        if (
          String((error as unknown as { statusCode?: string }).statusCode) ===
            "404"
        ) return false;
        throw new Error("STORAGE_UNAVAILABLE");
      }
      return data.size === plan.size && await imageHash(data) === plan.sha256;
    },
    async uploadImage(file, plan) {
      const { error } = await server.storage.from("community-post-images")
        .upload(plan.path!, file, {
          upsert: false,
          cacheControl: "3600",
          contentType: plan.mime,
        });
      if (error) throw new Error("IMAGE_UPLOAD_UNCONFIRMED");
    },
    verify: createUserVerifier({ url, anonKey: anon }),
    codec: createCursorCodec(secret),
    async isAdmin(token) {
      const client = createClient(url, anon, {
        ...options,
        global: {
          ...options.global,
          headers: { Authorization: `Bearer ${token}` },
        },
      });
      const { data, error } = await client.rpc("current_user_is_admin");
      if (error) throw new Error("AUTH_UNAVAILABLE");
      return data === true;
    },
    async rpc(name, args) {
      const { data, error } = await server.rpc(name, args);
      if (error) {
        const codes = [
          "INVALID_INPUT",
          "INVALID_FIELD",
          "INVALID_DOMAIN",
          "INVALID_SELECTOR",
          "CONFLICT",
          "NOT_FOUND",
          "EXPIRED",
          "APPROVAL_REQUIRED",
          "INVALID_STATE",
          "ADMIN_REQUIRED",
          "OWNER_MISMATCH",
          "FILE_IN_USE",
        ];
        throw new Error(
          error.code === "23505"
            ? "NICKNAME_TAKEN"
            : codes.find((code) => error.message === code) ||
              "STORAGE_UNAVAILABLE",
        );
      }
      return data;
    },
    // Auth merges supplied metadata keys; never resend stale unrelated metadata.
    async updateName(target, name) {
      const saved = await server.auth.admin.updateUserById(target, {
        user_metadata: { name },
      });
      if (saved.error) throw new Error("AUTH_UNAVAILABLE");
    },
    async getName(target) {
      const { data, error } = await server.auth.admin.getUserById(target);
      if (error) throw new Error("AUTH_UNAVAILABLE");
      return data.user.user_metadata.name ?? null;
    },
    async removeImage(image, target) {
      const parsed = new URL(image),
        project = new URL(url),
        prefix = "/storage/v1/object/public/community-post-images/";
      if (
        parsed.origin !== project.origin ||
        !parsed.pathname.startsWith(prefix) || parsed.search || parsed.hash
      ) throw new Error("STORAGE_PATH_INVALID");
      const path = decodeURIComponent(parsed.pathname.slice(prefix.length));
      if (
        !path.startsWith(`${target}/`) || path.includes("..") ||
        path.includes("\\") || path.split("/").some((segment) => !segment)
      ) throw new Error("STORAGE_PATH_INVALID");
      const { error } = await server.storage.from("community-post-images")
        .remove([path]);
      if (error) throw new Error("STORAGE_DELETE_FAILED");
    },
    log: (code) => console.warn("user-data-request", { code }),
  };
}
