"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { FaBug } from "react-icons/fa";
import { isSupabaseConfigured } from "@/lib/supabase";
import { SessionProvider, signIn, signOut, useSession } from "@/lib/session";
import Button from "@/components/ui/Button";

const inputCls =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

function Card({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "amber" }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className={`w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm ${tone === "amber" ? "border-amber-200" : "border-slate-200"}`}>
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-700 text-white">
            <FaBug size={18} />
          </span>
          <div className="leading-tight">
            <p className="font-semibold text-slate-900">IKPM</p>
            <p className="text-xs text-slate-500">Pest Management</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return setError("Enter your email and password");
    setBusy(true);
    setError("");
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setBusy(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <h1 className="text-lg font-semibold text-slate-900">Sign in</h1>
        <p className="mb-4 text-sm text-slate-500">Use your staff account.</p>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Email</span>
            <input autoFocus type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Password</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          </label>
        </div>
        {error && <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        <Button variant="primary" type="submit" disabled={busy} className="mt-5 w-full">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Card>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const s = useSession();
  if (s.status === "loading") return <div className="min-h-screen bg-slate-50" />;
  if (s.status === "signed-out") return <SignIn />;
  if (s.status === "no-profile")
    return (
      <Card tone="amber">
        <h1 className="text-lg font-semibold text-slate-900">No role assigned</h1>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-medium">{s.email}</span> is signed in but has no staff role yet. Ask an admin to set up your account.
        </p>
        <Button variant="secondary" className="mt-5 w-full" onClick={signOut}>Sign out</Button>
      </Card>
    );
  // This app is for the sales team only. Admins use the separate admin app.
  if (s.profile.role !== "sales")
    return (
      <Card tone="amber">
        <h1 className="text-lg font-semibold text-slate-900">Sales team only</h1>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-medium">{s.profile.email}</span> is not a sales account. This app is only for the sales team.
        </p>
        <Button variant="secondary" className="mt-5 w-full" onClick={signOut}>Sign out</Button>
      </Card>
    );
  return <>{children}</>;
}

/** Shows sign-in / setup screens until a staff user with a role is signed in. */
export default function AuthGate({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured)
    return (
      <Card tone="amber">
        <h1 className="text-lg font-semibold text-slate-900">Connect Supabase</h1>
        <p className="mt-2 text-sm text-slate-600">
          Add your Supabase URL and publishable key to <code className="rounded bg-slate-100 px-1">.env.local</code> (see{" "}
          <code className="rounded bg-slate-100 px-1">.env.example</code>), then restart the dev server.
        </p>
      </Card>
    );
  return (
    <SessionProvider>
      <Gate>{children}</Gate>
    </SessionProvider>
  );
}
