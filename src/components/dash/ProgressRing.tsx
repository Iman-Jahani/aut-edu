/** Circular progress meter. `onDark` draws it white-on-black for hero panels. */
export default function ProgressRing({
  value,
  size = 132,
  stroke = 11,
  label,
  sub,
  onDark = false,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  sub?: string;
  onDark?: boolean;
}) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label ?? v}`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={onDark ? "rgba(255,255,255,.16)" : "#e7e2d6"} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={onDark ? "#f2a93b" : "#0b6b70"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * v) / 100}
          style={{ transition: "stroke-dashoffset .9s cubic-bezier(.2,.7,.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-tight">
        <div>
          <div className="font-black tabular-nums" style={{ fontSize: size * 0.25 }}>
            {label ?? `${v.toLocaleString("fa-IR")}٪`}
          </div>
          {sub && <div className={`text-[11px] mt-0.5 ${onDark ? "text-white/55" : "text-muted"}`}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}
