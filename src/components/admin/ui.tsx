"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowRight, Search } from "lucide-react";
import { fa } from "@/lib/adminStats";

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  lead,
}: {
  title: string;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  lead?: React.ReactNode;
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-ink mb-3">
          <ArrowRight size={13} /> {back.label}
        </Link>
      )}
      <div className="flex items-start gap-4 flex-wrap">
        {lead}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl md:text-[28px] font-black tracking-tight leading-tight">{title}</h1>
          {subtitle && <div className="text-sm text-muted mt-1.5">{subtitle}</div>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
    </header>
  );
}

export function Panel({
  title,
  subtitle,
  right,
  children,
  className = "",
  flush = false,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** No inner padding (for tables). */
  flush?: boolean;
}) {
  return (
    <section className={`bg-white border border-line rounded-2xl ${className}`}>
      {(title || right) && (
        <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-extrabold text-[15px]">{title}</h2>}
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      <div className={flush ? "" : "px-5 pb-5" + (title || right ? "" : " pt-5")}>{children}</div>
    </section>
  );
}

export interface Stat {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** Positive/negative change shown next to the hint. */
  delta?: number | null;
}

/** One continuous strip of numbers (cells separated by hairlines) instead of a row of separate cards. */
export function StatStrip({ items, cols = "xl:grid-cols-6" }: { items: Stat[]; cols?: string }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 ${cols} gap-px bg-line border border-line rounded-2xl overflow-hidden`}>
      {items.map((s) => (
        <div key={s.label} className="bg-white px-4 py-4">
          <div className="text-xs text-muted font-semibold">{s.label}</div>
          <div className="text-[26px] font-black leading-tight mt-1 tabular-nums">{s.value}</div>
          {(s.hint || s.delta != null) && (
            <div className="text-[11px] text-muted mt-0.5 flex items-center gap-1.5">
              {s.delta != null && s.delta !== 0 && (
                <span className={`font-extrabold ${s.delta > 0 ? "text-success" : "text-danger"}`}>
                  {s.delta > 0 ? "▲" : "▼"} {fa(Math.abs(s.delta))}٪
                </span>
              )}
              {s.hint}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function Avatar({ name, avatar, size = 32 }: { name: string; avatar?: string | null; size?: number }) {
  return (
    <span
      className="rounded-full bg-zinc-100 border border-line grid place-items-center shrink-0 font-extrabold text-zinc-600 select-none"
      style={{ width: size, height: size, fontSize: size * 0.46 }}
      aria-hidden
    >
      {avatar || (name || "?").trim().charAt(0)}
    </span>
  );
}

export function Bar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`block h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden ${className}`}>
      <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted text-center py-10 px-4">{children}</div>;
}

export function SearchBox({ value, onChange, placeholder = "جستجو…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="relative block">
      <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full sm:w-64 bg-white border border-line rounded-xl pr-9 pl-3 py-2 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 border-b border-line mb-5 overflow-x-auto" role="tablist">
      {tabs.map((tb) => (
        <button
          key={tb.id}
          role="tab"
          aria-selected={value === tb.id}
          onClick={() => onChange(tb.id)}
          className={`px-4 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 -mb-px transition ${
            value === tb.id ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {tb.label}
          {tb.count !== undefined && <span className="mr-1.5 text-[11px] font-semibold text-muted">{fa(tb.count)}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------- sortable table ----------
export interface Column<T> {
  key: string;
  label: string;
  /** Value used for sorting. Omit to make the column unsortable. */
  sort?: (r: T) => number | string;
  render: (r: T) => React.ReactNode;
  className?: string;
  /** Hide below the md breakpoint. */
  hideOnMobile?: boolean;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  href,
  onRowClick,
  defaultSort,
  empty = "موردی پیدا نشد",
  maxHeight,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string;
  href?: (r: T) => string;
  /** Alternative to `href`: run something (e.g. open a drawer) when a row is clicked. */
  onRowClick?: (r: T) => void;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  empty?: string;
  maxHeight?: string;
}) {
  const router = useRouter();
  const [sort, setSort] = useState(defaultSort || null);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sort || !sort) return rows;
    const get = col.sort;
    const mul = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      return (typeof x === "string" && typeof y === "string" ? x.localeCompare(y, "fa") : Number(x) - Number(y)) * mul;
    });
  }, [rows, columns, sort]);

  const toggle = (key: string) => setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  if (!rows.length) return <Empty>{empty}</Empty>;

  return (
    <div className="overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full text-sm min-w-[640px]">
        <thead className="sticky top-0 bg-white z-10">
          <tr className="border-y border-line text-xs text-muted">
            {columns.map((c) => (
              <th key={c.key} className={`text-right font-bold px-4 py-2.5 whitespace-nowrap ${c.hideOnMobile ? "hidden md:table-cell" : ""} ${c.className || ""}`}>
                {c.sort ? (
                  <button onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 hover:text-ink">
                    {c.label}
                    {sort?.key === c.key && (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                  </button>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={href ? () => router.push(href(r)) : onRowClick ? () => onRowClick(r) : undefined}
              className={`border-b border-line/70 last:border-0 ${href || onRowClick ? "cursor-pointer hover:bg-zinc-50" : ""}`}
            >
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-3 align-middle ${c.hideOnMobile ? "hidden md:table-cell" : ""} ${c.className || ""}`}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "dark" | "ok" | "warn" | "bad" }) {
  const cls = {
    neutral: "bg-zinc-100 text-zinc-700",
    dark: "bg-primary text-white",
    ok: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-700",
    bad: "bg-red-50 text-red-700",
  }[tone];
  return <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{children}</span>;
}
