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

export interface Lead {
  id: string; // database uuid
  code: string; // human-friendly ID, e.g. LD-1001
  type: LeadType;
  name: string;
  companyName: string; // "" for residential leads
  phone: string;
  email: string;
  source: string;
  addedBy: string; // name of the signed-in user who created the lead
  createdAt: string; // ISO
}

/** Fields entered in the Add Lead form. Added By is set by the database. */
export type LeadInput = Pick<Lead, "type" | "name" | "companyName" | "phone" | "email" | "source">;
