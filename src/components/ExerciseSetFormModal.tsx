"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";
import { getErrorMessage } from "@/lib/errors";
import { toLocalInput, fromLocalInput } from "@/lib/schedule";
import RichTextHint from "@/components/RichTextHint";
import type { ExerciseSet } from "@/lib/types";
import { Layers, Pencil, X, CalendarClock } from "lucide-react";

/** Create / edit a series. The schedule set here is copied onto every question of the series. */
export default function ExerciseSetFormModal({
  classId,
  set,
  onClose,
  onSaved,
}: {
  classId: string;
  set?: ExerciseSet | null;
  onClose: () => void;
  onSaved: (saved: ExerciseSet) => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(set?.title || "");
  const [description, setDescription] = useState(set?.description || "");
  const [opensAt, setOpensAt] = useState(toLocalInput(set?.opens_at));
  const [dueAt, setDueAt] = useState(toLocalInput(set?.due_at));
  const [saving, setSaving] = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const save = async () => {
    const t = title.trim();
    if (!t) return toast("نام سری رو وارد کن", "err");
    const opensIso = fromLocalInput(opensAt);
    const dueIso = fromLocalInput(dueAt);
    if (opensIso && dueIso && new Date(dueIso) <= new Date(opensIso)) return toast("زمان پایان باید بعد از زمان شروع باشه", "err");

    setSaving(true);
    try {
      let saved: ExerciseSet;
      if (set) {
        const { data, error } = await supabase
          .from("exercise_sets")
          .update({ title: t, description: description.trim() || null, opens_at: opensIso, due_at: dueIso, updated_at: new Date().toISOString() })
          .eq("id", set.id)
          .select()
          .single();
        if (error) throw error;
        saved = data as ExerciseSet;
        // The DB checks the window on each question, so the series schedule is mirrored onto them.
        if ((set.opens_at ?? null) !== opensIso || (set.due_at ?? null) !== dueIso) {
          const { error: e2 } = await supabase.from("exercises").update({ opens_at: opensIso, due_at: dueIso }).eq("set_id", set.id);
          if (e2) throw e2;
        }
        toast("سری ویرایش شد", "ok");
      } else {
        const { data, error } = await supabase
          .from("exercise_sets")
          .insert({ class_id: classId, title: t, description: description.trim() || null, opens_at: opensIso, due_at: dueIso })
          .select()
          .single();
        if (error) throw error;
        saved = data as ExerciseSet;
        toast("سری ساخته شد؛ حالا سؤال‌هاش رو اضافه کن", "ok");
      }
      onSaved(saved);
    } catch (e) {
      toast("خطا: " + getErrorMessage(e), "err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-sm anim-fade flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl anim-pop w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-extrabold flex items-center gap-2">
            {set ? <Pencil size={17} /> : <Layers size={17} />} {set ? "ویرایش سری" : "سری تمرین جدید"}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={17} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4 flex-1 space-y-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="نام سری (مثلاً: سری اول تمرینات)"
            className="w-full border border-line rounded-lg px-3 py-2 outline-none focus:border-primary"
          />
          <textarea
            ref={descRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="توضیح سری (اختیاری)"
            rows={3}
            className="w-full border border-line rounded-lg px-3 py-2 outline-none focus:border-primary resize-none font-mono text-sm"
            dir="auto"
          />
          <RichTextHint textareaRef={descRef} value={description} onChange={setDescription} />

          <div className="border border-line rounded-lg p-3 space-y-2.5">
            <div className="flex items-center gap-1.5 text-sm font-bold text-muted">
              <CalendarClock size={15} /> بازه‌ی مجاز پاسخ‌دادن به کل سری <span className="text-[11px] font-normal">(اختیاری)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(
                [
                  ["شروع", opensAt, setOpensAt],
                  ["پایان (مهلت تحویل)", dueAt, setDueAt],
                ] as const
              ).map(([label, value, setter]) => (
                <div key={label}>
                  <label className="text-[11px] text-muted block mb-1">{label}</label>
                  <div className="flex gap-1">
                    <input
                      type="datetime-local"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="flex-1 min-w-0 border border-line rounded-lg px-2 py-1.5 text-sm outline-none focus:border-primary"
                    />
                    {value && (
                      <button type="button" onClick={() => setter("")} className="px-2 text-muted hover:text-danger" title="پاک کردن">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted">این بازه روی همه‌ی سؤال‌های سری (حتی سؤال‌هایی که بعداً اضافه می‌کنی) اعمال می‌شه. خالی یعنی همیشه باز.</p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-line flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold border border-line">
            لغو
          </button>
          <button onClick={save} disabled={saving} className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-br from-primary to-primary2 disabled:opacity-50">
            {saving ? "در حال ذخیره…" : "ذخیره"}
          </button>
        </div>
      </div>
    </div>
  );
}
