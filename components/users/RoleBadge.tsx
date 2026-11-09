import { ROLE_LABELS, type Role } from "@/types/user";

const STYLES: Record<Role, string> = {
  admin: "bg-slate-900 text-white ring-slate-900",
  operations: "bg-sky-50 text-sky-700 ring-sky-200",
  sales: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  finance: "bg-amber-50 text-amber-700 ring-amber-200",
};

export default function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}
