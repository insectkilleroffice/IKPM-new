"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { FaBug } from "react-icons/fa";
import { isSupabaseConfigured } from "@/lib/supabase";
import { signIn, useCurrentUser } from "@/lib/session";
import Button from "@/components/ui/Button";

const inputCls =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

function Brand() {
  return (
    <div className="mb-6 flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-700 text-white">
        <FaBug size={18} />
      </span>
      <div className="leading-tight">
        <p className="font-semibold text-slate-900">IKPM</p>
        <p className="text-xs text-slate-500">Pest Management</p>
      </div>
    </div>
  );
}

function SetupNeeded() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
        <Brand />
        <h1 className="text-lg font-semibold text-slate-900">Connect Supabase</h1>
        <p className="mt-2 text-sm text-slate-600">
          Create a <code className="rounded bg-slate-100 px-1">.env.local</code> file (copy{" "}
          <code className="rounded bg-slate-100 px-1">.env.example</code>), add your Supabase URL and publishable key, then
          restart <code className="rounded bg-slate-100 px-1">npm run dev</code>.
        </p>
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
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form onSubmit={submit} noValidate className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <Brand />
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
    </div>
  );
}

/** Shows the sign-in screen until a user is signed in. */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, loaded } = useCurrentUser();
  if (!isSupabaseConfigured) return <SetupNeeded />;
  if (!loaded) return <div className="min-h-screen bg-slate-50" />;
  if (!user) return <SignIn />;
  return <>{children}</>;
}
