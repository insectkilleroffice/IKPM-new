export const ROLES = ["admin", "operations", "sales", "finance"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  operations: "Operations",
  sales: "Sales",
  finance: "Finance",
};

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  createdAt: string;
}
