"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";
import { Search, UserPlus, X, GraduationCap } from "lucide-react";
import type { ClassTeacher, UserProfile } from "@/lib/types";

export default function CoTeachersModal({
  classId,
  ownerId,
  onClose,
}: {
  classId: string;
  ownerId: string | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [coTeachers, setCoTeachers] = useState<ClassTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("class_teachers").select("*").eq("class_id", classId).order("added_at", { ascending: true });
    setCoTeachers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const search = async () => {
    const q = query.trim();
    if (q.length < 3) return toast("حداقل ۳ کاراکتر از ایمیل رو بنویس", "err");
    setSearching(true);
    const { data, error } = await supabase.from("user_profiles").select("*").ilike("email", `%${q}%`).limit(8);
    setSearching(false);
    if (error) return toast("خطا: " + error.message, "err");
    setResults((data || []).filter((u) => u.user_id !== ownerId && !coTeachers.some((c) => c.user_id === u.user_id)));
  };

  const add = async (u: UserProfile) => {
    const { error } = await supabase.from("class_teachers").insert({
      class_id: classId,
      user_id: u.user_id,
      display_name: u.display_name,
      email: u.email,
      added_by: ownerId,
    });
    if (error) return toast("خطا: " + error.message, "err");
    toast(`${u.display_name} به‌عنوان معلم کلاس اضافه شد`, "ok");
    setResults((r) => r.filter((x) => x.user_id !== u.user_id));
    load();
  };

  const remove = async (ct: ClassTeacher) => {
    if (!confirm(`دسترسی معلمی «${ct.display_name}» به این کلاس حذف بشه؟`)) return;
    const { error } = await supabase.from("class_teachers").delete().eq("class_id", classId).eq("user_id", ct.user_id);
    if (error) return toast("خطا: " + error.message, "err");
    toast("دسترسی حذف شد", "ok");
    load();
  };

  return (
    <div
      className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-sm anim-fade flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl anim-pop w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-extrabold flex items-center gap-2">
            <GraduationCap size={18} /> معلم‌های همکار این کلاس
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={17} />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          <p className="text-xs text-muted">
            فقط شما (سازنده‌ی کلاس) می‌تونی به یه معلم دیگه دسترسی مدیریت این کلاس رو بدی. تا وقتی اینجا اضافه نشده، اون فقط می‌تونه مثل یه دانشجوی عادی وارد کلاس بشه.
          </p>

          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="جستجو با ایمیل…"
              dir="ltr"
              className="flex-1 border border-line rounded-lg px-3 py-2 text-sm text-right outline-none focus:border-primary"
            />
            <button
              onClick={search}
              disabled={searching}
              className="px-3 rounded-lg text-sm font-bold border border-line disabled:opacity-50"
            >
              <Search size={15} />
            </button>
          </div>

          {results.length > 0 && (
            <div className="space-y-1.5">
              {results.map((u) => (
                <div key={u.user_id} className="flex items-center gap-2.5 bg-slate-50 rounded-lg px-3 py-2">
                  <span className="w-8 h-8 rounded-full bg-white border grid place-items-center text-base shrink-0">{u.avatar}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold truncate">{u.display_name}</div>
                    <div className="text-[11px] text-muted truncate" dir="ltr">{u.email}</div>
                  </div>
                  <button
                    onClick={() => add(u)}
                    className="flex items-center gap-1 text-xs font-bold text-primary px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 shrink-0"
                  >
                    <UserPlus size={13} /> افزودن
                  </button>
                </div>
              ))}
            </div>
          )}

          <div>
            <div className="text-xs font-bold text-muted mb-2">معلم‌های فعلی ({coTeachers.length})</div>
            {loading ? (
              <div className="text-xs text-muted">در حال بارگذاری…</div>
            ) : coTeachers.length === 0 ? (
              <div className="text-xs text-muted bg-slate-50 rounded-lg px-3 py-2">هنوز معلم همکاری اضافه نشده.</div>
            ) : (
              <div className="space-y-1.5">
                {coTeachers.map((ct) => (
                  <div key={ct.user_id} className="flex items-center gap-2.5 bg-slate-50 rounded-lg px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold truncate">{ct.display_name}</div>
                      <div className="text-[11px] text-muted truncate" dir="ltr">{ct.email}</div>
                    </div>
                    <button onClick={() => remove(ct)} className="text-danger text-xs font-bold shrink-0">
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
