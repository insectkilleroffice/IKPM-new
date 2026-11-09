"use client";

import { useCallback, useEffect, useState } from "react";
import type { Lead, LeadInput, LeadType } from "@/types/lead";
import { getSupabase } from "@/lib/supabase";

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
}

const COLUMNS = "id, code, type, name, company_name, phone, email, source, added_by_name, created_at";

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
  };
}

export async function fetchLeads(): Promise<Lead[]> {
  const { data, error } = await getSupabase()
    .from("leads")
    .select(COLUMNS)
    .order("created_at", { ascending: false });
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

/** React hook: loads leads from Supabase and lets you add new ones. */
export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLeads(await fetchLeads());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load leads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    reload();
  }, [reload]);

  const add = useCallback(async (input: LeadInput) => {
    const lead = await createLead(input);
    setLeads((prev) => [lead, ...prev]);
    return lead;
  }, []);

  return { leads, loading, error, reload, add };
}
