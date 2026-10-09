// Copies the Pyodide runtime from node_modules into public/pyodide so the app can
// serve it from its own domain. Used automatically as a fallback when the CDN is
// unreachable for a student (see src/lib/pyodide.ts). Never fails the install.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

try {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const src = join(root, "node_modules", "pyodide");
  const dest = join(root, "public", "pyodide");
  if (!existsSync(src)) {
    console.log("[pyodide] package not installed, skipping local copy");
  } else {
    mkdirSync(dest, { recursive: true });
    const keep = new Set(["pyodide.js", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]);
    for (const f of readdirSync(src)) if (keep.has(f)) cpSync(join(src, f), join(dest, f));
    console.log("[pyodide] local runtime copied to public/pyodide");
  }
} catch (e) {
  console.log("[pyodide] local copy skipped:", e && e.message);
}
