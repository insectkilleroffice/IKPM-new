import type { Lead } from "@/types/lead";

/** e.g. "12 Nov, 3:30 pm" — adds the year only when it isn't this year. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
}

/** How urgent a scheduled date is, for colouring. */
export function dueStatus(iso: string): "overdue" | "today" | "upcoming" {
  const d = new Date(iso);
  const now = new Date();
  if (d < now) return "overdue";
  return d.toDateString() === now.toDateString() ? "today" : "upcoming";
}

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
