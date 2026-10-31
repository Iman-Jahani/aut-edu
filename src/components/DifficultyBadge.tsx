import { getDifficulty } from "@/lib/difficulty";

export function DifficultyBadge({ value, className = "" }: { value: number | null | undefined; className?: string }) {
  const d = getDifficulty(value);
  if (!d) return null;
  return (
    <span
      title={d.en}
      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${d.cls} ${className}`}
    >
      {d.fa}
    </span>
  );
}

export function TopicBadge({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  if (!value || !value.trim()) return null;
  return (
    <span
      dir="auto"
      className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 ${className}`}
    >
      {value}
    </span>
  );
}
