"use client";

import { parseAnsi } from "@/lib/ansi";

/** Renders program output, turning ANSI color codes into real colors. */
export default function AnsiText({ text }: { text: string }) {
  // Fast path: no escape codes at all.
  if (!text.includes("\u001b")) return <>{text}</>;
  return (
    <>
      {parseAnsi(text).map((s, i) => (
        <span
          key={i}
          style={{
            color: s.color,
            backgroundColor: s.background,
            fontWeight: s.bold ? 700 : undefined,
            opacity: s.dim ? 0.7 : undefined,
            fontStyle: s.italic ? "italic" : undefined,
            textDecoration: s.underline ? "underline" : undefined,
          }}
        >
          {s.text}
        </span>
      ))}
    </>
  );
}
