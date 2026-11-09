"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { FiX, FiEye, FiEyeOff } from "react-icons/fi";
import { ROLES, ROLE_LABELS, type NewUserInput, type Profile, type Role } from "@/types/user";
import { createUser } from "@/lib/users";
import { useAccessToken } from "@/lib/session";
import Button from "@/components/ui/Button";

interface Props {
  onClose: () => void;
  onCreated: (user: Profile) => void;
}

type Errors = Partial<Record<keyof NewUserInput, string>>;

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label} <span className="text-rose-500">*</span>
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

export default function UserFormModal({ onClose, onCreated }: Props) {
  const token = useAccessToken();
  const [form, setForm] = useState<NewUserInput>({ fullName: "", email: "", password: "", role: "sales" });
  const [errors, setErrors] = useState<Errors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof NewUserInput>(key: K, value: NewUserInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const next: Errors = {};
    if (!form.fullName.trim()) next.fullName = "Name is required";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Enter a valid email";
    if (form.password.length < 8) next.password = "At least 8 characters";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    setSaveError("");
    try {
      const user = await createUser({ ...form, fullName: form.fullName.trim(), email: form.email.trim() }, token);
      onCreated(user);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not create user");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={onClose}>
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        noValidate
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Add User</h2>
            <p className="text-xs text-slate-500">Create a staff login</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <FiX size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <Field label="Full Name" error={errors.fullName}>
            <input autoFocus className={inputCls} value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="e.g. Ahmed Khan" />
          </Field>

          <Field label="Email" error={errors.email}>
            <input type="email" autoComplete="off" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@company.com" />
          </Field>

          <Field label="Password" error={errors.password}>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className={`${inputCls} pr-10`}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Min. 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-700"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
              </button>
            </div>
          </Field>

          <div>
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Role <span className="text-rose-500">*</span>
            </span>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Role">
              {ROLES.map((r: Role) => {
                const active = form.role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => set("role", r)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      active ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                );
              })}
            </div>
          </div>

          {saveError && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{saveError}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create User"}
          </Button>
        </div>
      </form>
    </div>
  );
}
