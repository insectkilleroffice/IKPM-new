"use client";

import { useMemo, useState } from "react";
import type { IconType } from "react-icons";
import { FiAlertCircle, FiCalendar, FiChevronLeft, FiChevronRight, FiFileText, FiPhone, FiSearch, FiUsers } from "react-icons/fi";
import type { Lead, PipelineStage } from "@/types/lead";
import { formatDateTime } from "@/lib/utils";

type TaskStage = Exclude<PipelineStage, "closed">;

const TASK_TYPES: Record<TaskStage, { label: string; icon: IconType; style: string }> = {
  follow_up: { label: "Follow-up", icon: FiCalendar, style: "bg-sky-50 text-sky-700 ring-sky-200" },
  call: { label: "Meeting · On call", icon: FiPhone, style: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  meeting: { label: "Meeting · In person", icon: FiUsers, style: "bg-violet-50 text-violet-700 ring-violet-200" },
  inspection: { label: "Inspection", icon: FiSearch, style: "bg-amber-50 text-amber-700 ring-amber-200" },
  proposal: { label: "Proposal follow-up", icon: FiFileText, style: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

/** Filter chips. "meeting" covers both in-person and call meetings. */
const FILTERS = [
  { id: "all", label: "All" },
  { id: "follow_up", label: "Follow-ups" },
  { id: "meeting", label: "Meetings" },
  { id: "inspection", label: "Inspections" },
  { id: "proposal", label: "Proposals" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

const matchesFilter = (stage: TaskStage, f: FilterId) =>
  f === "all" || stage === f || (f === "meeting" && stage === "call");

/** Local calendar day as YYYY-MM-DD (the format of <input type="date">). */
function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDay(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + days));
}

function dayTitle(key: string, today: string) {
  if (key === today) return "Today";
  if (key === shiftDay(today, 1)) return "Tomorrow";
  if (key === shiftDay(today, -1)) return "Yesterday";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

interface Task {
  lead: Lead;
  stage: TaskStage;
  at: Date;
}

interface Props {
  leads: Lead[];
  onSelect: (lead: Lead) => void;
}

export default function TaskList({ leads, onSelect }: Props) {
  const today = dayKey(new Date());
  const [day, setDay] = useState(today);
  const [filter, setFilter] = useState<FilterId>("all");

  // Every open lead with a scheduled date is a task.
  const tasks = useMemo<Task[]>(
    () =>
      leads
        .filter((l) => l.nextActionAt && l.stage !== "new" && l.stage !== "closed")
        .map((l) => ({ lead: l, stage: l.stage as TaskStage, at: new Date(l.nextActionAt!) }))
        .sort((a, b) => a.at.getTime() - b.at.getTime()),
    [leads]
  );

  const forDay = tasks.filter((t) => dayKey(t.at) === day);
  // Overdue = scheduled before today and not moved on yet. Shown when looking at today.
  const overdue = day === today ? tasks.filter((t) => dayKey(t.at) < today) : [];

  const counts = (list: Task[]) =>
    Object.fromEntries(FILTERS.map((f) => [f.id, list.filter((t) => matchesFilter(t.stage, f.id)).length])) as Record<FilterId, number>;
  const dayCounts = counts([...overdue, ...forDay]);

  const shownDay = forDay.filter((t) => matchesFilter(t.stage, filter));
  const shownOverdue = overdue.filter((t) => matchesFilter(t.stage, filter));

  return (
    <div className="space-y-4">
      {/* Date picker */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <button
          type="button"
          onClick={() => setDay((d) => shiftDay(d, -1))}
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
          aria-label="Previous day"
        >
          <FiChevronLeft size={16} />
        </button>
        <input
          type="date"
          value={day}
          onChange={(e) => e.target.value && setDay(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          aria-label="Choose a day"
        />
        <button
          type="button"
          onClick={() => setDay((d) => shiftDay(d, 1))}
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
          aria-label="Next day"
        >
          <FiChevronRight size={16} />
        </button>
        {day !== today && (
          <button
            type="button"
            onClick={() => setDay(today)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
          >
            Today
          </button>
        )}
        <h2 className="ml-auto text-base font-semibold text-slate-900">{dayTitle(day, today)}</h2>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              filter === f.id ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.label} <span className="ml-0.5 text-slate-400">{dayCounts[f.id]}</span>
          </button>
        ))}
      </div>

      {shownOverdue.length > 0 && (
        <TaskGroup title="Overdue" tone="overdue" tasks={shownOverdue} onSelect={onSelect} showDate />
      )}
      <TaskGroup
        title={day === today ? "Due today" : "Scheduled"}
        tasks={shownDay}
        onSelect={onSelect}
        empty={`Nothing scheduled for ${dayTitle(day, today).toLowerCase() === "today" ? "today" : "this day"}.`}
      />
    </div>
  );
}

function TaskGroup({
  title,
  tasks,
  onSelect,
  tone,
  showDate,
  empty,
}: {
  title: string;
  tasks: Task[];
  onSelect: (lead: Lead) => void;
  tone?: "overdue";
  showDate?: boolean;
  empty?: string;
}) {
  return (
    <section className={`rounded-xl border bg-white ${tone === "overdue" ? "border-rose-200" : "border-slate-200"}`}>
      <header className={`flex items-center gap-2 border-b px-4 py-2.5 text-sm font-semibold ${tone === "overdue" ? "border-rose-100 text-rose-700" : "border-slate-100 text-slate-800"}`}>
        {tone === "overdue" && <FiAlertCircle size={14} />}
        {title}
        <span className="font-normal text-slate-400">{tasks.length}</span>
      </header>
      {tasks.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {tasks.map(({ lead: l, stage, at }) => {
            const type = TASK_TYPES[stage];
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => onSelect(l)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 focus-visible:bg-emerald-50 focus-visible:outline-none"
                >
                  <span className="w-20 shrink-0 text-sm font-medium tabular-nums text-slate-700">
                    {showDate ? formatDateTime(l.nextActionAt!) : at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {l.name}
                      {l.companyName && <span className="font-normal text-slate-500"> · {l.companyName}</span>}
                    </span>
                    <span className="block truncate text-xs text-slate-500">{l.phone}</span>
                  </span>
                  <span className={`hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset sm:inline-flex ${type.style}`}>
                    <type.icon size={11} /> {type.label}
                  </span>
                  <span className={`shrink-0 rounded-full p-1 ring-1 ring-inset sm:hidden ${type.style}`} title={type.label}>
                    <type.icon size={12} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
