// Pure helpers for running a program on a remote Piston-compatible executor.
// No imports on purpose: used by the API route AND the browser, and unit-testable.

export type ServerMode = "run" | "test";

export interface RawServerResult {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: string | null;
}

export interface InterpretedRun {
  output: string;
  needInput: string | null;
  isError: boolean;
}

export interface RunnerFile {
  name: string;
  content: string;
}

// Same semantics as the in-browser runner (lib/pyRunner.ts): a trailing bare
// expression prints its repr (so `10 / 2` shows 5.0), input() echoes the typed answer
// after its prompt, colors are enabled, random is seeded, and tracebacks read
// `File "<cell>", line N`. The student's code lives in its own file so line numbers
// are exact (no prelude to shift).
const RUN_HARNESS = String.raw`import ast, os, sys, random, builtins, traceback
os.environ["FORCE_COLOR"] = "1"
random.seed(__SEED__)
_orig_input = builtins.input
def _input(prompt=""):
    value = _orig_input(prompt)
    print(value)
    return value
builtins.input = _input
src = open("cell.py", encoding="utf-8").read()
g = {"__name__": "__main__"}
try:
    tree = compile(src, "<cell>", "exec", flags=ast.PyCF_ONLY_AST)
    if tree.body and isinstance(tree.body[-1], ast.Expr):
        last = tree.body.pop()
        if tree.body:
            exec(compile(ast.Module(body=tree.body, type_ignores=[]), "<cell>", "exec"), g)
        result = eval(compile(ast.Expression(body=last.value), "<cell>", "eval"), g)
        if result is not None:
            print(repr(result))
    else:
        exec(compile(tree, "<cell>", "exec"), g)
except SystemExit:
    pass
except BaseException as e:
    sys.stdout.flush()
    tb = e.__traceback__.tb_next if e.__traceback__ else None
    print("".join(traceback.format_exception(type(e), e, tb)), file=sys.stderr, end="")
    sys.exit(1)
`;

// Exercise checking: input() returns the next stdin line WITHOUT printing its prompt,
// so `input("Enter a number")` never pollutes the output that is compared.
const TEST_HARNESS = String.raw`import sys, builtins, traceback
def _input(prompt=""):
    line = sys.stdin.readline()
    if not line:
        raise EOFError("EOF when reading a line")
    return line.rstrip("\n")
builtins.input = _input
src = open("cell.py", encoding="utf-8").read()
g = {"__name__": "__main__"}
try:
    exec(compile(src, "<cell>", "exec"), g)
except SystemExit:
    pass
except BaseException as e:
    sys.stdout.flush()
    tb = e.__traceback__.tb_next if e.__traceback__ else None
    print("".join(traceback.format_exception(type(e), e, tb)), file=sys.stderr, end="")
    sys.exit(1)
`;

export function buildFiles(code: string, mode: ServerMode, seed: number): RunnerFile[] {
  const s = Number.isFinite(seed) ? Math.trunc(seed) : 1;
  const harness = mode === "run" ? RUN_HARNESS.replace("__SEED__", String(s)) : TEST_HARNESS;
  return [
    { name: "main.py", content: harness },
    { name: "cell.py", content: code },
  ];
}

/** Makes stdin end with a newline, like a person pressing Enter on the last answer. */
export function toStdin(inputs: string[]): string {
  return inputs.length ? inputs.join("\n") + "\n" : "";
}

export function cleanTraceback(stderr: string): string {
  return stderr.replace(/\s+$/, "");
}

const EOF_RE = /EOFError: EOF when reading a line/;

export function interpretRun(res: RawServerResult): InterpretedRun {
  const stdout = res.stdout || "";
  const stderr = res.stderr || "";

  if (res.signal) {
    const base = stdout.replace(/\s+$/, "");
    return {
      output: (base ? base + "\n" : "") + "اجرا بیش از حد طول کشید یا حافظه‌ی زیادی مصرف کرد و متوقف شد.",
      needInput: null,
      isError: true,
    };
  }

  // The program asked for more input than we have answers for yet: hand the prompt
  // back to the UI, which collects the answer and re-runs with it appended (replay).
  if (EOF_RE.test(stderr)) {
    const cut = stdout.lastIndexOf("\n");
    return {
      output: stdout.slice(0, cut + 1).replace(/\s+$/, ""),
      needInput: stdout.slice(cut + 1),
      isError: false,
    };
  }

  const failed = res.code !== 0 && res.code !== null;
  const tb = cleanTraceback(stderr);
  const sep = stdout && !stdout.endsWith("\n") && tb ? "\n" : "";
  return {
    output: (stdout + sep + tb).replace(/\s+$/, ""),
    needInput: null,
    isError: failed,
  };
}
