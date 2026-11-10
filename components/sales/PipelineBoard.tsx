"use client";

import { useMemo } from "react";
import { FiBriefcase, FiClock, FiHome, FiPhone, FiUsers } from "react-icons/fi";
import { ACTIVITY_LABELS, BOARD_COLUMNS, columnOf, type BoardColumn, type Lead } from "@/types/lead";
import { dueStatus, formatDateTime } from "@/lib/utils";

const COLUMN_LABELS: Record<BoardColumn, string> = {
  follow_up: "Follow-up",
  meeting: "Meeting",
  inspection: "Inspection",
  proposal: "Proposal",
  closed: "Closed",
};

const STAGE_BAR: Record<BoardColumn, string> = {
  follow_up: "bg-sky-500",
  meeting: "bg-violet-500",
  inspection: "bg-amber-500",
  proposal: "bg-emerald-600",
  closed: "bg-slate-400",
};

const DUE_STYLES = {
  overdue: "bg-rose-50 text-rose-700",
  today: "bg-amber-50 text-amber-700",
  upcoming: "bg-slate-100 text-slate-600",
};

interface Props {
  leads: Lead[];
  onSelect: (lead: Lead) => void;
}

/** Soonest next step first; leads without a date go last. Closed: most recent first. */
function sortColumn(stage: BoardColumn, items: Lead[]) {
  if (stage === "closed") return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return items.sort((a, b) => (a.nextActionAt ?? "￿").localeCompare(b.nextActionAt ?? "￿"));
}

export default function PipelineBoard({ leads, onSelect }: Props) {
  const columns = useMemo(
    () =>
      BOARD_COLUMNS.map((stage) => ({
        stage,
        items: sortColumn(stage, leads.filter((l) => l.stage !== "new" && columnOf(l.stage) === stage)),
      }))
        // Closed is only shown if old "other company" leads exist (wrong leads go to admin).
        .filter((c) => c.stage !== "closed" || c.items.length > 0),
    [leads]
  );

  return (
    <div className="-mx-6 overflow-x-auto px-6 pb-2">
      <div className="grid min-w-max auto-cols-[16rem] grid-flow-col gap-3 xl:min-w-0 xl:auto-cols-fr">
        {columns.map(({ stage, items }) => (
          <section key={stage} className="flex min-h-[60vh] flex-col rounded-xl border border-slate-200 bg-slate-100/60">
            <header className="px-3 pt-3 pb-2">
              <div className={`mb-2 h-1 rounded-full ${STAGE_BAR[stage]}`} />
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-slate-800">{COLUMN_LABELS[stage]}</h2>
                <span className="text-xs text-slate-500">
                  {items.length} {items.length === 1 ? "lead" : "leads"}
                </span>
              </div>
            </header>

            <div className="flex-1 space-y-2 px-2 pb-2">
              {items.length === 0 && <p className="px-1 py-6 text-center text-xs text-slate-400">No leads</p>}
              {items.map((l) => (
                <Card key={l.id} lead={l} onSelect={onSelect} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Card({ lead: l, onSelect }: { lead: Lead; onSelect: (lead: Lead) => void }) {
  const due = l.nextActionAt ? dueStatus(l.nextActionAt) : null;
  const TypeIcon = l.type === "Company" ? FiBriefcase : FiHome;

  return (
    <button
      type="button"
      onClick={() => onSelect(l)}
      className="block w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-emerald-300 hover:shadow focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:outline-none"
    >
      <p className="truncate text-sm font-medium text-slate-900">{l.companyName ? `${l.companyName}` : l.name}</p>
      <p className="flex items-center gap-1 truncate text-xs text-slate-500">
        <TypeIcon size={11} className="shrink-0" />
        {l.companyName ? l.name : l.type}
      </p>

      {(l.stage === "meeting" || l.stage === "call") && (
        <span
          className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            l.stage === "call" ? "bg-indigo-50 text-indigo-700" : "bg-violet-50 text-violet-700"
          }`}
        >
          {l.stage === "call" ? <FiPhone size={11} /> : <FiUsers size={11} />}
          {l.stage === "call" ? "On call meeting" : "In person meeting"}
        </span>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        {l.stage === "closed" && l.closedReason ? (
          <span className="truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {ACTIVITY_LABELS[l.closedReason]}
          </span>
        ) : l.nextActionAt && due ? (
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${DUE_STYLES[due]}`}>
            <FiClock size={11} /> {formatDateTime(l.nextActionAt)}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <FiPhone size={11} /> {l.phone}
          </span>
        )}
      </div>
    </button>
  );
}
