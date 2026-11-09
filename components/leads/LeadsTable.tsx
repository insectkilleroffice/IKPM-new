"use client";

import { useMemo, useState } from "react";
import { FiDownload } from "react-icons/fi";
import type { Lead } from "@/types/lead";
import { exportLeadsCsv } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";
import SearchInput from "@/components/ui/SearchInput";
import Button from "@/components/ui/Button";

interface Props {
  leads: Lead[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

const TYPE_STYLES = {
  Residential: "bg-sky-50 text-sky-700 ring-sky-200",
  Company: "bg-violet-50 text-violet-700 ring-violet-200",
};

const COLS = 8;

export default function LeadsTable({ leads, loading, error, onRetry }: Props) {
  const [query, setQuery] = useState("");
  const loaded = !loading && !error;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.name, l.companyName, l.type, l.code, l.phone, l.email, l.addedBy, l.source].some((v) => v.toLowerCase().includes(q))
    );
  }, [leads, query]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-4">
        <SearchInput value={query} onChange={setQuery} placeholder="Search leads…" className="w-full sm:w-72" />
        <Button variant="secondary" disabled={rows.length === 0} onClick={() => exportLeadsCsv(rows)}>
          <FiDownload size={14} /> Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-3 pl-4 font-medium">Name</th>
              <th className="py-3 font-medium">Lead ID</th>
              <th className="py-3 font-medium">Type</th>
              <th className="py-3 font-medium">Company</th>
              <th className="py-3 font-medium">Phone</th>
              <th className="py-3 font-medium">Email</th>
              <th className="py-3 font-medium">Added By</th>
              <th className="py-3 pr-4 font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={COLS} className="py-12 text-center text-slate-400">Loading leads…</td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={COLS} className="py-12 text-center">
                  <p className="text-sm text-rose-600">Could not load leads: {error}</p>
                  <Button variant="secondary" className="mt-3" onClick={onRetry}>Try again</Button>
                </td>
              </tr>
            )}
            {loaded && rows.length === 0 && (
              <tr>
                <td colSpan={COLS} className="py-12 text-center text-slate-400">
                  {leads.length === 0 ? "No leads yet. Click “Add Lead” to create one." : "No leads match your search."}
                </td>
              </tr>
            )}
            {loaded &&
              rows.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="py-3 pl-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={l.name} />
                      <span className="font-medium text-slate-900">{l.name}</span>
                    </div>
                  </td>
                  <td className="py-3 font-mono text-xs text-slate-500">{l.code}</td>
                  <td className="py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TYPE_STYLES[l.type]}`}>
                      {l.type}
                    </span>
                  </td>
                  <td className="py-3 text-slate-700">{l.companyName || <span className="text-slate-400">—</span>}</td>
                  <td className="py-3">
                    <a href={`tel:${l.phone.replace(/\s/g, "")}`} className="text-slate-700 hover:text-emerald-700">
                      {l.phone}
                    </a>
                  </td>
                  <td className="py-3">
                    {l.email ? (
                      <a href={`mailto:${l.email}`} className="text-slate-700 hover:text-emerald-700">{l.email}</a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 text-slate-700">{l.addedBy}</td>
                  <td className="py-3 pr-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">{l.source}</span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {loaded && (
        <p className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
          Showing {rows.length} of {leads.length} leads
        </p>
      )}
    </div>
  );
}
