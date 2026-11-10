/** Suggested sources shown in the form — any custom text is also allowed. */
export const LEAD_SOURCES = [
  "Facebook",
  "Instagram",
  "WhatsApp",
  "Google",
  "Website",
  "Referral",
  "Walk-in",
  "Phone Call",
  "Other",
] as const;

export const LEAD_TYPES = ["Residential", "Company"] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

/** Stages a claimed lead can be in ("call" = meeting on call, "meeting" = in person). */
export const PIPELINE_STAGES = ["follow_up", "call", "meeting", "inspection", "proposal", "closed"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Columns on the Sales board, in order. One "meeting" column holds both in-person and call meetings. */
export const BOARD_COLUMNS = ["follow_up", "meeting", "inspection", "proposal", "closed"] as const;
export type BoardColumn = (typeof BOARD_COLUMNS)[number];
export const columnOf = (stage: PipelineStage): BoardColumn => (stage === "call" ? "meeting" : stage);
/** "new" = unclaimed lead on the Leads tab; anything else is on someone's Sales board. */
export type LeadStage = "new" | PipelineStage;

export const STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  follow_up: "Follow-up",
  call: "Meeting · On call",
  meeting: "Meeting · In person",
  inspection: "Inspection",
  proposal: "Proposal",
  closed: "Closed",
};

export type ClosedReason = "wrong_lead" | "already_working";

/** Proposal events the admin app writes to a lead's history (sales can't log these). */
export type ProposalEvent = "proposal_sent" | "proposal_accepted" | "proposal_rejected";

/** What was logged. Matches the database's lead_activities.kind. */
export type ActivityKind = "follow_up" | "call" | "meeting" | "inspection" | "proposal" | ClosedReason | ProposalEvent;

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  follow_up: "Follow-up",
  call: "Meeting · On call",
  meeting: "Meeting · In person",
  inspection: "Inspection",
  proposal: "Proposal",
  wrong_lead: "Wrong lead",
  already_working: "Working with other company", // old entries only; no longer offered
  proposal_sent: "Proposal sent to client",
  proposal_accepted: "Client accepted",
  proposal_rejected: "Client rejected · Follow-up",
};

/** Proposal events only show their label (and, for a rejection, the reason). */
export const isProposalEvent = (kind: ActivityKind): kind is ProposalEvent => kind.startsWith("proposal_");

export interface Lead {
  id: string; // database uuid
  code: string; // human-friendly ID, e.g. LD-1001
  type: LeadType;
  name: string;
  companyName: string; // "" for residential leads
  phone: string;
  email: string;
  source: string;
  addedBy: string; // name of whoever created the lead, or "System"
  createdAt: string; // ISO
  stage: LeadStage;
  assignedTo: string | null; // owner's user id once someone logs contact
  assignedToName: string; // "" while unclaimed
  nextActionAt: string | null; // ISO date of the next scheduled step
  closedReason: ClosedReason | null;
  /** Set when the client rejected the proposal; shown as a "Rejected" tag while in Follow-up. */
  rejectedAt: string | null;
  updatedAt: string; // ISO
}

/** Fields entered in the Add Lead form. Added By is set by the database. */
export type LeadInput = Pick<Lead, "type" | "name" | "companyName" | "phone" | "email" | "source">;

export interface LeadActivity {
  id: string;
  kind: ActivityKind;
  scheduledAt: string | null;
  notes: string;
  createdByName: string;
  createdAt: string;
  /** Meetings / inspections: who admin assigned, where to go and their notes ("" if none). */
  attendeeName: string;
  visitAddress: string;
  attendeeNotes: string;
}

export interface ActivityInput {
  kind: Exclude<ActivityKind, ProposalEvent>;
  scheduledAt: string | null; // ISO
  notes: string;
}
