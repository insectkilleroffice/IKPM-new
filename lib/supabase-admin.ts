import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the SECRET key. Bypasses row level security,
 * so it must never be imported into browser code.
 */
let admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error("SUPABASE_SECRET_KEY is missing from .env.local");
  }
  admin ??= createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}
