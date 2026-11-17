"""Local tests for the server-side grader harness:  python3 tools/grader/test_grader.py"""
import json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))


def grade(code, tests, **extra):
    d = tempfile.mkdtemp()
    try:
        for f in ("main.py", "runner.py"):
            shutil.copy(os.path.join(HERE, f), d)
        open(os.path.join(d, "student.py"), "w", encoding="utf-8").write(code)
        open(os.path.join(d, "spec.json"), "w", encoding="utf-8").write(json.dumps({"tests": tests, **extra}))
        p = subprocess.run([sys.executable, "main.py"], cwd=d, capture_output=True, text=True, timeout=120)
        assert p.returncode == 0, p.stderr
        return json.loads(p.stdout)["results"]
    finally:
        shutil.rmtree(d, ignore_errors=True)


fails = 0
def check(name, cond, extra=""):
    global fails
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else "  -> " + str(extra)))
    fails += 0 if cond else 1


# 1. plain exact, with input() whose prompt must NOT pollute the output
r = grade('a=int(input("عدد؟ "))\nprint(a*2)', [{"kind": "exact", "input": "4\n", "expected": "8"}])
check("exact pass", r[0]["passed"], r)
r = grade('print(1)', [{"kind": "exact", "input": "", "expected": "2"}])
check("exact fail", not r[0]["passed"] and r[0]["actual"] == "1", r)

# 2. runtime error + hidden test masks input/expected/actual
r = grade('print(1/0)', [{"kind": "exact", "input": "secret-in", "expected": "secret-out", "hidden": True}])
check("hidden masks details", r[0]["input"] == "" and r[0]["expected"] == "" and r[0]["actual"] == "" and "ZeroDivisionError" in r[0]["error"], r)

# 3. seeded exact: same seed -> same output; teacher computes expected with the same seed
import random as _r
g = _r.Random(7); exp = str(g.randint(1, 100))
r = grade('import random\nprint(random.randint(1,100))', [{"kind": "exact", "expected": exp, "random": "seed: 7"}])
check("seeded exact", r[0]["passed"], (r, exp))

# 4. scripted values: independent queues per function, any interleaving of different functions
code = 'import random\nd=random.randint(1,6)\nc=random.choice(["a","b","c"])\nprint(d, c)'
r = grade(code, [{"kind": "exact", "expected": "4 c", "random": "randint: 4\nchoice: 2"}])
check("scripted pass", r[0]["passed"], r)
code2 = 'import random\nc=random.choice(["a","b","c"])\nd=random.randint(1,6)\nprint(d, c)'
r = grade(code2, [{"kind": "exact", "expected": "4 c", "random": "randint: 4\nchoice: 2"}])
check("scripted order across different functions is irrelevant", r[0]["passed"], r)
r = grade('import random\nrandom.randint(1,6)\nrandom.randint(1,6)\nprint(1)', [{"kind": "exact", "expected": "1", "random": "randint: 4"}])
check("scripted exhausted -> clear message", (not r[0]["passed"]) and "بیشتر از 1 بار" in (r[0]["error"] or ""), r)
r = grade('import random\nprint(random.randint(1,6))', [{"kind": "exact", "expected": "9", "random": "randint: 9"}])
check("scripted out of range -> error", not r[0]["passed"] and "خارج از بازه" in (r[0]["error"] or ""), r)
r = grade('from random import randint\nprint(randint(1,6))', [{"kind": "exact", "expected": "5", "random": "randint: 5"}])
check("from random import randint is patched too", r[0]["passed"], r)

# 5. checker: dice simulation, every run must satisfy the property
chk = "def check(ctx):\n    n = ctx.numbers()\n    assert len(n)==1, 'باید فقط یک عدد چاپ کنی'\n    assert 1 <= n[0] <= 6, 'عدد باید بین ۱ تا ۶ باشه'\n"
r = grade('import random\nprint(random.randint(1,6))', [{"kind": "checker", "checker": chk, "runs": 8}])
check("checker pass over 8 runs", r[0]["passed"] and r[0]["runs_passed"] == 8, r)
r = grade('import random\nprint(random.randint(1,7))', [{"kind": "checker", "checker": chk, "runs": 20}])
check("checker fails when out of range sometimes", not r[0]["passed"] and "بین ۱ تا ۶" in r[0]["message"], r)
r = grade('print(3)', [{"kind": "checker", "checker": chk, "runs": 5, "hidden": True}, {"kind": "checker", "checker": "def check(ctx): pass\ndef check_all(cs):\n    assert len({c.stdout for c in cs})>1, 'خروجی همیشه یکسانه (hardcode؟)'", "runs": 5}])
check("check_all catches hardcoded output", r[0]["passed"] and not r[1]["passed"] and "hardcode" in r[1]["message"], r)
# trace-based: printed sum must equal the sum of generated values, order-independent
chk2 = "def check(ctx):\n    vals = ctx.results_of('randint')\n    assert len(vals)==2, 'دو بار randint'\n    assert ctx.numbers()==[sum(vals)], 'جمع اشتباه'"
r = grade('import random\na=random.randint(1,6)\nb=random.randint(1,6)\nprint(a+b)', [{"kind": "checker", "checker": chk2, "runs": 6}])
check("checker uses trace of random calls", r[0]["passed"], r)
r = grade('import random\nrandom.randint(1,6)\nrandom.randint(1,6)\nprint(7)', [{"kind": "checker", "checker": chk2, "runs": 6}])
check("hardcoded sum is rejected", not r[0]["passed"], r)
r = grade('print(1)', [{"kind": "checker", "checker": "def check(ctx):\n    undefined_name", "runs": 2}])
check("broken checker is reported as checker error", "چک‌کننده" in (r[0]["error"] or "") and "NameError" in r[0]["error"], r)

# 6. safety: infinite loop, flood of output, student cannot read the spec / checker
r = grade('while True: pass', [{"kind": "exact", "expected": "x"}], timeout=1)
check("infinite loop -> timeout", not r[0]["passed"] and "طول کشید" in r[0]["error"], r)
r = grade('while True: print("x"*1000)', [{"kind": "exact", "expected": "x"}], timeout=5)
check("output flood is cut", not r[0]["passed"] and r[0]["error"], r)
spy = 'import os, glob\nfound = [p for p in glob.glob("/tmp/**/spec.json", recursive=True)] + glob.glob("spec.json") + glob.glob("../spec.json")\nprint(len(found))'
r = grade(spy, [{"kind": "exact", "expected": "0", "hidden": True}])
check("spec.json is not readable from the student's process", r[0]["passed"], r)

print("\nfailures:", fails)
sys.exit(1 if fails else 0)
