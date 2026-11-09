const COLORS = [
  "bg-emerald-100 text-emerald-800",
  "bg-sky-100 text-sky-800",
  "bg-amber-100 text-amber-800",
  "bg-teal-100 text-teal-800",
  "bg-lime-100 text-lime-800",
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const color = COLORS[name.length % COLORS.length];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${color}`}
      style={{ width: size, height: size }}
    >
      {initials(name)}
    </span>
  );
}
