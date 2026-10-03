"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";
import { useClassAccess } from "@/hooks/useClassAccess";
import ClassChrome from "@/components/ClassChrome";
import { ClassPageSkeleton } from "@/components/Skeleton";
import { CalendarDays, Plus, Users, Code2, ArrowLeft, Search, X } from "lucide-react";
import type { ClassMeeting, Cell } from "@/lib/types";

export default function ClassHomePage({ params }: { params: { code: string } }) {
  const access = useClassAccess(params.code);
  const { ready, session, notFound, isTeacher } = access;
  const toast = useToast();

  const [meetings, setMeetings] = useState<ClassMeeting[] | null>(null);
  const [stats, setStats] = useState<Record<string, { cells: number; people: number }>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from("class_meetings").select("*").eq("class_id", session.id).order("created_at", { ascending: false });
    const list = data || [];
    setMeetings(list);
    if (list.length) {
      const { data: cells } = await supabase.from("cells").select("meeting_id, author_name").eq("class_id", session.id);
      const map: Record<string, { cells: number; people: Set<string> }> = {};
      (cells || []).forEach((c: Pick<Cell, "meeting_id" | "author_name">) => {
        if (!c.meeting_id) return;
        if (!map[c.meeting_id]) map[c.meeting_id] = { cells: 0, people: new Set() };
        map[c.meeting_id].cells++;
        if (c.author_name) map[c.meeting_id].people.add(c.author_name);
      });
      const flat: Record<string, { cells: number; people: number }> = {};
      Object.entries(map).forEach(([k, v]) => (flat[k] = { cells: v.cells, people: v.people.size }));
      setStats(flat);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const createMeeting = async () => {
    const t = title.trim();
    if (!t) return toast("عنوان جلسه رو وارد کن", "err");
    if (!session) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("class_meetings")
      .insert({ class_id: session.id, title: t, created_by: access.user?.id })
      .select()
      .single();
    setCreating(false);
    if (error || !data) return toast("خطا: " + (error?.message || ""), "err");
    toast("جلسه ساخته شد", "ok");
    setFormOpen(false);
    setTitle("");
    setMeetings((prev) => [data, ...(prev || [])]);
  };

  if (notFound) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div className="card p-10 max-w-sm anim-pop">
          <Search size={44} className="mx-auto mb-3 text-primary/40" />
          <h1 className="font-extrabold text-lg mb-2">کلاسی با این کد پیدا نشد</h1>
          <p className="text-sm text-muted mb-5">کد رو دوباره چک کن یا از معلمت بپرس.</p>
          <Link href="/dashboard" className="btn-primary">
            بازگشت به داشبورد
          </Link>
        </div>
      </div>
    );
  }

  if (!ready || !session) return <ClassPageSkeleton />;

  return (
    <ClassChrome access={access}>
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-extrabold text-lg flex items-center gap-2">
              <CalendarDays size={19} className="text-primary" /> جلسات کلاس
            </h2>
            <p className="text-xs text-muted mt-0.5">{meetings?.length ?? 0} جلسه</p>
          </div>
          {isTeacher && (
            <button onClick={() => setFormOpen(true)} className="btn-primary">
              <Plus size={15} /> جلسه‌ی جدید
            </button>
          )}
        </div>

        {meetings === null ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card h-24 animate-pulse bg-slate-100/70" />
            ))}
          </div>
        ) : meetings.length === 0 ? (
          <div className="card text-center py-16 px-6 anim-pop">
            <CalendarDays size={44} className="mx-auto mb-3 text-primary/40" />
            <h3 className="font-extrabold mb-1">{isTeacher ? "هنوز جلسه‌ای نساختی" : "هنوز جلسه‌ای شروع نشده"}</h3>
            <p className="text-sm text-muted mb-5">
              {isTeacher ? "یه جلسه بساز تا دانشجوها بتونن توش کد بنویسن." : "وقتی معلم جلسه‌ای بسازه، اینجا می‌بینیش."}
            </p>
            {isTeacher && (
              <button onClick={() => setFormOpen(true)} className="btn-primary mx-auto">
                <Plus size={15} /> جلسه‌ی جدید
              </button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {meetings.map((m) => {
              const st = stats[m.id] || { cells: 0, people: 0 };
              return (
                <Link
                  key={m.id}
                  href={`/class/${session.code}/${m.id}`}
                  className="card p-4 flex items-center gap-3 hover:shadow-lift hover:-translate-y-0.5 transition group"
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 grid place-items-center text-primary shrink-0">
                    <CalendarDays size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm truncate">{m.title}</div>
                    <div className="flex items-center gap-3 text-[11px] text-muted mt-1">
                      <span>{new Date(m.created_at).toLocaleDateString("fa-IR")}</span>
                      <span className="flex items-center gap-1">
                        <Code2 size={11} /> {st.cells}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={11} /> {st.people}
                      </span>
                    </div>
                  </div>
                  <ArrowLeft size={16} className="text-muted group-hover:text-primary group-hover:-translate-x-0.5 transition shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {formOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm anim-fade flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setFormOpen(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl anim-pop w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold flex items-center gap-2">
                <CalendarDays size={18} /> جلسه‌ی جدید
              </h2>
              <button onClick={() => setFormOpen(false)} className="text-muted hover:text-ink">
                <X size={17} />
              </button>
            </div>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createMeeting()}
              placeholder="عنوان جلسه (مثلاً: جلسه ۳ - حلقه‌ها)"
              className="w-full border border-line rounded-xl px-4 py-2.5 mb-4 outline-none focus:border-primary"
            />
            <button onClick={createMeeting} disabled={creating} className="btn-primary w-full !py-3">
              {creating ? "در حال ساخت…" : "ساخت جلسه"}
            </button>
          </div>
        </div>
      )}
    </ClassChrome>
  );
}
