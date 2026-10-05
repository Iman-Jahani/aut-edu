"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/lib/supabase";
import { TrendingUp, Activity } from "lucide-react";

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("fa-IR", { month: "short", day: "numeric" });
}

/** Builds one entry per day for the last `days` days, defaulting value to 0. */
function dayBuckets(days: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    out.push({ key: d.toISOString().slice(0, 10), label: fmtDay(d.toISOString()) });
  }
  return out;
}

function CardShell({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-primary">{icon}</span>
        <h3 className="font-bold text-sm">{title}</h3>
      </div>
      <p className="text-[11px] text-muted mb-3">{subtitle}</p>
      {children}
    </div>
  );
}

export function StudentProgressChart({ userId }: { userId: string }) {
  const [data, setData] = useState<{ label: string; solved: number }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: subs } = await supabase
        .from("exercise_submissions")
        .select("status, submitted_at")
        .eq("user_id", userId)
        .eq("status", "correct")
        .order("submitted_at", { ascending: true });
      if (cancelled) return;
      const rows = subs || [];
      if (!rows.length) {
        setData([]);
        return;
      }
      const buckets = dayBuckets(30);
      const countByDay = new Map(buckets.map((b) => [b.key, 0]));
      rows.forEach((s) => {
        const key = s.submitted_at.slice(0, 10);
        if (countByDay.has(key)) countByDay.set(key, (countByDay.get(key) || 0) + 1);
        else if (key < buckets[0].key) countByDay.set(buckets[0].key, (countByDay.get(buckets[0].key) || 0) + 1);
      });
      let cum = 0;
      // Anything solved before the 30-day window still counts toward the running total.
      const before = rows.filter((s) => s.submitted_at.slice(0, 10) < buckets[0].key).length;
      cum = before;
      const series = buckets.map((b) => {
        cum += countByDay.get(b.key) || 0;
        return { label: b.label, solved: cum };
      });
      setData(series);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (data === null) {
    return (
      <CardShell icon={<TrendingUp size={16} />} title="روند پیشرفت" subtitle="تمرین‌های حل‌شده در ۳۰ روز اخیر">
        <div className="h-40 animate-pulse bg-slate-100 rounded-lg" />
      </CardShell>
    );
  }

  const total = data.length ? data[data.length - 1].solved : 0;
  if (total === 0) {
    return (
      <CardShell icon={<TrendingUp size={16} />} title="روند پیشرفت" subtitle="تمرین‌های حل‌شده در ۳۰ روز اخیر">
        <div className="h-24 grid place-items-center text-sm text-muted">هنوز تمرینی حل نکردی — اولین تمرینت رو حل کن تا نمودارت شروع بشه!</div>
      </CardShell>
    );
  }

  return (
    <CardShell icon={<TrendingUp size={16} />} title="روند پیشرفت" subtitle={`مجموع ${total} تمرین حل‌شده در ۳۰ روز اخیر`}>
      <div dir="ltr" className="h-40 -mr-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="solvedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={6} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} axisLine={false} tickLine={false} width={24} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e2e8f0", direction: "rtl" }}
              labelFormatter={(l) => `تا ${l}`}
              formatter={(v: unknown) => [String(v), "حل‌شده"]}
            />
            <Area type="monotone" dataKey="solved" stroke="#6366f1" strokeWidth={2.5} fill="url(#solvedGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </CardShell>
  );
}

export function TeacherActivityChart({ classIds }: { classIds: string[] }) {
  const [data, setData] = useState<{ label: string; cells: number }[] | null>(null);

  useEffect(() => {
    if (!classIds.length) {
      setData([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const buckets = dayBuckets(14);
      const { data: cells } = await supabase.from("cells").select("created_at").in("class_id", classIds).gte("created_at", buckets[0].key);
      if (cancelled) return;
      const countByDay = new Map(buckets.map((b) => [b.key, 0]));
      (cells || []).forEach((c) => {
        const key = c.created_at.slice(0, 10);
        if (countByDay.has(key)) countByDay.set(key, (countByDay.get(key) || 0) + 1);
      });
      setData(buckets.map((b) => ({ label: b.label, cells: countByDay.get(b.key) || 0 })));
    })();
    return () => {
      cancelled = true;
    };
  }, [classIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  if (data === null) {
    return (
      <CardShell icon={<Activity size={16} />} title="فعالیت کلاس‌ها" subtitle="تعداد سلول کد نوشته‌شده در ۱۴ روز اخیر">
        <div className="h-40 animate-pulse bg-slate-100 rounded-lg" />
      </CardShell>
    );
  }

  const total = data.reduce((s, d) => s + d.cells, 0);
  if (total === 0) {
    return (
      <CardShell icon={<Activity size={16} />} title="فعالیت کلاس‌ها" subtitle="تعداد سلول کد نوشته‌شده در ۱۴ روز اخیر">
        <div className="h-24 grid place-items-center text-sm text-muted">هنوز فعالیتی توی این بازه ثبت نشده.</div>
      </CardShell>
    );
  }

  return (
    <CardShell icon={<Activity size={16} />} title="فعالیت کلاس‌ها" subtitle={`${total} سلول کد در ۱۴ روز اخیر، توی همه‌ی کلاس‌هات`}>
      <div dir="ltr" className="h-40 -mr-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={1} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} axisLine={false} tickLine={false} width={24} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e2e8f0", direction: "rtl" }} formatter={(v: unknown) => [String(v), "سلول کد"]} />
            <Bar dataKey="cells" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </CardShell>
  );
}
