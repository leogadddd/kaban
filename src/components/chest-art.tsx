// Plain SVG, no hooks: safe in server components (the launch splash) as well as client ones.
import type { CSSProperties, Ref } from "react";

/** Fixed palette (the logo's), so the mascot reads the same in light and dark themes. */
export const CHEST = {
  body: "#176B4D",
  lid: "#2D936C",
  deep: "#0F3D2E",
  inside: "#0A2A1F",
  gold: "#C9A227",
  glow: "#F6D365",
  tear: "#8EC5FF",
  heart: "#E56B6F",
} as const;

export type ChestEyes = "open" | "happy" | "sleep";

const fill = (o: string): CSSProperties => ({ transformBox: "fill-box", transformOrigin: o });
const fx: CSSProperties = { ...fill("center"), opacity: 0 };
const shown = (on: boolean): CSSProperties => ({ ...fill("center"), opacity: on ? 1 : 0 });

/**
 * The Kaban chest. Every part carries a `kc-*` class so callers can animate it (motion, CSS or
 * attributes): kc-rig (whole chest, origin bottom centre), kc-lid (origin at the back hinge), kc-eye /
 * kc-pupil / kc-happy / kc-sleep, kc-glow, kc-leaf / kc-lock, kc-shadow, and hidden effects kc-coin-0…7,
 * kc-spark-0…2, kc-z-0…2, kc-dust-0…2, kc-sweat, kc-bang.
 * The eyes sit inside the chest and only show through the gap when the lid lifts.
 */
export function ChestArt({
  className,
  svgRef,
  lidLift = 0,
  eyes = "open",
  locked = false,
  effects = true,
  title,
}: {
  className?: string;
  svgRef?: Ref<SVGSVGElement>;
  /** Static lid lift in chest units (about 12 for a peek). */
  lidLift?: number;
  eyes?: ChestEyes;
  locked?: boolean;
  /** Render the hidden effect layers (coins, sparkles…). Off for static uses. */
  effects?: boolean;
  title?: string;
}) {
  const { body, lid, deep, inside, gold, glow } = CHEST;
  return (
    <svg
      ref={svgRef}
      viewBox="0 0 120 112"
      className={className}
      style={{ overflow: "visible" }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <ellipse className="kc-shadow" cx="60" cy="104" rx="40" ry="5" fill={deep} style={{ ...fill("center"), opacity: 0.16 }} />

      {effects && (
        <>
          {[
            { x: 12, y: 26, s: 1 },
            { x: 108, y: 18, s: 0.8 },
            { x: 106, y: 64, s: 0.6 },
          ].map((p, i) => (
            <path
              key={i}
              className={`kc-fx kc-spark-${i}`}
              d={`M${p.x} ${p.y - 6 * p.s}Q${p.x} ${p.y} ${p.x + 6 * p.s} ${p.y}Q${p.x} ${p.y} ${p.x} ${p.y + 6 * p.s}Q${p.x} ${p.y} ${p.x - 6 * p.s} ${p.y}Q${p.x} ${p.y} ${p.x} ${p.y - 6 * p.s}Z`}
              fill={gold}
              style={fx}
            />
          ))}
          {[0, 1, 2].map((i) => (
            <text key={i} className={`kc-fx kc-z-${i}`} x={92 + i * 6} y={32 - i * 10} fontSize={9 + i * 3} fontWeight={700} fill="#5E7A6B" style={fx}>
              z
            </text>
          ))}
          <path className="kc-fx kc-sweat" d="M10 26c-2.6 3.6-3.6 5.4-3.6 7a3.6 3.6 0 0 0 7.2 0c0-1.6-1-3.4-3.6-7Z" fill={CHEST.tear} style={fx} />
          <g className="kc-fx kc-bang" style={fx}>
            <rect x="56.5" y="-6" width="7" height="13" rx="3.5" fill={gold} />
            <circle cx="60" cy="12" r="3.1" fill={gold} />
          </g>
        </>
      )}

      <g className="kc-rig" style={fill("50% 100%")}>
        {/* The mouth: inset so it never shows past the body's rounded corners; its top hides under the lid. */}
        <rect x="24" y="34" width="72" height="22" rx="6" fill={inside} />
        <ellipse className="kc-glow" cx="60" cy="50" rx="30" ry="6" fill={glow} style={{ opacity: 0 }} />
        {[44, 76].map((cx) => (
          <g key={cx}>
            <g className="kc-eye" style={shown(eyes === "open")}>
              <ellipse cx={cx} cy="47.5" rx="3.8" ry="4.2" fill="#fff" />
              <g className="kc-pupil" style={fill("center")}>
                <circle cx={cx} cy="47.9" r="2.1" fill={deep} />
                <circle cx={cx + 0.8} cy="46.9" r="0.7" fill="#fff" />
              </g>
            </g>
            <path className="kc-happy" d={`M${cx - 3.8} 50q3.8-5 7.6 0`} stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" style={shown(eyes === "happy")} />
            <path className="kc-sleep" d={`M${cx - 3.4} 49.6q3.4 2.2 6.8 0`} stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" style={shown(eyes === "sleep")} />
          </g>
        ))}

        {effects && (
          <g transform="translate(60 50)">
            {Array.from({ length: 8 }, (_, i) => (
              <g key={i} className={`kc-fx kc-coin-${i}`} style={fx}>
                <circle r="6.5" fill={gold} />
                <circle r="4.3" fill="none" stroke={deep} strokeOpacity="0.25" strokeWidth="1.2" />
                <path d="M-1.6 -2.6h2.2a1.6 1.6 0 0 1 0 3.2h-2.2M-1.6 -2.6v5.4M-3 -0.9h5.4" stroke={deep} strokeOpacity="0.45" strokeWidth="1" fill="none" strokeLinecap="round" />
              </g>
            ))}
            {[0, 1, 2].map((i) => (
              <circle key={i} className={`kc-fx kc-dust-${i}`} r="4" fill="#85948B" style={fx} />
            ))}
          </g>
        )}

        {/* Body */}
        <rect x="18" y="52" width="84" height="46" rx="8" fill={body} />
        <path d="M22 66h76M22 81h76" stroke={deep} strokeOpacity="0.35" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="18" y="90" width="84" height="8" rx="4" fill={deep} opacity="0.35" />
        <rect x="29" y="52" width="7" height="46" fill={gold} />
        <rect x="84" y="52" width="7" height="46" fill={gold} />

        {/* Lid, hinged at the back right corner */}
        <g className="kc-lid" style={fill("100% 100%")} transform={lidLift ? `translate(0 ${-lidLift})` : undefined}>
          <path d="M15 55V45c0-12 19-19 45-19s45 7 45 19v10H15Z" fill={lid} />
          <path d="M24 34c8-4 20-6 36-6" stroke="#fff" strokeOpacity="0.28" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M29 30.5c2-.5 4.6-1 7-1.3V55h-7V30.5ZM84 29.2c2.4.3 5 .8 7 1.3V55h-7V29.2Z" fill={gold} />
          <rect x="13" y="50" width="94" height="7" rx="3.5" fill={deep} />
        </g>

        {/* Clasp: the logo's leaf, or a padlock */}
        <rect x="50" y="52" width="20" height="22" rx="5" fill={gold} />
        <rect x="50" y="52" width="20" height="22" rx="5" fill="none" stroke={deep} strokeOpacity="0.25" strokeWidth="1.2" />
        <g className="kc-leaf" style={shown(!locked)}>
          <path d="M60 56c-3.4 2.4-4.1 6.3-1.5 9.3.8.8 2 .8 3 0 2.6-3 1.9-6.9-1.5-9.3Z" fill={lid} stroke={deep} strokeWidth="1.2" />
          <path d="M60 59.5v6.5" stroke={deep} strokeWidth="1.2" strokeLinecap="round" />
        </g>
        <g className="kc-lock" style={shown(locked)}>
          <path d="M56 61v-3a4 4 0 0 1 8 0v3" stroke={deep} strokeWidth="2" fill="none" strokeLinecap="round" />
          <rect x="54" y="60.5" width="12" height="9" rx="2" fill={deep} />
          <circle cx="60" cy="64.2" r="1.4" fill={gold} />
          <rect x="59.4" y="64.4" width="1.2" height="2.8" rx="0.6" fill={gold} />
        </g>
      </g>
    </svg>
  );
}
