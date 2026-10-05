"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { Play, Trash2, Loader2, CornerDownLeft, X, Tag } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";
import { runPython } from "@/lib/pyodide";
import { noPaste } from "@/lib/editor";
import { Skeleton } from "@/components/Skeleton";
import HintButton from "@/components/HintPanel";
import { fmtRelative } from "@/lib/utils";
import type { PlaygroundCell as PlaygroundCellType } from "@/lib/types";

export default function PlaygroundCell({
  cell,
  autoFocus = false,
  onDeleted,
}: {
  cell: PlaygroundCellType;
  autoFocus?: boolean;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();
  const [code, setCode] = useState(cell.code || "");
  const [output, setOutput] = useState(cell.output || "");
  const [isError, setIsError] = useState(false);
  const [running, setRunning] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [tags, setTags] = useState<string[]>(cell.tags || []);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const inputsRef = useRef<string[]>([]);
  const seedRef = useRef(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extensions = useMemo(() => [python(), noPaste(() => toast("پیست کردن در سلول‌ها غیرفعاله؛ خودت تایپ کن 🙂", "err"))], [toast]);

  const save = async (newCode: string, newOutput: string) => {
    await supabase.from("playground_cells").update({ code: newCode, output: newOutput, updated_at: new Date().toISOString() }).eq("id", cell.id);
  };

  const handleChange = (value: string) => {
    setCode(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(value, output), 900);
  };

  const execute = async (first: boolean) => {
    setRunning(true);
    setShowSkeleton(first);
    try {
      const r = await runPython(code, inputsRef.current, seedRef.current);
      setOutput(r.output);
      setIsError(r.isError);
      if (r.needInput !== null) {
        setPendingPrompt(r.needInput);
        return;
      }
      setPendingPrompt(null);
      await save(code, r.output);
    } finally {
      setRunning(false);
      setShowSkeleton(false);
    }
  };

  const run = async () => {
    inputsRef.current = [];
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
    if (pendingPrompt !== null) {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [pendingPrompt]);

  const del = async () => {
    if (!confirm("این سلول حذف شود؟")) return;
    const { error } = await supabase.from("playground_cells").delete().eq("id", cell.id);
    if (error) return toast("خطا: " + error.message, "err");
    onDeleted(cell.id);
  };

  const addTag = async () => {
    const t = window.prompt("نام تگ:");
    if (!t || !t.trim()) return;
    const next = Array.from(new Set([...(cell.tags || []), t.trim()]));
    const { error } = await supabase.from("playground_cells").update({ tags: next }).eq("id", cell.id);
    if (error) toast("خطا: " + error.message, "err");
    else setTags(next);
  };
  const removeTag = async (tag: string) => {
    const next = tags.filter((t) => t !== tag);
    const { error } = await supabase.from("playground_cells").update({ tags: next }).eq("id", cell.id);
    if (error) toast("خطا: " + error.message, "err");
    else setTags(next);
  };

  return (
    <div className="card overflow-hidden shadow-soft hover:shadow-lift transition-shadow">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
        <span className="text-[11px] text-muted">{fmtRelative(cell.created_at)}</span>
        <div className="flex flex-wrap gap-1.5 justify-end">
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => removeTag(t)}
              className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600"
            >
              #{t} <X size={10} />
            </button>
          ))}
          <button onClick={addTag} className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border border-dashed border-line text-muted">
            <Tag size={11} /> تگ
          </button>
        </div>
      </div>

      <CodeMirror
        value={code}
        onChange={handleChange}
        theme={dracula}
        extensions={extensions}
        indentWithTab
        autoFocus={autoFocus}
        minHeight="100px"
        maxHeight="420px"
        basicSetup={{ lineNumbers: true, autocompletion: true }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            run();
          }
        }}
      />

      {showSkeleton ? (
        <div className="px-4 py-4 bg-[#0b1020] space-y-2.5 min-h-[96px]">
          <Skeleton dark className="h-3 w-1/4" />
          <Skeleton dark className="h-3 w-2/3" />
          <Skeleton dark className="h-3 w-1/2" />
        </div>
      ) : (
        (output || pendingPrompt !== null) && (
          <div className={isError ? "bg-red-950/90 text-red-300" : "bg-[#0b1020] text-emerald-400"} dir="ltr">
            {output && (
              <pre className="px-4 pt-4 pb-3 min-h-[72px] max-h-96 overflow-auto text-[13.5px] leading-6 font-mono whitespace-pre-wrap text-left">{output}</pre>
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
                  className="flex-1 min-w-0 bg-white/10 text-emerald-100 placeholder:text-slate-500 rounded-lg px-3 py-1.5 outline-none ring-1 ring-emerald-400/40 focus:ring-emerald-300"
                />
                <button type="submit" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold shrink-0">
                  <CornerDownLeft size={13} /> ارسال
                </button>
                <button type="button" onClick={cancelInput} className="flex items-center gap-1 text-slate-400 hover:text-white text-xs shrink-0">
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
        <HintButton code={code} error={isError ? output : undefined} />
        <button onClick={del} className="mr-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-danger border border-red-200 bg-white">
          <Trash2 size={14} /> حذف
        </button>
      </div>
    </div>
  );
}
