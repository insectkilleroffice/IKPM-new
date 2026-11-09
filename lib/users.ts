"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { NewUserInput, Profile, Role } from "@/types/user";

export async function fetchUsers(): Promise<Profile[]> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("id, full_name, email, role, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    role: r.role as Role,
    createdAt: r.created_at,
  }));
}

/** Creates a login + profile through the server route (needs admin). */
export async function createUser(input: NewUserInput, accessToken: string): Promise<Profile> {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Could not create user");
  return json.user as Profile;
}

export function useUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await fetchUsers());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    reload();
  }, [reload]);

  const add = useCallback((user: Profile) => setUsers((prev) => [user, ...prev]), []);

  return { users, loading, error, reload, add };
}
