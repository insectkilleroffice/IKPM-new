"use client";

import { useCallback, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { useLeads } from "@/lib/leads";
import LeadsTable from "@/components/leads/LeadsTable";
import LeadFormModal from "@/components/leads/LeadFormModal";
import Button from "@/components/ui/Button";

export default function LeadsPage() {
  const { leads, loading, error, reload, add } = useLeads();
  const [formOpen, setFormOpen] = useState(false);
  const closeForm = useCallback(() => setFormOpen(false), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
        <Button variant="primary" onClick={() => setFormOpen(true)}>
          <FiPlus size={16} /> Add Lead
        </Button>
      </div>

      <LeadsTable leads={leads} loading={loading} error={error} onRetry={reload} />

      {formOpen && <LeadFormModal onClose={closeForm} onCreate={add} />}
    </div>
  );
}
