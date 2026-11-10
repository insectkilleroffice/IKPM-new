"use client";

import { useCallback, useMemo, useState } from "react";
import { FiCheckSquare, FiColumns } from "react-icons/fi";
import type { Lead } from "@/types/lead";
import { useLeads } from "@/lib/leads";
import PipelineBoard from "@/components/sales/PipelineBoard";
import TaskList from "@/components/sales/TaskList";
import LogContactModal from "@/components/leads/LogContactModal";
import SearchInput from "@/components/ui/SearchInput";
import Button from "@/components/ui/Button";

export default function SalesPage() {
  const { leads, loading, error, reload } = useLeads("pipeline");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"tasks" | "board">("tasks");
  const closeModal = useCallback(() => setSelected(null), []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) => [l.name, l.companyName, l.phone, l.email, l.code].some((v) => v.toLowerCase().includes(q)));
  }, [leads, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sales</h1>
          <p className="text-sm text-slate-500">Your pipeline. Tap a lead to log the next step.</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5" role="tablist" aria-label="View">
            {([
              ["tasks", "Tasks", FiCheckSquare],
              ["board", "Board", FiColumns],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
                  view === id ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
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
      {!loading && !error && view === "tasks" && <TaskList leads={visible} onSelect={setSelected} />}
      {!loading && !error && view === "board" && <PipelineBoard leads={visible} onSelect={setSelected} />}

      {selected && <LogContactModal lead={selected} mode="pipeline" onClose={closeModal} onLogged={reload} />}
    </div>
  );
}
