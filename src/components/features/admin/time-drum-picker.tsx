/**
 * TimeDrumPicker – tablet-first drum-scroll time input
 * Columns: minutes | seconds | hundredths | thousandths (ones digit)
 * Returns time in milliseconds.
 */
import { useEffect, useRef, useCallback } from "react";

type ColSpec = {
  label: string;
  min: number;
  max: number;
  step: number;
  pad: number;
  flex?: number;
};

const COLS: ColSpec[] = [
  { label: "Min", min: 0, max: 9, step: 1, pad: 1 },
  { label: "Sek", min: 0, max: 59, step: 1, pad: 2 },
  { label: "1/100", min: 0, max: 99, step: 1, pad: 2 },
  { label: "1/1000", min: 0, max: 9, step: 1, pad: 1, flex: 0.6 },
];

const ITEM_H = 72; // px per item
const VISIBLE = 5; // visible rows (centre = selected)

function values(col: ColSpec): number[] {
  const arr: number[] = [];
  for (let v = col.min; v <= col.max; v += col.step) arr.push(v);
  return arr;
}

function DrumColumn({
  spec,
  value,
  onChange,
  dark,
}: {
  spec: ColSpec;
  value: number;
  onChange: (v: number) => void;
  dark: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const items = values(spec);
  const idx = items.indexOf(value);

  // scroll to a given index. `smooth` is only used for external/programmatic jumps;
  // the drum's own scroll-driven updates never call this, so they never fight momentum.
  const scrollTo = useCallback(
    (i: number, smooth = false) => {
      const el = ref.current;
      if (!el) return;
      el.scrollTo({ top: i * ITEM_H, behavior: smooth ? "smooth" : "instant" });
    },
    []
  );

  // Tracks the index this column itself last reported via onScroll, so the sync effect
  // below can tell "the value changed because we scrolled" apart from "the value changed
  // from outside (preset button, other column, initial load)" and only correct the
  // scroll position in the latter case. Without this, every onChange during an active
  // touch-scroll would immediately get an instant corrective scrollTo fired back at it,
  // fighting the browser's native momentum/snap physics and making the drum feel like it
  // "hangs" instead of scrolling smoothly.
  const lastEmittedIndexRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (lastEmittedIndexRef.current === idx) return;
    scrollTo(idx);
    lastEmittedIndexRef.current = idx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  const onScroll = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = ref.current;
      if (!el) return;
      const i = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, i));
      lastEmittedIndexRef.current = clamped;
      if (items[clamped] !== value) onChange(items[clamped]);
    });
  }, [items, onChange, value]);

  const accent = dark ? "#3a6dc7" : "#2455a4";
  const bg     = dark ? "#1a2744" : "#e8f0fe";
  const textSel = dark ? "#f0f4ff" : "#1a2455";
  const textMut = dark ? "#4a6090" : "#9aabb8";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: spec.flex ?? 1, minWidth: 0 }}>
      {/* label */}
      <div style={{
        fontSize: 12, fontWeight: 700, letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: dark ? "#8899bb" : "#6b82aa",
        marginBottom: 6,
      }}>
        {spec.label}
      </div>

      {/* drum */}
      <div style={{ position: "relative", width: "100%", height: ITEM_H * VISIBLE }}>
        {/* highlight stripe */}
        <div style={{
          position: "absolute",
          top: ITEM_H * Math.floor(VISIBLE / 2),
          left: 0, right: 0,
          height: ITEM_H,
          background: `${accent}22`,
          borderTop: `2px solid ${accent}`,
          borderBottom: `2px solid ${accent}`,
          borderRadius: 8,
          pointerEvents: "none",
          zIndex: 1,
        }} />

        {/* gradient masks */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: ITEM_H * 2,
          background: dark
            ? `linear-gradient(to bottom, ${bg}ee, transparent)`
            : `linear-gradient(to bottom, ${bg}cc, transparent)`,
          pointerEvents: "none", zIndex: 2,
          borderRadius: "8px 8px 0 0",
        }} />
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: ITEM_H * 2,
          background: dark
            ? `linear-gradient(to top, ${bg}ee, transparent)`
            : `linear-gradient(to top, ${bg}cc, transparent)`,
          pointerEvents: "none", zIndex: 2,
          borderRadius: "0 0 8px 8px",
        }} />

        {/* scrollable list */}
        <div
          ref={ref}
          onScroll={onScroll}
          style={{
            height: "100%",
            overflowY: "scroll",
            scrollSnapType: "y mandatory",
            overscrollBehaviorY: "contain",
            WebkitOverflowScrolling: "touch",
            background: bg,
            borderRadius: 8,
            border: `1px solid ${accent}33`,
            /* hide scrollbar */
            scrollbarWidth: "none",
          }}
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          css={{ "&::-webkit-scrollbar": { display: "none" } }}
        >
          {/* padding top/bottom so first/last item can be centred */}
          <div style={{ height: ITEM_H * Math.floor(VISIBLE / 2) }} />
          {items.map((v) => (
            <div
              key={v}
              onClick={() => onChange(v)}
              style={{
                height: ITEM_H,
                display: "flex", alignItems: "center", justifyContent: "center",
                scrollSnapAlign: "center",
                fontFamily: "monospace",
                fontSize: v === value ? 36 : 28,
                fontWeight: v === value ? 800 : 400,
                color: v === value ? textSel : textMut,
                cursor: "pointer",
                userSelect: "none",
                transition: "font-size .1s, color .1s",
              }}
            >
              {String(v).padStart(spec.pad, "0")}
            </div>
          ))}
          <div style={{ height: ITEM_H * Math.floor(VISIBLE / 2) }} />
        </div>
      </div>
    </div>
  );
}

type Props = {
  valueMs: number;
  onChange: (ms: number) => void;
  dark: boolean;
};

function msToFields(ms: number) {
  const total = Math.round(ms);
  const min = Math.floor(total / 60000);
  const sec = Math.floor((total % 60000) / 1000);
  const centi = Math.floor((total % 1000) / 10);
  const milliOnes = total % 10;
  return { min, sec, centi, milliOnes };
}

function fieldsToMs(min: number, sec: number, centi: number, milliOnes: number) {
  return min * 60000 + sec * 1000 + centi * 10 + milliOnes;
}

export function TimeDrumPicker({ valueMs, onChange, dark }: Props) {
  const { min, sec, centi, milliOnes } = msToFields(valueMs);

  const bg     = dark ? "#111d31" : "#f8fafc";
  const sepClr = dark ? "#2455a4" : "#94a3b8";

  return (
    <div style={{
      background: bg,
      borderRadius: 16,
      padding: "16px 8px",
      display: "flex",
      alignItems: "center",
      gap: 4,
      width: "100%",
    }}>
      <DrumColumn
        spec={COLS[0]} value={min} dark={dark}
        onChange={(v) => onChange(fieldsToMs(v, sec, centi, milliOnes))}
      />

      <div style={{
        fontSize: 32, fontWeight: 800,
        color: sepClr, paddingBottom: 8, userSelect: "none",
        flexShrink: 0,
      }}>:</div>

      <DrumColumn
        spec={COLS[1]} value={sec} dark={dark}
        onChange={(v) => onChange(fieldsToMs(min, v, centi, milliOnes))}
      />

      <div style={{
        fontSize: 22, fontWeight: 700,
        color: sepClr, paddingBottom: 4, userSelect: "none",
        flexShrink: 0,
      }}>.</div>

      <DrumColumn
        spec={COLS[2]} value={centi} dark={dark}
        onChange={(v) => onChange(fieldsToMs(min, sec, v, milliOnes))}
      />

      <div style={{
        fontSize: 14, fontWeight: 700,
        color: sepClr, paddingBottom: 6, userSelect: "none",
        flexShrink: 0,
      }}>′</div>

      <DrumColumn
        spec={COLS[3]} value={milliOnes} dark={dark}
        onChange={(v) => onChange(fieldsToMs(min, sec, centi, v))}
      />
    </div>
  );
}
