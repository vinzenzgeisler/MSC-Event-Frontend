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

/** Schematic seed coordinates based on the Dreiecksrennen route topology. */
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

const SECTION_COLORS: Record<string, string> = {
  "1": "#2563eb",
  "2": "#16a34a",
  "3": "#d97706",
  "4": "#9333ea",
};

const SECTION_PATHS: Record<string, string> = {
  "1": "M700 90 C748 128 776 184 808 246 C842 312 885 386 895 455 C903 508 897 555 870 575",
  "2": "M870 575 C820 592 738 564 669 540 C611 519 566 472 515 446 C466 421 408 417 354 398 C342 394 331 390 320 386",
  "3": "M320 386 C284 373 250 354 220 324 C198 300 219 267 264 243 C292 228 316 219 338 212",
  "4": "M338 212 C359 207 377 204 395 201 C443 190 480 195 516 182 C568 179 609 160 644 131 C667 112 685 98 700 90",
};

const LEADER_CARDS: Record<string, { x: number; y: number; anchor: Point }> = {
  "1": { x: 842, y: 38, anchor: { x: 827, y: 284 } },
  "2": { x: 672, y: 624, anchor: { x: 650, y: 530 } },
  "3": { x: 24, y: 337, anchor: { x: 250, y: 350 } },
  "4": { x: 275, y: 55, anchor: { x: 478, y: 194 } },
};

const TRACK_PATH = `${SECTION_PATHS["1"]} ${SECTION_PATHS["2"].replace(/^M[^C]+/, "")} ${SECTION_PATHS["3"].replace(/^M[^C]+/, "")} ${SECTION_PATHS["4"].replace(/^M[^C]+/, "")}`;

function staffingVisual(count: number, target: number, overfilled = false) {
  if (overfilled) return { color: "#dc2626", symbol: "+", label: "über Soll" };
  if (count === 0) return { color: "#ef4444", symbol: "×", label: "unbesetzt" };
  if (count < target) return { color: "#f59e0b", symbol: "!", label: "unter Soll" };
  return { color: "#16a34a", symbol: "✓", label: "Soll erreicht" };
}

function activate(event: KeyboardEvent<SVGGElement>, action: (() => void) | undefined) {
  if (action && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    action();
  }
}

function InfrastructureLabel({ x, y, width, label, kind }: { x: number; y: number; width: number; label: string; kind: "neutral" | "medical" | "fire" | "parking" | "food" | "wc" }) {
  const colors = {
    neutral: { fill: "#ffffff", accent: "#475569" },
    medical: { fill: "#fff1f2", accent: "#dc2626" },
    fire: { fill: "#fff7ed", accent: "#c2410c" },
    parking: { fill: "#eff6ff", accent: "#2563eb" },
    food: { fill: "#fefce8", accent: "#a16207" },
    wc: { fill: "#ecfeff", accent: "#0e7490" },
  }[kind];
  return (
    <g transform={`translate(${x} ${y})`} aria-label={label}>
      <rect width={width} height="28" rx="6" fill={colors.fill} stroke="#cbd5e1" strokeWidth="1.5" />
      <rect width="25" height="28" rx="6" fill={colors.accent} />
      {kind === "medical" ? (
        <path d="M8 11h4V7h4v4h4v4h-4v4h-4v-4H8z" fill="white" />
      ) : kind === "parking" ? (
        <text x="12.5" y="20" textAnchor="middle" fontSize="18" fill="white" fontWeight="800">P</text>
      ) : kind === "fire" ? (
        <path d="M9 20c-3-5 2-7 2-12 4 3 6 6 5 9 1-1 2-2 2-4 3 4 1 8-3 9-3 1-5 0-6-2z" fill="white" />
      ) : kind === "food" ? (
        <path d="M9 7v7m4-7v7m-6-4h8m4-3v14m-2-7h4" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      ) : kind === "wc" ? (
        <text x="12.5" y="18" textAnchor="middle" fontSize="11" fill="white" fontWeight="800">WC</text>
      ) : (
        <path d="M7 14h11m-4-4 4 4-4 4" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      <text x="32" y="18" fontSize="10.5" fill="#334155" fontWeight="700">{label}</text>
    </g>
  );
}

function Village({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-label={`Ortschaft ${label}`}>
      <path d="M0 10 10 2l10 8v13H0zM25 14l8-7 9 7v11H25zM47 9l9-7 10 8v13H47z" fill="#e7e5e4" stroke="#a8a29e" strokeWidth="1" />
      <path d="m0 10 10-8 10 8M25 14l8-7 9 7M47 9l9-7 10 8" fill="none" stroke="#b45309" strokeWidth="2" />
      <text x="33" y="39" textAnchor="middle" fontSize="13" fill="#334155" fontWeight="800">{label}</text>
    </g>
  );
}

function SectionBoundary({ x, y, target, from, to }: { x: number; y: number; target: Point; from: string; to: string }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-label={`Abschnittsgrenze ${from} zu ${to}`}>
      <path d={`M0 0L${target.x - x} ${target.y - y}`} stroke="#0f172a" strokeWidth="1.5" strokeDasharray="4 3" />
      <circle cx={target.x - x} cy={target.y - y} r="4" fill="#0f172a" stroke="white" strokeWidth="1.5" />
      <rect x="-31" y="-10" width="62" height="20" rx="6" fill="#0f172a" opacity=".9" />
      <text x="0" y="4" textAnchor="middle" fontSize="9" fill="white" fontWeight="800">A{from} → A{to}</text>
    </g>
  );
}

export function MarshalTrackSvg({ posts, sections, leaders = [], selectedMarker, onPostClick, onLeaderClick, className }: Props) {
  const instanceId = useId().replace(/:/g, "");
  const arrowId = `${instanceId}-route-arrow`;
  const shadowId = `${instanceId}-track-shadow`;
  const forestPatternId = `${instanceId}-forest-pattern`;
  const fieldPatternId = `${instanceId}-field-pattern`;
  const controlClass = `${instanceId}-marshal-control`;
  const activeSections = new Set(sections.map((section) => section.code));
  const position = (post: TrackPost) => {
    if (post.mapX == null || post.mapY == null) return DEFAULT_POST_COORDS[post.code] ?? { x: 500, y: 350 };
    return { x: post.mapX, y: post.mapY > 700 ? post.mapY * 0.7 : post.mapY };
  };

  return (
    <svg viewBox="0 0 1000 700" className={className ?? "h-auto w-full"} role="group" aria-label="Detaillierter Strecken- und Einsatzplan des Dreiecksrennens mit auswählbaren Posten und Abschnittsleitern">
      <defs>
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#334155" floodOpacity=".18" /></filter>
        <marker id={arrowId} markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M0 0v8l8-4z" fill="#0f172a" /></marker>
        <pattern id={forestPatternId} width="28" height="28" patternUnits="userSpaceOnUse">
          <rect width="28" height="28" fill="#dce8d7" />
          <path d="m7 20 5-9 5 9zm13-5 3-6 3 6z" fill="#86a77a" opacity=".55" />
          <path d="M12 20v4m11-9v4" stroke="#71866b" strokeWidth="1" />
        </pattern>
        <pattern id={fieldPatternId} width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
          <rect width="18" height="18" fill="#eee8cf" />
          <path d="M0 4h18M0 12h18" stroke="#d6cda8" strokeWidth="1" opacity=".7" />
        </pattern>
      </defs>
      <style>{`.${controlClass}:focus-visible .marshal-focus-ring{stroke:#0f172a;stroke-width:4px}`}</style>

      <rect width="1000" height="700" rx="18" fill="#f3f1e8" />

      <g aria-label="Abstrakte Landschaft und Orientierung" pointerEvents="none">
        <path d="M8 148C95 116 178 139 245 181s101 74 171 83c76 10 149-25 211-1 58 22 78 75 80 128 2 61-30 106-91 129-67 25-144 12-214 29-78 18-132 66-211 64-80-2-143-54-183-101z" fill={`url(#${forestPatternId})`} stroke="#b7c7af" strokeWidth="2" />
        <path d="M0 475c104-29 181-17 264 15 97 38 191 80 310 84 139 5 253-53 426-49v175H0z" fill={`url(#${forestPatternId})`} opacity=".78" />
        <path d="M0 62 250 31l46 104-89 72L0 169zM759 0h241v197l-105 39-102-77zM733 377l267-53v200c-88 1-170 16-248 33z" fill={`url(#${fieldPatternId})`} stroke="#d6cda8" strokeWidth="1.5" />
        <path d="M30 456C180 438 298 463 414 516S674 610 970 590" fill="none" stroke="#b8aa8d" strokeWidth="13" strokeLinecap="round" />
        <path d="M30 456C180 438 298 463 414 516S674 610 970 590" fill="none" stroke="#f5f0e5" strokeWidth="9" strokeLinecap="round" strokeDasharray="18 7" />
        <path d="M617 40c19 74 39 123 80 189M115 203c68 32 113 56 160 108M760 205c-66 37-111 63-137 105" fill="none" stroke="#c7bda9" strokeWidth="7" strokeLinecap="round" />
        <path d="M617 40c19 74 39 123 80 189M115 203c68 32 113 56 160 108M760 205c-66 37-111 63-137 105" fill="none" stroke="#faf7ef" strokeWidth="4" strokeLinecap="round" />
        <text x="452" y="617" fontSize="13" fill="#6b5f4b" fontWeight="700" transform="rotate(8 452 617)">Strümpelweg</text>
        <text x="128" y="525" fontSize="11" fill="#54704d" letterSpacing="1.5" fontWeight="700">WALDGEBIET</text>
        <text x="843" y="421" fontSize="11" fill="#84784f" letterSpacing="1.5" fontWeight="700">FELDER</text>
        <Village x={657} y={16} label="Jonsdorf" />
        <Village x={358} y={112} label="Saalendorf" />
        <Village x={111} y={235} label="Waltersdorf" />
      </g>

      <g aria-label="Nordpfeil" transform="translate(70 62)" pointerEvents="none">
        <circle r="31" fill="white" opacity=".88" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M0-23 8 4 0 0-8 4z" fill="#0f172a" />
        <path d="M0 23 8-4 0 0-8-4z" fill="#cbd5e1" />
        <text x="0" y="-28" textAnchor="middle" fontSize="11" fill="#0f172a" fontWeight="900">N</text>
      </g>

      <text x="116" y="51" fontSize="18" fill="#1e293b" fontWeight="900">DREIECKSRENNEN</text>
      <text x="116" y="70" fontSize="11" fill="#64748b" letterSpacing="1.3">STRECKEN- UND EINSATZPLAN</text>

      <g aria-label="Veranstaltungsinfrastruktur" pointerEvents="none">
        <rect x="500" y="254" width="278" height="145" rx="15" fill="#f8fafc" opacity=".92" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="5 4" />
        <text x="515" y="273" fontSize="10" fill="#64748b" fontWeight="800" letterSpacing="1">EINSATZZENTRUM</text>
        <InfrastructureLabel x={514} y={283} width={119} label="Fahrerlager" kind="neutral" />
        <InfrastructureLabel x={644} y={283} width={119} label="Verpflegung" kind="food" />
        <InfrastructureLabel x={514} y={319} width={119} label="Feuerwehr" kind="fire" />
        <InfrastructureLabel x={644} y={319} width={119} label="DRK" kind="medical" />
        <InfrastructureLabel x={514} y={355} width={119} label="WC" kind="wc" />
        <InfrastructureLabel x={644} y={355} width={119} label="Parken" kind="parking" />
        <InfrastructureLabel x={618} y={220} width={130} label="Zufahrt Nord" kind="neutral" />
        <InfrastructureLabel x={640} y={407} width={136} label="Eingang Helfer" kind="neutral" />
        <path d="M683 248v-9M708 399v8" stroke="#475569" strokeWidth="2" strokeDasharray="3 2" />
      </g>

      <g aria-label="Verbindungen zu den Abschnittsleitungen" fill="none" stroke="#475569" strokeWidth="1.5" strokeDasharray="5 5" opacity=".82" pointerEvents="none">
        {leaders.filter(({ section }) => activeSections.has(section.code)).map((leader) => {
          const card = LEADER_CARDS[leader.section.code];
          if (!card) return null;
          const cardTargetX = card.x < card.anchor.x ? card.x + 128 : card.x;
          const cardTargetY = card.y + 25;
          return <path key={leader.section.id} d={`M${card.anchor.x} ${card.anchor.y} L${cardTargetX} ${cardTargetY}`} />;
        })}
      </g>

      <path d={TRACK_PATH} fill="none" stroke="#64748b" strokeWidth="50" strokeLinecap="round" strokeLinejoin="round" opacity=".35" filter={`url(#${shadowId})`} />
      {Object.entries(SECTION_PATHS).filter(([code]) => activeSections.has(code)).map(([code, path]) => (
        <path key={code} d={path} fill="none" stroke={SECTION_COLORS[code]} strokeWidth="43" strokeLinecap="round" strokeLinejoin="round" opacity=".5" />
      ))}
      <path d={TRACK_PATH} fill="none" stroke="#e2e8f0" strokeWidth="33" strokeLinecap="round" strokeLinejoin="round" />
      <path d={TRACK_PATH} fill="none" stroke="#ffffff" strokeWidth="2.5" strokeDasharray="12 10" strokeLinecap="round" opacity=".95" />

      <g aria-label="Fahrtrichtung" fill="none" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" pointerEvents="none">
        <path d="M758 159c13 17 23 35 31 54" markerEnd={`url(#${arrowId})`} />
        <path d="M866 361c9 22 16 43 20 64" markerEnd={`url(#${arrowId})`} />
        <path d="M785 568c-25-3-45-7-62-12" markerEnd={`url(#${arrowId})`} />
        <path d="M548 468c-21-15-38-24-58-31" markerEnd={`url(#${arrowId})`} />
        <path d="M259 357c-18-15-29-28-36-41" markerEnd={`url(#${arrowId})`} />
        <path d="M432 192c20-1 37-1 54-5" markerEnd={`url(#${arrowId})`} />
        <path d="M611 159c21-11 37-23 51-36" markerEnd={`url(#${arrowId})`} />
      </g>

      <g aria-label="Start und Ziel in Jonsdorf" pointerEvents="none">
        <path d="M683 108 716 77" stroke="white" strokeWidth="11" />
        <path d="M683 108 716 77" stroke="#0f172a" strokeWidth="7" strokeDasharray="5 5" />
        <rect x="724" y="77" width="105" height="28" rx="7" fill="#0f172a" />
        <text x="776.5" y="95" textAnchor="middle" fontSize="11" fill="white" fontWeight="900">START / ZIEL</text>
      </g>

      <SectionBoundary x={920} y={612} target={{ x: 862, y: 563 }} from="1" to="2" />
      <SectionBoundary x={310} y={458} target={{ x: 303, y: 379 }} from="2" to="3" />
      <SectionBoundary x={314} y={159} target={{ x: 363, y: 205 }} from="3" to="4" />
      <SectionBoundary x={596} y={44} target={{ x: 702, y: 91 }} from="4" to="1" />

      <g aria-label="Abschnittsbezeichnungen" pointerEvents="none">
        <g transform="translate(933 278) rotate(90)"><rect x="-55" y="-13" width="110" height="26" rx="8" fill="#dbeafe" stroke="#2563eb" /><text y="4" textAnchor="middle" fontSize="11" fill="#1e40af" fontWeight="900">ABSCHNITT 1 · OST</text></g>
        <g transform="translate(524 588)"><rect x="-68" y="-13" width="136" height="26" rx="8" fill="#dcfce7" stroke="#16a34a" /><text y="4" textAnchor="middle" fontSize="11" fill="#166534" fontWeight="900">ABSCHNITT 2 · WALDRAND</text></g>
        <g transform="translate(143 443)"><rect x="-55" y="-13" width="110" height="26" rx="8" fill="#fef3c7" stroke="#d97706" /><text y="4" textAnchor="middle" fontSize="11" fill="#92400e" fontWeight="900">ABSCHNITT 3</text></g>
        <g transform="translate(508 132)"><rect x="-55" y="-13" width="110" height="26" rx="8" fill="#f3e8ff" stroke="#9333ea" /><text y="4" textAnchor="middle" fontSize="11" fill="#6b21a8" fontWeight="900">ABSCHNITT 4</text></g>
        <path d="M591 122 619 143" fill="none" stroke="#6b21a8" strokeWidth="1.5" />
        <rect x="435" y="84" width="158" height="24" rx="7" fill="white" stroke="#c084fc" />
        <text x="514" y="100" textAnchor="middle" fontSize="9.5" fill="#6b21a8" fontWeight="800">5/1–5/3 werden als A4 geführt</text>
      </g>

      {leaders.filter(({ section }) => activeSections.has(section.code)).map((leader) => {
        const card = LEADER_CARDS[leader.section.code];
        if (!card) return null;
        const code = leader.section.leaderCode;
        const selected = selectedMarker === `leader:${leader.section.id}`;
        const action = onLeaderClick ? () => onLeaderClick(leader) : undefined;
        const status = staffingVisual(leader.staffCount, leader.target);
        return (
          <g
            key={leader.section.id}
            transform={`translate(${card.x} ${card.y})`}
            role={action ? "button" : undefined}
            tabIndex={action ? 0 : undefined}
            aria-label={`${code}, Abschnitt ${leader.section.code}, ${leader.staffCount} von ${leader.target} besetzt, ${status.label}`}
            aria-pressed={action ? selected : undefined}
            onClick={action}
            onKeyDown={(event) => activate(event, action)}
            className={action ? `${controlClass} cursor-pointer outline-none` : undefined}
          >
            <title>{`${code}: ${leader.staffCount} von ${leader.target} besetzt (${status.label})`}</title>
            <rect className="marshal-focus-ring" width="128" height="50" rx="10" fill="white" stroke={selected ? "#0f172a" : SECTION_COLORS[leader.section.code] ?? "#64748b"} strokeWidth={selected ? 4 : 2} filter={`url(#${shadowId})`} />
            <rect width="43" height="50" rx="10" fill={SECTION_COLORS[leader.section.code] ?? "#64748b"} />
            <path d="M34 0v50" stroke="white" opacity=".35" />
            <text x="21.5" y="30" textAnchor="middle" fontSize="13" fill="white" fontWeight="900">{code}</text>
            <text x="51" y="19" fontSize="9.5" fill="#64748b" fontWeight="800">ABSCHNITTSLEITUNG</text>
            <circle cx="56" cy="34" r="9" fill={status.color} />
            <text x="56" y="38" textAnchor="middle" fontSize="12" fill="white" fontWeight="900">{status.symbol}</text>
            <text x="70" y="38" fontSize="12" fill="#1e293b" fontWeight="900">{leader.staffCount}/{leader.target}</text>
          </g>
        );
      })}

      {posts.map((post) => {
        const pos = position(post);
        const selected = selectedMarker === `post:${post.id}`;
        const sectionCode = post.code.startsWith("5/") ? "4" : post.code.split("/")[0];
        const action = onPostClick ? () => onPostClick(post) : undefined;
        const status = staffingVisual(post.staffCount, post.target, post.overfilled);
        return (
          <g
            key={post.id}
            transform={`translate(${pos.x} ${pos.y})`}
            role={action ? "button" : undefined}
            tabIndex={action ? 0 : undefined}
            aria-label={`Posten ${post.code}, ${post.staffCount} von ${post.target} besetzt, ${status.label}`}
            aria-pressed={action ? selected : undefined}
            onClick={action}
            onKeyDown={(event) => activate(event, action)}
            className={action ? `${controlClass} cursor-pointer outline-none` : undefined}
          >
            <title>{`Posten ${post.code}: ${post.staffCount} von ${post.target} besetzt (${status.label})`}</title>
            <circle className="marshal-focus-ring" r={selected ? 23 : 20} fill="white" stroke={selected ? "#0f172a" : status.color} strokeWidth={selected ? 4 : 3.5} filter={`url(#${shadowId})`} />
            <rect x="-16" y="-10" width="32" height="20" rx="6" fill={SECTION_COLORS[sectionCode] ?? "#64748b"} stroke="white" strokeWidth="1.5" />
            <text y="3.5" textAnchor="middle" fontSize="9.5" fill="white" fontWeight="900" pointerEvents="none">{post.code}</text>
            <g transform="translate(10 12)" pointerEvents="none">
              <rect width="35" height="15" rx="7.5" fill={status.color} stroke="white" strokeWidth="1.5" />
              <text x="17.5" y="10.8" textAnchor="middle" fontSize="8.5" fill="white" fontWeight="900">{status.symbol} {post.staffCount}/{post.target}</text>
            </g>
          </g>
        );
      })}

      <g transform="translate(22 514)" aria-label="Legende" pointerEvents="none">
        <rect width="256" height="165" rx="12" fill="white" opacity=".96" stroke="#cbd5e1" strokeWidth="1.5" />
        <text x="14" y="22" fontSize="12" fill="#1e293b" fontWeight="900" letterSpacing="1">LEGENDE</text>
        <path d="M128 32v119" stroke="#e2e8f0" />
        {[...activeSections].sort().map((code, index) => (
          <g key={code} transform={`translate(14 ${38 + index * 27})`}>
            <rect width="17" height="17" rx="5" fill={SECTION_COLORS[code] ?? "#64748b"} />
            <text x="25" y="12.5" fontSize="10.5" fill="#334155" fontWeight="700">Abschnitt {code}</text>
          </g>
        ))}
        {[
          { color: "#16a34a", symbol: "✓", label: "Soll erreicht" },
          { color: "#f59e0b", symbol: "!", label: "Unter Soll" },
          { color: "#ef4444", symbol: "×", label: "Unbesetzt" },
          { color: "#dc2626", symbol: "+", label: "Über Soll" },
        ].map((item, index) => (
          <g key={item.label} transform={`translate(142 ${38 + index * 27})`}>
            <circle cx="8.5" cy="8.5" r="8.5" fill={item.color} />
            <text x="8.5" y="12" textAnchor="middle" fontSize="10" fill="white" fontWeight="900">{item.symbol}</text>
            <text x="23" y="12.5" fontSize="10.5" fill="#334155" fontWeight="700">{item.label}</text>
          </g>
        ))}
        <text x="142" y="157" fontSize="8.5" fill="#64748b">Symbol + Zahl ergänzen die Farbe</text>
      </g>
    </svg>
  );
}
