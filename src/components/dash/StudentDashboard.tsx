"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, Flame, Plus, Sparkles, Trophy } from "lucide-react";
import { Bar, Chip, Empty, Panel, StatStrip } from "@/components/admin/ui";
import { ActivityChart, HBars, StatusDonut, TopicRadar } from "@/components/admin/charts";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import ProgressRing from "@/components/dash/ProgressRing";
import { STATUS_LABEL, ago, fa, pct } from "@/lib/adminStats";
import type { StudentDash } from "@/lib/studentDash";

const toneOf = { correct: "ok", partial: "warn", wrong: "bad", error: "neutral", pending: "neutral" } as const;

function deadlineText(iso: string, overdue: boolean) {
  const diff = new Date(iso).getTime() - Date.now();
  const d = Math.ceil(Math.abs(diff) / 86_400_000);
  if (overdue) return `${fa(d)} روز از مهلت گذشته`;
  if (diff < 86_400_000) return "امروز تموم می‌شه";
  return `${fa(d)} روز دیگه`;
}

export default function StudentDashboard({ dash, name, avatar, onJoin }: { dash: StudentDash; name: string; avatar: string; onJoin: () => void }) {
  const T = dash.totals;
  const overall = pct(T.solved, T.total);
  const overdue = dash.deadlines.filter((d) => d.overdue).length;
  const message =
    T.total === 0
      ? "هنوز تمرینی توی کلاس‌هات نیست. وقتی معلمت تمرین بذاره، پیشرفتت همین‌جا نمایش داده می‌شه."
      : T.solved === T.total
      ? "همه‌ی تمرین‌های فعلی رو حل کردی. عالیه!"
      : overdue > 0
      ? `${fa(overdue)} تمرین از مهلتش گذشته؛ بهشون سر بزن. در کل ${fa(T.total - T.solved)} تمرین مونده.`
      : `${fa(T.total - T.solved)} تمرین مونده تا همه‌ی تمرین‌هات تموم بشه.`;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <section className="rounded-3xl bg-primary text-white p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-12 h-12 rounded-full bg-white/10 grid place-items-center text-2xl">{avatar}</span>
              <div>
                <div className="text-white/50 text-sm">سلام</div>
                <h1 className="text-2xl md:text-3xl font-black leading-tight">{name}</h1>
              </div>
            </div>
            <p className="text-white/70 text-[15px] leading-8 max-w-lg">{message}</p>
            <div className="flex flex-wrap gap-2 mt-5">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-bold ${dash.streak > 0 ? "bg-white text-primary" : "bg-white/10 text-white/70"}`}>
                <Flame size={15} /> {dash.streak > 0 ? `${fa(dash.streak)} روز پیاپی` : "رشته‌ات از امروز شروع می‌شه"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-bold">
                <Trophy size={15} /> سطح {fa(dash.level)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-bold">
                <Sparkles size={15} /> {fa(dash.xp)} امتیاز
              </span>
            </div>
            <div className="mt-4 max-w-sm">
              <div className="flex justify-between text-[11px] text-white/50 mb-1.5">
                <span>تا سطح بعدی</span>
                <span>{fa(dash.xpToNext)} امتیاز</span>
              </div>
              <span className="block h-1.5 rounded-full bg-white/15 overflow-hidden">
                <span className="block h-full rounded-full bg-white" style={{ width: `${dash.levelProgress}%`, transition: "width .8s" }} />
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-3 md:pl-4">
            <ProgressRing value={overall} onDark label={`${fa(overall)}٪`} sub={`${fa(T.solved)} از ${fa(T.total)} تمرین`} />
            <button onClick={onJoin} className="inline-flex items-center gap-1.5 rounded-xl bg-white text-primary font-extrabold text-sm px-4 py-2 hover:opacity-90">
              <Plus size={14} /> پیوستن به کلاس با کد
            </button>
          </div>
        </div>
      </section>

      <StatStrip
        items={[
          { label: "تمرین حل‌شده", value: fa(T.solved), hint: `از ${fa(T.total)} تمرین` },
          { label: "میانگین نمره", value: T.attempts ? fa(T.avgScore) : "—", hint: `${fa(T.attempts)} تلاش` },
          { label: "میانگین کوییز", value: T.quizAvg === null ? "—" : `${fa(T.quizAvg)}٪`, hint: `${fa(T.quizCount)} کوییز` },
          { label: "سلول کد", value: fa(T.cells) },
          { label: "نظر دریافتی", value: fa(T.commentsReceived), hint: "از معلم و هم‌کلاسی‌ها" },
          { label: "کلاس", value: fa(dash.classes.length) },
        ]}
      />

      <div className="grid lg:grid-cols-12 gap-5">
        <Panel className="lg:col-span-8" title="فعالیت ۳۰ روز اخیر من">
          <ActivityChart data={dash.activity} />
        </Panel>
        <Panel className="lg:col-span-4" title="نتیجه‌ی پاسخ‌های من">
          <StatusDonut counts={dash.statusCounts} />
        </Panel>

        <Panel className="lg:col-span-5" title="مهلت‌های پیش رو" subtitle="تمرین‌هایی که هنوز حل نکردی" flush>
          {dash.deadlines.length === 0 ? (
            <Empty>مهلت‌داری منتظرت نیست.</Empty>
          ) : (
            <ul className="divide-y divide-line/70">
              {dash.deadlines.map((d) => (
                <li key={d.id}>
                  <Link href={`/class/${d.classCode}`} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50">
                    <span className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${d.overdue ? "bg-red-50 text-red-600" : "bg-zinc-100 text-zinc-600"}`}>
                      {d.overdue ? <AlertTriangle size={16} /> : <CalendarClock size={16} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-bold truncate">{d.title}</span>
                        <DifficultyBadge value={d.difficulty} />
                      </span>
                      <span className="block text-[11px] text-muted truncate">{d.classTitle}</span>
                    </span>
                    <span className={`text-xs font-bold whitespace-nowrap ${d.overdue ? "text-danger" : "text-ink"}`}>{deadlineText(d.dueAt, d.overdue)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="lg:col-span-7" title="کلاس‌های من" subtitle="روی هر کلاس بزن تا واردش بشی" flush>
          {dash.classes.length === 0 ? (
            <Empty>
              هنوز به کلاسی نپیوستی.
              <button onClick={onJoin} className="btn-primary mx-auto mt-4">
                پیوستن با کد
              </button>
            </Empty>
          ) : (
            <ul className="divide-y divide-line/70">
              {dash.classes.map((c) => (
                <li key={c.id}>
                  <Link href={`/class/${c.code}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-50">
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-bold">
                        <span className="truncate">{c.title}</span>
                        {c.attention && <span className="w-2 h-2 rounded-full bg-danger shrink-0" title="کوییز یا مسابقه‌ی فعال منتظرته" />}
                      </span>
                      <span className="block text-[11px] text-muted mt-0.5">آخرین بازدید {ago(c.lastSeenAt)}</span>
                    </span>
                    <span className="w-40 hidden sm:block">
                      {c.total > 0 ? (
                        <>
                          <span className="flex justify-between text-[11px] text-muted mb-1">
                            <span className="tabular-nums">
                              {fa(c.solved)}/{fa(c.total)} تمرین
                            </span>
                            <b className="text-ink tabular-nums">{fa(pct(c.solved, c.total))}٪</b>
                          </span>
                          <Bar value={pct(c.solved, c.total)} />
                        </>
                      ) : (
                        <span className="text-[11px] text-muted">بدون تمرین</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="lg:col-span-4" title="درصد درست بر اساس سختی">
          {dash.byDifficulty.some((d) => d.attempts > 0) ? (
            <HBars rows={dash.byDifficulty.map((d) => ({ label: d.label, value: d.correctRate, sub: `${fa(d.attempts)} تلاش` }))} suffix="٪" max={100} />
          ) : (
            <Empty>هنوز روی تمرینِ سختی‌دار پاسخی ندادی.</Empty>
          )}
        </Panel>
        <Panel className="lg:col-span-4" title="نقاط قوت من" subtitle="درصد درست در هر موضوع">
          {dash.byTopic.length >= 3 ? (
            <TopicRadar data={dash.byTopic} />
          ) : dash.byTopic.length > 0 ? (
            <HBars rows={dash.byTopic.map((t) => ({ label: t.topic, value: t.correctRate, sub: `${fa(t.attempts)} تلاش` }))} suffix="٪" max={100} />
          ) : (
            <Empty>هنوز روی تمرینِ موضوع‌دار پاسخی ندادی.</Empty>
          )}
        </Panel>
        <Panel className="lg:col-span-4" title="نتیجه‌ی کوییزها" flush>
          {dash.quizzes.length === 0 ? (
            <Empty>هنوز توی کوییزی شرکت نکردی.</Empty>
          ) : (
            <ul className="divide-y divide-line/70">
              {dash.quizzes.map((q, i) => (
                <li key={i} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-sm font-bold truncate">{q.title}</span>
                    <b className="text-sm tabular-nums">{fa(q.pct)}٪</b>
                  </div>
                  <Bar value={q.pct} />
                  <div className="text-[11px] text-muted mt-1 truncate">{q.classTitle}</div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="lg:col-span-7" title="آخرین پاسخ‌های من" flush>
          {dash.recent.length === 0 ? (
            <Empty>هنوز پاسخی نفرستادی.</Empty>
          ) : (
            <ul className="divide-y divide-line/70">
              {dash.recent.map((s, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <Chip tone={toneOf[s.status]}>{STATUS_LABEL[s.status]}</Chip>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold truncate">{s.title}</span>
                    <span className="block text-[11px] text-muted truncate">{s.classTitle}</span>
                  </span>
                  <span className="text-xs font-bold tabular-nums">{fa(s.score)}</span>
                  <span className="text-xs text-muted w-20 text-left">{ago(s.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="lg:col-span-5" title="مسابقه‌هایی که شرکت کردی" flush>
          {dash.competitions.length === 0 ? (
            <Empty>هنوز توی مسابقه‌ای شرکت نکردی.</Empty>
          ) : (
            <ul className="divide-y divide-line/70">
              {dash.competitions.map((c, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="w-8 h-8 rounded-full bg-zinc-100 grid place-items-center text-zinc-600 shrink-0">
                    <CheckCircle2 size={15} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold truncate">{c.title}</span>
                    <span className="block text-[11px] text-muted truncate">
                      تیم {c.team} · {c.classTitle}
                    </span>
                  </span>
                  <span className="text-xs text-muted">{ago(c.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
