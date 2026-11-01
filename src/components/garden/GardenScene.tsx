import type { RefObject } from "react";
import { SHADE_AT, clamp, smooth } from "@/lib/garden";

// ---------------------------------------------------------------------------
// The picture only: the seed-to-tree plant (drawn from one number `g` in 0..1, so growth is continuous)
// and the little character. All behaviour lives in GardenCompanion.
// ---------------------------------------------------------------------------

export const VB_W = 260;
export const VB_H = 220;
export const GROUND_Y = 186;
export const PLANT_X = 172;
export const CHAR_X = 74;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, clamp(t)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

export interface SceneRefs {
  pupilL: RefObject<SVGGElement>;
  pupilR: RefObject<SVGGElement>;
  /** wind from the pointer: its transform is set from outside */
  wind: RefObject<SVGGElement>;
}

export interface SceneProps {
  g: number;
  trees: number;
  lounge: boolean;
  excited: boolean;
  blink: boolean;
  peek: boolean;
  waving: boolean;
  hopping: boolean;
  wiggling: boolean;
  seedDrop: boolean;
  refs?: SceneRefs;
  /** false when the visitor prefers reduced motion */
  motion?: boolean;
  /** emit plain transform attributes (for rendering a still image) */
  still?: boolean;
  onCharClick?: () => void;
  onPlantClick?: () => void;
}

/** CSS-driven transform with a smooth transition, or a plain attribute in `still` mode. */
function place(still: boolean | undefined, x: number, y: number, rot = 0, scale = 1) {
  if (still) return { transform: `translate(${x} ${y}) rotate(${rot}) scale(${scale})` };
  return {
    style: {
      transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`,
      transition: "transform .9s cubic-bezier(.2,.8,.2,1)",
    } as React.CSSProperties,
  };
}

const LEAF = (s: number) => `M0 0 C ${s * 0.3} ${-s * 0.75}, ${s * 1.2} ${-s * 0.55}, ${s * 1.6} 0 C ${s * 1.2} ${s * 0.55}, ${s * 0.3} ${s * 0.75}, 0 0 Z`;

// ---------------------------------------------------------------------------
// Plant
// ---------------------------------------------------------------------------
export function PlantArt({ g, wiggling, motion = true }: { g: number; wiggling?: boolean; motion?: boolean }) {
  const t = clamp((g - 0.025) / 0.85); // growth of the stem
  const H = g < 0.03 ? 0 : 104 * (1 - Math.pow(1 - t, 2.2));
  const wb = 2.4 + 13 * Math.pow(t, 1.3); // trunk width at the base
  const wt = wb * 0.42; //                     … and at the top
  const trunk = mix("#46c27d", "#86582f", smooth(0.28, 0.62, g));
  const cR = 52 * Math.pow(smooth(0.3, 0.82, g), 0.85);
  const leafFade = 1 - smooth(0.38, 0.52, g);
  const pairs = 1 + Math.floor(t * 4.5);
  const ls = 6 + 7 * Math.min(1, t * 2.4);
  const branch = smooth(0.5, 0.72, g);
  const bloom = smooth(0.93, 1, g);

  if (H <= 0) return null;
  const sway = motion ? "gc-sway" : "";

  return (
    <g className={wiggling && motion ? "gc-wiggle" : ""}>
      <g className={sway} style={{ ["--amp" as string]: String(0.4 + g * 1.1) }}>
        {/* branches */}
        {branch > 0.01 && (
          <g stroke={trunk} strokeLinecap="round" fill="none" opacity={branch}>
            <path d={`M0 ${-H * 0.5} Q ${-cR * 0.35} ${-H * 0.62} ${-cR * 0.7} ${-H * 0.8}`} strokeWidth={Math.max(1.5, wb * 0.34)} />
            <path d={`M0 ${-H * 0.58} Q ${cR * 0.35} ${-H * 0.7} ${cR * 0.72} ${-H * 0.84}`} strokeWidth={Math.max(1.5, wb * 0.3)} />
          </g>
        )}
        {/* trunk / stem */}
        <path
          d={`M ${-wb / 2} 0 C ${-wb / 2} ${-H * 0.4}, ${-wt / 2} ${-H * 0.6}, ${-wt / 2} ${-H} L ${wt / 2} ${-H} C ${wt / 2} ${-H * 0.6}, ${wb / 2} ${-H * 0.4}, ${wb / 2} 0 Z`}
          fill={trunk}
        />
        <ellipse cx={0} cy={0} rx={wb * 0.85} ry={2.2} fill={trunk} opacity={0.9} />

        {/* leaves along the stem (fade out as the canopy takes over) */}
        {leafFade > 0.02 && (
          <g>
            {Array.from({ length: pairs }).map((_, i) => {
              const pop = clamp(t * 5 - i) * leafFade; // shrink away under the growing canopy
              if (pop <= 0.02) return null;
              const y = -H * (0.18 + (0.72 * i) / Math.max(1, pairs));
              const a = 24 + (i % 2) * 14;
              const col = i % 2 ? "#3aa96c" : "#46c27d";
              return (
                <g key={i}>
                  <g transform={`translate(${wb / 2 - 0.5} ${y}) rotate(${-a}) scale(${pop})`}>
                    <path d={LEAF(ls)} fill={col} />
                  </g>
                  <g transform={`translate(${-wb / 2 + 0.5} ${y}) scale(-1 1) rotate(${-a}) scale(${pop})`}>
                    <path d={LEAF(ls)} fill={col} />
                  </g>
                </g>
              );
            })}
            {/* top bud */}
            <g transform={`translate(0 ${-H}) rotate(-38) scale(${(0.7 + 0.5 * Math.min(1, t * 3)) * leafFade})`}>
              <path d={LEAF(ls * 0.9)} fill="#5fd08e" />
            </g>
            <g transform={`translate(0 ${-H}) scale(-1 1) rotate(-38) scale(${(0.7 + 0.5 * Math.min(1, t * 3)) * leafFade})`}>
              <path d={LEAF(ls * 0.9)} fill="#5fd08e" />
            </g>
          </g>
        )}

        {/* canopy */}
        {cR > 1 && (
          <g>
            <circle cx={-cR * 0.82} cy={-H + cR * 0.18} r={cR * 0.68} fill="url(#gc-canopy-dark)" />
            <circle cx={cR * 0.84} cy={-H + cR * 0.12} r={cR * 0.7} fill="url(#gc-canopy-dark)" />
            <circle cx={0} cy={-H - cR * 0.2} r={cR} fill="url(#gc-canopy)" />
            <circle cx={cR * 0.1} cy={-H - cR * 0.62} r={cR * 0.62} fill="url(#gc-canopy)" />
            <circle cx={-cR * 0.34} cy={-H - cR * 0.5} r={cR * 0.34} fill="#7be0a4" opacity={0.55} />
            <circle cx={cR * 0.38} cy={-H - cR * 0.12} r={cR * 0.2} fill="#7be0a4" opacity={0.4} />
            {bloom > 0.02 &&
              [
                [-0.55, -0.35],
                [0.4, -0.7],
                [0.75, 0.05],
                [-0.9, 0.2],
                [0.05, 0.1],
              ].map(([bx, by], i) => (
                <g key={i} transform={`translate(${bx * cR} ${-H + by * cR}) scale(${bloom})`}>
                  <circle r={3.1} fill="#fff" />
                  <circle r={1.3} fill="#ffd166" />
                </g>
              ))}
          </g>
        )}
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Character
// ---------------------------------------------------------------------------
function Character({ lounge, excited, blink, peek, waving, refs, motion }: Pick<SceneProps, "lounge" | "excited" | "blink" | "peek" | "waving" | "refs" | "motion">) {
  const eyesClosed = (lounge && !peek) || blink;
  return (
    <g>
      {/* feet */}
      <ellipse cx={-9} cy={-1.5} rx={7.5} ry={4.2} fill="#2a6fb0" />
      <ellipse cx={9} cy={-1.5} rx={7.5} ry={4.2} fill="#2a6fb0" />
      {/* arms */}
      {lounge ? (
        <>
          <ellipse cx={-19} cy={-40} rx={4.6} ry={8.5} transform="rotate(-35 -19 -40)" fill="#3b8fd4" />
          <ellipse cx={19} cy={-40} rx={4.6} ry={8.5} transform="rotate(35 19 -40)" fill="#3b8fd4" />
        </>
      ) : (
        <>
          <ellipse cx={-22} cy={-20} rx={4.6} ry={8.5} transform="rotate(18 -22 -20)" fill="#3b8fd4" />
          <g className={waving && motion ? "gc-wave" : ""} style={{ transformOrigin: "21px -27px" }}>
            <ellipse cx={22} cy={-20} rx={4.6} ry={8.5} transform="rotate(-18 22 -20)" fill="#3b8fd4" />
          </g>
        </>
      )}
      {/* body */}
      <path d="M -22 -22 C -22 -53, 22 -53, 22 -22 C 22 -6, 13 0, 0 0 C -13 0, -22 -6, -22 -22 Z" fill="url(#gc-body)" />
      <ellipse cx={0} cy={-16} rx={12.5} ry={13} fill="#e6f6ff" opacity={0.92} />
      {/* leaf sprout on the head */}
      <g transform="translate(0 -46)">
        <path d="M0 0 C -2 -7, -1 -12, 0 -15" stroke="#2f9e5e" strokeWidth={2.2} fill="none" strokeLinecap="round" />
        <g transform="translate(0 -14) rotate(-40)">
          <path d={LEAF(8)} fill="#46c27d" />
        </g>
        <g transform="translate(0 -12) scale(-1 1) rotate(-30)">
          <path d={LEAF(6.5)} fill="#3fbf7f" />
        </g>
      </g>
      {/* cheeks */}
      <circle cx={-14.5} cy={-22.5} r={3.3} fill="#ff9fb2" opacity={0.55} />
      <circle cx={14.5} cy={-22.5} r={3.3} fill="#ff9fb2" opacity={0.55} />
      {/* eyes */}
      {eyesClosed ? (
        <g stroke="#13262f" strokeWidth={2} strokeLinecap="round" fill="none">
          <path d="M -13.5 -31 Q -8.5 -26.5 -3.5 -31" />
          <path d="M 3.5 -31 Q 8.5 -26.5 13.5 -31" />
        </g>
      ) : (
        <g>
          <circle cx={-8.5} cy={-31} r={6} fill="#fff" />
          <circle cx={8.5} cy={-31} r={6} fill="#fff" />
          <g ref={refs?.pupilL} transform="translate(-8.5 -31)">
            <g className="gc-pupil">
              <circle r={3} fill="#13262f" />
              <circle cx={1} cy={-1.1} r={1} fill="#fff" />
            </g>
          </g>
          <g ref={refs?.pupilR} transform="translate(8.5 -31)">
            <g className="gc-pupil">
              <circle r={3} fill="#13262f" />
              <circle cx={1} cy={-1.1} r={1} fill="#fff" />
            </g>
          </g>
        </g>
      )}
      {/* mouth */}
      {excited ? (
        <g>
          <ellipse cx={0} cy={-20} rx={3.6} ry={4} fill="#13262f" />
          <ellipse cx={0} cy={-18.6} rx={2.2} ry={1.8} fill="#ff7f93" />
        </g>
      ) : (
        <path d="M -4.5 -21 Q 0 -16.5 4.5 -21" stroke="#13262f" strokeWidth={1.9} fill="none" strokeLinecap="round" />
      )}
      {/* sunglasses while lounging */}
      {lounge && !peek && (
        <g>
          <rect x={-15.5} y={-35} width={13} height={8.5} rx={3.4} fill="#13262f" />
          <rect x={2.5} y={-35} width={13} height={8.5} rx={3.4} fill="#13262f" />
          <path d="M -2.5 -32 L 2.5 -32" stroke="#13262f" strokeWidth={1.6} />
          <path d="M -13 -33.5 l 3 0" stroke="#7aa6c6" strokeWidth={1.2} strokeLinecap="round" />
          <path d="M 5 -33.5 l 3 0" stroke="#7aa6c6" strokeWidth={1.2} strokeLinecap="round" />
        </g>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------
export default function GardenScene(p: SceneProps) {
  const { g, trees, lounge, hopping, seedDrop, refs, still, motion = true } = p;
  const cR = 52 * Math.pow(smooth(0.3, 0.82, g), 0.85);
  const shade = smooth(0.55, SHADE_AT, g);
  const H = g < 0.03 ? 0 : 104 * (1 - Math.pow(1 - clamp((g - 0.025) / 0.85), 2.2));
  const plantHitH = Math.max(34, H + cR * 1.2);
  const plantHitW = Math.max(30, cR * 2.3);
  const miniXs = [32, 236, 50].slice(0, Math.min(3, trees));

  const charPose = lounge ? place(still, PLANT_X - 86, GROUND_Y - 1, 76) : place(still, CHAR_X, GROUND_Y, 0);

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-auto overflow-visible" aria-hidden focusable="false">
      <defs>
        <linearGradient id="gc-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fd0f7" />
          <stop offset="1" stopColor="#3b8fd4" />
        </linearGradient>
        <radialGradient id="gc-canopy" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#5fd08e" />
          <stop offset="1" stopColor="#2f9e5e" />
        </radialGradient>
        <radialGradient id="gc-canopy-dark" cx="0.4" cy="0.35" r="0.85">
          <stop offset="0" stopColor="#3fb675" />
          <stop offset="1" stopColor="#23865a" />
        </radialGradient>
        <linearGradient id="gc-soil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a47c52" />
          <stop offset="1" stopColor="#7d5c3b" />
        </linearGradient>
      </defs>

      {/* far-away trees you already grew */}
      {miniXs.map((x, i) => (
        <g key={i} transform={`translate(${x} ${GROUND_Y - 3}) scale(0.34)`} opacity={0.8}>
          <PlantArt g={0.98} motion={false} />
        </g>
      ))}

      {/* ground */}
      <ellipse cx={VB_W / 2} cy={GROUND_Y + 5} rx={124} ry={10} fill="#cfe9dc" />
      <ellipse cx={VB_W / 2} cy={GROUND_Y + 3} rx={112} ry={6} fill="#b4dfc6" />
      <path d={`M ${PLANT_X - 40} ${GROUND_Y + 2} Q ${PLANT_X} ${GROUND_Y - 13} ${PLANT_X + 40} ${GROUND_Y + 2} Z`} fill="url(#gc-soil)" />
      <g stroke="#3fbf7f" strokeWidth={2} strokeLinecap="round" fill="none">
        <path d={`M 28 ${GROUND_Y + 3} q 2 -8 5 -11`} />
        <path d={`M 33 ${GROUND_Y + 3} q 0 -7 -3 -9`} />
        <path d={`M 118 ${GROUND_Y + 4} q 2 -7 5 -9`} />
        <path d={`M ${PLANT_X + 48} ${GROUND_Y + 3} q 1 -8 5 -10`} />
        <path d={`M ${PLANT_X + 52} ${GROUND_Y + 3} q -1 -6 -4 -8`} />
      </g>

      {/* shade under the tree */}
      <ellipse cx={PLANT_X - 6} cy={GROUND_Y + 3} rx={14 + cR * 1.3} ry={4 + cR * 0.13} fill="#0d3b66" opacity={0.2 * shade} />

      {/* seed */}
      {g < 0.05 && (
        <g transform={`translate(${PLANT_X} ${GROUND_Y - 5})`} opacity={1 - smooth(0.02, 0.05, g)}>
          <g className={seedDrop && motion ? "gc-seed-drop" : ""}>
            <ellipse rx={5.4} ry={3.6} transform="rotate(-24)" fill="#8a5a2b" />
            <ellipse cx={-1.4} cy={-1} rx={1.8} ry={1} transform="rotate(-24)" fill="#b78650" />
          </g>
        </g>
      )}

      {/* the plant; the outer group takes the pointer wind */}
      <g transform={`translate(${PLANT_X} ${GROUND_Y})`}>
        <g ref={refs?.wind} style={{ transition: "transform .25s ease-out" }}>
          <PlantArt g={g} wiggling={p.wiggling} motion={motion} />
          <rect
            x={-plantHitW / 2}
            y={-plantHitH}
            width={plantHitW}
            height={plantHitH + 4}
            fill="transparent"
            style={{ pointerEvents: p.onPlantClick ? "auto" : "none", cursor: "pointer" }}
            onClick={p.onPlantClick}
          />
        </g>
      </g>

      {/* lounging extras */}
      {lounge && (
        <g>
          <g transform={`translate(${PLANT_X - 112} ${GROUND_Y - 14})`}>
            <rect x={-4.5} y={0} width={9} height={13} rx={2} fill="#bfe6ff" stroke="#3b8fd4" strokeWidth={1.2} />
            <rect x={-4.5} y={5} width={9} height={8} rx={2} fill="#3fbf7f" opacity={0.75} />
            <path d="M 2 0 L 5 -8" stroke="#ff7f93" strokeWidth={1.6} strokeLinecap="round" />
          </g>
          {!p.peek && motion && (
            <g fontFamily="Vazirmatn, sans-serif" fontWeight={800} fill="#2a6fb0">
              <text className="gc-zzz" style={{ animationDelay: "0s" }} x={PLANT_X - 30} y={GROUND_Y - 38} fontSize={13}>z</text>
              <text className="gc-zzz" style={{ animationDelay: "0.9s" }} x={PLANT_X - 22} y={GROUND_Y - 50} fontSize={10}>z</text>
              <text className="gc-zzz" style={{ animationDelay: "1.8s" }} x={PLANT_X - 15} y={GROUND_Y - 60} fontSize={8}>z</text>
            </g>
          )}
        </g>
      )}

      {/* the character: outer group positions (and eases between standing / lounging), inner group hops */}
      <g {...charPose}>
        <g className={hopping && motion ? "gc-hop" : ""}>
          <Character lounge={lounge} excited={p.excited} blink={p.blink} peek={p.peek} waving={p.waving} refs={refs} motion={motion} />
          <rect
            x={-26}
            y={-62}
            width={52}
            height={66}
            fill="transparent"
            style={{ pointerEvents: p.onCharClick ? "auto" : "none", cursor: "pointer" }}
            onClick={p.onCharClick}
          />
        </g>
      </g>
    </svg>
  );
}
