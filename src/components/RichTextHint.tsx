"use client";

import { useState } from "react";
import { Code2, Eye, EyeOff, Sigma } from "lucide-react";
import RichText from "@/components/RichText";

/**
 * Small toolbar for a textarea whose content is rendered by <RichText>
 * (Markdown + LaTeX math + code). Inserts templates at the cursor and offers a live preview.
 */
export default function RichTextHint({ textareaRef, value, onChange }: {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (next: string) => void;
}) {
  const [preview, setPreview] = useState(false);

  /** Wraps the current selection (or a placeholder) in before/after and re-selects the inner text. */
  const insert = (before: string, after: string, placeholder: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const inner = value.slice(start, end) || placeholder;
    onChange(value.slice(0, start) + before + inner + after + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + before.length, start + before.length + inner.length);
    });
  };

  const btn = "flex items-center gap-1 text-[11px] font-bold text-primary shrink-0";

  return (
    <div className="-mt-1.5 space-y-1.5">
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
        <button type="button" onClick={() => insert("$", "$", "x^2 + y^2")} className={btn} title="فرمول درون‌خطی (LaTeX)">
          <Sigma size={12} /> فرمول <span dir="ltr" className="font-mono font-normal">$…$</span>
        </button>
        <button type="button" onClick={() => insert("\n$$\n", "\n$$\n", "\\frac{a}{b}")} className={btn} title="فرمول بلوکی (LaTeX)">
          <Sigma size={12} /> فرمول بلوکی <span dir="ltr" className="font-mono font-normal">$$…$$</span>
        </button>
        <button type="button" onClick={() => insert("```\n", "\n```", "کد اینجا")} className={btn}>
          <Code2 size={12} /> بلوک کد
        </button>
        <button type="button" onClick={() => insert("**", "**", "متن پررنگ")} className={btn + " font-extrabold"}>
          B
        </button>
        <button type="button" onClick={() => setPreview((p) => !p)} className={btn + " mr-auto"}>
          {preview ? <EyeOff size={12} /> : <Eye size={12} />} پیش‌نمایش
        </button>
      </div>
      <div className="text-[11px] text-muted leading-5">
        Markdown و LaTeX پشتیبانی میشه — مثلا <code className="rich-inline-code">$\frac{"{a}{b}"}$</code>، <code className="rich-inline-code">**پررنگ**</code> یا <code className="rich-inline-code">`کد کوتاه`</code>. برای نوشتن خودِ علامت دلار از <code className="rich-inline-code">\$</code> استفاده کن.
      </div>
      {preview && (
        <div className="border border-dashed border-line rounded-lg px-3 py-2 text-sm bg-slate-50/60 min-h-[2.5rem]" dir="auto">
          {value.trim() ? <RichText text={value} /> : <span className="text-muted text-xs">چیزی برای نمایش نیست</span>}
        </div>
      )}
    </div>
  );
}
