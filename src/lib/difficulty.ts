export interface DifficultyInfo {
  value: number;
  en: string;
  fa: string;
  /** Tailwind classes for the badge */
  cls: string;
}

export const DIFFICULTIES: DifficultyInfo[] = [
  { value: 1, en: "Basic", fa: "پایه", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  { value: 2, en: "Easy", fa: "آسان", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: 3, en: "Medium", fa: "متوسط", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: 4, en: "Hard", fa: "سخت", cls: "bg-red-50 text-red-700 border-red-200" },
];

export function getDifficulty(v: number | null | undefined): DifficultyInfo | null {
  return DIFFICULTIES.find((d) => d.value === v) || null;
}

/** Suggestions for the topic input; any text is still allowed. */
export const TOPIC_SUGGESTIONS = ["Python", "Mathematics"];
