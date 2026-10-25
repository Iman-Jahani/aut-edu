"use client";

import { useState } from "react";
import { Lightbulb, Loader2, Sparkles, X } from "lucide-react";
import { getHint } from "@/lib/hint";
import RichText from "@/components/RichText";

/**
 * "گیر کردم؟" assistant, split in two so the caller decides where each piece
 * goes: `useHint` holds the state, `HintButton` is just the button (safe in a
 * toolbar row), and `HintBox` is the (height-limited, scrollable) answer panel
 * that belongs in normal page flow — never inside a flex toolbar.
 */
export function useHint(args: { code: string; context?: string; error?: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const ask = async () => {
    setOpen(true);
    if (!args.code.trim()) {
      setHint(null);
      setErrMsg("اول یه کد بنویس تا بتونم راهنماییت کنم");
      return;
    }
    setLoading(true);
    setErrMsg(null);
    setHint(null);
    const res = await getHint(args);
    setLoading(false);
    if (res.error) setErrMsg(res.error);
    else setHint(res.hint || null);
  };

  return { open, loading, hint, errMsg, ask, close: () => setOpen(false) };
}

export function HintButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-60 shrink-0"
      title="یه راهنمایی کوچیک با هوش مصنوعی بگیر"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />} گیر کردم
    </button>
  );
}

export function HintBox({ state }: { state: ReturnType<typeof useHint> }) {
  if (!state.open) return null;
  return (
    <div className="border border-amber-200 bg-amber-50/60 rounded-xl p-3.5 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
          <Sparkles size={13} /> راهنمای هوش مصنوعی
        </span>
        <button type="button" onClick={state.close} className="text-amber-700/60 hover:text-amber-800">
          <X size={14} />
        </button>
      </div>

      {state.loading ? (
        <div className="flex items-center gap-2 text-sm text-amber-800">
          <Loader2 size={14} className="animate-spin" /> داره فکر می‌کنه…
        </div>
      ) : state.errMsg ? (
        <p className="text-xs text-red-700 break-words">{state.errMsg}</p>
      ) : state.hint ? (
        // Long answers scroll inside the box instead of stretching the page.
        <div className="text-sm text-amber-900 max-h-48 overflow-y-auto break-words pr-1">
          <RichText text={state.hint} />
        </div>
      ) : null}

      <p className="text-[10px] text-amber-700/70 mt-2">این راهنمایی با هوش مصنوعیه و ممکنه گاهی دقیق نباشه — جای فکر کردن خودت رو نمی‌گیره.</p>
    </div>
  );
}
