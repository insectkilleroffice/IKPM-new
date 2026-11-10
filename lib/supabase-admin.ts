import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// SERVER ONLY. Never import this from a "use client" file: the secret key
// bypasses row level security.

let admin: SupabaseClient | null = null;

/** Supabase client using the secret key (rows it inserts are recorded as added by "System"). */
export function getSupabaseAdmin(): SupabaseClient {
  if (typeof window !== "undefined") throw new Error("getSupabaseAdmin() must only run on the server");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
  admin ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}
