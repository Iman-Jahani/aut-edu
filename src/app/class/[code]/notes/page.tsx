"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "@/components/ToastProvider";
import { useClassAccess } from "@/hooks/useClassAccess";
import ClassChrome from "@/components/ClassChrome";
import { ClassPageSkeleton, MeetingCardSkeleton } from "@/components/Skeleton";
import { FileText, Plus, ArrowLeft, Search, X, Pencil, Trash2 } from "lucide-react";
import type { ClassNote } from "@/lib/types";

export default function NotesListPage({ params }: { params: { code: string } }) {
  const access = useClassAccess(params.code);
  const { ready, session, notFound, teacherMode, user } = access;
  const toast = useToast();

  const [notes, setNotes] = useState<ClassNote[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClassNote | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from("class_notes").select("*").eq("class_id", session.id).order("created_at", { ascending: true });
    setNotes((data || []) as ClassNote[]);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const openForm = (n: ClassNote | null) => {
    setEditing(n);
    setTitle(n?.title || "");
    setFormOpen(true);
  };

  const submit = async () => {
    const t = title.trim();
    if (!t) return toast("عنوان جزوه رو وارد کن", "err");
    if (!session || !user) return;
    setSaving(true);
    const res = editing
      ? await supabase.from("class_notes").update({ title: t }).eq("id", editing.id).select().single()
      : await supabase.from("class_notes").insert({ class_id: session.id, title: t, created_by: user.id }).select().single();
    setSaving(false);
    if (res.error || !res.data) return toast("خطا: " + getErrorMessage(res.error), "err");
    toast(editing ? "عنوان تغییر کرد" : "جزوه ساخته شد", "ok");
    setFormOpen(false);
    load();
  };

  const remove = async (n: ClassNote) => {
    if (!confirm(`جزوه‌ی «${n.title}» با همه‌ی محتواش حذف شود؟`)) return;
    // PDFs live in storage; remove them too (rows cascade with the note).
    const { data: files } = await supabase.from("material_files").select("storage_path").eq("note_id", n.id);
    const { error } = await supabase.from("class_notes").delete().eq("id", n.id);
    if (error) return toast("خطا: " + error.message, "err");
    if (files?.length) await supabase.storage.from("materials").remove(files.map((f) => f.storage_path));
    setNotes((p) => (p || []).filter((x) => x.id !== n.id));
  };

  if (notFound) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div className="card p-10 max-w-sm anim-pop">
          <Search size={44} className="mx-auto mb-3 text-primary/40" />
          <h1 className="font-extrabold text-lg mb-2">کلاسی با این کد پیدا نشد</h1>
          <Link href="/dashboard" className="btn-primary">
            بازگشت به داشبورد
          </Link>
        </div>
      </div>
    );
  }
  if (!ready || !session) return <ClassPageSkeleton variant="meetings" />;

  return (
    <ClassChrome access={access} section="notes">
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-extrabold text-lg flex items-center gap-2">
              <FileText size={19} className="text-primary" /> جزوه‌های کلاس
            </h2>
            <p className="text-xs text-muted mt-0.5">{notes?.length ?? 0} جزوه</p>
          </div>
          {teacherMode && (
            <button onClick={() => openForm(null)} className="btn-primary">
              <Plus size={15} /> جزوه‌ی جدید
            </button>
          )}
        </div>

        {notes === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <MeetingCardSkeleton key={i} />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="card text-center py-16 px-6 anim-pop">
            <FileText size={44} className="mx-auto mb-3 text-primary/40" />
            <h3 className="font-extrabold mb-1">{teacherMode ? "هنوز جزوه‌ای نساختی" : "هنوز جزوه‌ای گذاشته نشده"}</h3>
            <p className="text-sm text-muted mb-5">
              {teacherMode ? "برای هر فصل یا موضوع یه جزوه بساز و فایل ipynb یا PDF توش آپلود کن." : "وقتی معلم جزوه‌ای بذاره، اینجا می‌بینیش."}
            </p>
            {teacherMode && (
              <button onClick={() => openForm(null)} className="btn-primary mx-auto">
                <Plus size={15} /> جزوه‌ی جدید
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {notes.map((n) => (
              <div key={n.id} className="card p-4 flex items-center gap-3 hover:shadow-lift transition group">
                <Link href={`/class/${session.code}/notes/${n.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 grid place-items-center text-primary shrink-0">
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm truncate">{n.title}</div>
                    <div className="text-[11px] text-muted mt-1">{new Date(n.created_at).toLocaleDateString("fa-IR")}</div>
                  </div>
                </Link>
                {teacherMode ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openForm(n)} title="تغییر عنوان" className="p-1.5 rounded-lg border border-line bg-white">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => remove(n)} title="حذف" className="p-1.5 rounded-lg border border-red-200 bg-white text-danger">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <ArrowLeft size={16} className="text-muted shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {formOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm anim-fade flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setFormOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl anim-pop w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold flex items-center gap-2">
                <FileText size={18} /> {editing ? "تغییر عنوان جزوه" : "جزوه‌ی جدید"}
              </h2>
              <button onClick={() => setFormOpen(false)} className="text-muted hover:text-ink">
                <X size={17} />
              </button>
            </div>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="عنوان جزوه (مثلاً: فصل ۲ - حلقه‌ها)"
              className="w-full border border-line rounded-xl px-4 py-2.5 mb-4 outline-none focus:border-primary"
            />
            <button onClick={submit} disabled={saving} className="btn-primary w-full !py-3">
              {saving ? "در حال ذخیره…" : editing ? "ذخیره" : "ساخت جزوه"}
            </button>
          </div>
        </div>
      )}
    </ClassChrome>
  );
}
