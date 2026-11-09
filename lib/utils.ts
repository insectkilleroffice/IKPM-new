import type { Lead } from "@/types/lead";

export function exportLeadsCsv(leads: Lead[]) {
  const headers = ["Lead ID", "Name", "Type", "Company", "Phone", "Email", "Added By", "Source", "Created"];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = leads.map((l) =>
    [l.code, l.name, l.type, l.companyName, l.phone, l.email, l.addedBy, l.source, l.createdAt].map(escape).join(",")
  );
  const blob = new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
