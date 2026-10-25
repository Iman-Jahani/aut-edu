"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// Paragraphs are <span>s so <RichText> can live inside <p>/<span> without invalid nesting;
// CSS (.rich-p) makes them behave like paragraphs.
const components: Components = {
  p: ({ children }) => <span className="rich-p">{children}</span>,
  code: ({ children }) => <code className="rich-inline-code">{children}</code>,
  pre: ({ children }) => <pre className="rich-code-block">{children}</pre>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <span className="rich-table-wrap">
      <table>{children}</table>
    </span>
  ),
};

const remarkPlugins = [remarkGfm, [remarkMath, { singleDollarTextMath: true }], remarkBreaks] as const;
const rehypePlugins = [[rehypeKatex, { throwOnError: false, strict: false }]] as const;

/** `$$…$$` always means display math: put it in its own paragraph with fence lines so it renders as a block. */
function normalizeMath(src: string): string {
  const parts = src.split(/(```[\s\S]*?```|`[^`\n]+`)/g); // leave code (fenced and inline) untouched
  return parts
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$/g, (_m, body: string) => `\n\n$$\n${body.trim()}\n$$\n\n`)))
    .join("");
}

/**
 * Renders Markdown with LaTeX math, used for exercise/quiz text:
 *  - math:  $x^2 + y^2$ inline, $$\frac{a}{b}$$ as a centred block  (KaTeX)
 *  - code:  `inline` and ```fenced blocks```
 *  - md:    **bold**, *italic*, lists, > quotes, tables, links, ~~strike~~
 * Single line breaks are kept. Raw HTML is NOT rendered (safe by default).
 * Write \$ for a literal dollar sign.
 */
export default function RichText({ text, className = "" }: { text: string; className?: string }) {
  if (!text) return null;
  // Quiz rows are prefixed like "1. question" — keep that a literal label, not a one-item list.
  const source = normalizeMath(text.replace(/^(\s*\d+)\.(\s)/, "$1\\.$2"));
  return (
    <span className={`rich-text ${className}`}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins as unknown as never}
        rehypePlugins={rehypePlugins as unknown as never}
        components={components}
        skipHtml
      >
        {source}
      </ReactMarkdown>
    </span>
  );
}

/** Plain-text teaser for places (card previews) that can't render a code block nicely. */
export function stripRich(text: string, maxLen = 140): string {
  if (!text) return "";
  const flat = text
    .replace(/```[\s\S]*?```/g, " [کد] ")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\$\$([\s\S]*?)\$\$/g, " $1 ")
    .replace(/(^|[^\\$])\$([^$\n]+)\$/g, "$1$2")
    .replace(/\\\$/g, "$")
    .replace(/(\*\*|__|~~)/g, "")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+])\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > maxLen ? flat.slice(0, maxLen) + "…" : flat;
}
