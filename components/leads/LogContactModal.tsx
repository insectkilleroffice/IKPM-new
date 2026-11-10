"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { IconType } from "react-icons";
import {
  FiCalendar,
  FiFileText,
  FiLock,
  FiMail,
  FiPhone,
  FiSearch,
  FiUser,
  FiUsers,
  FiX,
  FiXCircle,
} from "react-icons/fi";
import { ACTIVITY_LABELS, STAGE_LABELS, isProposalEvent, type ActivityKind, type Lead, type LeadActivity } from "@/types/lead";
import { fetchActivities, logActivity } from "@/lib/leads";
import { formatDateTime } from "@/lib/utils";
import Button from "@/components/ui/Button";

type TabId = "follow_up" | "meeting" | "inspection" | "proposal" | "wrong_lead";
type MeetingMode = "in_person" | "call";

interface Tab {
  id: TabId;
  label: string;
  icon: IconType;
  date: "required" | "optional" | "none";
  dateLabel?: string;
  notesRequired?: boolean;
  notesPlaceholder: string;
}

const TABS: Record<TabId, Tab> = {
  follow_up: {
    id: "follow_up",
    label: "Follow-up",
    icon: FiCalendar,
    date: "required",
    dateLabel: "Follow-up date & time",
    notesPlaceholder: "What was discussed? What to follow up on?",
  },
  meeting: {
    id: "meeting",
    label: "Meeting",
    icon: FiUsers,
    date: "required",
    dateLabel: "Meeting date & time",
    notesPlaceholder: "Agenda, address, or anything to remember",
  },
  inspection: {
    id: "inspection",
    label: "Inspection",
    icon: FiSearch,
    date: "required",
    dateLabel: "Inspection date & time",
    notesPlaceholder: "Site address, areas to inspect, pest type…",
  },
  proposal: {
    id: "proposal",
    label: "Proposal",
    icon: FiFileText,
    date: "optional",
    dateLabel: "Proposal follow-up date & time (optional)",
    notesPlaceholder: "Services, price quoted, validity…",
  },
  wrong_lead: {
    id: "wrong_lead",
    label: "Wrong lead",
    icon: FiXCircle,
    date: "none",
    notesRequired: true,
    notesPlaceholder: "Why is this a wrong lead? e.g. wrong number, not interested",
  },
};

const CONTACT_TABS: TabId[] = ["follow_up", "meeting", "wrong_lead"];
// "Wrong lead" is only offered on first contact (Leads tab), not on the Sales board.
const PIPELINE_TABS: TabId[] = ["follow_up", "meeting", "inspection", "proposal"];

/** Sales people can only move a lead while it is New or in Follow-up; after that only admin can. */
const SALES_MOVABLE: Lead["stage"][] = ["new", "follow_up"];

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

/** Opens on the lead's current step when it's already on the Sales board. */
function initialTab(lead: Lead): { tab: TabId; mode: MeetingMode } {
  switch (lead.stage) {
    case "call":
      return { tab: "meeting", mode: "call" };
    case "meeting":
    case "inspection":
    case "proposal":
      return { tab: lead.stage, mode: "in_person" };
    default:
      return { tab: "follow_up", mode: "in_person" };
  }
}

interface Props {
  lead: Lead;
  /** "contact" = first contact from the Leads tab; "pipeline" = next step on the Sales board. */
  mode: "contact" | "pipeline";
  onClose: () => void;
  onLogged: (lead: Lead) => void;
}

export default function LogContactModal({ lead, mode, onClose, onLogged }: Props) {
  const tabs = mode === "contact" ? CONTACT_TABS : PIPELINE_TABS;
  const [{ tab: tabId, mode: meetingMode }, setChoice] = useState(() =>
    mode === "contact" ? { tab: "follow_up" as TabId, mode: "in_person" as MeetingMode } : initialTab(lead)
  );
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ when?: string; notes?: string }>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const tab = TABS[tabId];
  const locked = !SALES_MOVABLE.includes(lead.stage);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pickTab = (id: TabId) => {
    setChoice((c) => ({ ...c, tab: id }));
    setErrors({});
    setSaveError("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving || locked) return;
    const next: typeof errors = {};
    if (tab.date === "required" && !when) next.when = "Choose a date and time";
    if (when && Number.isNaN(new Date(when).getTime())) next.when = "Enter a valid date and time";
    // Notes are required on every step.
    if (!notes.trim()) next.notes = tab.notesRequired ? "Add a note explaining why" : "Add notes";
    setErrors(next);
    if (Object.keys(next).length) return;

    const kind: ActivityKind = tabId === "meeting" ? (meetingMode === "call" ? "call" : "meeting") : tabId;
    setSaving(true);
    setSaveError("");
    try {
      await logActivity(lead.id, {
        kind,
        scheduledAt: tab.date !== "none" && when ? new Date(when).toISOString() : null,
        notes: notes.trim(),
      });
      onLogged(lead);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" onMouseDown={onClose}>
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        noValidate
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">Log Contact</h2>
            <p className="truncate text-sm text-slate-700">
              {lead.name}
              {lead.companyName && <span className="text-slate-500"> · {lead.companyName}</span>}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <a href={`tel:${lead.phone.replace(/\s/g, "")}`} className="flex items-center gap-1 hover:text-emerald-700">
                <FiPhone size={12} /> {lead.phone}
              </a>
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-emerald-700">
                  <FiMail size={12} /> {lead.email}
                </a>
              )}
              {lead.assignedToName && (
                <span className="flex items-center gap-1">
                  <FiUser size={12} /> {lead.assignedToName}
                </span>
              )}
              {lead.stage !== "new" && (
                <span className="rounded-full bg-slate-100 px-2 font-medium text-slate-700">{STAGE_LABELS[lead.stage]}</span>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <FiX size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {locked ? (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              <FiLock size={15} className="mt-0.5 shrink-0" />
              This lead is in {STAGE_LABELS[lead.stage]}. Only admin can move it to the next step.
            </p>
          ) : (
          <>
          {/* Tabs */}
          <div className={`grid gap-2 ${tabs.length > 4 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`} role="tablist">
            {tabs.map((id) => {
              const t = TABS[id];
              const active = id === tabId;
              const closing = t.date === "none";
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => pickTab(id)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                    active
                      ? closing
                        ? "border-rose-500 bg-rose-50 text-rose-700"
                        : "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <t.icon size={14} /> {t.label}
                </button>
              );
            })}
          </div>

          {tabId === "meeting" && (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Meeting type">
              {(["in_person", "call"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={meetingMode === m}
                  onClick={() => setChoice((c) => ({ ...c, mode: m }))}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
                    meetingMode === m ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {m === "call" ? <FiPhone size={14} /> : <FiUsers size={14} />}
                  {m === "call" ? "On call" : "In person"}
                </button>
              ))}
            </div>
          )}

          {tab.date !== "none" && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                {tab.dateLabel} {tab.date === "required" && <span className="text-rose-500">*</span>}
              </span>
              <input
                type="datetime-local"
                className={inputCls}
                value={when}
                onChange={(e) => {
                  setWhen(e.target.value);
                  setErrors((er) => ({ ...er, when: undefined }));
                }}
              />
              {errors.when && <span className="mt-1 block text-xs text-rose-600">{errors.when}</span>}
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Notes <span className="text-rose-500">*</span>
            </span>
            <textarea
              rows={3}
              className={inputCls}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setErrors((er) => ({ ...er, notes: undefined }));
              }}
              placeholder={tab.notesPlaceholder}
            />
            {errors.notes && <span className="mt-1 block text-xs text-rose-600">{errors.notes}</span>}
          </label>

          {saveError && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{saveError}</p>}
          </>
          )}

          {mode === "pipeline" && <History leadId={lead.id} />}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-4">
          <p className="text-xs text-slate-500">
            {locked
              ? ""
              : tabId === "wrong_lead"
                ? "Removes this lead. Only admin will see it."
                : mode === "contact"
                  ? "Moves this lead to your Sales board"
                  : `Moves to ${tab.label}`}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>{locked ? "Close" : "Cancel"}</Button>
            {!locked && (
              <Button variant={tab.date === "none" ? "danger" : "primary"} type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function History({ leadId }: { leadId: string }) {
  const [items, setItems] = useState<LeadActivity[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchActivities(leadId)
      .then((a) => !cancelled && setItems(a))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load history"));
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  return (
    <div className="border-t border-slate-100 pt-4">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">History</h3>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {!error && !items && <p className="text-xs text-slate-400">Loading…</p>}
      {items?.length === 0 && <p className="text-xs text-slate-400">Nothing logged yet.</p>}
      {items && items.length > 0 && (
        <ol className="space-y-3">
          {items.map((a) => {
            const proposalEvent = isProposalEvent(a.kind);
            // Proposal events: label only (no proposal code / amount). A rejection made
            // with the new flow also has a follow-up date and the client's reason.
            const showNotes = a.notes && (!proposalEvent || (a.kind === "proposal_rejected" && a.scheduledAt));
            return (
            <li
              key={a.id}
              className={`border-l-2 pl-3 text-sm ${
                a.kind === "proposal_accepted" ? "border-emerald-400" : a.kind === "proposal_rejected" ? "border-rose-400" : "border-slate-200"
              }`}
            >
              <p
                className={`font-medium ${
                  a.kind === "proposal_accepted" ? "text-emerald-700" : a.kind === "proposal_rejected" ? "text-rose-700" : "text-slate-800"
                }`}
              >
                {ACTIVITY_LABELS[a.kind] ?? a.kind}
                {a.scheduledAt && <span className="font-normal text-slate-500"> · {formatDateTime(a.scheduledAt)}</span>}
              </p>
              {showNotes && (
                <p className="whitespace-pre-wrap text-slate-600">
                  {a.kind === "proposal_rejected" && <span className="font-medium text-slate-700">Reason: </span>}
                  {a.notes}
                </p>
              )}
              {a.attendeeName && (
                <div className="mt-1 space-y-0.5 rounded-md bg-violet-50 px-2.5 py-1.5 text-xs text-slate-700">
                  <p>
                    {a.attendeeName.includes(",") ? "Attendees" : "Attendee"}:{" "}
                    <span className="font-medium">{a.attendeeName}</span>
                  </p>
                  {a.visitAddress && (
                    <p className="whitespace-pre-wrap">
                      <span className="font-medium">Address:</span> {a.visitAddress}
                    </p>
                  )}
                  {a.attendeeNotes && (
                    <p className="whitespace-pre-wrap">
                      <span className="font-medium">Notes:</span> {a.attendeeNotes}
                    </p>
                  )}
                </div>
              )}
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                <FiUser size={11} />
                Moved by <span className="font-medium text-slate-700">{a.createdByName}</span> · {formatDateTime(a.createdAt)}
              </p>
            </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
