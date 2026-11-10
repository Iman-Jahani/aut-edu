"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ToastProvider";
import MaterialCell from "@/components/MaterialCell";
import { CellSkeleton } from "@/components/Skeleton";
import { parseNotebookFull } from "@/lib/ipynb";
import { getErrorMessage } from "@/lib/errors";
import { Code2, FileText, Upload, FileUp, Trash2, ExternalLink, Presentation, BookOpen, Lock } from "lucide-react";
import type { MaterialCell as MCell, MaterialFile, MaterialKind } from "@/lib/types";

const MAX_PDF_BYTES = 25 * 1024 * 1024;

const COPY: Record<MaterialKind, { title: string; studentHint: string; teacherHint: string; emptyStudent: string; emptyTeacher: string }> = {
  notes: {
    title: "جزوه",
    studentHint: "جزوه‌ی این جلسه از طرف معلم. می‌تونی کدها رو اجرا کنی؛ تغییرها و خروجی اجرای تو ذخیره نمی‌شه.",
    teacherHint: "فقط تو می‌تونی این بخش رو تغییر بدی. فایل ipynb یا PDF آپلود کن، یا سلول بساز. خروجی‌ای که تو اجرا می‌کنی برای همه ذخیره می‌شه.",
    emptyStudent: "معلم هنوز جزوه‌ای برای این جلسه نذاشته.",
    emptyTeacher: "هنوز چیزی نذاشتی. یه ipynb/PDF آپلود کن یا سلول جدید بساز.",
  },
  board: {
    title: "تخته کلاس",
    studentHint: "تخته‌ی کلاس: فقط معلم می‌نویسه و تو می‌بینی. می‌تونی کدها رو اجرا کنی ولی چیزی ذخیره نمی‌شه.",
    teacherHint: "تخته مخصوص توئه؛ می‌تونی سر کلاس کد بزنی یا از قبل یه ipynb آپلود کنی. دانشجوها فقط می‌بینن و اجرا می‌کنن.",
    emptyStudent: "تخته هنوز خالیه.",
    emptyTeacher: "تخته خالیه. سر کلاس سلول بساز یا از قبل یه ipynb آپلود کن.",
  },
};

export default function MaterialSection({
  kind,
  classId,
  meetingId,
  teacherMode,
}: {
  kind: MaterialKind;
  classId: string;
  meetingId: string;
  /** True only for the class's teacher/co-teacher who is NOT previewing as a student. */
  teacherMode: boolean;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const copy = COPY[kind];
  const [cells, setCells] = useState<MCell[]>([]);
  const [files, setFiles] = useState<MaterialFile[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const ipynbRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    const [c, f] = await Promise.all([
      supabase.from("material_cells").select("*").eq("meeting_id", meetingId).eq("kind", kind).order("position", { ascending: true }),
      supabase.from("material_files").select("*").eq("meeting_id", meetingId).eq("kind", kind).order("created_at", { ascending: true }),
    ]);
    if (c.error) toast("خطا: " + c.error.message, "err");
    else setCells((c.data || []) as MCell[]);
    if (!f.error) {
      const list = (f.data || []) as MaterialFile[];
      setFiles(list);
      const missing = list.filter((x) => !urls[x.id]);
      if (missing.length) {
        const signed = await supabase.storage.from("materials").createSignedUrls(missing.map((x) => x.storage_path), 60 * 60 * 6);
        if (signed.data) {
          setUrls((prev) => {
            const next = { ...prev };
            signed.data!.forEach((s, i) => {
              if (s.signedUrl) next[missing[i].id] = s.signedUrl;
            });
            return next;
          });
        }
      }
    }
    loadedOnce.current = true;
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, kind, toast]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Live updates (needs Realtime on the tables) + a slow poll as a fallback for students.
  useEffect(() => {
    const ch = supabase
      .channel(`material-${kind}-${meetingId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "material_cells", filter: `meeting_id=eq.${meetingId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "material_files", filter: `meeting_id=eq.${meetingId}` }, () => load())
      .subscribe();
    const poll = teacherMode ? null : setInterval(load, 20000);
    return () => {
      supabase.removeChannel(ch);
      if (poll) clearInterval(poll);
    };
  }, [kind, meetingId, load, teacherMode]);

  const nextPosition = () => (cells.length ? Math.max(...cells.map((c) => c.position)) + 1000 : 1000);

  const addCell = async (type: "code" | "markdown") => {
    if (!teacherMode || !user) return;
    const { data, error } = await supabase
      .from("material_cells")
      .insert({ class_id: classId, meeting_id: meetingId, kind, cell_type: type, source: "", output: "", position: nextPosition(), created_by: user.id })
      .select()
      .single();
    if (error || !data) return toast("خطا: " + (error?.message || "نامشخص"), "err");
    setCells((p) => [...p, data as MCell]);
  };

  const importIpynb = async (file: File) => {
    if (!teacherMode || !user) return;
    setBusy(true);
    try {
      const parsed = parseNotebookFull(await file.text());
      if (!parsed.length) return toast("سلولی توی این فایل پیدا نشد", "err");
      const base = nextPosition();
      const rows = parsed.map((p, i) => ({
        class_id: classId,
        meeting_id: meetingId,
        kind,
        cell_type: p.cell_type,
        source: p.source,
        output: p.output,
        position: base + i * 1000,
        created_by: user.id,
      }));
      const { error } = await supabase.from("material_cells").insert(rows);
      if (error) return toast("خطا در آپلود: " + error.message, "err");
      toast(`${rows.length} سلول اضافه شد`, "ok");
      load();
    } catch (e) {
      toast("خطا: " + getErrorMessage(e), "err");
    } finally {
      setBusy(false);
    }
  };

  const importPdf = async (file: File) => {
    if (!teacherMode || !user) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return toast("فقط فایل PDF قابل آپلوده", "err");
    if (file.size > MAX_PDF_BYTES) return toast("حجم PDF بیشتر از ۲۵ مگابایته", "err");
    setBusy(true);
    try {
      const path = `${classId}/${meetingId}/${crypto.randomUUID()}.pdf`;
      const up = await supabase.storage.from("materials").upload(path, file, { contentType: "application/pdf" });
      if (up.error) return toast("خطا در آپلود: " + up.error.message, "err");
      const { error } = await supabase.from("material_files").insert({
        class_id: classId,
        meeting_id: meetingId,
        kind,
        title: file.name.replace(/\.pdf$/i, ""),
        storage_path: path,
        created_by: user.id,
      });
      if (error) {
        await supabase.storage.from("materials").remove([path]);
        return toast("خطا: " + error.message, "err");
      }
      toast("PDF آپلود شد", "ok");
      load();
    } catch (e) {
      toast("خطا: " + getErrorMessage(e), "err");
    } finally {
      setBusy(false);
    }
  };

  const deleteFile = async (f: MaterialFile) => {
    if (!confirm(`«${f.title}» حذف شود؟`)) return;
    const { error } = await supabase.from("material_files").delete().eq("id", f.id);
    if (error) return toast("خطا: " + error.message, "err");
    await supabase.storage.from("materials").remove([f.storage_path]);
    setFiles((p) => p.filter((x) => x.id !== f.id));
  };

  const move = async (id: string, dir: -1 | 1) => {
    const i = cells.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= cells.length) return;
    const a = cells[i];
    const b = cells[j];
    const next = [...cells];
    next[i] = { ...b, position: a.position };
    next[j] = { ...a, position: b.position };
    setCells(next);
    const r1 = await supabase.from("material_cells").update({ position: b.position }).eq("id", a.id);
    const r2 = await supabase.from("material_cells").update({ position: a.position }).eq("id", b.id);
    if (r1.error || r2.error) {
      toast("خطا در جابه‌جایی", "err");
      load();
    }
  };

  const Icon = kind === "board" ? Presentation : BookOpen;

  return (
    <div>
      <div className="card p-4 mb-4 flex flex-wrap items-center gap-3">
        <Icon size={22} className="text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="font-extrabold text-base">{copy.title}</h2>
          <p className="text-xs text-muted mt-0.5">{teacherMode ? copy.teacherHint : copy.studentHint}</p>
        </div>
        {teacherMode ? (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => addCell("code")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-line bg-white hover:shadow-soft">
              <Code2 size={13} /> سلول کد
            </button>
            <button onClick={() => addCell("markdown")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-line bg-white hover:shadow-soft">
              <FileText size={13} /> سلول متن
            </button>
            <button onClick={() => ipynbRef.current?.click()} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-line bg-white hover:shadow-soft disabled:opacity-50">
              <Upload size={13} /> آپلود ipynb
            </button>
            <button onClick={() => pdfRef.current?.click()} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-line bg-white hover:shadow-soft disabled:opacity-50">
              <FileUp size={13} /> آپلود PDF
            </button>
            <input
              ref={ipynbRef}
              type="file"
              accept=".ipynb,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) importIpynb(f);
              }}
            />
            <input
              ref={pdfRef}
              type="file"
              accept=".pdf,application/pdf"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) importPdf(f);
              }}
            />
          </div>
        ) : (
          <span className="flex items-center gap-1 text-[11px] font-bold text-muted px-2.5 py-1 rounded-full bg-slate-100">
            <Lock size={11} /> فقط‌خواندنی
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          <CellSkeleton />
          <CellSkeleton />
        </div>
      ) : (
        <div className="space-y-4">
          {files.map((f) => (
            <div key={f.id} className="bg-white border border-line rounded-2xl overflow-hidden shadow-soft">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line bg-slate-50">
                <FileText size={15} className="text-primary" />
                <span className="font-bold text-sm truncate flex-1">{f.title}</span>
                {urls[f.id] && (
                  <a href={urls[f.id]} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-line bg-white">
                    <ExternalLink size={12} /> باز کردن
                  </a>
                )}
                {teacherMode && (
                  <button onClick={() => deleteFile(f)} title="حذف" className="p-1.5 rounded-lg border border-red-200 bg-white text-danger">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              {urls[f.id] ? (
                <iframe src={urls[f.id]} title={f.title} className="w-full h-[75vh] bg-slate-100" />
              ) : (
                <div className="h-40 grid place-items-center text-sm text-muted">در حال آماده‌سازی فایل…</div>
              )}
            </div>
          ))}

          {cells.map((c, i) => (
            <MaterialCell
              key={c.id}
              cell={c}
              canEdit={teacherMode}
              isFirst={i === 0}
              isLast={i === cells.length - 1}
              onMove={move}
              onDeleted={(id) => setCells((p) => p.filter((x) => x.id !== id))}
            />
          ))}

          {!cells.length && !files.length && (
            <div className="card text-center py-14 px-6">
              <Icon size={40} className="mx-auto mb-3 text-primary/40" />
              <p className="text-sm text-muted">{teacherMode ? copy.emptyTeacher : copy.emptyStudent}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
