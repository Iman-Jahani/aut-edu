"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";
import { runPython } from "@/lib/pyodide";
import { growGarden } from "@/lib/garden";
import AnsiText from "@/components/AnsiText";
import RichText from "@/components/RichText";
import { Skeleton } from "@/components/Skeleton";
import { Play, Trash2, ArrowUp, ArrowDown, Pencil, Check, CornerDownLeft, X, Loader2, Eye, Copy } from "lucide-react";
import type { MaterialCell as MCell } from "@/lib/types";

/**
 * One cell of the notes / board.
 *  - canEdit (teacher): can edit, run (the output is SAVED for everyone), move, delete.
 *  - everyone else: read-only. They can run code cells, but the result lives only in this
 *    component's state — nothing is ever written to the database for them.
 */
export default function MaterialCell({
  cell,
  canEdit,
  isFirst,
  isLast,
  onMove,
  onDeleted,
  onCopy,
}: {
  cell: MCell;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMove: (id: string, dir: -1 | 1) => void;
  onDeleted: (id: string) => void;
  /** Students: copy this code cell into their own workspace. */
  onCopy?: (cell: MCell) => void;
}) {
  const toast = useToast();
  const [source, setSource] = useState(cell.source);
  const [output, setOutput] = useState(cell.output); // what is shown; for students may be their own local run
  const [localRun, setLocalRun] = useState(false); // student ran it → output is NOT the teacher's saved one
  const [isError, setIsError] = useState(false);
  const [running, setRunning] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [editingMd, setEditingMd] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const inputsRef = useRef<string[]>([]);
  const seedRef = useRef(1);
  const engineRef = useRef<"remote" | "local" | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocalEdit = useRef(0);

  // Pick up the teacher's changes (realtime) — except while the teacher is typing, or for a student's own local run.
  useEffect(() => {
    if (canEdit && Date.now() - lastLocalEdit.current < 3000) return;
    if (running || pendingPrompt !== null) return;
    setSource(cell.source);
    if (!localRun) setOutput(cell.output);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell.source, cell.output, cell.updated_at]);

  const codeExt = useMemo(
    () => (canEdit ? [python()] : [python(), EditorState.readOnly.of(true), EditorView.editable.of(false)]),
    [canEdit]
  );

  const saveSource = (value: string) => {
    lastLocalEdit.current = Date.now();
    setSource(value);
    if (!canEdit) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase.from("material_cells").update({ source: value, updated_at: new Date().toISOString() }).eq("id", cell.id);
      if (error) toast("خطا در ذخیره: " + error.message, "err");
    }, 900);
  };

  const execute = async (first: boolean) => {
    setRunning(true);
    setShowSkeleton(first);
    try {
      const r = await runPython(source, inputsRef.current, seedRef.current, { engine: engineRef.current });
      setOutput(r.output);
      setIsError(r.isError);
      growGarden(r.isError ? 1 : 3, "run");
      engineRef.current = r.remote ? "remote" : "local";
      if (r.needInput !== null) {
        setPendingPrompt(r.needInput);
        return;
      }
      setPendingPrompt(null);
      if (canEdit) {
        // Only the teacher's run is persisted (and RLS would reject anyone else anyway).
        const { error } = await supabase.from("material_cells").update({ output: r.output, updated_at: new Date().toISOString() }).eq("id", cell.id);
        if (error) toast("خطا در ذخیره‌ی خروجی: " + error.message, "err");
      } else {
        setLocalRun(true);
      }
    } finally {
      setRunning(false);
      setShowSkeleton(false);
    }
  };

  const run = async () => {
    inputsRef.current = [];
    engineRef.current = undefined;
    seedRef.current = Math.floor(Math.random() * 2147483647);
    setPendingPrompt(null);
    setInputValue("");
    await execute(true);
  };

  const submitInput = async () => {
    if (pendingPrompt === null || running) return;
    inputsRef.current = [...inputsRef.current, inputValue];
    setInputValue("");
    setPendingPrompt(null);
    await execute(false);
  };

  const cancelInput = () => {
    setPendingPrompt(null);
    setInputValue("");
    setOutput((o) => (o ? o + "\n" : "") + "^C  (اجرا متوقف شد)");
    setIsError(true);
  };

  useEffect(() => {
    if (pendingPrompt !== null) inputRef.current?.focus();
  }, [pendingPrompt]);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    []
  );

  const del = async () => {
    if (!confirm("این سلول حذف شود؟")) return;
    const { error } = await supabase.from("material_cells").delete().eq("id", cell.id);
    if (error) return toast("خطا: " + error.message, "err");
    onDeleted(cell.id);
  };

  const toolbar = canEdit && (
    <div className="flex items-center gap-1 mr-auto">
      <button onClick={() => onMove(cell.id, -1)} disabled={isFirst} title="بالا" className="p-1.5 rounded-lg border border-line bg-white disabled:opacity-30">
        <ArrowUp size={13} />
      </button>
      <button onClick={() => onMove(cell.id, 1)} disabled={isLast} title="پایین" className="p-1.5 rounded-lg border border-line bg-white disabled:opacity-30">
        <ArrowDown size={13} />
      </button>
      <button onClick={del} title="حذف" className="p-1.5 rounded-lg border border-red-200 bg-white text-danger">
        <Trash2 size={13} />
      </button>
    </div>
  );

  // ---------------- Markdown cell ----------------
  if (cell.cell_type === "markdown") {
    return (
      <div className="bg-white border border-line rounded-2xl shadow-soft overflow-hidden">
        {canEdit && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-line bg-slate-50">
            <span className="text-[11px] font-bold text-muted">متن (Markdown)</span>
            <button onClick={() => setEditingMd((e) => !e)} className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-line bg-white">
              {editingMd ? <Check size={12} /> : <Pencil size={12} />} {editingMd ? "تمام" : "ویرایش"}
            </button>
            {toolbar}
          </div>
        )}
        {canEdit && editingMd ? (
          <textarea
            value={source}
            onChange={(e) => saveSource(e.target.value)}
            dir="auto"
            rows={Math.min(18, Math.max(5, source.split("\n").length + 1))}
            spellCheck={false}
            placeholder="متن، **بولد**، `کد`، $فرمول$ ..."
            className="w-full px-4 py-3 text-sm leading-7 font-mono outline-none resize-y bg-white"
          />
        ) : (
          <div className="px-5 py-4 text-sm leading-7 select-text">
            {source.trim() ? <RichText text={source} html /> : <span className="text-muted">(متن خالی)</span>}
          </div>
        )}
      </div>
    );
  }

  // ---------------- Code cell ----------------
  return (
    <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-soft">
      {canEdit && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-line bg-slate-50">
          <span className="text-[11px] font-bold text-muted">کد</span>
          {toolbar}
        </div>
      )}
      <CodeMirror
        value={source}
        onChange={saveSource}
        theme={dracula}
        extensions={codeExt}
        readOnly={!canEdit}
        editable={canEdit}
        indentWithTab
        minHeight="60px"
        maxHeight="420px"
        basicSetup={{ lineNumbers: true, autocompletion: canEdit }}
      />

      {showSkeleton ? (
        <div className="px-4 py-4 bg-[#0b1020] space-y-2.5 min-h-[96px]">
          <Skeleton dark className="h-3 w-1/4" />
          <Skeleton dark className="h-3 w-2/3" />
        </div>
      ) : (
        (output || pendingPrompt !== null) && (
          <div className={isError ? "bg-red-950/90 text-red-300" : "bg-[#0b1020] text-emerald-400"} dir="ltr">
            {!canEdit && localRun && (
              <div className="px-4 pt-2.5 text-[10px] text-slate-400" dir="rtl">
                این خروجیِ اجرای خودته و ذخیره نمی‌شه.
              </div>
            )}
            {output && (
              <pre className="px-4 pt-4 pb-3 max-h-96 overflow-auto text-[13.5px] leading-6 font-mono whitespace-pre-wrap text-left">
                <AnsiText text={output} />
              </pre>
            )}
            {pendingPrompt !== null && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitInput();
                }}
                className="flex items-center gap-2 px-4 pb-4 pt-1 font-mono text-[13.5px]"
              >
                <span className="text-emerald-300 whitespace-pre-wrap break-words max-w-[55%]">{pendingPrompt || "›"}</span>
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && cancelInput()}
                  placeholder="ورودی رو بنویس و Enter بزن…"
                  autoComplete="off"
                  spellCheck={false}
                  className="flex-1 min-w-0 bg-white/10 text-emerald-100 placeholder:text-slate-500 rounded-lg px-3 py-1.5 outline-none ring-1 ring-emerald-400/40"
                />
                <button type="submit" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold shrink-0">
                  <CornerDownLeft size={13} /> ارسال
                </button>
                <button type="button" onClick={cancelInput} className="flex items-center gap-1 text-slate-400 text-xs shrink-0">
                  <X size={13} /> لغو
                </button>
              </form>
            )}
          </div>
        )
      )}

      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-t border-line">
        <button onClick={run} disabled={running} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white disabled:opacity-50">
          {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {running ? "در حال اجرا…" : "اجرا"}
        </button>
        {!canEdit && onCopy && source.trim() && (
          <button onClick={() => onCopy({ ...cell, source, output })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-line bg-white hover:shadow-soft">
            <Copy size={13} /> کپی توی پلی‌گراند من
          </button>
        )}
        {!canEdit && (
          <span className="mr-auto flex items-center gap-1 text-[11px] text-muted">
            <Eye size={12} /> فقط‌خواندنی
          </span>
        )}
      </div>
    </div>
  );
}
