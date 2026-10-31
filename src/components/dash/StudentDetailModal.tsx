"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import Portal from "@/components/Portal";
import { Avatar, Bar, Chip, Empty, Panel, StatStrip } from "@/components/admin/ui";
import { ActivityChart, StatusDonut } from "@/components/admin/charts";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { ClassStats, Index, STATUS_LABEL, ago, fa, pct, studentClassDetail } from "@/lib/adminStats";

const toneOf = { correct: "ok", partial: "warn", wrong: "bad", error: "neutral", pending: "neutral" } as const;

/**
 * One student's progress inside one class, as a centered dialog.
 * Used from the teacher dashboard (no page change) and from the class insights page.
 */
export default function StudentDetailModal({
  cs,
  ix,
  classId,
  code,
  userId,
  onClose,
}: {
  cs: ClassStats;
  ix: Index;
  classId: string;
  code: string;
  userId: string;
  onClose: () => void;
}) {
  const stu = cs.students.find((s) => s.userId === userId);
  const d = useMemo(() => studentClassDetail(ix, classId, userId), [ix, classId, userId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!stu) return null;
  const quizTaken = d.quizzes.filter((q) => q.pct !== null);
  const quizAvg = quizTaken.length ? Math.round(quizTaken.reduce((a, b) => a + (b.pct || 0), 0) / quizTaken.length) : null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[130] bg-stone-900/55 backdrop-blur-sm anim-fade flex items-center justify-center p-3 sm:p-6"
        onClick={(e) => e.target === e.currentTarget && onClose()}
        role="dialog"
        aria-modal="true"
        aria-label={`پیشرفت ${stu.name}`}
      >
        <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-paper shadow-2xl anim-pop overflow-hidden">
          <div className="hero-panel text-white px-5 sm:px-6 py-4 flex items-center gap-3 shrink-0">
            <Avatar name={stu.name} avatar={stu.avatar} size={48} />
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-lg leading-tight truncate">{stu.name}</h3>
              <div className="text-xs text-white/65 truncate">
                {cs.title} · {stu.teamName ? `تیم ${stu.teamName} · ` : ""}آخرین فعالیت {ago(stu.lastActive)}
              </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 grid place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="بستن">
              <X size={18} />
            </button>
          </div>
          <div className="overflow-y-auto flex-1">
          <div className="p-5 sm:p-6 space-y-5">
          <StatStrip
            cols="xl:grid-cols-3"
            items={[
              { label: "تمرین حل‌شده", value: `${fa(stu.solved)}/${fa(cs.exercises.length)}`, hint: cs.exercises.length ? `${fa(pct(stu.solved, cs.exercises.length))}٪` : undefined },
              { label: "میانگین نمره", value: stu.attempts ? fa(stu.avgScore) : "—" },
              { label: "میانگین کوییز", value: quizAvg === null ? "—" : `${fa(quizAvg)}٪`, hint: `${fa(quizTaken.length)} از ${fa(d.quizzes.length)}` },
              { label: "مسابقه", value: `${fa(d.competitions.filter((c) => c.participated).length)}/${fa(d.competitions.length)}` },
              { label: "سلول کد", value: fa(stu.cells) },
              { label: "نظر نوشته", value: fa(stu.comments) },
            ]}
          />
          <Panel title="فعالیت ۳۰ روز اخیر">
            <ActivityChart data={d.activity} height={200} />
          </Panel>
          <div className="grid sm:grid-cols-2 gap-5">
            <Panel title="نتیجه‌ی پاسخ‌ها">
              <StatusDonut counts={d.statusCounts} />
            </Panel>
            <Panel title="کوییزها" flush>
              {d.quizzes.length === 0 ? (
                <Empty>کوییزی نبوده.</Empty>
              ) : (
                <ul className="divide-y divide-line/70">
                  {d.quizzes.map((q) => (
                    <li key={q.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-sm font-bold truncate">{q.title}</span>
                        {q.pct === null ? <Chip tone="bad">شرکت نکرده</Chip> : <b className="text-sm tabular-nums">{fa(q.pct)}٪</b>}
                      </div>
                      <Bar value={q.pct ?? 0} />
                      {q.pct !== null && q.classAvg > 0 && <div className="text-[11px] text-muted mt-1">میانگین کلاس {fa(q.classAvg)}٪</div>}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
          <Panel title="تمرین‌ها" subtitle="همه‌ی تمرین‌های کلاس، حل‌شده یا نه" flush>
            {d.exercises.length === 0 ? (
              <Empty>تمرینی نیست.</Empty>
            ) : (
              <ul className="divide-y divide-line/70">
                {d.exercises.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    {e.status ? <Chip tone={toneOf[e.status]}>{STATUS_LABEL[e.status]}</Chip> : <Chip>بدون پاسخ</Chip>}
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="font-bold truncate">{e.title}</span>
                        <DifficultyBadge value={e.difficulty} />
                      </span>
                      {e.at && <span className="block text-[11px] text-muted">{ago(e.at)}</span>}
                    </span>
                    <span className="w-24 hidden sm:block">
                      <Bar value={e.score} />
                    </span>
                    <b className="text-xs tabular-nums w-8 text-left">{e.status ? fa(e.score) : "—"}</b>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {d.competitions.length > 0 && (
            <Panel title="مسابقه‌ها" flush>
              <ul className="divide-y divide-line/70">
                {d.competitions.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="flex-1 font-bold truncate">{c.title}</span>
                    {c.participated ? <Chip tone="ok">تیم {c.team} تحویل داد</Chip> : <Chip>شرکت نکرد</Chip>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <div className="flex gap-2 flex-wrap">
            <Link href={`/class/${code}/insights`} className="btn-ghost flex-1 justify-center">
              آمار کامل کلاس
            </Link>
            <Link href={`/class/${code}/students`} className="btn-ghost flex-1 justify-center">
              دیدن کدها و پاسخ‌ها
            </Link>
          </div>
          </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
