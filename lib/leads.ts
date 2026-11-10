"use client";

import { useCallback, useEffect, useState } from "react";
import type { ActivityInput, ActivityKind, ClosedReason, Lead, LeadActivity, LeadInput, LeadStage, LeadType } from "@/types/lead";
import type { Role } from "@/types/user";
import { getSupabase } from "@/lib/supabase";

/** Only admins and sales use the Leads and Sales tabs (also enforced by database policies). */
export function canUseLeads(role: Role): boolean {
  return role === "admin" || role === "sales";
}

interface LeadRow {
  id: string;
  code: string;
  type: LeadType;
  name: string;
  company_name: string | null;
  phone: string;
  email: string | null;
  source: string;
  added_by_name: string;
  created_at: string;
  stage: LeadStage;
  assigned_to: string | null;
  assigned_to_name: string | null;
  next_action_at: string | null;
  closed_reason: ClosedReason | null;
  updated_at: string;
}

const COLUMNS =
  "id, code, type, name, company_name, phone, email, source, added_by_name, created_at, stage, assigned_to, assigned_to_name, next_action_at, closed_reason, updated_at";

function toLead(r: LeadRow): Lead {
  return {
    id: r.id,
    code: r.code,
    type: r.type,
    name: r.name,
    companyName: r.company_name ?? "",
    phone: r.phone,
    email: r.email ?? "",
    source: r.source,
    addedBy: r.added_by_name,
    createdAt: r.created_at,
    stage: r.stage,
    assignedTo: r.assigned_to,
    assignedToName: r.assigned_to_name ?? "",
    nextActionAt: r.next_action_at,
    closedReason: r.closed_reason,
    updatedAt: r.updated_at,
  };
}

/** "new" = unclaimed leads (Leads tab). "pipeline" = claimed leads (Sales board). */
export type LeadScope = "new" | "pipeline";

export async function fetchLeads(scope: LeadScope): Promise<Lead[]> {
  const base = getSupabase().from("leads").select(COLUMNS);
  const { data, error } = await (scope === "new" ? base.eq("stage", "new") : base.neq("stage", "new")).order(
    "created_at",
    { ascending: false }
  );
  if (error) throw new Error(error.message);
  return (data as LeadRow[]).map(toLead);
}

export async function createLead(input: LeadInput): Promise<Lead> {
  const { data, error } = await getSupabase()
    .from("leads")
    .insert({
      type: input.type,
      name: input.name,
      company_name: input.type === "Company" ? input.companyName : null,
      phone: input.phone,
      email: input.email || null,
      source: input.source,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toLead(data as LeadRow);
}

/** Logs a contact/step and moves the lead to the matching stage (claims it if unclaimed). */
export async function logActivity(leadId: string, input: ActivityInput): Promise<void> {
  const { error } = await getSupabase().rpc("log_lead_activity", {
    p_lead_id: leadId,
    p_kind: input.kind,
    p_scheduled_at: input.scheduledAt,
    p_notes: input.notes,
  });
  if (error) throw new Error(error.message);
}

export async function fetchActivities(leadId: string): Promise<LeadActivity[]> {
  const { data, error } = await getSupabase()
    .from("lead_activities")
    .select("id, kind, scheduled_at, notes, created_by_name, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map((r) => ({
    id: r.id,
    kind: r.kind as ActivityKind,
    scheduledAt: r.scheduled_at,
    notes: r.notes ?? "",
    createdByName: r.created_by_name,
    createdAt: r.created_at,
  }));
}

/** React hook: loads leads for one scope and lets you add new ones. */
export function useLeads(scope: LeadScope) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLeads(await fetchLeads(scope));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load leads");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    reload();
  }, [reload]);

  const add = useCallback(async (input: LeadInput) => {
    const lead = await createLead(input);
    setLeads((prev) => [lead, ...prev]);
    return lead;
  }, []);

  const remove = useCallback((id: string) => setLeads((prev) => prev.filter((l) => l.id !== id)), []);

  return { leads, loading, error, reload, add, remove };
}
