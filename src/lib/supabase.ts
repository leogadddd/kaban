import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** False when the build has no Supabase keys: the app then runs local-only, exactly as before. */
export const cloudConfigured = !!(url && key);

let client: SupabaseClient | null = null;

/** Browser-only singleton. The session lives in localStorage and refreshes itself in the background. */
export function supabase(): SupabaseClient | null {
  if (!cloudConfigured || typeof window === "undefined") return null;
  client ??= createClient(url!, key!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "kaban-auth" },
  });
  return client;
}
