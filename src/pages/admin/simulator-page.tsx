import { useCallback, useEffect, useMemo, useState } from "react";
import { Trophy, Trash2, Moon, Sun, Plus } from "lucide-react";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { adminSimulatorService } from "@/services/admin-simulator.service";
import { adminMetaService } from "@/services/admin-meta.service";
import { getApiErrorMessage } from "@/services/api/http-client";
import { TimeDrumPicker } from "@/components/features/admin/time-drum-picker";
import type { SimDay, SimEntry } from "@/types/admin-simulator";

/* ─── time helpers ─────────────────────────────────────────────────────────── */

function formatTimeMs(ms: number): string {
  const t = Math.round(ms);
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const i = t % 1000;
  return `${m}:${String(s).padStart(2, "0")}.${String(i).padStart(3, "0")}`;
}

/* ─── constants ─────────────────────────────────────────────────────────────── */

const DAY_LABEL: Record<SimDay, string> = { saturday: "Samstag", sunday: "Sonntag" };
const DEFAULT_TIME_MS = 90_000; // 1:30.000

/* ─── component ─────────────────────────────────────────────────────────────── */

export function AdminSimulatorPage() {
  const { roles } = useAuth();
  const canWrite = hasPermission(roles, "sim.write");

  /* ── state ── */
  const [dark, setDark] = useState(true);
  const [eventId, setEventId] = useState<string | null>(null);
  const [day, setDay] = useState<SimDay>("saturday");
  const [entries, setEntries] = useState<SimEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* form */
  const [nameInput, setNameInput] = useState("");
  const [timeMs, setTimeMs] = useState(DEFAULT_TIME_MS);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showAC, setShowAC] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  /* ── load event & entries ── */
  const loadEntries = useCallback(async (eid: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await adminSimulatorService.listEntries(eid);
      setEntries(res.entries);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    adminMetaService.getCurrentEvent()
      .then(ev => {
        if (ev) {
          setEventId(ev.id);
          loadEntries(ev.id);
        }
      })
      .catch(() => setError("Event konnte nicht geladen werden."));
  }, [loadEntries]);

  /* ── derived ── */
  const sorted = useMemo(
    () => [...entries].filter(e => e.day === day).sort((a, b) => a.bestTimeMs - b.bestTimeMs),
    [entries, day]
  );

  const acItems = useMemo(() => {
    if (!nameInput.trim()) return [];
    const q = nameInput.toLowerCase();
    return entries.filter(e => e.day === day && e.name.toLowerCase().includes(q)).slice(0, 6);
  }, [entries, nameInput, day]);

  const existing = useMemo(
    () => entries.find(e => e.day === day && e.name.toLowerCase() === nameInput.trim().toLowerCase()),
    [entries, nameInput, day]
  );

  /* ── submit ── */
  const handleSubmit = async () => {
    if (!eventId || !canWrite) return;
    if (!nameInput.trim()) { setSubmitError("Name fehlt."); return; }
    if (timeMs <= 0) { setSubmitError("Zeit ungültig."); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      await adminSimulatorService.upsertEntry({ eventId, name: nameInput.trim(), bestTimeMs: timeMs, day });
      setNameInput("");
      setTimeMs(DEFAULT_TIME_MS);
      setShowPicker(false);
      await loadEntries(eventId);
    } catch (e) {
      setSubmitError(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canWrite || !eventId || !confirm("Eintrag löschen?")) return;
    try {
      await adminSimulatorService.deleteEntry(id);
      await loadEntries(eventId);
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  /* ── theme tokens ── */
  const bg      = dark ? "#0d1829" : "#f4f6fb";
  const surface = dark ? "#162240" : "#ffffff";
  const border  = dark ? "#2455a4" : "#c8d8f0";
  const text    = dark ? "#f0f4ff" : "#1a2455";
  const muted   = dark ? "#8899bb" : "#6b82aa";
  const accent  = dark ? "#3a6dc7" : "#2455a4";
  const gold    = "#f5c000";
  const inputBg = dark ? "#0d1829" : "#e8f0fe";
  const inputBorder = dark ? "#2455a4" : "#a0b8d8";

  return (
    <div style={{
      minHeight: "100vh", background: bg, color: text,
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      padding: "0 0 40px",
    }}>

      {/* ── TOP BAR ─────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px",
        background: surface,
        borderBottom: `2px solid ${border}`,
        marginBottom: 20,
        gap: 12,
        flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Simulator-Bestenliste</div>
          <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
            <a
              href="https://sim.event.msc-oberlausitz.de"
              target="_blank" rel="noreferrer"
              style={{ color: accent, textDecoration: "underline" }}
            >
              sim.event.msc-oberlausitz.de
            </a>
          </div>
        </div>

        {/* Day + Dark toggle */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {(["saturday", "sunday"] as SimDay[]).map(d => (
            <button key={d} onClick={() => setDay(d)} style={{
              padding: "8px 18px",
              borderRadius: 10,
              border: `2px solid ${day === d ? accent : border}`,
              background: day === d ? accent : "transparent",
              color: day === d ? "#fff" : muted,
              fontWeight: 700, fontSize: 14, cursor: "pointer",
              transition: "all .15s",
            }}>
              {DAY_LABEL[d]}
            </button>
          ))}

          <button onClick={() => setDark(d => !d)} style={{
            width: 38, height: 38, borderRadius: 10,
            border: `1px solid ${border}`,
            background: "transparent",
            color: muted, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>

      <div style={{ padding: "0 16px", maxWidth: 700, margin: "0 auto" }}>

        {error && (
          <div style={{
            background: "#ef444420", border: "1px solid #ef4444",
            borderRadius: 10, padding: "10px 14px",
            color: "#ef4444", fontSize: 14, marginBottom: 16,
          }}>{error}</div>
        )}

        {/* ── ENTRY FORM ────────────────────────────────────────────── */}
        {canWrite && (
          <div style={{
            background: surface, borderRadius: 16,
            border: `1px solid ${border}`,
            padding: 20, marginBottom: 20,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: muted, marginBottom: 14, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Neuer Eintrag – {DAY_LABEL[day]}
            </div>

            {/* NAME */}
            <div style={{ position: "relative", marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: muted, marginBottom: 5 }}>
                Name des Fahrers / der Fahrerin
              </label>
              <input
                value={nameInput}
                onChange={e => { setNameInput(e.target.value); setShowAC(true); }}
                onFocus={() => setShowAC(true)}
                onBlur={() => setTimeout(() => setShowAC(false), 150)}
                placeholder="Name eingeben…"
                style={{
                  width: "100%", padding: "14px 16px",
                  fontSize: 18, fontWeight: 600,
                  background: inputBg, color: text,
                  border: `2px solid ${existing ? gold : inputBorder}`,
                  borderRadius: 12, outline: "none",
                  boxSizing: "border-box",
                }}
              />

              {existing && (
                <div style={{
                  marginTop: 6, padding: "6px 12px",
                  background: `${gold}22`, border: `1px solid ${gold}66`,
                  borderRadius: 8, fontSize: 13, color: gold,
                  fontWeight: 600,
                }}>
                  ⚠ Bisherige Zeit: {formatTimeMs(existing.bestTimeMs)} – wird überschrieben
                </div>
              )}

              {/* autocomplete */}
              {showAC && acItems.length > 0 && (
                <div style={{
                  position: "absolute", zIndex: 20, top: "100%", left: 0, right: 0,
                  background: surface, border: `1px solid ${border}`,
                  borderRadius: 10, overflow: "hidden",
                  boxShadow: "0 8px 24px rgba(0,0,0,.3)",
                  marginTop: 4,
                }}>
                  {acItems.map(item => (
                    <button key={item.id} type="button"
                      onMouseDown={() => { setNameInput(item.name); setTimeMs(item.bestTimeMs); setShowAC(false); setShowPicker(true); }}
                      style={{
                        display: "flex", width: "100%", alignItems: "center",
                        justifyContent: "space-between",
                        padding: "13px 16px", background: "transparent",
                        border: "none", borderBottom: `1px solid ${border}33`,
                        color: text, cursor: "pointer", textAlign: "left",
                        fontSize: 16,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{item.name}</span>
                      <span style={{ fontFamily: "monospace", color: muted, fontSize: 14 }}>
                        {formatTimeMs(item.bestTimeMs)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* TIME PICKER */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 8,
              }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: muted }}>
                  Bestzeit
                </label>
                <div style={{
                  fontSize: 22, fontFamily: "monospace", fontWeight: 800,
                  color: accent, letterSpacing: "0.04em",
                }}>
                  {formatTimeMs(timeMs)}
                </div>
              </div>

              {!showPicker ? (
                <button
                  onClick={() => setShowPicker(true)}
                  style={{
                    width: "100%", padding: "18px",
                    background: inputBg, border: `2px dashed ${inputBorder}`,
                    borderRadius: 14, color: muted, cursor: "pointer",
                    fontSize: 15, fontWeight: 600, display: "flex",
                    alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <Plus size={18} /> Zeit einstellen
                </button>
              ) : (
                <TimeDrumPicker valueMs={timeMs} onChange={setTimeMs} dark={dark} />
              )}
            </div>

            {submitError && (
              <div style={{ fontSize: 13, color: "#ef4444", marginBottom: 10 }}>{submitError}</div>
            )}

            {/* SUBMIT */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !nameInput.trim() || !showPicker}
              style={{
                width: "100%", padding: "16px",
                background: submitting || !nameInput.trim() || !showPicker ? `${accent}55` : accent,
                color: "#fff", border: "none", borderRadius: 12,
                fontSize: 18, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer",
                transition: "background .15s",
                letterSpacing: "0.02em",
              }}
            >
              {submitting ? "Speichern…" : existing ? "Zeit überschreiben" : "Eintrag speichern"}
            </button>
          </div>
        )}

        {/* ── LEADERBOARD TABLE ────────────────────────────────────── */}
        <div style={{
          background: surface, borderRadius: 16,
          border: `1px solid ${border}`,
          overflow: "hidden",
        }}>
          <div style={{
            padding: "14px 20px",
            borderBottom: `1px solid ${border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>
              {DAY_LABEL[day]} · {sorted.length} Einträge
            </span>
            {loading && <span style={{ fontSize: 12, color: muted }}>Lade…</span>}
          </div>

          {sorted.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: muted, fontSize: 15 }}>
              Noch keine Einträge für {DAY_LABEL[day]}.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: dark ? "#0d1829" : "#e8f0fe" }}>
                  {["#", "Name", "Bestzeit", ""].map((h, i) => (
                    <th key={i} style={{
                      padding: "10px 16px", textAlign: i === 2 ? "right" : "left",
                      fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                      textTransform: "uppercase", color: muted,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((entry, i) => (
                  <tr key={entry.id} style={{
                    borderTop: `1px solid ${border}22`,
                    transition: "background .1s",
                  }}>
                    <td style={{ padding: "14px 16px", width: 44 }}>
                      {i === 0
                        ? <Trophy size={18} style={{ color: gold }} />
                        : <span style={{ fontWeight: 700, color: muted, fontSize: 14 }}>{i + 1}</span>
                      }
                    </td>
                    <td style={{ padding: "14px 16px", fontWeight: 600, fontSize: 16 }}>
                      {entry.name}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: accent }}>
                      {formatTimeMs(entry.bestTimeMs)}
                    </td>
                    <td style={{ padding: "14px 12px", textAlign: "right", width: 44 }}>
                      {canWrite && (
                        <button
                          onClick={() => handleDelete(entry.id)}
                          style={{
                            background: "transparent", border: "none",
                            color: dark ? "#334155" : "#b0c0d8",
                            cursor: "pointer", padding: 4,
                            borderRadius: 6,
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
