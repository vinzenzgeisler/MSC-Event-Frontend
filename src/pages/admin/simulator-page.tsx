import { useCallback, useEffect, useMemo, useState } from "react";
import { Trophy, Trash2, Plus, ExternalLink, Moon, Sun } from "lucide-react";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminSimulatorService, simConfigService, type SimTheme } from "@/services/admin-simulator.service";
import { adminMetaService } from "@/services/admin-meta.service";
import { getApiErrorMessage } from "@/services/api/http-client";
import { TimeDrumPicker } from "@/components/features/admin/time-drum-picker";
import type { SimDay, SimEntry } from "@/types/admin-simulator";

/* ─── helpers ───────────────────────────────────────────────────────────────── */

function formatTimeMs(ms: number): string {
  const t = Math.round(ms);
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const i = t % 1000;
  return `${m}:${String(s).padStart(2, "0")}.${String(i).padStart(3, "0")}`;
}

const DAY_LABEL: Record<SimDay, string> = { saturday: "Samstag", sunday: "Sonntag" };
const LEADERBOARD_URL = "https://sim.event.msc-oberlausitz.de";
const DEFAULT_TIME_MS = 90_000;

/* ─── component ─────────────────────────────────────────────────────────────── */

export function AdminSimulatorPage() {
  const { roles } = useAuth();
  const canWrite = hasPermission(roles, "sim.write");

  const [eventId, setEventId] = useState<string | null>(null);
  const [day, setDay] = useState<SimDay>("saturday");
  const [entries, setEntries] = useState<SimEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [nameInput, setNameInput] = useState("");
  const [timeMs, setTimeMs] = useState(DEFAULT_TIME_MS);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showAC, setShowAC] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const [lbTheme, setLbTheme] = useState<SimTheme>("dark");
  const [themeLoading, setThemeLoading] = useState(false);

  /* ── load ── */
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
      .then(ev => { if (ev) { setEventId(ev.id); loadEntries(ev.id); } })
      .catch(() => setError("Event konnte nicht geladen werden."));
    // Load current leaderboard theme from backend
    simConfigService.getTheme().then(setLbTheme).catch(() => {});
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

  const leaderboardUrl = LEADERBOARD_URL;

  /* ─────────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Simulator-Bestenliste</h1>
          <p className="text-sm text-slate-500 mt-1">Zeiten eintragen und verwalten</p>
        </div>

        {/* Leaderboard-Link + Theme-Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Anzeigetafel:</span>
          <div className="flex items-center rounded-md border bg-white overflow-hidden text-sm">
            {(["dark", "light"] as SimTheme[]).map(t => (
              <button
                key={t}
                type="button"
                disabled={themeLoading}
                onClick={async () => {
                  setThemeLoading(true);
                  try {
                    await simConfigService.setTheme(t);
                    setLbTheme(t);
                  } catch { /* ignore */ }
                  finally { setThemeLoading(false); }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                  lbTheme === t ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"
                } disabled:opacity-50`}
              >
                {t === "dark" ? <><Moon size={13} /> Dark</> : <><Sun size={13} /> Hell</>}
              </button>
            ))}
          </div>
          <a
            href={leaderboardUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            Öffnen <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Day tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        {(["saturday", "sunday"] as SimDay[]).map(d => (
          <button
            key={d}
            type="button"
            onClick={() => setDay(d)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              day === d
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {DAY_LABEL[d]}
          </button>
        ))}
      </div>

      {/* ── Entry form ───────────────────────────────────────────────── */}
      {canWrite && (
        <div className="rounded-lg border bg-white shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-medium text-slate-700">
            Neuer Eintrag – {DAY_LABEL[day]}
          </h2>

          {/* Name */}
          <div className="relative space-y-1">
            <Label htmlFor="sim-name">Name</Label>
            <Input
              id="sim-name"
              value={nameInput}
              onChange={e => { setNameInput(e.target.value); setShowAC(true); }}
              onFocus={() => setShowAC(true)}
              onBlur={() => setTimeout(() => setShowAC(false), 150)}
              placeholder="Fahrer- oder Gästename"
              autoComplete="off"
              className={existing ? "border-amber-400 focus-visible:ring-amber-400" : ""}
            />
            {existing && (
              <p className="text-xs text-amber-600 font-medium">
                ⚠ Bisherige Zeit: {formatTimeMs(existing.bestTimeMs)} – wird überschrieben
              </p>
            )}

            {/* Autocomplete */}
            {showAC && acItems.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg text-sm overflow-hidden">
                {acItems.map(item => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex justify-between items-center gap-4"
                      onMouseDown={() => {
                        setNameInput(item.name);
                        setTimeMs(item.bestTimeMs);
                        setShowAC(false);
                        setShowPicker(true);
                      }}
                    >
                      <span className="font-medium">{item.name}</span>
                      <span className="text-slate-400 font-mono text-xs">{formatTimeMs(item.bestTimeMs)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Time picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Bestzeit</Label>
              <span className="font-mono text-lg font-bold text-primary">
                {formatTimeMs(timeMs)}
              </span>
            </div>

            {!showPicker ? (
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="w-full py-4 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 hover:border-slate-300 hover:text-slate-500 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              >
                <Plus size={16} /> Zeit einstellen
              </button>
            ) : (
              <TimeDrumPicker valueMs={timeMs} onChange={setTimeMs} dark={false} />
            )}
          </div>

          {submitError && (
            <p className="text-sm text-red-600">{submitError}</p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={submitting || !nameInput.trim() || !showPicker}
            className="w-full"
          >
            {submitting ? "Speichern…" : existing ? "Zeit überschreiben" : "Eintrag speichern"}
          </Button>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-700">
            {DAY_LABEL[day]} · {sorted.length} Einträge
          </h2>
          {loading && <span className="text-xs text-slate-400">Lade…</span>}
        </div>

        {sorted.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            Noch keine Einträge für {DAY_LABEL[day]}.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 text-left w-12">#</th>
                <th className="px-5 py-3 text-left">Name</th>
                <th className="px-5 py-3 text-right">Bestzeit</th>
                {canWrite && <th className="px-5 py-3 w-12" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((entry, i) => (
                <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    {i === 0
                      ? <Trophy size={16} className="text-yellow-500" />
                      : <span className="text-slate-400 font-medium">{i + 1}</span>
                    }
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-900">{entry.name}</td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-slate-700">
                    {formatTimeMs(entry.bestTimeMs)}
                  </td>
                  {canWrite && (
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
