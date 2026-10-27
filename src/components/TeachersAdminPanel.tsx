"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { ChevronDown, Copy, KeyRound, Plus, Trash2, Ban, CheckCircle2, Save, UserCog } from "lucide-react";

interface InviteCode {
  id: string;
  code: string;
  note: string | null;
  max_uses: number;
  uses: number;
  max_classes: number | null;
  max_meetings: number | null;
  expires_at: string | null;
  disabled: boolean;
  created_at: string;
  used_by: { user_id: string; name: string; email: string | null; used_at: string }[];
}

interface TeacherRow {
  user_id: string;
  display_name: string;
  email: string | null;
  avatar: string | null;
  max_classes: number | null;
  max_meetings: number | null;
  classes: number;
  meetings: number;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || "خطا");
  return d as T;
}

const inputCls = "bg-white border border-line rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-primary";

function codeStatus(c: InviteCode): { text: string; cls: string } {
  if (c.disabled) return { text: "غیرفعال", cls: "bg-zinc-100 text-zinc-600" };
  if (c.expires_at && new Date(c.expires_at) <= new Date()) return { text: "منقضی", cls: "bg-amber-50 text-amber-700" };
  if (c.uses >= c.max_uses) return { text: "مصرف‌شده", cls: "bg-zinc-100 text-zinc-600" };
  return { text: "فعال", cls: "bg-emerald-50 text-emerald-700" };
}

const lim = (v: number | null) => (v === null ? "∞" : String(v));

export default function TeachersAdminPanel({ section }: { section: "codes" | "teachers" }) {
  const toast = useToast();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);

  // create-form state
  const [note, setNote] = useState("");
  const [count, setCount] = useState("1");
  const [maxUses, setMaxUses] = useState("1");
  const [maxClasses, setMaxClasses] = useState("");
  const [maxMeetings, setMaxMeetings] = useState("");
  const [days, setDays] = useState("");
  const [creating, setCreating] = useState(false);

  // per-teacher edits not yet saved
  const [edits, setEdits] = useState<Record<string, { c: string; m: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([api<{ items: InviteCode[] }>("/api/admin/invites"), api<{ items: TeacherRow[] }>("/api/admin/teachers")]);
      setCodes(a.items);
      setTeachers(b.items);
    } catch (e) {
      toast("خطا: " + (e instanceof Error ? e.message : ""), "err");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setCreating(true);
    try {
      const d = await api<{ items: InviteCode[] }>("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, count, max_uses: maxUses, max_classes: maxClasses, max_meetings: maxMeetings, expires_in_days: days }),
      });
      toast(d.items.length > 1 ? `${d.items.length} کد ساخته شد` : `کد ساخته شد: ${d.items[0].code}`, "ok");
      if (d.items.length === 1) navigator.clipboard?.writeText(d.items[0].code).catch(() => undefined);
      setNote("");
      await load();
    } catch (e) {
      toast("خطا: " + (e instanceof Error ? e.message : ""), "err");
    } finally {
      setCreating(false);
    }
  };

  const toggleCode = async (c: InviteCode) => {
    try {
      await api("/api/admin/invites", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, disabled: !c.disabled }) });
      setCodes((prev) => prev.map((x) => (x.id === c.id ? { ...x, disabled: !c.disabled } : x)));
    } catch (e) {
      toast("خطا: " + (e instanceof Error ? e.message : ""), "err");
    }
  };

  const delCode = async (c: InviteCode) => {
    if (!confirm(`کد ${c.code} حذف شود؟ معلم‌هایی که قبلاً باهاش ثبت‌نام کردن همچنان حسابشون رو دارن.`)) return;
    try {
      await api(`/api/admin/invites?id=${c.id}`, { method: "DELETE" });
      setCodes((prev) => prev.filter((x) => x.id !== c.id));
    } catch (e) {
      toast("خطا: " + (e instanceof Error ? e.message : ""), "err");
    }
  };

  const saveTeacher = async (t: TeacherRow) => {
    const e = edits[t.user_id];
    if (!e) return;
    try {
      await api("/api/admin/teachers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: t.user_id, max_classes: e.c, max_meetings: e.m }),
      });
      toast("سقف‌ها ذخیره شد", "ok");
      setEdits((prev) => {
        const next = { ...prev };
        delete next[t.user_id];
        return next;
      });
      await load();
    } catch (err) {
      toast("خطا: " + (err instanceof Error ? err.message : ""), "err");
    }
  };

  const setEdit = (t: TeacherRow, field: "c" | "m", v: string) =>
    setEdits((prev) => {
      const cur = prev[t.user_id] || { c: t.max_classes === null ? "" : String(t.max_classes), m: t.max_meetings === null ? "" : String(t.max_meetings) };
      return { ...prev, [t.user_id]: { ...cur, [field]: v } };
    });

  return (
    <div className="space-y-6">
          {/* ---- create codes ---- */}
          {section === "codes" && (<>
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-zinc-600">
              <Plus size={13} /> ساخت کد معرف جدید
            </div>
            <div className="bg-zinc-50 rounded-xl p-3 space-y-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <Field label="تعداد کد">
                  <input value={count} onChange={(e) => setCount(e.target.value)} inputMode="numeric" className={inputCls + " w-full"} />
                </Field>
                <Field label="ظرفیت هر کد (نفر)">
                  <input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} inputMode="numeric" className={inputCls + " w-full"} />
                </Field>
                <Field label="سقف کلاس (خالی = نامحدود)">
                  <input value={maxClasses} onChange={(e) => setMaxClasses(e.target.value)} inputMode="numeric" placeholder="∞" className={inputCls + " w-full"} />
                </Field>
                <Field label="سقف جلسه (خالی = نامحدود)">
                  <input value={maxMeetings} onChange={(e) => setMaxMeetings(e.target.value)} inputMode="numeric" placeholder="∞" className={inputCls + " w-full"} />
                </Field>
                <Field label="اعتبار (روز، خالی = دائمی)">
                  <input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" placeholder="∞" className={inputCls + " w-full"} />
                </Field>
              </div>
              <div className="flex gap-2.5 flex-wrap">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="یادداشت (مثلا اسم معلم یا دانشگاه) — اختیاری" dir="auto" className={inputCls + " flex-1 min-w-[200px]"} />
                <button
                  onClick={create}
                  disabled={creating}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold text-white bg-gradient-to-br from-primary to-primary2 disabled:opacity-50"
                >
                  <KeyRound size={14} /> {creating ? "در حال ساخت…" : "بساز"}
                </button>
              </div>
              <p className="text-[11px] text-muted">سقف‌ها موقع ثبت‌نام روی حساب معلم ثبت میشن و بعداً از جدول پایین قابل تغییرن.</p>
            </div>
          </div>

          {/* ---- codes ---- */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-zinc-600">
              <KeyRound size={13} /> کدها <span className="text-muted">({codes.length})</span>
            </div>
            {loading && !codes.length ? (
              <div className="text-xs text-muted py-4 text-center">در حال بارگذاری…</div>
            ) : codes.length === 0 ? (
              <div className="text-xs text-muted bg-zinc-50 rounded-lg px-3 py-2">هنوز کدی نساختی. بدون کد معرف هیچ‌کس نمی‌تونه حساب معلم بسازه.</div>
            ) : (
              <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
                {codes.map((c) => {
                  const st = codeStatus(c);
                  return (
                    <div key={c.id} className="bg-zinc-50 rounded-lg px-3 py-2 text-xs">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(c.code);
                            toast("کپی شد", "ok");
                          }}
                          title="کپی"
                          className="inline-flex items-center gap-1 font-mono tracking-widest text-sm text-ink bg-zinc-100 px-2 py-0.5 rounded hover:bg-zinc-200"
                        >
                          {c.code} <Copy size={11} />
                        </button>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.text}</span>
                        <span className="text-muted">
                          {c.uses}/{c.max_uses} استفاده
                        </span>
                        <span className="text-muted">
                          کلاس {lim(c.max_classes)} · جلسه {lim(c.max_meetings)}
                        </span>
                        {c.expires_at && <span className="text-muted">تا {new Date(c.expires_at).toLocaleDateString("fa-IR")}</span>}
                        {c.note && (
                          <span dir="auto" className="text-zinc-600 truncate max-w-[200px]">
                            {c.note}
                          </span>
                        )}
                        <span className="mr-auto flex items-center gap-2">
                          <button onClick={() => toggleCode(c)} title={c.disabled ? "فعال‌سازی" : "غیرفعال‌سازی"} className="text-muted hover:text-ink">
                            {c.disabled ? <CheckCircle2 size={14} /> : <Ban size={14} />}
                          </button>
                          <button onClick={() => delCode(c)} title="حذف" className="text-danger hover:opacity-70">
                            <Trash2 size={14} />
                          </button>
                        </span>
                      </div>
                      {c.used_by.length > 0 && (
                        <div className="mt-1.5 text-[11px] text-muted">
                          استفاده‌شده توسط:{" "}
                          {c.used_by.map((u) => (
                            <span key={u.user_id} className="inline-block ml-2">
                              {u.name}
                              {u.email ? ` (${u.email})` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          </>)}

          {/* ---- teachers ---- */}
          {section === "teachers" && (
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-zinc-600">
              <UserCog size={13} /> معلم‌ها و سقف مجاز <span className="text-muted">({teachers.length})</span>
            </div>
            {teachers.length === 0 ? (
              <div className="text-xs text-muted bg-zinc-50 rounded-lg px-3 py-2">هنوز معلمی نیست.</div>
            ) : (
              <div className="space-y-1.5 max-h-[360px] overflow-y-auto">
                {teachers.map((t) => {
                  const e = edits[t.user_id];
                  const cVal = e ? e.c : t.max_classes === null ? "" : String(t.max_classes);
                  const mVal = e ? e.m : t.max_meetings === null ? "" : String(t.max_meetings);
                  const overC = t.max_classes !== null && t.classes >= t.max_classes;
                  const overM = t.max_meetings !== null && t.meetings >= t.max_meetings;
                  return (
                    <div key={t.user_id} className="flex items-center gap-2.5 bg-zinc-50 rounded-lg px-3 py-2 text-xs flex-wrap">
                      <span className="text-base">{t.avatar || "🙂"}</span>
                      <div className="min-w-0 flex-1 basis-40">
                        <div className="font-bold truncate">{t.display_name}</div>
                        <div className="text-muted truncate" dir="ltr">
                          {t.email || "—"}
                        </div>
                      </div>
                      <label className="flex items-center gap-1.5 text-muted">
                        کلاس
                        <input
                          value={cVal}
                          onChange={(ev) => setEdit(t, "c", ev.target.value)}
                          inputMode="numeric"
                          placeholder="∞"
                          className={inputCls + " w-16 text-center !py-1"}
                        />
                        <span className={overC ? "text-amber-600 font-bold" : ""}>(الان {t.classes})</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-muted">
                        جلسه
                        <input
                          value={mVal}
                          onChange={(ev) => setEdit(t, "m", ev.target.value)}
                          inputMode="numeric"
                          placeholder="∞"
                          className={inputCls + " w-16 text-center !py-1"}
                        />
                        <span className={overM ? "text-amber-600 font-bold" : ""}>(الان {t.meetings})</span>
                      </label>
                      <button
                        onClick={() => saveTeacher(t)}
                        disabled={!e}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold text-white bg-primary hover:opacity-85 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Save size={12} /> ذخیره
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-muted mt-2">
              خالی گذاشتن یعنی نامحدود. سقف جلسه کل جلسه‌های همه‌ی کلاس‌های اون معلمه (جلسه‌هایی که همکار-معلم می‌سازه هم از سهم صاحب کلاس کم میشه). کاهش سقف زیر تعداد فعلی چیزی رو حذف نمی‌کنه، فقط ساخت جدید رو می‌بنده.
            </p>
          </div>
          )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted block mb-1">{label}</span>
      {children}
    </label>
  );
}
