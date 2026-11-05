import type { SceneProps } from "@/components/garden/GardenScene";

/** The same little leaf the sprout character wears, here growing from the robot's antenna. */
const LEAF = (s: number) => `M0 0 C ${s * 0.3} ${-s * 0.75}, ${s * 1.2} ${-s * 0.55}, ${s * 1.6} 0 C ${s * 1.2} ${s * 0.55}, ${s * 0.3} ${s * 0.75}, 0 0 Z`;

const GLOW = "#7df0b1"; // eye colour
const SCREEN = "#0f2a3d";
const TRIM = "#3b8fd4";

/**
 * "Robot" variant of the garden character: a boxy little helper with a screen for a face. It never speaks;
 * it shows how it feels with its eyes (round-ish bars normally, ^ ^ when happy, — — when sleepy) and the
 * antenna leaf. Eye groups use the same anchor points as the sprout character so pointer-following works unchanged.
 */
export default function RobotCharacter({ lounge, excited, blink, peek, waving, refs, motion }: Pick<SceneProps, "lounge" | "excited" | "blink" | "peek" | "waving" | "refs" | "motion">) {
  const sleepy = lounge && !peek;
  const happy = excited && !sleepy;

  const Open = ({ side }: { side: -1 | 1 }) => (
    <g ref={side === -1 ? refs?.pupilL : refs?.pupilR} transform={`translate(${8.5 * side} -31)`}>
      <g className="gc-pupil">
        <rect x={-5.5} y={-7.5} width={11} height={15} rx={3.5} fill={GLOW} opacity={0.22} />
        <rect x={-3.6} y={-5.4} width={7.2} height={10.8} rx={2.4} fill={GLOW} />
        <rect x={-2.4} y={-4.4} width={2.2} height={3.2} rx={1} fill="#fff" opacity={0.75} />
      </g>
    </g>
  );

  const Bar = ({ side, dim = false }: { side: -1 | 1; dim?: boolean }) => (
    <rect x={8.5 * side - 4.2} y={-32} width={8.4} height={2.3} rx={1.15} fill={GLOW} opacity={dim ? 0.55 : 0.9} />
  );

  const Arc = ({ side }: { side: -1 | 1 }) => (
    <path d={`M ${8.5 * side - 4.2} -28.5 Q ${8.5 * side} -36.5 ${8.5 * side + 4.2} -28.5`} stroke={GLOW} strokeWidth={2.6} strokeLinecap="round" fill="none" />
  );

  return (
    <g>
      {/* legs */}
      <rect x={-12} y={-9} width={9} height={9} rx={2.6} fill="#2a6fb0" />
      <rect x={3} y={-9} width={9} height={9} rx={2.6} fill="#2a6fb0" />
      {/* arms */}
      <rect x={-27} y={-35} width={6} height={17} rx={3} fill={TRIM} />
      <g className={waving && motion && !lounge ? "gc-wave" : ""} style={{ transformOrigin: "24px -33px" }}>
        <rect x={21} y={-35} width={6} height={17} rx={3} fill={TRIM} />
      </g>
      {/* body */}
      <rect x={-21} y={-51} width={42} height={43} rx={12} fill="url(#gc-robot-shell)" stroke={TRIM} strokeWidth={1.3} />
      {/* screen */}
      <rect x={-16} y={-45} width={32} height={26} rx={8} fill={SCREEN} />
      <rect x={-13} y={-43} width={14} height={3} rx={1.5} fill="#fff" opacity={0.08} />
      {/* eyes */}
      {sleepy ? (
        <g>
          <Bar side={-1} />
          <Bar side={1} />
        </g>
      ) : blink ? (
        <g>
          <Bar side={-1} dim />
          <Bar side={1} dim />
        </g>
      ) : happy ? (
        <g>
          <Arc side={-1} />
          <Arc side={1} />
        </g>
      ) : lounge && peek ? (
        <g>
          <Open side={-1} />
          <Bar side={1} dim />
        </g>
      ) : (
        <g>
          <Open side={-1} />
          <Open side={1} />
        </g>
      )}
      {/* tiny smile */}
      <path d={happy ? "M -4.2 -23.8 Q 0 -19.8 4.2 -23.8" : "M -3 -23.4 Q 0 -21.4 3 -23.4"} stroke={GLOW} strokeWidth={1.5} strokeLinecap="round" fill="none" opacity={sleepy ? 0.5 : 0.95} />
      {/* chest panel: three lights, or a battery while it rests in the shade */}
      {lounge ? (
        <g>
          <rect x={-8} y={-16.5} width={14} height={7} rx={1.8} fill="none" stroke={TRIM} strokeWidth={1.2} />
          <rect x={6.4} y={-14.6} width={1.8} height={3.2} rx={0.8} fill={TRIM} />
          {[0, 1, 2].map((i) => (
            <rect key={i} className={motion ? "gc-charge" : ""} style={{ animationDelay: `${i * 0.45}s` }} x={-6.6 + i * 4.2} y={-15.2} width={3.2} height={4.4} rx={0.8} fill="#3fbf7f" />
          ))}
        </g>
      ) : (
        <g>
          <circle cx={-6} cy={-13} r={1.7} fill="#3fbf7f" />
          <circle cx={0} cy={-13} r={1.7} fill={TRIM} />
          <circle cx={6} cy={-13} r={1.7} fill="#bcdcf0" />
        </g>
      )}
      {/* antenna with a leaf */}
      <path d="M0 -51 L0 -59" stroke={TRIM} strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={0} cy={-59.5} r={2.3} fill={TRIM} />
      <g transform="translate(0 -60) rotate(-42)">
        <path d={LEAF(8)} fill="#46c27d" />
      </g>
      <g transform="translate(0 -60) scale(-1 1) rotate(-30)">
        <path d={LEAF(6.5)} fill="#3fbf7f" />
      </g>
    </g>
  );
}
