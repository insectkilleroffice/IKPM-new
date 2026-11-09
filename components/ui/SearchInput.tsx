"use client";

import { FiSearch } from "react-icons/fi";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchInput({ value, onChange, placeholder = "Search leads…", className = "" }: Props) {
  return (
    <label
      className={`flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100 ${className}`}
    >
      <FiSearch className="shrink-0" size={14} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
      />
    </label>
  );
}
