// Lazily loads Pyodide from the CDN (same version the old app used) and
// keeps a single shared instance around so every code cell can run Python
// without re-downloading the ~10MB runtime each time.

import { CELL_RUNNER_SETUP, TEST_INPUT_SETUP } from "./pyRunner";
import { stripAnsi } from "./ansi";
import { executeOnServer, interpretRun, toStdin, cleanTraceback } from "./serverRun";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PyodideInterface = any;

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideInterface>;
  }
}

const PYODIDE_VERSION = "0.26.2";
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
// Same-origin copy of the runtime (filled in by `npm install` via scripts/copy-pyodide.mjs).
// Used as an automatic fallback for students whose network can't reach the CDN.
const PYODIDE_LOCAL = "/pyodide/";
const SOURCE_TIMEOUT_MS = 45_000;

export const PYODIDE_LOAD_ERROR = "PYODIDE_LOAD_FAILED";

let pyodidePromise: Promise<PyodideInterface> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) existing.remove(); // a previous failed attempt must not block a retry
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error("Failed to load " + src));
    };
    document.head.appendChild(script);
  });
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function loadFrom(base: string): Promise<PyodideInterface> {
  // pyodide.js is tiny; if it doesn't arrive quickly this source is unreachable — give up fast.
  if (!window.loadPyodide) await withTimeout(loadScript(`${base}pyodide.js`), 15_000);
  if (!window.loadPyodide) throw new Error("loadPyodide missing");
  return window.loadPyodide({ indexURL: base });
}

/**
 * Loads Pyodide once and shares it. Tries the CDN first (so nothing changes for
 * people it already works for), then the same-origin copy, and — importantly —
 * forgets a failed attempt so the next "Run" click retries instead of staying
 * broken until the page is reloaded.
 */
export function getPyodide(): Promise<PyodideInterface> {
  if (pyodidePromise) return pyodidePromise;
  const preferLocal = process.env.NEXT_PUBLIC_PYODIDE_PREFER_LOCAL === "1";
  const sources = preferLocal ? [PYODIDE_LOCAL, PYODIDE_CDN] : [PYODIDE_CDN, PYODIDE_LOCAL];
  const attempt = (async () => {
    for (const base of sources) {
      try {
        const py = await withTimeout(loadFrom(base), SOURCE_TIMEOUT_MS);
        // Output goes to a web page that understands ANSI colors; libraries such as
        // termcolor only emit them when asked, and they decide once, on first use.
        py.runPython('import os\nos.environ["FORCE_COLOR"] = "1"');
        return py;
      } catch {
        // try the next source
      }
    }
    throw new Error(PYODIDE_LOAD_ERROR);
  })();
  pyodidePromise = attempt;
  attempt.catch(() => {
    if (pyodidePromise === attempt) pyodidePromise = null;
  });
  return attempt;
}

/** Start downloading the Python runtime in the background (safe to call repeatedly). */
export function preloadPyodide() {
  getPyodide().catch(() => undefined);
}

const LOAD_FAILED_MESSAGE =
  "موتور پایتون لود نشد. احتمالاً اینترنتت قطع یا کنده، یا مرورگرت قدیمیه.\nدوباره روی «اجرا» بزن؛ اگه بازم نشد صفحه رو رفرش کن یا با مرورگر دیگه (Chrome / Edge / Firefox به‌روز) امتحان کن.";

/** Same message, but pointing at the likely cause when we can tell what it is. */
function loadFailedMessage(): string {
  if (typeof WebAssembly === "undefined") {
    return "مرورگر این دستگاه WebAssembly رو پشتیبانی نمی‌کنه، برای همین پایتون توش اجرا نمی‌شه.\nمرورگرت رو به‌روز کن یا با Chrome / Safari / Firefox جدید باز کن.";
  }
  if (typeof navigator !== "undefined" && /Telegram|Instagram|FBAN|FBAV|FB_IAB|Line\/|Snapchat|MicroMessenger/i.test(navigator.userAgent)) {
    return "این صفحه داخل مرورگر داخلیِ یه برنامه (تلگرام / اینستاگرام / ...) باز شده و معمولاً نمی‌ذاره پایتون اجرا بشه.\nلینک رو توی Chrome یا Safari باز کن.";
  }
  return LOAD_FAILED_MESSAGE;
}

// When the in-browser engine can't start, remember it for a few minutes so each
// "Run" doesn't wait for another failed load before using the server instead.
let pyodideFailedAt = 0;
let serverUnavailable = false;
const SERVER_PREFERENCE_MS = 5 * 60_000;

// Captures stdout+stderr as raw bytes (exact text, including partial lines such
// as print("x", end="")). Call the returned function to read what was written.
function captureStdio(pyodide: PyodideInterface): () => string {
  const chunks: Uint8Array[] = [];
  const handler = {
    write: (buf: Uint8Array) => {
      chunks.push(buf.slice());
      return buf.length;
    },
  };
  pyodide.setStdout(handler);
  pyodide.setStderr(handler);
  return () => {
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const merged = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      merged.set(c, off);
      off += c.length;
    }
    return new TextDecoder().decode(merged);
  };
}

async function flushStdio(pyodide: PyodideInterface) {
  try {
    await pyodide.runPythonAsync("import sys\nsys.stdout.flush()\nsys.stderr.flush()");
  } catch {
    /* ignore */
  }
}

export interface RunResult {
  /** True when this run was executed on the server instead of in the browser. */
  remote?: boolean;
  output: string;
  /** Prompt text when the program called input() and is waiting for an answer, else null. */
  needInput: string | null;
  isError: boolean;
}

/**
 * Runs a code cell. `inputs` are the answers already given to input() calls
 * (replayed in order); if the program asks for one more, `needInput` holds the
 * prompt and the caller should collect the answer and call again with it appended.
 */
interface ServerOutcome {
  result?: RunResult;
  /** Why the server run failed, when it was attempted and failure is worth showing. */
  error?: string;
}

async function runOnServer(code: string, inputs: string[], seed: number): Promise<ServerOutcome> {
  const r = await executeOnServer({ code, stdin: toStdin(inputs), mode: "run", seed });
  if (r.ok) return { result: { ...interpretRun(r.raw), remote: true } };
  if (r.reason === "unavailable") {
    serverUnavailable = true;
    return {}; // not configured: say nothing about it
  }
  return { error: r.message || (r.reason === "unauthorized" ? "نشست ورود معتبر نیست" : "خطای نامشخص") };
}

function failure(serverError?: string): RunResult {
  return {
    output: loadFailedMessage() + (serverError ? `\n\nاجرا روی سرور هم ناموفق بود: ${serverError}` : ""),
    needInput: null,
    isError: true,
  };
}

/** `?runner=server` in any page URL makes this browser run everything on the server (handy for testing); `?runner=browser` undoes it. */
function forceServer(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get("runner");
    if (q === "server") localStorage.setItem("forceServerRun", "1");
    if (q === "browser") localStorage.removeItem("forceServerRun");
    return localStorage.getItem("forceServerRun") === "1";
  } catch {
    return false;
  }
}

const SLOW_LOAD_MS = 12_000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface RunOptions {
  /**
   * Keep using the engine a previous step of the SAME run used. input() replays the
   * program from the start for every answer, so it must not hop between the browser
   * and the server halfway through.
   */
  engine?: "remote" | "local";
}

/**
 * Runs a code cell. `inputs` are the answers already given to input() calls
 * (replayed in order); if the program asks for one more, `needInput` holds the
 * prompt and the caller should collect the answer and call again with it appended.
 *
 * Engine choice: the in-browser Python engine, unless it fails to load, crashes, or is
 * still loading after a few seconds — then (if the server executor is configured) the
 * server runs it instead while the browser engine keeps loading for later runs.
 */
export async function runPython(code: string, inputs: string[] = [], seed = 1, opts: RunOptions = {}): Promise<RunResult> {
  const sticky = opts.engine;
  const canUseServer = sticky !== "local" && !serverUnavailable;
  let triedServer = false;
  let serverError: string | undefined;

  const viaServer = async (): Promise<RunResult | null> => {
    if (!canUseServer || triedServer || serverUnavailable) return null;
    triedServer = true;
    const o = await runOnServer(code, inputs, seed);
    if (o.error) serverError = o.error;
    return o.result ?? null;
  };

  const prefersServer =
    sticky === "remote" || (sticky === undefined && (forceServer() || (pyodideFailedAt > 0 && Date.now() - pyodideFailedAt < SERVER_PREFERENCE_MS)));
  if (prefersServer) {
    const remote = await viaServer();
    if (remote) return remote;
    if (sticky === "remote") return failure(serverError);
  }

  let pyodide: PyodideInterface;
  const loading = getPyodide();
  const first = await Promise.race([
    loading.then(
      (p) => ({ kind: "ok" as const, p }),
      () => ({ kind: "fail" as const })
    ),
    sleep(sticky === "local" ? 10 * 60_000 : SLOW_LOAD_MS).then(() => ({ kind: "slow" as const })),
  ]);

  if (first.kind === "ok") {
    pyodide = first.p;
    pyodideFailedAt = 0;
  } else {
    if (first.kind === "fail") pyodideFailedAt = Date.now();
    // Too slow or failed: try the server for THIS run (a slow load keeps going in the background).
    const remote = await viaServer();
    if (remote) return remote;
    try {
      pyodide = await loading;
      pyodideFailedAt = 0;
    } catch {
      pyodideFailedAt = Date.now();
      return failure(serverError);
    }
  }

  const read = captureStdio(pyodide);
  try {
    if (inputs.length === 0) {
      // Best effort: a missing package should surface as Python's own ModuleNotFoundError,
      // not abort the run.
      try {
        await pyodide.loadPackagesFromImports(code);
      } catch {
        /* ignore */
      }
      await installMissingPackages(pyodide, code);
    }
    await ensureCellRunner(pyodide);
    const runCell = pyodide.globals.get("__run_cell");
    let res: unknown;
    try {
      res = runCell(code, JSON.stringify(inputs), seed);
    } finally {
      runCell.destroy();
    }
    const output = read().replace(/\s+$/, "");
    if (typeof res === "string" && res.startsWith("P:")) return { output, needInput: res.slice(2), isError: false };
    return { output, needInput: null, isError: res === "E" };
  } catch (e) {
    // __run_cell catches every Python error itself, so an exception reaching here means
    // the engine itself failed (out of memory, wasm abort, ...) — not the student's code.
    await flushStdio(pyodide);
    const remote = await viaServer();
    if (remote) return remote;
    return { output: (read() + "\nError: " + (e as Error).message).trim(), needInput: null, isError: true };
  }
}

/**
 * Pyodide ships ~300 packages (numpy, pandas, termcolor, rich, ...). Anything else that
 * is a pure-Python package on PyPI can still be installed on the fly with micropip, so
 * students aren't blocked by a library that isn't bundled. Best effort and time-boxed.
 */
async function installMissingPackages(pyodide: PyodideInterface, code: string): Promise<void> {
  try {
    await ensureCellRunner(pyodide);
    const find = pyodide.globals.get("__missing_modules");
    const proxy = find(code);
    const names: string[] = proxy.toJs();
    proxy.destroy?.();
    find.destroy();
    if (!names.length) return;
    await withTimeout(
      (async () => {
        await pyodide.loadPackage("micropip");
        const micropip = pyodide.pyimport("micropip");
        for (const name of names.slice(0, 5)) {
          try {
            await micropip.install(name);
          } catch {
            /* not on PyPI / not pure Python — Python will report the ImportError */
          }
        }
        micropip.destroy?.();
      })(),
      25_000
    );
  } catch {
    /* ignore */
  }
}

let cellRunnerReady = false;
async function ensureCellRunner(pyodide: PyodideInterface): Promise<void> {
  if (cellRunnerReady) return;
  await pyodide.runPythonAsync(CELL_RUNNER_SETUP);
  cellRunnerReady = true;
}

function testStdin(input: string | undefined): string {
  const lines = (input == null ? "" : String(input)).split("\n");
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return toStdin(lines);
}

/** Exercise checking on the server, for students whose browser can't run Python. */
async function runTestCasesOnServer(code: string, tests: TestCaseInput[]): Promise<TestRunResult[] | null> {
  const results: TestRunResult[] = [];
  for (const test of tests) {
    const r = await executeOnServer({ code, stdin: testStdin(test.input), mode: "test", seed: 1 });
    if (!r.ok) {
      if (r.reason === "unavailable") serverUnavailable = true;
      if (results.length === 0) return null;
      results.push({ input: test.input || "", expected: test.expected || "", actual: "Error: " + (r.message || "اجرا روی سرور ناموفق بود"), passed: false, error: r.message || "server" });
      continue;
    }
    const { stdout, stderr, code: exit, signal } = r.raw;
    const err = signal ? "اجرا بیش از حد طول کشید" : exit !== 0 && exit !== null ? cleanTraceback(stderr) : null;
    const rawOut = stdout.replace(/\n$/, "");
    results.push({
      input: test.input || "",
      expected: test.expected || "",
      actual: err ? "Error: " + err : rawOut || "(بدون خروجی)",
      passed: !err && normalizeOutput(rawOut) === normalizeOutput(test.expected),
      error: err,
    });
  }
  return results;
}

function normalizeOutput(s: string | null | undefined): string {
  if (s == null) return "";
  return stripAnsi(String(s))
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

export interface TestCaseInput {
  input?: string;
  expected?: string;
}

export interface TestRunResult {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  error: string | null;
}

// Runs `code` once per test case, feeding `input` as stdin lines and
// comparing normalized stdout against `expected`. Mirrors the exercise
// checker from the original class-23.html.
export async function runTestCases(
  code: string,
  tests: TestCaseInput[]
): Promise<TestRunResult[]> {
  let pyodide: PyodideInterface;
  try {
    pyodide = await getPyodide();
  } catch {
    const remote = serverUnavailable ? null : await runTestCasesOnServer(code, tests);
    if (remote) return remote;
    throw new Error(loadFailedMessage());
  }
  try {
    await pyodide.loadPackagesFromImports(code);
  } catch {
    /* ignore — Python reports a missing module itself */
  }
  const results: TestRunResult[] = [];

  for (const test of tests) {
    const read = captureStdio(pyodide);

    const inputStr = test.input == null ? "" : String(test.input);
    let queue: string[];
    if (inputStr.length === 0) {
      queue = [];
    } else {
      const lines = inputStr.split("\n");
      while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
      queue = lines.map((l) => l + "\n");
    }
    pyodide.setStdin({ stdin: () => (queue.length === 0 ? null : queue.shift()) });

    let err: string | null = null;
    let g: PyodideInterface | null = null;
    try {
      g = pyodide.globals.get("dict")();
      // Shared queue: sys.stdin reads lines (with "\\n"), input() gets them without
      // the newline and without echoing the prompt.
      g.set("__next_input", () => (queue.length ? String(queue.shift()).replace(/\r?\n$/, "") : undefined));
      await pyodide.runPythonAsync(TEST_INPUT_SETUP, { globals: g });
      await pyodide.runPythonAsync(code, { globals: g });
    } catch (e) {
      err = String((e as Error).message || e);
    } finally {
      await flushStdio(pyodide);
      if (g) {
        try {
          g.destroy();
        } catch {
          /* ignore */
        }
      }
    }

    const rawOut = read().replace(/\n$/, "");
    const actual = err ? "Error: " + err : rawOut;
    const passed = !err && normalizeOutput(rawOut) === normalizeOutput(test.expected);
    results.push({
      input: test.input || "",
      expected: test.expected || "",
      actual: actual || "(بدون خروجی)",
      passed,
      error: err,
    });
  }

  try {
    pyodide.setStdin({ stdin: () => null });
  } catch {
    /* ignore */
  }

  return results;
}
