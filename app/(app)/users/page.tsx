"use client";

import { useCallback, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { useProfile } from "@/lib/session";
import { useUsers } from "@/lib/users";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import RoleBadge from "@/components/users/RoleBadge";
import UserFormModal from "@/components/users/UserFormModal";

function UsersAdmin() {
  const { users, loading, error, reload, add } = useUsers();
  const [formOpen, setFormOpen] = useState(false);
  const closeForm = useCallback(() => setFormOpen(false), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
        <Button variant="primary" onClick={() => setFormOpen(true)}>
          <FiPlus size={16} /> Add User
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-3 pl-4 font-medium">Name</th>
              <th className="py-3 font-medium">Email</th>
              <th className="py-3 pr-4 font-medium">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={3} className="py-12 text-center text-slate-400">Loading users…</td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={3} className="py-12 text-center">
                  <p className="text-sm text-rose-600">Could not load users: {error}</p>
                  <Button variant="secondary" className="mt-3" onClick={reload}>Try again</Button>
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="py-3 pl-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.fullName} />
                      <span className="font-medium text-slate-900">{u.fullName}</span>
                    </div>
                  </td>
                  <td className="py-3 text-slate-700">{u.email}</td>
                  <td className="py-3 pr-4"><RoleBadge role={u.role} /></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {formOpen && <UserFormModal onClose={closeForm} onCreated={add} />}
    </div>
  );
}

export default function UsersPage() {
  const { role } = useProfile();
  if (role !== "admin") {
    return <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Only admins can manage users.</p>;
  }
  return <UsersAdmin />;
}
