/**
 * Custom SVG icon components for EDA/VLSI-specific tools.
 * All icons follow a consistent 24x24 viewBox, 1.5px stroke, currentColor.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const defaults = (size = 18): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

/* ── Layout Drawing Tools ── */

/** Rectangle draw tool — outlined rect with corner handles */
export function IconRect({ size, ...p }: IconProps) {
  return (
    <svg {...defaults(size)} {...p}>
      <rect x="4" y="6" width="16" height="12" rx="1" />
      <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="20" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="20" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Polygon draw tool — irregular polygon shape */
export function IconPolygon({ size, ...p }: IconProps) {
  return (
    <svg {...defaults(size)} {...p}>
      <polygon points="12,3 21,9 18,20 6,20 3,9" />
    </svg>
  );
}

/** Path/Wire draw tool — routed wire with 90° bends */
export function IconPath({ size, ...p }: IconProps) {
  return (
    <svg {...defaults(size)} {...p}>
      <polyline points="4,18 4,12 12,12 12,6 20,6" />
      <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="20" cy="6" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Via tool — stacked layers with via hole */
export function IconVia({ size, ...p }: IconProps) {
  return (
    <svg {...defaults(size)} {...p}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
      <line x1="8" y1="8" x2="16" y2="16" />
      <line x1="16" y1="8" x2="8" y2="16" />
    </svg>
  );
}

/* ── Sidebar Panel Icons ── */

/** Layers — stacked horizontal layers */
export function IconLayers({ size, ...p }: IconProps) {
  return (
    <svg {...defaults(size)} {...p}>
      <path d="M12 3L2 8l10 5 10-5-10-5z" />
      <path d="M2 13l10 5 10-5" />
      <path d="M2 18l10 5 10-5" />
    </svg>
  );
}

/** Cell Hierarchy — tree/hierarchy view */
export function IconCellHierarchy({ size, ...p }: IconProps) {
  return (
    <svg {...defaults(size)} {...p}>
      <rect x="8" y="2" width="8" height="5" rx="1" />
      <rect x="2" y="17" width="7" height="5" rx="1" />
      <rect x="15" y="17" width="7" height="5" rx="1" />
      <line x1="12" y1="7" x2="12" y2="12" />
      <line x1="5.5" y1="17" x2="5.5" y2="12" />
      <line x1="18.5" y1="17" x2="18.5" y2="12" />
      <line x1="5.5" y1="12" x2="18.5" y2="12" />
    </svg>
  );
}

/** Component Library — IC chip symbol */
export function IconComponentLib({ size, ...p }: IconProps) {
  return (
    <svg {...defaults(size)} {...p}>
      <rect x="6" y="4" width="12" height="16" rx="1" />
      <line x1="2" y1="8" x2="6" y2="8" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="2" y1="16" x2="6" y2="16" />
      <line x1="18" y1="8" x2="22" y2="8" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="18" y1="16" x2="22" y2="16" />
      <circle cx="12" cy="7" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Guard Ring generator icon */
export function IconGuardRing({ size, ...p }: IconProps) {
  return (
    <svg {...defaults(size)} {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <rect x="7" y="7" width="10" height="10" rx="1" strokeDasharray="3 2" />
    </svg>
  );
}

/** Common Centroid generator icon — 2x2 grid pattern */
export function IconCommonCentroid({ size, ...p }: IconProps) {
  return (
    <svg {...defaults(size)} {...p}>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
      <text x="7" y="9" fontSize="5" fill="currentColor" stroke="none" textAnchor="middle" fontWeight="700">A</text>
      <text x="17" y="9" fontSize="5" fill="currentColor" stroke="none" textAnchor="middle" fontWeight="700">B</text>
      <text x="7" y="19" fontSize="5" fill="currentColor" stroke="none" textAnchor="middle" fontWeight="700">B</text>
      <text x="17" y="19" fontSize="5" fill="currentColor" stroke="none" textAnchor="middle" fontWeight="700">A</text>
    </svg>
  );
}

/** Interdigitation generator icon — interleaved fingers */
export function IconInterdigitation({ size, ...p }: IconProps) {
  return (
    <svg {...defaults(size)} {...p}>
      <line x1="5" y1="4" x2="5" y2="20" />
      <line x1="9" y1="4" x2="9" y2="20" />
      <line x1="13" y1="4" x2="13" y2="20" />
      <line x1="17" y1="4" x2="17" y2="20" />
      <line x1="3" y1="4" x2="7" y2="4" />
      <line x1="11" y1="4" x2="15" y2="4" />
      <line x1="7" y1="20" x2="11" y2="20" />
      <line x1="15" y1="20" x2="19" y2="20" />
    </svg>
  );
}

/** Auto Dummy generator icon — edge dummies */
export function IconAutoDummy({ size, ...p }: IconProps) {
  return (
    <svg {...defaults(size)} {...p}>
      <rect x="3" y="5" width="4" height="14" rx="0.5" strokeDasharray="2 2" opacity={0.5} />
      <rect x="10" y="5" width="4" height="14" rx="0.5" />
      <rect x="17" y="5" width="4" height="14" rx="0.5" strokeDasharray="2 2" opacity={0.5} />
    </svg>
  );
}

/** MOSFET I-V / transistor icon */
export function IconMosfet({ size, ...p }: IconProps) {
  return (
    <svg {...defaults(size)} {...p}>
      <line x1="6" y1="8" x2="6" y2="16" />
      <line x1="9" y1="7" x2="9" y2="11" />
      <line x1="9" y1="13" x2="9" y2="17" />
      <line x1="9" y1="9" x2="16" y2="9" />
      <line x1="16" y1="9" x2="16" y2="4" />
      <line x1="9" y1="15" x2="16" y2="15" />
      <line x1="16" y1="15" x2="16" y2="20" />
      <line x1="9" y1="12" x2="14" y2="12" />
      <line x1="3" y1="12" x2="6" y2="12" />
    </svg>
  );
}

/** Wire R/C calculator icon — resistor + capacitor */
export function IconWireRC({ size, ...p }: IconProps) {
  return (
    <svg {...defaults(size)} {...p}>
      <polyline points="3,12 5,12 6,9 8,15 10,9 12,15 14,9 16,12 18,12" />
      <line x1="18" y1="12" x2="21" y2="12" />
      <line x1="18" y1="16" x2="18" y2="20" />
      <line x1="21" y1="16" x2="21" y2="20" />
      <line x1="16" y1="18" x2="18" y2="18" />
      <line x1="21" y1="18" x2="23" y2="18" />
    </svg>
  );
}

/** Matching/Pelgrom icon — balanced scales */
export function IconMatching({ size, ...p }: IconProps) {
  return (
    <svg {...defaults(size)} {...p}>
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="7" x2="4" y2="13" />
      <line x1="20" y1="7" x2="20" y2="13" />
      <path d="M2 13 Q4 17 6 13" />
      <path d="M18 13 Q20 17 22 13" />
      <line x1="8" y1="21" x2="16" y2="21" />
    </svg>
  );
}

/** gm/Id sizer icon — delta/triangle function */
export function IconGmId({ size, ...p }: IconProps) {
  return (
    <svg {...defaults(size)} {...p}>
      <polygon points="12,4 4,20 20,20" fill="none" />
      <text x="12" y="17" fontSize="7" fill="currentColor" stroke="none" textAnchor="middle" fontFamily="serif" fontStyle="italic">g</text>
    </svg>
  );
}

/* ── Verification ── */

/** Incremental LVS — circular refresh with check */
export function IconIncrLvs({ size, ...p }: IconProps) {
  return (
    <svg {...defaults(size)} {...p}>
      <path d="M21 12a9 9 0 11-3-6.7" />
      <polyline points="21 3 21 9 15 9" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

/** Graph Debug — network/graph nodes */
export function IconGraphDebug({ size, ...p }: IconProps) {
  return (
    <svg {...defaults(size)} {...p}>
      <circle cx="5" cy="6" r="2.5" />
      <circle cx="19" cy="6" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <circle cx="5" cy="18" r="2.5" />
      <circle cx="19" cy="18" r="2.5" />
      <line x1="7" y1="7" x2="10" y2="16.5" />
      <line x1="17" y1="7" x2="14" y2="16.5" />
      <line x1="7.5" y1="18" x2="16.5" y2="18" />
      <line x1="7" y1="6.5" x2="16.5" y2="6" />
    </svg>
  );
}

/** Pre/Post comparison — side-by-side diff */
export function IconPrePost({ size, ...p }: IconProps) {
  return (
    <svg {...defaults(size)} {...p}>
      <rect x="2" y="4" width="8" height="16" rx="1" />
      <rect x="14" y="4" width="8" height="16" rx="1" />
      <polyline points="11 10 13 12 11 14" />
    </svg>
  );
}

/** Select/Cursor tool — precise cursor */
export function IconSelect({ size, ...p }: IconProps) {
  return (
    <svg {...defaults(size)} {...p}>
      <path d="M5 3l2 18 4-6 7-1L5 3z" fill="currentColor" fillOpacity={0.15} />
      <path d="M5 3l2 18 4-6 7-1L5 3z" />
    </svg>
  );
}
