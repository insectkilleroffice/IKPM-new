import type { ReactNode } from "react";
import AuthGate from "@/components/auth/AuthGate";
import Header from "@/components/layout/Header";

/** Every page in this folder requires a signed-in staff member. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
      </div>
    </AuthGate>
  );
}
