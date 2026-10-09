"use client";

import { Code2 } from "lucide-react";

/**
 * A small "insert code block" affordance to pair with a textarea that supports
 * the ```code``` / `code` convention rendered by <RichText>. Inserts a
 * ```\n...\n``` template at the cursor position.
 */
export default function RichTextHint({ textareaRef, value, onChange }: {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (next: string) => void;
}) {
  const insertCodeBlock = () => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const placeholder = "کد اینجا";
    const snippet = "```\n" + placeholder + "\n```";
    const next = value.slice(0, start) + snippet + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + 4;
      el?.setSelectionRange(pos, pos + placeholder.length);
    });
  };

  return (
    <div className="flex items-center justify-between -mt-1.5">
      <span className="text-[11px] text-muted">
        برای نمایش کد: <code className="rich-inline-code">`کد کوتاه`</code> یا سه‌تا بک‌تیک برای بلوک کد
      </span>
      <button type="button" onClick={insertCodeBlock} className="flex items-center gap-1 text-[11px] font-bold text-primary shrink-0">
        <Code2 size={12} /> افزودن بلوک کد
      </button>
    </div>
  );
}
