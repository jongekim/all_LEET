import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

export type UserVerifier = (token: string) => Promise<{
  userId: string | null;
  unavailable?: boolean;
}>;

export function createUserVerifier({ url, anonKey }: {
  url?: string;
  anonKey?: string;
}, fetcher: typeof fetch = fetch): UserVerifier {
  // This client verifies identity only. It never has service-role authority.
  if (!url || !anonKey) {
    return async () => ({ userId: null, unavailable: true });
  }
  const auth = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) =>
        fetcher(input, { ...init, signal: AbortSignal.timeout(8_000) }),
    },
  }).auth;

  return async (token) => {
    try {
      const { data, error } = await auth.getUser(token);
      if (error) {
        const invalidCredential = [400, 401, 403].includes(error.status || 0);
        return { userId: null, unavailable: !invalidCredential };
      }
      return { userId: data.user?.id || null };
    } catch {
      return { userId: null, unavailable: true };
    }
  };
}
