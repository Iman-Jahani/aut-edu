// The "garden companion": a seed that grows into a tree while you spend time on classes and write code.
// This file is the pure part (numbers, stages, storage); the drawing lives in components/garden.

/** Growth points needed for a finished tree. About 6 points per active minute, plus bonuses for running code. */
export const GROWTH_FULL = 1000;
export const GARDEN_EVENT = "garden:grow";
const VISIBILITY_EVENT = "garden:visibility";

export type GrowthReason = "tick" | "run" | "submit" | "solved" | "water";

/** Anything can call this ("I just ran code") without knowing the garden exists. */
export function growGarden(amount: number, reason: GrowthReason) {
  if (typeof window === "undefined" || amount <= 0) return;
  window.dispatchEvent(new CustomEvent(GARDEN_EVENT, { detail: { amount, reason } }));
}

/** Stage boundaries as a fraction of GROWTH_FULL. */
export const STAGES = [
  { min: 0, name: "بذر", emoji: "🌰" },
  { min: 0.03, name: "جوانه", emoji: "🌱" },
  { min: 0.1, name: "نهال", emoji: "🌿" },
  { min: 0.25, name: "گیاه جوان", emoji: "🪴" },
  { min: 0.5, name: "درخت جوان", emoji: "🌳" },
  { min: 0.85, name: "درخت پرسایه", emoji: "🌳" },
] as const;

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function stageIndex(g: number): number {
  let idx = 0;
  STAGES.forEach((s, i) => {
    if (g >= s.min) idx = i;
  });
  return idx;
}

/** The tree is big enough to shade the character (he lies down under it). */
export const SHADE_AT = 0.85;

export interface GardenState {
  points: number;
  /** finished trees (each one is planted again as a new seed) */
  trees: number;
}

const key = (userKey: string) => `garden:v1:${userKey}`;

export function loadGarden(userKey: string): GardenState {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(key(userKey)) : null;
    if (!raw) return { points: 0, trees: 0 };
    const d = JSON.parse(raw);
    return { points: clamp(Number(d.points) || 0, 0, GROWTH_FULL), trees: Math.max(0, Math.floor(Number(d.trees) || 0)) };
  } catch {
    return { points: 0, trees: 0 };
  }
}

export function saveGarden(userKey: string, s: GardenState) {
  try {
    window.localStorage.setItem(key(userKey), JSON.stringify(s));
  } catch {
    /* private mode / quota: the garden just won't remember */
  }
}

// ----- show / hide (the account menu has a switch) -----
const HIDDEN_KEY = "garden:hidden";
const COLLAPSED_KEY = "garden:collapsed";

export function isGardenHidden(): boolean {
  try {
    return window.localStorage.getItem(HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}
export function setGardenHidden(hidden: boolean) {
  try {
    window.localStorage.setItem(HIDDEN_KEY, hidden ? "1" : "0");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(VISIBILITY_EVENT, { detail: hidden }));
}
export const GARDEN_VISIBILITY_EVENT = VISIBILITY_EVENT;

export function isGardenCollapsed(): boolean | null {
  try {
    const v = window.localStorage.getItem(COLLAPSED_KEY);
    return v === null ? null : v === "1";
  } catch {
    return null;
  }
}
export function setGardenCollapsed(v: boolean) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Pages where time spent counts as "working on the class". */
export function isWorkPath(pathname: string): boolean {
  return pathname.startsWith("/class") || pathname.startsWith("/playground");
}
/** Pages where the garden stays out of the way entirely. */
export function isQuietPath(pathname: string): boolean {
  return pathname.startsWith("/login") || pathname.startsWith("/signup") || pathname.startsWith("/admin");
}
