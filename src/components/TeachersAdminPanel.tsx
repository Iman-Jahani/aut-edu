"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { useAdminData } from "@/components/admin/AdminShell";
import { adminJson, jsonBody } from "@/lib/adminFetch";
import { Ban, CheckCircle2, Copy, KeyRound, Plus, Save, Trash2, UserCog } from "lucide-react";

interface InviteCode {
  id: string;
  code: string;
  role: "teacher" | "manager";
  institution_id: string | null;
  institution_name: string | null;
  new_institution_name: string | null;
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
  institution_id: string | null;
  institution_name: string | null;
  max_classes: number | null;
  max_meetings: number | null;
  classes: number;
  meetings: number;
}

const inputCls = "bg-white border border-line rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-primary";
const NEW = "__new__";
const NONE = "";

function codeStatus(c: InviteCode): { text: string; cls: string } {
  if (c.disabled) return { text: "غیرفعال", cls: "bg-stone-100 text-stone-600" };
  if (c.expires_at && new Date(c.expires_at) <= new Date()) return { text: "منقضی", cls: "bg-amber-50 text-amber-700" };
  if (c.uses >= c.max_uses) return { text: "مصرف‌شده", cls: "bg-stone-100 text-stone-600" };
  return { text: "فعال", cls: "bg-emerald-50 text-emerald-700" };
}

const lim = (v: number | null) => (v === null ? "∞" : String(v));
const errMsg = (e: unknown) => "خطا: " + (e instanceof Error ? e.message : "");

export default function TeachersAdminPanel({ section }: { section: "codes" | "teachers" }) {
  const toast = useToast();
  const { actor, isAdmin, data, reload } = useAdminData();
  const institutions = useMemo(() => data?.institutions || [], [data]);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);

  // create-form state
  const [role, setRole] = useState<"teacher" | "manager">("teacher");
  const [institution, setInstitution] = useState<string>(NONE); // NONE | NEW | institution id
  const [newName, setNewName] = useState("");
  const [note, setNote] = useState("");
  const [count, setCount] = useState("1");
  const [maxUses, setMaxUses] = useState("1");
  const [maxClasses, setMaxClasses] = useState("");
  const [maxMeetings, setMaxMeetings] = useState("");
  const [days, setDays] = useState("");
  const [creating, setCreating] = useState(false);

  // per-teacher edits not yet saved
  const [edits, setEdits] = useState<Record<string, { c: string; m: string; inst: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([adminJson<{ items: InviteCode[] }>("/api/admin/invites"), adminJson<{ items: TeacherRow[] }>("/api/admin/teachers")]);
      setCodes(a.items);
      setTeachers(b.items);
    } catch (e) {
      toast(errMsg(e), "err");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const myInstitution = institutions.find((i) => i.id === actor.institutionId);
  const seatsUsed = actor.institutionId ? (data?.grants || []).filter((g) => g.role === "teacher" && g.institution_id === actor.institutionId).length : 0;
  const makingManagerForNew = isAdmin && role === "manager" && institution === NEW;

  const create = async () => {
    if (makingManagerForNew && !newName.trim()) return toast("اسم موسسه‌ی جدید رو بنویس", "err");
    if (isAdmin && role === "manager" && institution === NONE) return toast("برای کد مدیر، موسسه رو انتخاب کن یا «موسسه‌ی جدید» رو بزن", "err");
    setCreating(true);
    try {
      const d = await adminJson<{ items: InviteCode[] }>(
        "/api/admin/invites",
        { method: "POST", ...jsonBody({
          role: isAdmin ? role : "teacher",
          institution_id: isAdmin && institution && institution !== NEW ? institution : undefined,
          new_institution_name: makingManagerForNew ? newName : undefined,
          note,
          count,
          max_uses: maxUses,
          max_classes: maxClasses,
          max_meetings: maxMeetings,
          expires_in_days: days,
        }) }
      );
      toast(d.items.length > 1 ? `${d.items.length} کد ساخته شد` : `کد ساخته شد: ${d.items[0].code}`, "ok");
      if (d.items.length === 1) navigator.clipboard?.writeText(d.items[0].code).catch(() => undefined);
      setNote("");
      setNewName("");
      await load();
    } catch (e) {
      toast(errMsg(e), "err");
    } finally {
      setCreating(false);
    }
  };

  const toggleCode = async (c: InviteCode) => {
    try {
      await adminJson("/api/admin/invites", { method: "PATCH", ...jsonBody({ id: c.id, disabled: !c.disabled }) });
      setCodes((prev) => prev.map((x) => (x.id === c.id ? { ...x, disabled: !c.disabled } : x)));
    } catch (e) {
      toast(errMsg(e), "err");
    }
  };

  const delCode = async (c: InviteCode) => {
    if (!confirm(`کد ${c.code} حذف شود؟ کسانی که قبلاً باهاش ثبت‌نام کردن همچنان حسابشون رو دارن.`)) return;
    try {
      await adminJson(`/api/admin/invites?id=${c.id}`, { method: "DELETE" });
      setCodes((prev) => prev.filter((x) => x.id !== c.id));
    } catch (e) {
      toast(errMsg(e), "err");
    }
  };

  const baseEdit = (t: TeacherRow) => ({ c: t.max_classes === null ? "" : String(t.max_classes), m: t.max_meetings === null ? "" : String(t.max_meetings), inst: t.institution_id || NONE });
  const setEdit = (t: TeacherRow, patch: Partial<{ c: string; m: string; inst: string }>) =>
    setEdits((prev) => ({ ...prev, [t.user_id]: { ...(prev[t.user_id] || baseEdit(t)), ...patch } }));

  const saveTeacher = async (t: TeacherRow) => {
    const e = edits[t.user_id];
    if (!e) return;
    try {
      await adminJson("/api/admin/teachers", {
        method: "PATCH",
        ...jsonBody({ user_id: t.user_id, max_classes: e.c, max_meetings: e.m, ...(isAdmin ? { institution_id: e.inst || null } : {}) }),
      });
      toast("ذخیره شد", "ok");
      setEdits((prev) => {
        const next = { ...prev };
        delete next[t.user_id];
        return next;
      });
      await Promise.all([load(), reload()]);
    } catch (err) {
      toast(errMsg(err), "err");
    }
  };

  return (
    <div className="space-y-6">
      {section === "codes" && (
        <>
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-stone-600">
              <Plus size={13} /> ساخت کد معرف جدید
            </div>
            <div className="bg-stone-50 rounded-xl p-3 space-y-2.5">
              {isAdmin ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Field label="این کد چه نقشی می‌ده؟">
                    <select value={role} onChange={(e) => { setRole(e.target.value as "teacher" | "manager"); setInstitution(NONE); }} className={inputCls + " w-full"}>
                      <option value="teacher">معلم</option>
                      <option value="manager">مدیر موسسه</option>
                    </select>
                  </Field>
                  <Field label={role === "manager" ? "موسسه" : "موسسه (اختیاری)"}>
                    <select value={institution} onChange={(e) => setInstitution(e.target.value)} className={inputCls + " w-full"}>
                      {role === "teacher" ? <option value={NONE}>بدون موسسه (معلم مستقل)</option> : <option value={NONE}>انتخاب کن…</option>}
                      {role === "manager" && <option value={NEW}>+ موسسه‌ی جدید</option>}
                      {institutions.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {makingManagerForNew && (
                    <div className="sm:col-span-2">
                      <Field label="اسم موسسه‌ی جدید (موقع ثبت‌نام مدیر ساخته می‌شه)">
                        <input value={newName} onChange={(e) => setNewName(e.target.value)} dir="auto" placeholder="مثلاً دبیرستان البرز" className={inputCls + " w-full"} />
                      </Field>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-stone-600 leading-6">
                  کد معلم برای <b className="text-ink">{actor.institutionName}</b>
                  {myInstitution?.max_teachers != null && (
                    <>
                      {" "}
                      — ظرفیت معلم‌ها: <b className="text-ink">{seatsUsed.toLocaleString("fa-IR")}</b> از <b className="text-ink">{myInstitution.max_teachers.toLocaleString("fa-IR")}</b>
                    </>
                  )}
                </div>
              )}

              <div className={`grid grid-cols-2 ${role === "manager" && isAdmin ? "sm:grid-cols-3" : "sm:grid-cols-5"} gap-2.5`}>
                <Field label="تعداد کد">
                  <input value={makingManagerForNew ? "1" : count} disabled={makingManagerForNew} onChange={(e) => setCount(e.target.value)} inputMode="numeric" className={inputCls + " w-full disabled:opacity-50"} />
                </Field>
                <Field label="ظرفیت هر کد (نفر)">
                  <input value={makingManagerForNew ? "1" : maxUses} disabled={makingManagerForNew} onChange={(e) => setMaxUses(e.target.value)} inputMode="numeric" className={inputCls + " w-full disabled:opacity-50"} />
                </Field>
                {!(isAdmin && role === "manager") && (
                  <>
                    <Field label="سقف کلاس (خالی = نامحدود)">
                      <input value={maxClasses} onChange={(e) => setMaxClasses(e.target.value)} inputMode="numeric" placeholder="∞" className={inputCls + " w-full"} />
                    </Field>
                    <Field label="سقف جلسه (خالی = نامحدود)">
                      <input value={maxMeetings} onChange={(e) => setMaxMeetings(e.target.value)} inputMode="numeric" placeholder="∞" className={inputCls + " w-full"} />
                    </Field>
                  </>
                )}
                <Field label="اعتبار (روز، خالی = دائمی)">
                  <input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" placeholder="∞" className={inputCls + " w-full"} />
                </Field>
              </div>
              <div className="flex gap-2.5 flex-wrap">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="یادداشت (مثلا اسم معلم یا گروه) — اختیاری" dir="auto" className={inputCls + " flex-1 min-w-[200px]"} />
                <button onClick={create} disabled={creating} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold text-white bg-primary disabled:opacity-50">
                  <KeyRound size={14} /> {creating ? "در حال ساخت…" : "بساز"}
                </button>
              </div>
              <p className="text-[11px] text-muted leading-6">
                سقف‌ها موقع ثبت‌نام روی حساب معلم ثبت می‌شن و بعداً از تب «معلم‌ها» قابل تغییرن.
                {!isAdmin && " برای گروهی از معلم‌ها بهتره یه کد چندنفره با تاریخ انقضا بسازی؛ برای یک نفر، کد تک‌نفره."}
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-stone-600">
              <KeyRound size={13} /> کدها <span className="text-muted">({codes.length})</span>
            </div>
            {loading && !codes.length ? (
              <div className="text-xs text-muted py-4 text-center">در حال بارگذاری…</div>
            ) : codes.length === 0 ? (
              <div className="text-xs text-muted bg-stone-50 rounded-lg px-3 py-2">هنوز کدی نساخته‌ای. بدون کد معرف هیچ‌کس نمی‌تونه حساب معلم یا مدیر بسازه.</div>
            ) : (
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
                {codes.map((c) => {
                  const st = codeStatus(c);
                  const where = c.institution_name || c.new_institution_name;
                  return (
                    <div key={c.id} className="bg-stone-50 rounded-lg px-3 py-2 text-xs">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(c.code);
                            toast("کپی شد", "ok");
                          }}
                          title="کپی"
                          className="inline-flex items-center gap-1 font-mono tracking-widest text-sm text-ink bg-white border border-line px-2 py-0.5 rounded hover:border-primary"
                        >
                          {c.code} <Copy size={11} />
                        </button>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.role === "manager" ? "bg-primary text-white" : "bg-stone-200 text-stone-700"}`}>{c.role === "manager" ? "مدیر" : "معلم"}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.text}</span>
                        <span className="text-muted">
                          {c.uses}/{c.max_uses} استفاده
                        </span>
                        {c.role === "teacher" && (
                          <span className="text-muted">
                            کلاس {lim(c.max_classes)} · جلسه {lim(c.max_meetings)}
                          </span>
                        )}
                        <span className="text-stone-600">{where ? (c.institution_name ? `موسسه: ${where}` : `موسسه‌ی جدید: ${where}`) : "بدون موسسه"}</span>
                        {c.expires_at && <span className="text-muted">تا {new Date(c.expires_at).toLocaleDateString("fa-IR")}</span>}
                        {c.note && (
                          <span dir="auto" className="text-stone-600 truncate max-w-[200px]">
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
        </>
      )}

      {section === "teachers" && (
        <div>
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-stone-600">
            <UserCog size={13} /> {isAdmin ? "همه‌ی معلم‌ها" : "معلم‌های موسسه"} <span className="text-muted">({teachers.length})</span>
          </div>
          {loading && !teachers.length ? (
            <div className="text-xs text-muted py-4 text-center">در حال بارگذاری…</div>
          ) : teachers.length === 0 ? (
            <div className="text-xs text-muted bg-stone-50 rounded-lg px-3 py-2">{isAdmin ? "هنوز معلمی نیست." : "هنوز معلمی با کد معرف موسسه‌ی تو ثبت‌نام نکرده. از تب «کدهای معرف» یه کد بساز و برای معلم‌ها بفرست."}</div>
          ) : (
            <div className="space-y-1.5 max-h-[520px] overflow-y-auto">
              {teachers.map((t) => {
                const e = edits[t.user_id];
                const cur = e || baseEdit(t);
                const overC = t.max_classes !== null && t.classes >= t.max_classes;
                const overM = t.max_meetings !== null && t.meetings >= t.max_meetings;
                return (
                  <div key={t.user_id} className="flex items-center gap-2.5 bg-stone-50 rounded-lg px-3 py-2 text-xs flex-wrap">
                    <span className="text-base">{t.avatar || "🙂"}</span>
                    <div className="min-w-0 flex-1 basis-40">
                      <div className="font-bold truncate">{t.display_name}</div>
                      <div className="text-muted truncate" dir="ltr">
                        {t.email || "—"}
                      </div>
                    </div>
                    {isAdmin && (
                      <select value={cur.inst} onChange={(ev) => setEdit(t, { inst: ev.target.value })} className={inputCls + " !py-1 max-w-[160px]"}>
                        <option value={NONE}>بدون موسسه</option>
                        {institutions.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <label className="flex items-center gap-1.5 text-muted">
                      کلاس
                      <input value={cur.c} onChange={(ev) => setEdit(t, { c: ev.target.value })} inputMode="numeric" placeholder="∞" className={inputCls + " w-16 text-center !py-1"} />
                      <span className={overC ? "text-amber-600 font-bold" : ""}>(الان {t.classes})</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-muted">
                      جلسه
                      <input value={cur.m} onChange={(ev) => setEdit(t, { m: ev.target.value })} inputMode="numeric" placeholder="∞" className={inputCls + " w-16 text-center !py-1"} />
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
          <p className="text-[11px] text-muted mt-2 leading-6">
            خالی گذاشتن یعنی نامحدود. سقف جلسه کل جلسه‌های همه‌ی کلاس‌های اون معلمه. کاهش سقف زیر تعداد فعلی چیزی رو حذف نمی‌کنه، فقط ساخت جدید رو می‌بنده.
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
