"use client";

import { Fragment } from "react";

function InlineText({ text }: { text: string }) {
  const segments = text.split(/`([^`\n]+)`/g);
  return (
    <>
      {segments.map((seg, i) =>
        i % 2 === 1 ? (
          <code key={i} className="rich-inline-code">
            {seg}
          </code>
        ) : (
          <Fragment key={i}>{seg}</Fragment>
        )
      )}
    </>
  );
}

/**
 * Renders mixed text+code: ```fenced blocks``` become a monospace code block,
 * single `backticks` become inline code, everything else is plain (wrapped) text.
 * Used for exercise/quiz question & option text so a question can embed a
 * snippet like `n = int(input())` or a multi-line ```code``` example.
 */
export default function RichText({ text, className = "" }: { text: string; className?: string }) {
  if (!text) return null;
  const parts = text.split(/```([\s\S]*?)```/g);
  return (
    <span className={`rich-text ${className}`}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <pre key={i} className="rich-code-block">
            {part.replace(/^\n/, "").replace(/\n$/, "")}
          </pre>
        ) : (
          <InlineText key={i} text={part} />
        )
      )}
    </span>
  );
}

/** Plain-text teaser for places (card previews) that can't render a code block nicely. */
export function stripRich(text: string, maxLen = 140): string {
  if (!text) return "";
  const flat = text
    .replace(/```[\s\S]*?```/g, " [کد] ")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > maxLen ? flat.slice(0, maxLen) + "…" : flat;
}
