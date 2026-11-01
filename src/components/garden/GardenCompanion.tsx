"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Minus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import GardenScene, { CHAR_X, GROUND_Y, PLANT_X, VB_H, VB_W, SceneRefs } from "@/components/garden/GardenScene";
import {
  GARDEN_EVENT,
  GARDEN_VISIBILITY_EVENT,
  GROWTH_FULL,
  GardenState,
  SHADE_AT,
  STAGES,
  clamp,
  isGardenCollapsed,
  isGardenHidden,
  isQuietPath,
  isWorkPath,
  loadGarden,
  saveGarden,
  setGardenCollapsed,
  stageIndex,
} from "@/lib/garden";

const fa = (n: number) => n.toLocaleString("fa-IR");
const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

const POKED = ["هی! قلقلکم نده 😄", "سلام! من جوانه‌م 🌱", "داشتم به بذر نگاه می‌کردم 👀", "بیا با هم بزرگش کنیم!"] as const;
const WOKE = ["هوم؟ خواب بودم 😴", "پنج دقیقه‌ی دیگه…", "این سایه خیلی می‌چسبه 😎"] as const;
const CHATTER = ["هر دقیقه کد زدن، بذر رو بزرگ‌تر می‌کنه 🌱", "من همین‌جام، راحت کد بزن 🍃", "خطا یعنی داری یاد می‌گیری؛ ادامه بده 💪", "روی گیاه بزن تا آبش بدم 💧"] as const;
const STAGE_SAY = ["", "جوانه زد! 🌱", "داره نهال می‌شه 🌿", "گیاه جوون شدم! 🪴", "داره درخت می‌شه 🌳", "سایه‌دار شد! بریم لم بدیم 😎"] as const;

interface Fx {
  id: number;
  emoji: string;
  left: number; // %
  top: number; // %
}

export default function GardenCompanion() {
  const pathname = usePathname();
  const { user } = useAuth();
  const userKey = user?.id ?? "anon";
  const scrollMode = pathname === "/";
  const work = isWorkPath(pathname);
  const quiet = isQuietPath(pathname);

  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [state, setState] = useState<GardenState>({ points: 0, trees: 0 });
  const [scrollG, setScrollG] = useState(0);
  const [shown, setShown] = useState(0);
  const [motion, setMotion] = useState(true);

  const [excited, setExcited] = useState(false);
  const [blink, setBlink] = useState(false);
  const [peek, setPeek] = useState(false);
  const [waving, setWaving] = useState(false);
  const [hopping, setHopping] = useState(false);
  const [wiggling, setWiggling] = useState(false);
  const [seedDrop, setSeedDrop] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const [fx, setFx] = useState<Fx[]>([]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const refs = useMemo<SceneRefs>(() => ({ pupilL: { current: null }, pupilR: { current: null }, wind: { current: null } }), []);
  const lastInput = useRef(Date.now());
  const lastWater = useRef(0);
  const look = useRef({ dx: 0, dy: 0 });
  const loadedKey = useRef<string | null>(null);
  const prevStage = useRef(0);
  const shownRef = useRef(0);
  const activeTicks = useRef(0);
  const timers = useRef<number[]>([]);
  const fxId = useRef(0);
  const tapCount = useRef(0);

  const target = scrollMode ? scrollG : state.points / GROWTH_FULL;
  const lounge = shown >= SHADE_AT;
  const stage = stageIndex(target);
  const visible = mounted && !hidden && !quiet;

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }, []);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const say = useCallback(
    (text: string, ms = 3800) => {
      setBubble(text);
      later(() => setBubble((cur) => (cur === text ? null : cur)), ms);
    },
    [later]
  );

  const spawn = useCallback(
    (emoji: string, count: number, around: "char" | "plant") => {
      const baseX = ((around === "char" ? (lounge ? PLANT_X - 60 : CHAR_X) : PLANT_X) / VB_W) * 100;
      const baseY = ((GROUND_Y - (around === "char" ? 60 : 70)) / VB_H) * 100;
      const items = Array.from({ length: count }, () => ({ id: ++fxId.current, emoji, left: baseX + (Math.random() - 0.5) * 16, top: baseY + (Math.random() - 0.5) * 10 }));
      setFx((cur) => [...cur.slice(-6), ...items]);
      later(() => setFx((cur) => cur.filter((f) => !items.some((i) => i.id === f.id))), 1500);
    },
    [later, lounge]
  );

  const hop = useCallback(() => {
    setHopping(true);
    later(() => setHopping(false), 560);
  }, [later]);

  // ---- setup: stored preferences, motion preference ----
  useEffect(() => {
    setMounted(true);
    setHidden(isGardenHidden());
    setCollapsed(isGardenCollapsed() ?? false);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setMotion(!mq.matches);
    const on = () => setMotion(!mq.matches);
    mq.addEventListener("change", on);
    const onVis = (e: Event) => setHidden(!!(e as CustomEvent).detail);
    window.addEventListener(GARDEN_VISIBILITY_EVENT, onVis);
    return () => {
      mq.removeEventListener("change", on);
      window.removeEventListener(GARDEN_VISIBILITY_EVENT, onVis);
    };
  }, []);

  // ---- load / save the persistent garden (per account) ----
  useEffect(() => {
    if (!mounted) return;
    const loaded = loadGarden(userKey);
    setState(loaded);
    prevStage.current = stageIndex(loaded.points / GROWTH_FULL); // already-reached stages are not news
    loadedKey.current = userKey;
  }, [mounted, userKey]);
  useEffect(() => {
    if (loadedKey.current === userKey) saveGarden(userKey, state);
  }, [state, userKey]);

  // ---- growth: time on class pages, plus bonuses other code announces ----
  const add = useCallback((n: number) => setState((s) => ({ ...s, points: clamp(s.points + n, 0, GROWTH_FULL) })), []);
  useEffect(() => {
    const onGrow = (e: Event) => {
      if (scrollMode) return;
      const { amount, reason } = (e as CustomEvent).detail as { amount: number; reason: string };
      add(amount);
      if (reason === "solved") {
        spawn("💚", 3, "plant");
        say("آفرین! تمرین رو حل کردی 🎉");
        hop();
      }
    };
    window.addEventListener(GARDEN_EVENT, onGrow);
    return () => window.removeEventListener(GARDEN_EVENT, onGrow);
  }, [add, scrollMode, spawn, say, hop]);

  useEffect(() => {
    if (!work) return;
    const id = window.setInterval(() => {
      const active = document.visibilityState === "visible" && Date.now() - lastInput.current < 60_000;
      if (!active) return;
      add(1);
      activeTicks.current += 1;
      if (activeTicks.current % 270 === 0) say("یه استراحت کوتاه می‌چسبه؛ یه لیوان آب بخور ☕", 5000);
    }, 10_000);
    return () => window.clearInterval(id);
  }, [work, add, say]);

  // ---- finished tree → a new seed ----
  useEffect(() => {
    if (scrollMode || state.points < GROWTH_FULL) return;
    say("درخت کامل شد! 🎉 یه بذر جدید می‌کارم", 4500);
    spawn("🍃", 4, "plant");
    const id = window.setTimeout(() => {
      setState((s) => ({ points: 0, trees: s.trees + 1 }));
      setSeedDrop(true);
      later(() => setSeedDrop(false), 1300);
    }, 5200);
    return () => window.clearTimeout(id);
  }, [state.points, scrollMode, say, spawn, later]);

  // ---- scroll drives growth on the landing page ----
  useEffect(() => {
    if (!scrollMode) return;
    const calc = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollG(clamp(max > 0 ? (window.scrollY / max) * 1.04 : 0));
    };
    calc();
    window.addEventListener("scroll", calc, { passive: true });
    window.addEventListener("resize", calc);
    return () => {
      window.removeEventListener("scroll", calc);
      window.removeEventListener("resize", calc);
    };
  }, [scrollMode]);

  // ---- ease the drawn size toward the real value so growth is visible, never a jump ----
  // (the loop stops as soon as it arrives, so an idle garden costs nothing)
  useEffect(() => {
    if (!motion) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    let raf = 0;
    const step = () => {
      const d = target - shownRef.current;
      if (Math.abs(d) < 0.0006) {
        shownRef.current = target;
        setShown(target);
        return;
      }
      shownRef.current += Math.sign(d) * Math.min(Math.abs(d) * 0.07 + 0.0004, 0.02);
      setShown(shownRef.current);
      raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [target, motion]);

  // ---- say something when it reaches a new stage ----
  useEffect(() => {
    if (!visible || collapsed) {
      prevStage.current = stage;
      return;
    }
    if (stage > prevStage.current && STAGE_SAY[stage]) {
      say(STAGE_SAY[stage], 4200);
      spawn("🍃", 3, "plant");
      hop();
    }
    prevStage.current = stage;
  }, [stage, visible, collapsed, say, spawn, hop]);

  // ---- first appearance: plant the seed ----
  useEffect(() => {
    if (!visible || collapsed || target > 0.03) return;
    let greeted = false;
    try {
      greeted = sessionStorage.getItem("garden:greeted") === "1";
      sessionStorage.setItem("garden:greeted", "1");
    } catch {
      /* ignore */
    }
    if (greeted) return;
    setSeedDrop(true);
    later(() => setSeedDrop(false), 1300);
    later(() => say(scrollMode ? "یه بذر می‌کارم؛ اسکرول کن تا بزرگ بشه ↓" : "یه بذر کاشتم! با وقت گذاشتن و کد زدن بزرگ می‌شه 🌱", 5200), 1300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, collapsed]);

  // ---- eyes follow the pointer, the plant sways, he gets excited when you come close ----
  const applyPupils = useCallback(() => {
    const { dx, dy } = look.current;
    refs.pupilL.current?.setAttribute("transform", `translate(${-8.5 + dx} ${-31 + dy})`);
    refs.pupilR.current?.setAttribute("transform", `translate(${8.5 + dx} ${-31 + dy})`);
  }, [refs]);
  useEffect(applyPupils, [applyPupils, blink, lounge, peek, collapsed, visible]);

  useEffect(() => {
    if (!visible || collapsed) return;
    let raf = 0;
    let pending: { x: number; y: number; mx: number } | null = null;
    let windTimer = 0;

    const track = () => {
      raf = 0;
      if (!pending || !wrapRef.current) return;
      const { x, y, mx } = pending;
      pending = null;
      const rect = wrapRef.current.getBoundingClientRect();
      const k = rect.width / VB_W;
      const ex = rect.left + (lounge ? PLANT_X - 70 : CHAR_X) * k;
      const ey = rect.top + (GROUND_Y - (lounge ? 18 : 31)) * k;
      const dx = x - ex;
      const dy = y - ey;
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, dist / 180);
      look.current = { dx: (dx / dist) * 2.5 * reach, dy: (dy / dist) * 2.2 * reach };
      applyPupils();

      const near = dist < 150;
      setExcited((v) => (v === near ? v : near));
      setWaving((v) => (v === (near && !lounge) ? v : near && !lounge));
      setPeek((v) => (v === (near && lounge) ? v : near && lounge));

      // wind: moving the pointer close to the plant makes it lean the way you move
      const px = rect.left + PLANT_X * k;
      const py = rect.top + (GROUND_Y - 60) * k;
      if (Math.hypot(x - px, y - py) < 260 * k && mx !== 0 && refs.wind.current) {
        refs.wind.current.style.transform = `rotate(${clamp(mx * 0.35, -7, 7)}deg)`;
        window.clearTimeout(windTimer);
        windTimer = window.setTimeout(() => {
          if (refs.wind.current) refs.wind.current.style.transform = "rotate(0deg)";
        }, 260);
      }
    };

    const onMove = (e: PointerEvent) => {
      lastInput.current = Date.now();
      pending = { x: e.clientX, y: e.clientY, mx: e.movementX || 0 };
      if (!raf) raf = window.requestAnimationFrame(track);
    };
    const onDown = (e: PointerEvent) => {
      lastInput.current = Date.now();
      pending = { x: e.clientX, y: e.clientY, mx: 0 };
      if (!raf) raf = window.requestAnimationFrame(track);
      // a tap anywhere gets his attention: a blink, and now and then a little hop
      tapCount.current += 1;
      setBlink(true);
      later(() => setBlink(false), 140);
      if (tapCount.current % 3 === 0) hop();
    };
    const onKey = () => (lastInput.current = Date.now());
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("keydown", onKey, { passive: true });
    window.addEventListener("scroll", onKey, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onKey);
      if (raf) window.cancelAnimationFrame(raf);
      window.clearTimeout(windTimer);
    };
  }, [visible, collapsed, lounge, applyPupils, refs, later, hop]);

  // ---- idle life: blinking, and an occasional remark ----
  useEffect(() => {
    if (!visible || collapsed || !motion) return;
    let id = 0;
    const loop = () => {
      id = window.setTimeout(() => {
        setBlink(true);
        later(() => setBlink(false), 150);
        loop();
      }, 2600 + Math.random() * 3800);
    };
    loop();
    return () => window.clearTimeout(id);
  }, [visible, collapsed, motion, later]);

  useEffect(() => {
    if (!visible || collapsed || scrollMode) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastInput.current > 6000 && Date.now() - lastInput.current < 60_000) say(pick(CHATTER), 4200);
    }, 150_000);
    return () => window.clearInterval(id);
  }, [visible, collapsed, scrollMode, say]);

  // ---- clicks on him / on the plant ----
  const onCharClick = () => {
    hop();
    spawn("💚", 2, "char");
    if (lounge) {
      setPeek(true);
      later(() => setPeek(false), 3200);
      say(pick(WOKE));
    } else {
      say(pick(POKED));
    }
  };
  const onPlantClick = () => {
    setWiggling(true);
    later(() => setWiggling(false), 720);
    const pct = Math.round(clamp(target) * 100);
    if (scrollMode) return say("اسکرول کن تا بزرگ بشه ↓", 2800);
    const now = Date.now();
    if (now - lastWater.current > 12_000 && state.points < GROWTH_FULL) {
      lastWater.current = now;
      add(3);
      spawn("💧", 4, "plant");
      say(`ممنون! 💧 ${STAGES[stage].name}، ${fa(pct)}٪ رشد کرده`, 3600);
    } else {
      say(`${STAGES[stage].name} · ${fa(pct)}٪ رشد ${state.trees ? `· ${fa(state.trees)} درخت قبلاً بزرگ کردی` : ""}`, 3200);
    }
  };

  const toggle = (v: boolean) => {
    setCollapsed(v);
    setGardenCollapsed(v);
  };

  if (!visible) return null;

  if (collapsed) {
    const c = 2 * Math.PI * 17;
    return (
      <button
        onClick={() => toggle(false)}
        className="fixed bottom-3 left-3 z-[45] w-12 h-12 rounded-full bg-white border border-line shadow-soft grid place-items-center hover:shadow-lift transition"
        title={`جوانه · ${STAGES[stage].name} (${fa(Math.round(target * 100))}٪)`}
        aria-label="نمایش جوانه و باغچه"
      >
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 40 40" aria-hidden>
          <circle cx={20} cy={20} r={17} fill="none" stroke="#d9e8e3" strokeWidth={3} />
          <circle cx={20} cy={20} r={17} fill="none" stroke="#3fbf7f" strokeWidth={3} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - c * clamp(target)} />
        </svg>
        <span className="text-xl relative">{STAGES[stage].emoji}</span>
      </button>
    );
  }

  const charLeft = ((lounge ? PLANT_X - 70 : CHAR_X) / VB_W) * 100;

  return (
    <div className="fixed bottom-1 left-1 z-[45] w-[138px] sm:w-[200px] pointer-events-none select-none" role="group" aria-label="جوانه، همراه باغبان">
      {bubble && (
        <div key={bubble} className="gc-bubble absolute left-1 bottom-full mb-1 max-w-[min(210px,72vw)] w-max rounded-2xl rounded-bl-md border border-line bg-white px-3 py-2 text-[11.5px] font-bold leading-5 text-ink shadow-soft" style={{ pointerEvents: "none" }}>
          {bubble}
          <span className="absolute -bottom-1 w-2.5 h-2.5 rotate-45 bg-white border-b border-r border-line" style={{ left: `${Math.min(80, Math.max(8, charLeft - 6))}%` }} />
        </div>
      )}
      <button
        onClick={() => toggle(true)}
        className="pointer-events-auto absolute top-0 right-0 w-6 h-6 rounded-full bg-white/80 border border-line text-muted hover:text-ink grid place-items-center opacity-60 hover:opacity-100 transition"
        title="کوچک کردن"
        aria-label="کوچک کردن جوانه"
      >
        <Minus size={12} />
      </button>
      <div ref={wrapRef} className="relative">
        <GardenScene
          g={shown}
          trees={state.trees}
          lounge={lounge}
          excited={excited}
          blink={blink}
          peek={peek}
          waving={waving}
          hopping={hopping}
          wiggling={wiggling}
          seedDrop={seedDrop}
          refs={refs}
          motion={motion}
          onCharClick={onCharClick}
          onPlantClick={onPlantClick}
        />
        {motion &&
          fx.map((f) => (
            <span key={f.id} className="gc-fx absolute text-base" style={{ left: `${f.left}%`, top: `${f.top}%` }} aria-hidden>
              {f.emoji}
            </span>
          ))}
      </div>
    </div>
  );
}
