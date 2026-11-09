"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/** Display name for a user: their full name if set in Supabase, otherwise their email. */
export function displayName(user: User | null) {
  if (!user) return "";
  const meta = user.user_metadata as { full_name?: string } | undefined;
  return meta?.full_name?.trim() || user.email || "";
}

export async function signIn(email: string, password: string) {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  await getSupabase().auth.signOut();
}

/** Current Supabase user, kept in sync with sign-in / sign-out. */
export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoaded(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return { user, name: displayName(user), loaded };
}
