"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Profile, Role } from "@/types/user";

type SessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "no-profile"; email: string }
  | { status: "ready"; profile: Profile; accessToken: string };

const SessionContext = createContext<SessionState>({ status: "loading" });

export async function signIn(email: string, password: string) {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  await getSupabase().auth.signOut();
}

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data } = await getSupabase()
    .from("profiles")
    .select("id, full_name, email, role, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, fullName: data.full_name, email: data.email, role: data.role as Role, createdAt: data.created_at };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    let cancelled = false;

    const apply = async (session: Session | null) => {
      if (!session) {
        if (!cancelled) setState({ status: "signed-out" });
        return;
      }
      const profile = await loadProfile(session.user.id);
      if (cancelled) return;
      setState(
        profile
          ? { status: "ready", profile, accessToken: session.access_token }
          : { status: "no-profile", email: session.user.email ?? "" }
      );
    };

    // onAuthStateChange fires INITIAL_SESSION on subscribe, so no separate getSession call is needed.
    // Profile loading is deferred so it doesn't run inside Supabase's auth callback.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => apply(session), 0);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

/** The signed-in staff profile. Only use inside pages wrapped by AuthGate. */
export function useProfile(): Profile {
  const s = useSession();
  if (s.status !== "ready") throw new Error("useProfile used outside a signed-in page");
  return s.profile;
}

/** Current access token, for calling the app's own API routes. */
export function useAccessToken(): string {
  const s = useSession();
  return s.status === "ready" ? s.accessToken : "";
}
