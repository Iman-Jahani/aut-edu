// Minimal, dependency-free .ipynb (nbformat v4) import/export.
// Export: turns the class's code cells into a real Jupyter notebook file
// (openable in Jupyter/VS Code/Colab) — code + last output, per cell.
// Import: reads a .ipynb file's code cells back into `cells` rows.

import type { Cell } from "@/lib/types";

interface NbCell {
  cell_type: "code" | "markdown";
  source: string[];
  outputs?: Array<{ output_type: string; text?: string[]; name?: string }>;
  metadata?: Record<string, unknown>;
  execution_count?: number | null;
}

interface Notebook {
  cells: NbCell[];
  metadata: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
}

function toSourceLines(text: string): string[] {
  // nbformat stores source as an array of lines, each ending in \n except the last.
  const lines = (text || "").split("\n");
  return lines.map((l, i) => (i < lines.length - 1 ? l + "\n" : l));
}

export function buildNotebook(cells: Cell[]): Notebook {
  const nbCells: NbCell[] = [];

  // A short markdown header so the export is self-explanatory when opened elsewhere.
  nbCells.push({
    cell_type: "markdown",
    source: toSourceLines(`# خروجی کلاس پایتون\n\nاین فایل به‌صورت خودکار از دفترچه‌ی کلاس ساخته شده — ${cells.length} سلول کد.`),
    metadata: {},
  });

  for (const c of cells) {
    const header = `# ${c.author_name || "ناشناس"}${c.team_name ? " — تیم " + c.team_name : ""}`;
    nbCells.push({
      cell_type: "code",
      execution_count: null,
      metadata: {
        classroom: {
          author_name: c.author_name,
          team_name: c.team_name || null,
          tags: c.tags || [],
          created_at: c.created_at,
        },
      },
      source: toSourceLines(header + "\n" + (c.code || "")),
      outputs: c.output
        ? [{ output_type: "stream", name: "stdout", text: toSourceLines(c.output) }]
        : [],
    });
  }

  return {
    cells: nbCells,
    metadata: {
      kernelspec: { display_name: "Python 3", language: "python", name: "python3" },
      language_info: { name: "python", version: "3.11" },
    },
    nbformat: 4,
    nbformat_minor: 5,
  };
}

export function downloadNotebook(cells: Cell[], filename: string) {
  const nb = buildNotebook(cells);
  const blob = new Blob([JSON.stringify(nb, null, 1)], { type: "application/x-ipynb+json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ipynb") ? filename : filename + ".ipynb";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface ImportedCell {
  code: string;
  output: string;
}

/** Parses an uploaded .ipynb file's code cells into {code, output} pairs, dropping markdown/raw cells. */
export function parseNotebook(fileText: string): ImportedCell[] {
  let nb: Notebook;
  try {
    nb = JSON.parse(fileText);
  } catch {
    throw new Error("فایل معتبر نیست (JSON قابل خواندن نیست)");
  }
  if (!nb || !Array.isArray(nb.cells)) throw new Error("این یک فایل ipynb معتبر نیست");

  const joinSrc = (src: string[] | string | undefined) => (Array.isArray(src) ? src.join("") : src || "");

  return nb.cells
    .filter((c) => c.cell_type === "code")
    .map((c) => {
      const code = joinSrc(c.source).trim();
      const outputText = (c.outputs || [])
        .map((o) => {
          if (o.text) return joinSrc(o.text);
          return "";
        })
        .filter(Boolean)
        .join("\n");
      return { code, output: outputText.trim() };
    })
    .filter((c) => c.code.length > 0);
}
