import AuthGate from "@/components/auth/AuthGate";
import Header from "@/components/layout/Header";

export default function LeadsLayout({ children }: LayoutProps<"/leads">) {
  return (
    <AuthGate>
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
      </div>
    </AuthGate>
  );
}
