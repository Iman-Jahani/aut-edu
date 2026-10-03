"use client";

import type { ReactNode } from "react";
import { CheckCircle2, CircleDashed, XCircle, AlertTriangle, Circle } from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  { icon: ReactNode; label: string; className: string }
> = {
  correct: { icon: <CheckCircle2 size={12} />, label: "حل شد", className: "bg-emerald-100 text-emerald-700" },
  partial: { icon: <CircleDashed size={12} />, label: "ناقص", className: "bg-amber-100 text-amber-700" },
  wrong: { icon: <XCircle size={12} />, label: "نادرست", className: "bg-red-100 text-red-700" },
  error: { icon: <AlertTriangle size={12} />, label: "خطا", className: "bg-red-100 text-red-700" },
  pending: { icon: <Circle size={12} />, label: "حل نشده", className: "bg-slate-100 text-slate-600" },
};

export function StatusBadge({ status, text }: { status: keyof typeof STATUS_CONFIG; text?: string }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${c.className}`}>
      {c.icon} {text ?? c.label}
    </span>
  );
}

/** Generic icon + label pill, e.g. lifecycle state (draft / active / ended). */
export function Pill({ icon, children, className = "" }: { icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${className}`}>
      {icon} {children}
    </span>
  );
}
