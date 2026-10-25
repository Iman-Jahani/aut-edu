// Tiny ANSI SGR parser so colored program output (termcolor, colorama, rich,
// "\x1b[31m...") shows up colored instead of as garbage characters.

export interface AnsiSpan {
  text: string;
  color?: string;
  background?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

// Tuned for the dark output panel.
const BASIC = ["#1f2937", "#f87171", "#4ade80", "#facc15", "#60a5fa", "#e879f9", "#22d3ee", "#e5e7eb"];
const BRIGHT = ["#6b7280", "#fca5a5", "#86efac", "#fde047", "#93c5fd", "#f0abfc", "#67e8f9", "#ffffff"];

function color256(n: number): string | undefined {
  if (n < 0 || n > 255) return undefined;
  if (n < 8) return BASIC[n];
  if (n < 16) return BRIGHT[n - 8];
  if (n >= 232) {
    const g = 8 + (n - 232) * 10;
    return `rgb(${g},${g},${g})`;
  }
  const i = n - 16;
  const c = (v: number) => (v === 0 ? 0 : 55 + v * 40);
  return `rgb(${c(Math.floor(i / 36))},${c(Math.floor((i % 36) / 6))},${c(i % 6)})`;
}

// eslint-disable-next-line no-control-regex
const SGR = /\x1b\[([0-9;]*)m/g;
// eslint-disable-next-line no-control-regex
const OTHER_ESC = /\x1b\[[0-9;?]*[A-Za-ln-z]|\x1b\][^\x07]*\x07/g;

export function stripAnsi(text: string): string {
  return text.replace(SGR, "").replace(OTHER_ESC, "");
}

export function parseAnsi(input: string): AnsiSpan[] {
  const text = input.replace(OTHER_ESC, "");
  const spans: AnsiSpan[] = [];
  let state: Omit<AnsiSpan, "text"> = {};
  let last = 0;
  let m: RegExpExecArray | null;
  SGR.lastIndex = 0;

  const push = (chunk: string) => {
    if (chunk) spans.push({ text: chunk, ...state });
  };

  while ((m = SGR.exec(text))) {
    push(text.slice(last, m.index));
    last = m.index + m[0].length;
    const codes = m[1] === "" ? [0] : m[1].split(";").map((x) => parseInt(x, 10) || 0);
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c === 0) state = {};
      else if (c === 1) state = { ...state, bold: true };
      else if (c === 2) state = { ...state, dim: true };
      else if (c === 3) state = { ...state, italic: true };
      else if (c === 4) state = { ...state, underline: true };
      else if (c === 22) state = { ...state, bold: false, dim: false };
      else if (c === 23) state = { ...state, italic: false };
      else if (c === 24) state = { ...state, underline: false };
      else if (c >= 30 && c <= 37) state = { ...state, color: BASIC[c - 30] };
      else if (c === 39) state = { ...state, color: undefined };
      else if (c >= 90 && c <= 97) state = { ...state, color: BRIGHT[c - 90] };
      else if (c >= 40 && c <= 47) state = { ...state, background: BASIC[c - 40] };
      else if (c === 49) state = { ...state, background: undefined };
      else if (c >= 100 && c <= 107) state = { ...state, background: BRIGHT[c - 100] };
      else if (c === 38 || c === 48) {
        const key = c === 38 ? "color" : "background";
        if (codes[i + 1] === 5) {
          state = { ...state, [key]: color256(codes[i + 2]) };
          i += 2;
        } else if (codes[i + 1] === 2) {
          state = { ...state, [key]: `rgb(${codes[i + 2] || 0},${codes[i + 3] || 0},${codes[i + 4] || 0})` };
          i += 4;
        }
      }
    }
  }
  push(text.slice(last));
  return spans;
}
