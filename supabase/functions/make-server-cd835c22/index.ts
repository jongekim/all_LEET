import { createHistoryApp } from "./app.ts";
import { createUserVerifier } from "./auth.ts";
import { atomicHistoryStore } from "./atomic-store.ts";

const app = createHistoryApp({
  kv: atomicHistoryStore(),
  verifyUser: createUserVerifier({
    url: Deno.env.get("SUPABASE_URL"),
    anonKey: Deno.env.get("SUPABASE_ANON_KEY"),
  }),
  log: (event) => console.log("history-request", event),
});

Deno.serve(app.fetch);
