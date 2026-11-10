"use client";

import { useCallback, useMemo, useState } from "react";
import type { Lead } from "@/types/lead";
import { canUseLeads, useLeads } from "@/lib/leads";
import { useProfile } from "@/lib/session";
import PipelineBoard from "@/components/sales/PipelineBoard";
import LogContactModal from "@/components/leads/LogContactModal";
import SearchInput from "@/components/ui/SearchInput";
import Button from "@/components/ui/Button";

export default function SalesPage() {
  const { role } = useProfile();
  if (!canUseLeads(role)) {
    return <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Sales is only available to admin and sales.</p>;
  }
  return <SalesBoard isAdmin={role === "admin"} />;
}

function SalesBoard({ isAdmin }: { isAdmin: boolean }) {
  const { leads, loading, error, reload } = useLeads("pipeline");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("");
  const closeModal = useCallback(() => setSelected(null), []);

  // Admin sees everyone's board and can narrow it to one sales person.
  const owners = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of leads) if (l.assignedTo) map.set(l.assignedTo, l.assignedToName);
    return [...map].sort((a, b) => a[1].localeCompare(b[1]));
  }, [leads]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter(
      (l) =>
        (!owner || l.assignedTo === owner) &&
        (!q || [l.name, l.companyName, l.phone, l.email, l.code].some((v) => v.toLowerCase().includes(q)))
    );
  }, [leads, owner, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sales</h1>
          <p className="text-sm text-slate-500">
            {isAdmin ? "Every sales person's pipeline." : "Your pipeline."} Tap a card to log the next step.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {isAdmin && (
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              aria-label="Filter by sales person"
            >
              <option value="">All sales people</option>
              {owners.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          )}
          <SearchInput value={query} onChange={setQuery} placeholder="Search…" className="w-full sm:w-60" />
        </div>
      </div>

      {loading && <p className="py-12 text-center text-slate-400">Loading pipeline…</p>}
      {!loading && error && (
        <div className="py-12 text-center">
          <p className="text-sm text-rose-600">Could not load pipeline: {error}</p>
          <Button variant="secondary" className="mt-3" onClick={reload}>Try again</Button>
        </div>
      )}
      {!loading && !error && <PipelineBoard leads={visible} showOwner={isAdmin} onSelect={setSelected} />}

      {selected && <LogContactModal lead={selected} mode="pipeline" onClose={closeModal} onLogged={reload} />}
    </div>
  );
}
