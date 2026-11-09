"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { FiX, FiHome, FiBriefcase } from "react-icons/fi";
import { LEAD_SOURCES, LEAD_TYPES, type LeadInput, type LeadType } from "@/types/lead";
import { useCurrentUser } from "@/lib/session";
import Button from "@/components/ui/Button";

interface FormState {
  type: LeadType;
  name: string;
  companyName: string;
  phone: string;
  email: string;
  source: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

const EMPTY: FormState = { type: "Residential", name: "", companyName: "", phone: "", email: "", source: "" };

const TYPE_ICONS = { Residential: FiHome, Company: FiBriefcase };

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

function Field({ label, error, children, required }: { label: string; error?: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

interface Props {
  onClose: () => void;
  onCreate: (input: LeadInput) => Promise<unknown>;
}

export default function LeadFormModal({ onClose, onCreate }: Props) {
  const { name: user } = useCurrentUser();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const isCompany = form.type === "Company";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const next: Errors = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (isCompany && !form.companyName.trim()) next.companyName = "Company name is required";
    if (!/^[+\d][\d\s-]{6,}$/.test(form.phone.trim())) next.phone = "Enter a valid phone number";
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Enter a valid email";
    if (!form.source.trim()) next.source = "Enter where this lead came from";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    setSaveError("");
    try {
      await onCreate({
        type: form.type,
        name: form.name.trim(),
        companyName: isCompany ? form.companyName.trim() : "",
        phone: form.phone.trim(),
        email: form.email.trim(),
        source: form.source.trim(),
      });
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save the lead");
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
            <h2 className="text-base font-semibold text-slate-900">Add Lead</h2>
            <p className="text-xs text-slate-500">Enter the lead&apos;s details</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <FiX size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Lead Type <span className="text-rose-500">*</span>
            </span>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Lead type">
              {LEAD_TYPES.map((t) => {
                const Icon = TYPE_ICONS[t];
                const active = form.type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => set("type", t)}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon size={14} /> {t}
                  </button>
                );
              })}
            </div>
          </div>

          {isCompany && (
            <Field label="Company Name" error={errors.companyName} required>
              <input className={inputCls} value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="e.g. Green Valley Restaurant" />
            </Field>
          )}

          <Field label={isCompany ? "Contact Person Name" : "Full Name"} error={errors.name} required>
            <input autoFocus className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Sara Malik" />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phone" error={errors.phone} required>
              <input type="tel" className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+92 300 1234567" />
            </Field>
            <Field label="Email" error={errors.email}>
              <input type="email" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" />
            </Field>
          </div>

          <Field label="Source (platform we got this lead from)" error={errors.source} required>
            <input
              list="lead-sources"
              className={inputCls}
              value={form.source}
              onChange={(e) => set("source", e.target.value)}
              placeholder="Pick one or type your own, e.g. Flyer, TikTok"
            />
            <datalist id="lead-sources">
              {LEAD_SOURCES.map((s) => <option key={s} value={s} />)}
            </datalist>
          </Field>

          {saveError && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{saveError}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-6 py-4">
          <p className="text-xs text-slate-500">
            Added by <span className="font-medium text-slate-700">{user}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Create Lead"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
