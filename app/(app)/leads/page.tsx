"use client";

import { useCallback, useState } from "react";
import { FiPlus } from "react-icons/fi";
import type { Lead } from "@/types/lead";
import { canUseLeads, useLeads } from "@/lib/leads";
import { useProfile } from "@/lib/session";
import LeadsTable from "@/components/leads/LeadsTable";
import LeadFormModal from "@/components/leads/LeadFormModal";
import LogContactModal from "@/components/leads/LogContactModal";
import Button from "@/components/ui/Button";

export default function LeadsPage() {
  const { role } = useProfile();
  if (!canUseLeads(role)) {
    return <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Leads are only available to admin and sales.</p>;
  }
  return <LeadsWorkspace />;
}

function LeadsWorkspace() {
  const { leads, loading, error, reload, add, remove } = useLeads("new");
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const closeForm = useCallback(() => setFormOpen(false), []);
  const closeContact = useCallback(() => setSelected(null), []);
  // Once contact is logged the lead belongs to the Sales board, not this list.
  const onLogged = useCallback((lead: Lead) => remove(lead.id), [remove]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500">Tap a lead to log contact. It then moves to your Sales board.</p>
        </div>
        <Button variant="primary" onClick={() => setFormOpen(true)}>
          <FiPlus size={16} /> Add Lead
        </Button>
      </div>

      <LeadsTable leads={leads} loading={loading} error={error} onRetry={reload} onSelect={setSelected} />

      {formOpen && <LeadFormModal onClose={closeForm} onCreate={add} />}
      {selected && <LogContactModal lead={selected} mode="contact" onClose={closeContact} onLogged={onLogged} />}
    </div>
  );
}
