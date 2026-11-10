import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { LEAD_TYPES, type LeadType } from "@/types/lead";

/**
 * POST /api/leads — add leads from a scraper, website form, Zapier, etc.
 *
 * Auth:  header `x-api-key: <LEADS_API_KEY>`  (or `Authorization: Bearer <LEADS_API_KEY>`)
 * Body:  one lead object, an array of leads, or { "leads": [...] }  (max 500 per request)
 *
 * Lead fields:
 *   name         required
 *   phone        required
 *   type         "Residential" | "Company" (default: "Company" if companyName is given, else "Residential")
 *   companyName  required when type is "Company"
 *   email        optional
 *   source       optional, default "API"  (e.g. "Google Maps Scraper")
 *   addedBy      optional label shown as "Added By", default "System"
 *
 * Leads whose phone number already exists are skipped and reported as duplicates.
 * New leads land in the Leads tab (stage "new") and are visible to the whole sales team.
 */

const MAX_BATCH = 500;

interface CleanLead {
  type: LeadType;
  name: string;
  company_name: string | null;
  phone: string;
  email: string | null;
  source: string;
  added_by_name: string;
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.LEADS_API_KEY;
  if (!expected) return false;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const given = req.headers.get("x-api-key") ?? bearer ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const str = (v: unknown, max = 200): string => (typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, max) : "");

/** Phone used for duplicate checks: digits only, leading "+" kept. */
const phoneKey = (phone: string) => phone.replace(/(?!^\+)[^\d]/g, "");

function validate(raw: unknown): CleanLead | string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "Each lead must be an object";
  const r = raw as Record<string, unknown>;

  const name = str(r.name);
  const phone = str(r.phone, 40);
  const companyName = str(r.companyName ?? r.company_name);
  const email = str(r.email, 200);
  const typeIn = str(r.type);

  if (!name) return "name is required";
  if (!phone || phoneKey(phone).replace("+", "").length < 5) return "phone is required";

  let type: LeadType;
  if (typeIn) {
    const match = LEAD_TYPES.find((t) => t.toLowerCase() === typeIn.toLowerCase());
    if (!match) return `type must be one of: ${LEAD_TYPES.join(", ")}`;
    type = match;
  } else {
    type = companyName ? "Company" : "Residential";
  }
  if (type === "Company" && !companyName) return "companyName is required for Company leads";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "email is not valid";

  return {
    type,
    name,
    company_name: type === "Company" ? companyName : null,
    phone,
    email: email || null,
    source: str(r.source) || "API",
    added_by_name: str(r.addedBy ?? r.added_by) || "System",
  };
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return json({ error: "Invalid or missing API key" }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body must be valid JSON" }, 400);
  }

  const items: unknown[] = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { leads?: unknown }).leads)
      ? (body as { leads: unknown[] }).leads
      : [body];

  if (items.length === 0) return json({ error: "No leads given" }, 400);
  if (items.length > MAX_BATCH) return json({ error: `At most ${MAX_BATCH} leads per request` }, 400);

  const errors: { index: number; error: string }[] = [];
  const duplicates: { index: number; phone: string; existingCode: string | null }[] = [];
  const valid: { index: number; lead: CleanLead }[] = [];
  const seen = new Set<string>();

  items.forEach((raw, index) => {
    const res = validate(raw);
    if (typeof res === "string") return errors.push({ index, error: res });
    const key = phoneKey(res.phone);
    if (seen.has(key)) return duplicates.push({ index, phone: res.phone, existingCode: null }); // repeated in this request
    seen.add(key);
    valid.push({ index, lead: res });
  });

  const supabase = getSupabaseAdmin();

  // Skip phones that are already in the database.
  if (valid.length) {
    // Look up both as given and digits-only, so "0300-1234567" matches a stored "03001234567".
    const phones = [...new Set(valid.flatMap((v) => [v.lead.phone, phoneKey(v.lead.phone)]))];
    const { data: existing, error } = await supabase.from("leads").select("code, phone").in("phone", phones);
    if (error) return json({ error: error.message }, 500);
    const byKey = new Map(existing.map((e) => [phoneKey(e.phone), e.code as string]));
    for (let i = valid.length - 1; i >= 0; i--) {
      const code = byKey.get(phoneKey(valid[i].lead.phone));
      if (code) {
        duplicates.push({ index: valid[i].index, phone: valid[i].lead.phone, existingCode: code });
        valid.splice(i, 1);
      }
    }
  }

  let created: { index: number; id: string; code: string; name: string; phone: string }[] = [];
  if (valid.length) {
    const { data, error } = await supabase
      .from("leads")
      .insert(valid.map((v) => v.lead))
      .select("id, code, name, phone");
    if (error) return json({ error: error.message, errors, duplicates }, 500);
    // Postgres returns inserted rows in insert order.
    created = data.map((row, i) => ({ index: valid[i].index, ...row }));
  }

  duplicates.sort((a, b) => a.index - b.index);
  return json(
    {
      created: created.length,
      skipped: duplicates.length,
      failed: errors.length,
      leads: created,
      duplicates,
      errors,
    },
    created.length ? 201 : errors.length && !duplicates.length ? 400 : 200
  );
}
