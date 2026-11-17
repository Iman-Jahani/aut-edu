# Server-side grader: runs on the code executor (Piston / Vercel Sandbox) in ONE process.
# Reads spec.json (then deletes it, so student code can never read hidden tests or checkers),
# runs the student's program once per test (or several times for "checker" tests) in a child
# process with limits, judges the results and prints one JSON document on stdout.
import json, os, re, shutil, subprocess, sys, tempfile, time

try:
    import resource
except Exception:  # pragma: no cover
    resource = None

BASE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(BASE, "spec.json"), encoding="utf-8") as fh:
    SPEC = json.load(fh)
os.remove(os.path.join(BASE, "spec.json"))

WORK = tempfile.mkdtemp(prefix="grade_")
shutil.move(os.path.join(BASE, "runner.py"), os.path.join(WORK, "runner.py"))
shutil.move(os.path.join(BASE, "student.py"), os.path.join(WORK, "student.py"))

TIMEOUT = float(SPEC.get("timeout", 3))
DEADLINE = time.time() + float(SPEC.get("budget", 30))
ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
INT_FUNCS = ("randint", "randrange", "choice")
FLOAT_FUNCS = ("random", "uniform")
MAX_TEXT = 2000


def norm(s):
    s = ANSI.sub("", s or "").replace("\r\n", "\n").replace("\r", "\n")
    return "\n".join(l.rstrip() for l in s.split("\n")).strip("\n")


def clip(s):
    s = s or ""
    return s if len(s) <= MAX_TEXT else s[:MAX_TEXT] + "…"


def parse_random(text, default_seed):
    """'seed: 7' / 'randint: 4, 2, 6' / 'choice: 0, 1' (choice values are INDEXES) / 'random: 0.3, 0.9'."""
    seed, script = default_seed, {}
    for raw in (text or "").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        k, v = line.split(":", 1)
        k = k.strip().lower()
        vals = [x for x in re.split(r"[,\s،]+", v.strip()) if x]
        if k == "seed":
            seed = int(vals[0])
        elif k in INT_FUNCS:
            script[k] = [int(x) for x in vals]
        elif k in FLOAT_FUNCS:
            script[k] = [float(x) for x in vals]
        else:
            raise ValueError("تابع %r قابل‌تنظیم نیست (randint, randrange, choice, random, uniform)" % k)
    return script, seed


def stdin_text(inp):
    lines = (inp or "").split("\n")
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines) + "\n" if lines else ""


def _limits():
    if resource:
        try:
            resource.setrlimit(resource.RLIMIT_FSIZE, (2_000_000, 2_000_000))
            resource.setrlimit(resource.RLIMIT_AS, (768 * 1024 * 1024, 768 * 1024 * 1024))
        except Exception:
            pass


def run_once(stdin, seed, script, timeout):
    out_p, err_p, tr_p = (os.path.join(WORK, n) for n in ("out.txt", "err.txt", "trace.json"))
    for p in (tr_p,):
        if os.path.exists(p):
            os.remove(p)
    env = dict(os.environ, G_SEED=str(seed), G_RANDOM=json.dumps(script), G_TRACE=tr_p, PYTHONUNBUFFERED="1")
    timed_out = False
    code = None
    with open(out_p, "wb") as fo, open(err_p, "wb") as fe:
        try:
            p = subprocess.run([sys.executable, "runner.py"], input=stdin.encode("utf-8"), stdout=fo, stderr=fe,
                               cwd=WORK, env=env, timeout=timeout, preexec_fn=_limits if resource else None)
            code = p.returncode
        except subprocess.TimeoutExpired:
            timed_out = True
    rd = lambda p: open(p, "rb").read(2_100_000).decode("utf-8", "replace")
    try:
        trace = json.load(open(tr_p, encoding="utf-8"))
    except Exception:
        trace = []
    stderr = rd(err_p)
    too_big = code is not None and code < 0 and -code == 25  # SIGXFSZ
    return {"stdout": rd(out_p).replace("\r\n", "\n"), "stderr": stderr, "code": code, "timeout": timed_out,
            "too_big": too_big, "trace": trace}


def run_error(r):
    if r["timeout"]:
        return "اجرا بیش از حد طول کشید (احتمالاً حلقه‌ی بی‌پایان)"
    if r["too_big"]:
        return "خروجی برنامه خیلی زیاد شد"
    if r["code"] not in (0, None):
        if r["code"] < 0:
            return "برنامه با سیگنال %d متوقف شد (حافظه یا زمان)" % -r["code"]
        return r["stderr"].rstrip() or "خطای اجرا"
    return None


def last_line(msg):
    ls = [l for l in (msg or "").strip().split("\n") if l.strip()]
    return ls[-1] if ls else ""


class Ctx:
    def __init__(self, stdin, stdout, calls, run, seed):
        self.stdin, self.stdout, self.calls, self.run, self.seed = stdin, stdout, calls, run, seed
        self.lines = [l.rstrip() for l in norm(stdout).split("\n")] if norm(stdout) else []

    def calls_of(self, fn):
        return [c for c in self.calls if c["fn"] == fn]

    def results_of(self, fn):
        return [c["result"] for c in self.calls_of(fn)]

    def numbers(self):
        return [float(x) if ("." in x) else int(x) for x in re.findall(r"-?\d+(?:\.\d+)?", self.stdout)]

    def fail(self, msg):
        raise AssertionError(msg)


def load_checker(src):
    ns = {"__name__": "checker"}
    exec(compile(src, "<checker>", "exec"), ns)
    if not callable(ns.get("check")) and not callable(ns.get("check_all")):
        raise ValueError("تابع check(ctx) یا check_all(ctxs) تعریف نشده")
    return ns


def judge_checker_result(r):
    if r is False:
        return "خروجی با شرط تست نمی‌خونه"
    return None


def grade_test(i, t):
    hidden = bool(t.get("hidden")) or t.get("kind") == "checker"
    base = {"id": i, "kind": t.get("kind", "exact"), "hidden": bool(t.get("hidden")), "passed": False,
            "input": "" if t.get("hidden") else t.get("input", ""), "expected": "" if (t.get("hidden") or t.get("kind") == "checker") else t.get("expected", ""),
            "actual": "", "error": None, "message": "", "runs": 1, "runs_passed": 0}
    if time.time() > DEADLINE:
        base["error"] = "زمان کل تصحیح تموم شد"
        return base
    try:
        script, seed = parse_random(t.get("random", ""), int(t.get("seed", 1)))
    except Exception as e:
        base["error"] = "تنظیمات random این تست نادرسته: %s" % e
        return base
    stdin = stdin_text(t.get("input", ""))

    if t.get("kind") != "checker":
        r = run_once(stdin, seed, script, TIMEOUT)
        err = run_error(r)
        out = r["stdout"].rstrip("\n") if r["stdout"].endswith("\n") else r["stdout"]
        base["runs_passed"] = 0
        if err:
            base["error"] = last_line(err) if t.get("hidden") else err
            base["actual"] = "" if t.get("hidden") else clip("Error: " + err)
            return base
        base["passed"] = norm(out) == norm(t.get("expected", ""))
        base["runs_passed"] = 1 if base["passed"] else 0
        base["actual"] = "" if t.get("hidden") else clip(out or "(بدون خروجی)")
        return base

    # ---- checker test: run N times with different seeds, every run must satisfy check(ctx) ----
    runs = max(1, min(int(t.get("runs", 5) or 5), 20))
    base["runs"] = runs
    try:
        ns = load_checker(t.get("checker", ""))
    except Exception as e:
        base["error"] = "خطا در چک‌کننده‌ی این تست (به معلم اطلاع بده): %s" % clip(last_line(str(e)) or repr(e))[:200]
        return base
    ctxs = []
    for k in range(runs):
        if time.time() > DEADLINE:
            base["error"] = "زمان کل تصحیح تموم شد"
            return base
        r = run_once(stdin, seed + k, script, TIMEOUT)
        err = run_error(r)
        if err:
            base["error"] = last_line(err)
            base["actual"] = clip(r["stdout"])
            base["message"] = "اجرای %d از %d با خطا مواجه شد" % (k + 1, runs)
            return base
        ctx = Ctx(t.get("input", ""), r["stdout"], r["trace"], k, seed + k)
        ctxs.append(ctx)
        try:
            res = ns["check"](ctx) if callable(ns.get("check")) else True
            bad = judge_checker_result(res)
            if bad:
                raise AssertionError(bad)
        except AssertionError as e:
            base["message"] = "اجرای %d از %d: %s" % (k + 1, runs, str(e) or "شرط تست برقرار نیست")
            base["actual"] = clip(r["stdout"])
            return base
        except Exception as e:
            base["error"] = "خطا در چک‌کننده (به معلم اطلاع بده): %s" % clip(last_line("%s: %s" % (type(e).__name__, e)))[:200]
            return base
        base["runs_passed"] += 1
    if callable(ns.get("check_all")):
        try:
            res = ns["check_all"](ctxs)
            bad = judge_checker_result(res)
            if bad:
                raise AssertionError(bad)
        except AssertionError as e:
            base["message"] = "بررسی کلی اجراها: %s" % (str(e) or "شرط تست برقرار نیست")
            base["actual"] = clip(ctxs[-1].stdout)
            return base
        except Exception as e:
            base["error"] = "خطا در چک‌کننده (به معلم اطلاع بده): %s" % clip(last_line("%s: %s" % (type(e).__name__, e)))[:200]
            return base
    base["passed"] = True
    base["actual"] = clip(ctxs[-1].stdout)
    return base


results = []
for idx, test in enumerate(SPEC["tests"]):
    try:
        results.append(grade_test(idx, test))
    except Exception as e:  # never let one broken test kill the whole grading
        results.append({"id": idx, "kind": test.get("kind", "exact"), "hidden": bool(test.get("hidden")), "passed": False,
                        "input": "", "expected": "", "actual": "", "error": "خطای داخلی تصحیح: %s" % e,
                        "message": "", "runs": 1, "runs_passed": 0})
sys.stdout.write(json.dumps({"results": results}, ensure_ascii=False))
