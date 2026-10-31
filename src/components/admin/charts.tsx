"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DayPoint, STATUS_COLOR, STATUS_LABEL, SubStatus, fa } from "@/lib/adminStats";

const INK = "#0b6b70";
const GREY = "#f2a93b";
const LIGHT = "#bfdcdc";
const tick = { fontSize: 11, fill: "#a8a29e" };
const tooltipStyle = { fontSize: 12, borderRadius: 12, border: "1px solid #e7e2d6", direction: "rtl" as const, boxShadow: "none" };

function Box({ height, children }: { height: number; children: React.ReactNode }) {
  return (
    <div dir="ltr" style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

const SERIES = [
  { key: "submissions", name: "پاسخ تمرین", color: INK },
  { key: "cells", name: "سلول کد", color: GREY },
  { key: "comments", name: "نظر", color: "#a8a29e" },
] as const;

export function ActivityChart({ data, height = 250 }: { data: DayPoint[]; height?: number }) {
  const total = data.reduce((a, p) => a + p.cells + p.submissions + p.comments, 0);
  if (!total) return <div className="text-sm text-muted text-center py-16">در این بازه فعالیتی ثبت نشده.</div>;
  return (
    <div>
      <div className="flex gap-4 mb-2 text-xs text-muted">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <Box height={height}>
        <AreaChart data={data} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id="act-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={INK} stopOpacity={0.18} />
              <stop offset="100%" stopColor={INK} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1ede2" />
          <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(data.length / 7))} />
          <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={(v) => fa(v)} width={34} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fa(Number(v)), SERIES.find((s) => s.key === n)?.name || String(n)]} />
          <Area type="monotone" dataKey="comments" stroke="#a8a29e" strokeWidth={1.5} strokeDasharray="4 3" fill="none" />
          <Area type="monotone" dataKey="cells" stroke={GREY} strokeWidth={1.8} fill="none" />
          <Area type="monotone" dataKey="submissions" stroke={INK} strokeWidth={2.4} fill="url(#act-fill)" />
        </AreaChart>
      </Box>
    </div>
  );
}

export function StatusDonut({ counts }: { counts: Record<SubStatus, number> }) {
  const order: SubStatus[] = ["correct", "partial", "wrong", "error"];
  const rows = order.map((k) => ({ key: k, name: STATUS_LABEL[k], value: counts[k] || 0, color: STATUS_COLOR[k] })).filter((r) => r.value > 0);
  const total = rows.reduce((a, r) => a + r.value, 0);
  if (!total) return <div className="text-sm text-muted text-center py-12">هنوز پاسخی ثبت نشده.</div>;
  return (
    <div className="flex items-center gap-5 flex-wrap justify-center">
      <div className="relative w-[150px] h-[150px] shrink-0" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" innerRadius={50} outerRadius={72} paddingAngle={2} stroke="none">
              {rows.map((r) => (
                <Cell key={r.key} fill={r.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center leading-tight">
            <div className="text-xl font-black tabular-nums">{fa(total)}</div>
            <div className="text-[10px] text-muted">پاسخ</div>
          </div>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm min-w-[130px]">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
            <span className="flex-1">{r.name}</span>
            <span className="font-bold tabular-nums">{fa(r.value)}</span>
            <span className="text-[11px] text-muted w-9 text-left tabular-nums">{fa(Math.round((r.value / total) * 100))}٪</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bars drawn with CSS so each row can be a link. */
export function HBars({
  rows,
  suffix = "",
  max,
  emptyText = "داده‌ای نیست",
}: {
  rows: { label: string; value: number; href?: string; sub?: string }[];
  suffix?: string;
  max?: number;
  emptyText?: string;
}) {
  if (!rows.length) return <div className="text-sm text-muted text-center py-10">{emptyText}</div>;
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const inner = (
          <>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="text-[13px] font-bold truncate">{r.label}</span>
              <span className="text-xs text-muted tabular-nums shrink-0">
                {r.sub && <span className="ml-2">{r.sub}</span>}
                <b className="text-ink">{fa(r.value)}</b>
                {suffix}
              </span>
            </div>
            <span className="block h-2 rounded-full bg-stone-100 overflow-hidden">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${(r.value / m) * 100}%` }} />
            </span>
          </>
        );
        return (
          <li key={r.label + (r.href || "")}>
            {r.href ? (
              <Link href={r.href} className="block hover:opacity-70 transition-opacity">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Columns({
  data,
  xKey,
  bars,
  height = 200,
  unit = "",
  domain,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  bars: { key: string; name: string; color?: string }[];
  height?: number;
  unit?: string;
  domain?: [number, number];
}) {
  if (!data.length) return <div className="text-sm text-muted text-center py-10">داده‌ای نیست</div>;
  return (
    <Box height={height}>
      <BarChart data={data} margin={{ top: 6, right: 6, left: -22, bottom: 0 }} barGap={3}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1ede2" />
        <XAxis dataKey={xKey} tick={tick} axisLine={false} tickLine={false} interval={data.length > 12 ? Math.floor(data.length / 8) : 0} />
        <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} domain={domain} tickFormatter={(v) => fa(v)} width={34} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f3efe4" }} formatter={(v, n) => [fa(Number(v)) + unit, String(n)]} />
        {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {bars.map((b, i) => (
          <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color || [INK, LIGHT][i % 2]} radius={[5, 5, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </Box>
  );
}

export function TopicRadar({ data }: { data: { topic: string; correctRate: number }[] }) {
  return (
    <Box height={230}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#e7e2d6" />
        <PolarAngleAxis dataKey="topic" tick={{ fontSize: 11, fill: "#52525b" }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fa(Number(v)) + "٪", "درصد درست"]} />
        <Radar dataKey="correctRate" stroke={INK} fill={INK} fillOpacity={0.18} strokeWidth={2} />
      </RadarChart>
    </Box>
  );
}
