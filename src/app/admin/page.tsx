"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MessageCircle, Code2, CheckCircle2 } from "lucide-react";
import { useAdminData } from "@/components/admin/AdminShell";
import { PageHeader, Panel, StatStrip, Empty } from "@/components/admin/ui";
import { ActivityChart, Columns, HBars, StatusDonut } from "@/components/admin/charts";
import { ago, fa, overview, pct } from "@/lib/adminStats";

export default function AdminOverviewPage() {
  const { ix } = useAdminData();
  const ov = useMemo(() => (ix ? overview(ix) : null), [ix]);
  if (!ov) return null;
  const { totals: T } = ov;
  const delta = ov.prevActive7d > 0 ? Math.round(((ov.active7d - ov.prevActive7d) / ov.prevActive7d) * 100) : null;
  const weekActivity = ov.activity.slice(-7).reduce((a, p) => a + p.cells + p.submissions + p.comments, 0);

  return (
    <>
      <PageHeader title="نمای کلی" subtitle="وضعیت همه‌ی کلاس‌ها در یک نگاه؛ روی هر کلاس یا دانشجو بزن تا جزئیاتش رو ببینی." />

      <StatStrip
        items={[
          { label: "کلاس", value: fa(T.classes), hint: `${fa(T.meetings)} جلسه` },
          { label: "معلم", value: fa(T.teachers) },
          { label: "دانشجو", value: fa(T.students) },
          { label: "فعال در ۷ روز اخیر", value: fa(ov.active7d), delta, hint: "نسبت به هفته‌ی قبل" },
          { label: "پاسخ تمرین", value: fa(T.submissions), hint: `${fa(ov.correctRate)}٪ درست` },
          { label: "سلول کد", value: fa(T.cells), hint: `${fa(T.comments)} نظر` },
        ]}
      />

      <div className="grid lg:grid-cols-12 gap-5 mt-5">
        <Panel className="lg:col-span-8" title="فعالیت ۳۰ روز اخیر" subtitle={`${fa(weekActivity)} فعالیت در هفته‌ی گذشته`}>
          <ActivityChart data={ov.activity} />
        </Panel>
        <Panel className="lg:col-span-4" title="نتیجه‌ی پاسخ‌ها" subtitle="همه‌ی ارسال‌ها در همه‌ی کلاس‌ها">
          <StatusDonut counts={ov.statusCounts} />
        </Panel>

        <Panel className="lg:col-span-5" title="فعال‌ترین کلاس‌ها" subtitle="مجموع سلول، پاسخ و نظر در ۳۰ روز اخیر">
          <HBars
            rows={ov.topClasses.filter((c) => c.value > 0).map((c) => ({ label: c.title, value: c.value, href: `/admin/classes/${c.id}` }))}
            emptyText="هنوز فعالیتی ثبت نشده."
          />
        </Panel>
        <Panel className="lg:col-span-4" title="دانشجوهای جدید" subtitle="اولین ورود به یک کلاس، روزانه">
          <Columns data={ov.joins as unknown as Record<string, string | number>[]} xKey="label" bars={[{ key: "joins", name: "دانشجوی جدید" }]} height={190} />
        </Panel>
        <Panel className="lg:col-span-3" title="درصد درست بر اساس سختی" subtitle="از تمرین‌هایی که سختی دارن">
          {ov.byDifficulty.some((d) => d.attempts > 0) ? (
            <HBars rows={ov.byDifficulty.map((d) => ({ label: d.label, value: d.correctRate, sub: `${fa(d.attempts)} پاسخ` }))} suffix="٪" max={100} />
          ) : (
            <Empty>هنوز به تمرین‌ها سختی داده نشده.</Empty>
          )}
        </Panel>

        <Panel className="lg:col-span-12" title="آخرین رویدادها" flush>
          {ov.recent.length === 0 ? (
            <Empty>هنوز رویدادی نیست.</Empty>
          ) : (
            <ul className="divide-y divide-line/70">
              {ov.recent.map((r, i) => {
                const Icon = r.kind === "cell" ? Code2 : r.kind === "comment" ? MessageCircle : CheckCircle2;
                const body = (
                  <>
                    <span className="w-8 h-8 rounded-full bg-zinc-100 grid place-items-center shrink-0 text-zinc-600">
                      <Icon size={15} />
                    </span>
                    <span className="flex-1 min-w-0 text-sm">
                      <b>{r.who || "ناشناس"}</b> <span className="text-muted">— {r.text}</span>
                    </span>
                    <span className="text-xs text-muted shrink-0">{ago(r.at)}</span>
                  </>
                );
                return (
                  <li key={i}>
                    {r.classId ? (
                      <Link href={`/admin/classes/${r.classId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-5 py-3">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
      <p className="text-[11px] text-muted mt-4">
        نرخ درستی کل: {fa(pct(ov.statusCounts.correct, T.submissions))}٪ از {fa(T.submissions)} پاسخ.
      </p>
    </>
  );
}
