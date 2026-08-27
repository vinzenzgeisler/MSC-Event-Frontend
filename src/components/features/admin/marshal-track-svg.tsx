import { useId, type KeyboardEvent } from "react";
import type { MarshalPost, MarshalSection } from "@/types/admin-marshals";

export type TrackPost = MarshalPost & { staffCount: number; target: number; overfilled?: boolean };
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

type Point = { x: number; y: number };

/** Schematic seed coordinates following the Dreiecksrennen route topology. */
export const DEFAULT_POST_COORDS: Record<string, Point> = {
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

const SECTION_PATHS: Record<string, string> = {
  "1": "M700 90 C748 128 776 184 808 246 C842 312 885 386 895 455 C903 508 897 555 870 575",
  "2": "M870 575 C820 592 738 564 669 540 C611 519 566 472 515 446 C466 421 408 417 354 398 C342 394 331 390 320 386",
  "3": "M320 386 C284 373 250 354 220 324 C198 300 219 267 264 243 C292 228 316 219 338 212",
  "4": "M338 212 C359 207 377 204 395 201 C443 190 480 195 516 182 C568 179 609 160 644 131 C667 112 685 98 700 90",
};

const LEADER_CARDS: Record<string, { x: number; y: number; anchor: Point; cardAnchor: Point }> = {
  "1": { x: 840, y: 32, anchor: { x: 838, y: 304 }, cardAnchor: { x: 908, y: 86 } },
  "2": { x: 650, y: 625, anchor: { x: 650, y: 533 }, cardAnchor: { x: 720, y: 625 } },
  "3": { x: 24, y: 318, anchor: { x: 250, y: 350 }, cardAnchor: { x: 164, y: 344 } },
  "4": { x: 284, y: 66, anchor: { x: 474, y: 199 }, cardAnchor: { x: 424, y: 120 } },
};

const SECTION_COLORS: Record<string, string> = { "1": "#3b82f6", "2": "#22c55e", "3": "#f59e0b", "4": "#a855f7" };
const TRACK_PATH = `${SECTION_PATHS["1"]} ${SECTION_PATHS["2"].replace(/^M[^C]+/, "")} ${SECTION_PATHS["3"].replace(/^M[^C]+/, "")} ${SECTION_PATHS["4"].replace(/^M[^C]+/, "")}`;

function staffingColor(count: number, target: number, overfilled = false) {
  if (overfilled) return "#dc2626";
  if (count === 0) return "#ef4444";
  if (count < target) return "#f59e0b";
  return "#22c55e";
}

function staffingLabel(count: number, target: number, overfilled = false) {
  if (overfilled) return "über Soll";
  if (count === 0) return "unbesetzt";
  if (count < target) return "unter Soll";
  return "Soll erreicht";
}

function activate(event: KeyboardEvent<SVGGElement>, action: (() => void) | undefined) {
  if (action && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    action();
  }
}

export function MarshalTrackSvg({ posts, sections, leaders = [], selectedMarker, onPostClick, onLeaderClick, className }: Props) {
  const instanceId = useId().replace(/:/g, "");
  const shadowId = `${instanceId}-marshal-track-shadow`;
  const arrowId = `${instanceId}-marshal-track-arrow`;
  const controlClass = `${instanceId}-marshal-control`;
  const activeSections = new Set(sections.map((section) => section.code));
  const position = (post: TrackPost) => {
    if (post.mapX == null || post.mapY == null) return DEFAULT_POST_COORDS[post.code] ?? { x: 500, y: 350 };
    return { x: post.mapX, y: post.mapY > 700 ? post.mapY * 0.7 : post.mapY };
  };

  return (
    <svg viewBox="0 0 1000 700" className={className ?? "h-auto w-full"} role="group" aria-label="Schematischer Streckenplan mit auswählbaren Posten und Abschnittsleitungen">
      <defs>
        <filter id={shadowId}><feDropShadow dx="0" dy="4" stdDeviation="7" floodOpacity=".18" /></filter>
        <marker id={arrowId} markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#475569" /></marker>
      </defs>
      <style>{`.${controlClass}:focus-visible .marshal-focus-ring{stroke:#0f172a;stroke-width:4px}`}</style>
      <rect width="1000" height="700" fill="#f8fafc" rx="18" />

      <g aria-label="Verbindungen zu den Abschnittsleitungen" fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="5 5" opacity=".72" pointerEvents="none">
        {leaders.filter(({ section }) => activeSections.has(section.code)).map((leader) => {
          const card = LEADER_CARDS[leader.section.code];
          return card ? <path key={leader.section.id} d={`M${card.anchor.x} ${card.anchor.y} L${card.cardAnchor.x} ${card.cardAnchor.y}`} /> : null;
        })}
      </g>

      <path d={TRACK_PATH} fill="none" stroke="#94a3b8" strokeWidth="72" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${shadowId})`} />
      <path d={TRACK_PATH} fill="none" stroke="#cbd5e1" strokeWidth="62" strokeLinecap="round" strokeLinejoin="round" />
      <path d={TRACK_PATH} fill="none" stroke="white" strokeWidth="3" strokeDasharray="13 11" opacity=".9" />
      <g aria-label="Start, Ziel und Fahrtrichtung">
        <path d="M680 107 L715 76" stroke="white" strokeWidth="9" /><path d="M681 108 L716 77" stroke="#1e293b" strokeWidth="4" strokeDasharray="7 6" />
        <text x="720" y="70" fontSize="16" fill="#334155" fontWeight="700">START / ZIEL</text>
        <path d="M730 125 C748 148 759 171 771 196" fill="none" stroke="#475569" strokeWidth="3" markerEnd={`url(#${arrowId})`} />
      </g>

      {leaders.filter(({ section }) => activeSections.has(section.code)).map((leader) => {
        const code = leader.section.leaderCode;
        const card = LEADER_CARDS[leader.section.code];
        if (!card) return null;
        const selected = selectedMarker === `leader:${leader.section.id}`;
        const action = onLeaderClick ? () => onLeaderClick(leader) : undefined;
        const statusColor = staffingColor(leader.staffCount, leader.target);
        const statusLabel = staffingLabel(leader.staffCount, leader.target);
        return (
          <g key={leader.section.id} transform={`translate(${card.x} ${card.y})`} role={action ? "button" : undefined} tabIndex={action ? 0 : undefined} aria-label={`${code}, Abschnitt ${leader.section.code}, ${leader.staffCount} von ${leader.target} besetzt, ${statusLabel}`} aria-pressed={action ? selected : undefined} onClick={action} onKeyDown={(event) => activate(event, action)} className={action ? `${controlClass} cursor-pointer outline-none` : undefined}>
            <title>{`${code}: ${leader.staffCount} von ${leader.target} besetzt (${statusLabel})`}</title>
            <rect className="marshal-focus-ring" width="140" height="54" rx="10" fill="white" stroke={selected ? "#0f172a" : SECTION_COLORS[leader.section.code] ?? "#64748b"} strokeWidth={selected ? 4 : 2} />
            <rect width="46" height="54" rx="10" fill={SECTION_COLORS[leader.section.code] ?? "#64748b"} />
            <path d="M38 0v54" stroke="white" opacity=".35" />
            <text x="23" y="32" textAnchor="middle" fontSize="13" fill="white" fontWeight="800">{code}</text>
            <text x="55" y="21" fontSize="10" fill="#475569" fontWeight="700">ABSCHNITTSLEITUNG</text>
            <circle cx="63" cy="38" r="7" fill={statusColor} />
            <text x="76" y="42" fontSize="12" fill="#1e293b" fontWeight="800">{leader.staffCount}/{leader.target}</text>
          </g>
        );
      })}

      {posts.map((post) => {
        const pos = position(post);
        const selected = selectedMarker === `post:${post.id}`;
        const sectionCode = post.code.startsWith("5/") ? "4" : post.code.split("/")[0];
        const action = onPostClick ? () => onPostClick(post) : undefined;
        const statusLabel = staffingLabel(post.staffCount, post.target, post.overfilled);
        return (
          <g key={post.id} role={action ? "button" : undefined} tabIndex={action ? 0 : undefined} aria-label={`Posten ${post.code}, ${post.staffCount} von ${post.target} besetzt, ${statusLabel}`} aria-pressed={action ? selected : undefined} onClick={action} onKeyDown={(event) => activate(event, action)} className={action ? `${controlClass} cursor-pointer outline-none` : undefined}>
            <circle className="marshal-focus-ring" cx={pos.x} cy={pos.y} r={selected ? 24 : 21} fill={staffingColor(post.staffCount, post.target, post.overfilled)} opacity=".5" stroke={selected ? "#0f172a" : "white"} strokeWidth={selected ? 4 : 2} />
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
