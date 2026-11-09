"use client";

import { FaBug } from "react-icons/fa";
import { FiLogOut } from "react-icons/fi";
import { signOut, useCurrentUser } from "@/lib/session";
import Avatar from "@/components/ui/Avatar";

export default function Header() {
  const { name: user } = useCurrentUser();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-white">
            <FaBug size={16} />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900">IKPM</p>
            <p className="text-xs text-slate-500">Pest Management</p>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <Avatar name={user} size={30} />
            <span className="hidden text-sm font-medium text-slate-800 sm:inline">{user}</span>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <FiLogOut size={14} /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
