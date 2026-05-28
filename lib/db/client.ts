import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only client. Uses the service_role key which bypasses RLS — never
// import this from a "use client" file. The build will not stop you; the
// runtime will leak the key into the browser bundle if you do.
let cached: SupabaseClient | null = null;

export function getDbClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

// Test-only: replace the cached client with a fake. Lets the data-layer
// functions stay un-parameterized in app code without making tests gymnastic.
export function __setDbClientForTests(client: SupabaseClient | null): void {
  cached = client;
}
