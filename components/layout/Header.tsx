"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaBug } from "react-icons/fa";
import { FiLogOut } from "react-icons/fi";
import { signOut, useProfile } from "@/lib/session";
import { ROLE_LABELS } from "@/types/user";
import Avatar from "@/components/ui/Avatar";

export default function Header() {
  const profile = useProfile();
  const pathname = usePathname();

  const links = [
    { href: "/leads", label: "Leads" },
    ...(profile.role === "admin" ? [{ href: "/users", label: "Users" }] : []),
  ];

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-white">
              <FaBug size={16} />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900">IKPM</p>
              <p className="text-xs text-slate-500">Pest Management</p>
            </div>
          </div>

          {links.length > 1 && (
            <nav className="flex gap-1">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    pathname.startsWith(l.href) ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Avatar name={profile.fullName} size={30} />
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-medium text-slate-800">{profile.fullName}</p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[profile.role]}</p>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <FiLogOut size={14} /> Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
