import type { KeyboardEvent } from "react";
import type { MarshalPost, MarshalSection } from "@/types/admin-marshals";

export type TrackPost = MarshalPost & { staffCount: number; target: number };
export type TrackLeader = {
  section: MarshalSection;
  staffCount: number;
  target: number;
};

type Props = {
  posts: TrackPost[];
  sections: MarshalSection[];
  leaders?: TrackLeader[];
  selectedMarker?: string | null;
  onPostClick?: (post: TrackPost) => void;
  onLeaderClick?: (leader: TrackLeader) => void;
  className?: string;
};

/** Schematic seed coordinates based on the Dreiecksrennen route topology. */
export const DEFAULT_POST_COORDS: Record<string, { x: number; y: number }> = {
  "1/1": { x: 700, y: 92 }, "1/2": { x: 755, y: 150 }, "1/3": { x: 805, y: 238 },
  "1/4": { x: 855, y: 334 }, "1/5": { x: 892, y: 445 }, "1/6": { x: 884, y: 550 },
  "2/1": { x: 842, y: 574 }, "2/2": { x: 770, y: 565 }, "2/3": { x: 700, y: 548 },
  "2/4": { x: 630, y: 525 }, "2/5": { x: 574, y: 485 }, "2/6": { x: 520, y: 445 },
  "2/7": { x: 470, y: 430 }, "2/8": { x: 420, y: 420 }, "2/9": { x: 366, y: 404 },
  "2/10": { x: 320, y: 386 }, "3/1": { x: 286, y: 372 }, "3/2": { x: 250, y: 350 },
  "3/3": { x: 210, y: 315 }, "3/4": { x: 224, y: 274 }, "3/5": { x: 276, y: 242 },
  "3/6": { x: 338, y: 212 }, "4/1": { x: 390, y: 202 }, "4/2": { x: 430, y: 190 },
  "4/3": { x: 474, y: 199 }, "4/4": { x: 510, y: 180 }, "4/5": { x: 560, y: 181 },
  "5/1": { x: 610, y: 160 }, "5/2": { x: 650, y: 130 }, "5/3": { x: 680, y: 104 },
};

const AL_COORDS: Record<string, { x: number; y: number }> = {
  AL1: { x: 738, y: 112 }, AL2: { x: 820, y: 538 }, AL3: { x: 238, y: 335 }, AL4: { x: 452, y: 172 },
};
const SECTION_COLORS: Record<string, string> = { "1": "#3b82f6", "2": "#22c55e", "3": "#f59e0b", "4": "#a855f7" };
const TRACK_PATH = "M700 90 C748 128 776 184 808 246 C842 312 885 386 895 455 C903 508 897 555 870 575 C820 592 738 564 669 540 C611 519 566 472 515 446 C466 421 408 417 354 398 C307 382 262 366 220 324 C198 300 219 267 264 243 C314 216 351 209 395 201 C443 190 480 195 516 182 C568 179 609 160 644 131 C667 112 685 98 700 90";

function staffingColor(count: number, target: number) {
  if (count === 0) return "#ef4444";
  if (count < target) return "#f59e0b";
  return "#22c55e";
}

function activate(event: KeyboardEvent<SVGGElement>, action: (() => void) | undefined) {
  if (action && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    action();
  }
}

export function MarshalTrackSvg({ posts, sections, leaders = [], selectedMarker, onPostClick, onLeaderClick, className }: Props) {
  const activeSections = new Set(sections.map((section) => section.code));
  const position = (post: TrackPost) => {
    if (post.mapX == null || post.mapY == null) return DEFAULT_POST_COORDS[post.code] ?? { x: 500, y: 350 };
    return { x: post.mapX, y: post.mapY > 700 ? post.mapY * 0.7 : post.mapY };
  };

  return (
    <svg viewBox="0 0 1000 700" className={className ?? "h-auto w-full"} role="group" aria-label="Schematischer Streckenplan mit auswählbaren Posten und Abschnittsleitern">
      <defs>
        <filter id="marshal-track-shadow"><feDropShadow dx="0" dy="4" stdDeviation="7" floodOpacity=".18" /></filter>
        <marker id="marshal-track-arrow" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#475569" /></marker>
      </defs>
      <rect width="1000" height="700" fill="#f8fafc" rx="18" />
      <path d={TRACK_PATH} fill="none" stroke="#94a3b8" strokeWidth="72" strokeLinecap="round" strokeLinejoin="round" filter="url(#marshal-track-shadow)" />
      <path d={TRACK_PATH} fill="none" stroke="#cbd5e1" strokeWidth="62" strokeLinecap="round" strokeLinejoin="round" />
      <path d={TRACK_PATH} fill="none" stroke="white" strokeWidth="3" strokeDasharray="13 11" opacity=".9" />
      <g aria-label="Start, Ziel und Fahrtrichtung">
        <path d="M680 107 L715 76" stroke="white" strokeWidth="9" /><path d="M681 108 L716 77" stroke="#1e293b" strokeWidth="4" strokeDasharray="7 6" />
        <text x="720" y="70" fontSize="16" fill="#334155" fontWeight="700">START / ZIEL</text>
        <path d="M742 128 C760 148 776 174 787 199" fill="none" stroke="#475569" strokeWidth="3" markerEnd="url(#marshal-track-arrow)" />
      </g>

      {leaders.filter(({ section }) => activeSections.has(section.code)).map((leader) => {
        const code = leader.section.leaderCode;
        const pos = AL_COORDS[code] ?? { x: 500, y: 350 };
        const selected = selectedMarker === `leader:${leader.section.id}`;
        const action = onLeaderClick ? () => onLeaderClick(leader) : undefined;
        return (
          <g key={leader.section.id} role={action ? "button" : undefined} tabIndex={action ? 0 : undefined} aria-label={`${code}, ${leader.staffCount} von ${leader.target} besetzt`} aria-pressed={action ? selected : undefined} onClick={action} onKeyDown={(event) => activate(event, action)} className={action ? "cursor-pointer outline-none focus-visible:[&>rect]:stroke-slate-950" : undefined}>
            <rect x={pos.x - 23} y={pos.y - 23} width="46" height="46" rx="7" fill={staffingColor(leader.staffCount, leader.target)} opacity=".42" stroke={selected ? "#0f172a" : "white"} strokeWidth={selected ? 4 : 2} />
            <rect x={pos.x - 15} y={pos.y - 15} width="30" height="30" rx="5" fill={SECTION_COLORS[leader.section.code] ?? "#64748b"} stroke="white" strokeWidth="2" />
            <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize="11" fill="white" fontWeight="700" pointerEvents="none">{code}</text>
          </g>
        );
      })}

      {posts.map((post) => {
        const pos = position(post);
        const selected = selectedMarker === `post:${post.id}`;
        const sectionCode = post.code.startsWith("5/") ? "4" : post.code.split("/")[0];
        const action = onPostClick ? () => onPostClick(post) : undefined;
        return (
          <g key={post.id} role={action ? "button" : undefined} tabIndex={action ? 0 : undefined} aria-label={`Posten ${post.code}, ${post.staffCount} von ${post.target} besetzt`} aria-pressed={action ? selected : undefined} onClick={action} onKeyDown={(event) => activate(event, action)} className={action ? "cursor-pointer outline-none focus-visible:[&>circle]:stroke-slate-950" : undefined}>
            <circle cx={pos.x} cy={pos.y} r={selected ? 24 : 21} fill={staffingColor(post.staffCount, post.target)} opacity=".5" stroke={selected ? "#0f172a" : "white"} strokeWidth={selected ? 4 : 2} />
            <circle cx={pos.x} cy={pos.y} r="13" fill={SECTION_COLORS[sectionCode] ?? "#64748b"} stroke="white" strokeWidth="2" />
            <text x={pos.x} y={pos.y + 3.5} textAnchor="middle" fontSize="8" fill="white" fontWeight="700" pointerEvents="none">{post.code}</text>
            <text x={pos.x + 22} y={pos.y - 17} fontSize="10" fill="#1e293b" fontWeight="700" pointerEvents="none">{post.staffCount}/{post.target}</text>
          </g>
        );
      })}

      <g transform="translate(24 518)" aria-label="Legende">
        <rect x="-10" y="-10" width="174" height="177" rx="10" fill="white" opacity=".94" />
        {[...activeSections].sort().map((code, index) => <g key={code} transform={`translate(0 ${index * 23})`}><circle cx="8" cy="8" r="7" fill={SECTION_COLORS[code]} /><text x="22" y="13" fontSize="12" fill="#334155">Abschnitt {code}</text></g>)}
        <g transform="translate(0 98)"><circle cx="8" cy="8" r="7" fill="#22c55e" /><text x="22" y="13" fontSize="12" fill="#334155">Soll erreicht</text></g>
        <g transform="translate(0 121)"><circle cx="8" cy="8" r="7" fill="#f59e0b" /><text x="22" y="13" fontSize="12" fill="#334155">Unterbesetzt</text></g>
        <g transform="translate(0 144)"><circle cx="8" cy="8" r="7" fill="#ef4444" /><text x="22" y="13" fontSize="12" fill="#334155">Unbesetzt</text></g>
      </g>
    </svg>
  );
}
