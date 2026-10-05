"use client";

import { useState } from "react";
import { Lightbulb, Loader2, Sparkles, X } from "lucide-react";
import { getHint } from "@/lib/hint";
import RichText from "@/components/RichText";

/**
 * Drop-in "گیر کردم؟" button. Pass the student's current code and, when
 * available, the exercise's question text and the last run's output/error —
 * the server asks a free LLM (via OpenRouter) for a short nudge, never the
 * full solution.
 */
export default function HintButton({ code, context, error }: { code: string; context?: string; error?: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const ask = async () => {
    setOpen(true);
    if (!code.trim()) {
      setErrMsg("اول یه کد بنویس تا بتونم راهنماییت کنم");
      return;
    }
    setLoading(true);
    setErrMsg(null);
    setHint(null);
    const res = await getHint({ code, context, error });
    setLoading(false);
    if (res.error) setErrMsg(res.error);
    else setHint(res.hint || null);
  };

  return (
    <>
      <button
        onClick={ask}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
        title="یه راهنمایی کوچیک با هوش مصنوعی بگیر"
      >
        <Lightbulb size={14} /> گیر کردم
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="border border-amber-200 bg-amber-50/60 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <Sparkles size={13} /> راهنمای هوش مصنوعی
              </span>
              <button onClick={() => setOpen(false)} className="text-amber-700/60 hover:text-amber-800">
                <X size={14} />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-amber-800">
                <Loader2 size={14} className="animate-spin" /> داره فکر می‌کنه…
              </div>
            ) : errMsg ? (
              <p className="text-xs text-red-700">{errMsg}</p>
            ) : hint ? (
              <div className="text-sm text-amber-900">
                <RichText text={hint} />
              </div>
            ) : null}

            <p className="text-[10px] text-amber-700/70 mt-2">
              این راهنمایی با هوش مصنوعیه و ممکنه گاهی دقیق نباشه — جای فکر کردن خودت رو نمی‌گیره.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
