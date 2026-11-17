# Runs ONE execution of the student's program (spawned by main.py in an empty temp dir).
# - input() reads the next stdin line without echoing the prompt (same as the exercise checker).
# - the random module is patched: calls are recorded in a trace, optionally fed from a script
#   (teacher-provided values), otherwise served by a Random seeded with G_SEED.
import sys, os, json, builtins, traceback, random

seed = int(os.environ.get("G_SEED", "1"))
script = json.loads(os.environ.get("G_RANDOM") or "{}")
trace_path = os.environ.get("G_TRACE", "")
trace = []
queues = {k: list(v) for k, v in script.items()}
_real = random.Random(seed)


class ScriptError(Exception):
    pass


def _j(x, depth=0):
    if x is None or isinstance(x, (bool, int, float)):
        return x
    if isinstance(x, str):
        return x if len(x) <= 200 else x[:200] + "…"
    if isinstance(x, (list, tuple)) and depth < 2:
        return [_j(i, depth + 1) for i in list(x)[:50]]
    r = repr(x)
    return r if len(r) <= 200 else r[:200] + "…"


def _scripted(name, v, args):
    if name == "randint":
        a, b = args[0], args[1]
        v = int(v)
        if not a <= v <= b:
            raise ScriptError("randint(%s, %s): مقدار تعیین‌شده‌ی تست (%s) خارج از بازه است" % (a, b, v))
        return v
    if name == "randrange":
        v = int(v)
        if v not in range(*args):
            raise ScriptError("randrange%s: مقدار تعیین‌شده‌ی تست (%s) خارج از بازه است" % (tuple(args), v))
        return v
    if name == "random":
        return float(v)
    if name == "uniform":
        return float(v)
    if name == "choice":
        seq = args[0]
        i = int(v)
        if not 0 <= i < len(seq):
            raise ScriptError("choice: اندیس تعیین‌شده‌ی تست (%s) خارج از طول دنباله (%s) است" % (i, len(seq)))
        return seq[i]
    raise ScriptError("%s قابل‌تنظیم نیست" % name)


def _wrap(name):
    real_fn = getattr(_real, name)

    def f(*args, **kwargs):
        before = [_j(a) for a in args]
        if name in queues:
            q = queues[name]
            if not q:
                raise ScriptError("%s() بیشتر از %d بار صدا زده شد؛ تست انتظار این تعداد فراخوانی رو نداشت" % (name, len(script[name])))
            value = _scripted(name, q.pop(0), args)
        else:
            value = real_fn(*args, **kwargs)
        res = _j(args[0]) if name == "shuffle" and args else _j(value)
        trace.append({"fn": name, "args": before, "result": res})
        return value

    f.__name__ = name
    return f


for _n in ("random", "randint", "randrange", "choice", "choices", "sample", "shuffle", "uniform",
           "gauss", "normalvariate", "triangular", "betavariate", "expovariate", "getrandbits", "randbytes"):
    if hasattr(_real, _n):
        setattr(random, _n, _wrap(_n))
random.seed = lambda a=None, version=2: _real.seed(a, version)


def _input(prompt=""):
    line = sys.stdin.readline()
    if not line:
        raise EOFError("EOF when reading a line")
    return line.rstrip("\n")


builtins.input = _input


def _save():
    try:
        sys.stdout.flush()
    except Exception:
        pass
    if trace_path:
        try:
            with open(trace_path, "w", encoding="utf-8") as fh:
                json.dump(trace[:2000], fh)
        except Exception:
            pass


src = open("student.py", encoding="utf-8").read()
g = {"__name__": "__main__"}
code = 0
try:
    exec(compile(src, "<cell>", "exec"), g)
except SystemExit:
    pass
except ScriptError as e:
    sys.stdout.flush()
    print("ScriptError: %s" % e, file=sys.stderr)
    code = 3
except BaseException as e:
    sys.stdout.flush()
    tb = e.__traceback__.tb_next if e.__traceback__ else None
    print("".join(traceback.format_exception(type(e), e, tb)), file=sys.stderr, end="")
    code = 1
_save()
sys.exit(code)
