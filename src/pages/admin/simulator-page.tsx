import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trash2, Trophy } from "lucide-react";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminSimulatorService } from "@/services/admin-simulator.service";
import { adminMetaService } from "@/services/admin-meta.service";
import { getApiErrorMessage } from "@/services/api/http-client";
import type { SimDay, SimEntry } from "@/types/admin-simulator";

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/** Parse flexible user input → milliseconds. Accepts:
 *  "1:23.456"  → 83456
 *  "83.456"    → 83456
 *  "83456"     → 83456 (already ms if no decimal point and > 999)
 *  "1:23"      → 83000
 */
function parseTimeMs(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  // MM:SS.mmm or M:SS.mmm
  const colonMatch = s.match(/^(\d+):(\d{2})(?:\.(\d{1,3}))?$/);
  if (colonMatch) {
    const minutes = parseInt(colonMatch[1], 10);
    const seconds = parseInt(colonMatch[2], 10);
    const msStr = (colonMatch[3] ?? "0").padEnd(3, "0");
    const ms = parseInt(msStr, 10);
    if (seconds >= 60) return null;
    return (minutes * 60 + seconds) * 1000 + ms;
  }

  // SS.mmm or SSS.mmm (decimal seconds)
  const decimalMatch = s.match(/^(\d+)\.(\d{1,3})$/);
  if (decimalMatch) {
    const totalSec = parseFloat(s);
    if (isNaN(totalSec) || totalSec <= 0) return null;
    return Math.round(totalSec * 1000);
  }

  // Pure integer: if > 999 treat as ms, else treat as seconds
  const intVal = parseInt(s, 10);
  if (!isNaN(intVal) && String(intVal) === s) {
    return intVal > 999 ? intVal : intVal * 1000;
  }

  return null;
}

/** Format milliseconds → "M:SS.mmm" */
function formatTimeMs(ms: number): string {
  const totalMs = Math.round(ms);
  const minutes = Math.floor(totalMs / 60000);
  const remaining = totalMs % 60000;
  const seconds = Math.floor(remaining / 1000);
  const milliseconds = remaining % 1000;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// Day helpers
// ---------------------------------------------------------------------------

function guessCurrentDay(): SimDay {
  const dow = new Date().getDay(); // 0=Sun, 6=Sat
  return dow === 6 ? "saturday" : "sunday";
}

const DAY_LABEL: Record<SimDay, string> = {
  saturday: "Samstag",
  sunday: "Sonntag"
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminSimulatorPage() {
  const { roles } = useAuth();
  const canWrite = hasPermission(roles, "sim.write");

  const [eventId, setEventId] = useState<string | null>(null);
  const [eventLoading, setEventLoading] = useState(true);

  const [day, setDay] = useState<SimDay>(guessCurrentDay);
  const [entries, setEntries] = useState<SimEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [nameInput, setNameInput] = useState("");
  const [timeInput, setTimeInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Autocomplete: filter existing entries for current day by name prefix
  const autocompleteItems = useMemo(() => {
    if (!nameInput.trim() || nameInput.length < 1) return [];
    const lower = nameInput.toLowerCase();
    return entries
      .filter((e) => e.day === day && e.name.toLowerCase().includes(lower))
      .slice(0, 8);
  }, [entries, nameInput, day]);

  // Detect if exact name already has an entry today
  const existingEntry = useMemo(
    () => entries.find((e) => e.day === day && e.name.toLowerCase() === nameInput.trim().toLowerCase()),
    [entries, nameInput, day]
  );

  // Parsed time preview
  const parsedMs = useMemo(() => parseTimeMs(timeInput), [timeInput]);

  // Load event + entries
  const loadEntries = useCallback(
    async (eid: string) => {
      setLoading(true);
      setError("");
      try {
        const res = await adminSimulatorService.listEntries(eid);
        setEntries(res.entries);
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    adminMetaService
      .getCurrentEvent()
      .then((event) => {
        if (event) {
          setEventId(event.id);
          loadEntries(event.id);
        }
      })
      .catch(() => setError("Aktuelles Event konnte nicht geladen werden."))
      .finally(() => setEventLoading(false));
  }, [loadEntries]);

  // Group & rank entries per day
  const grouped = useMemo(() => {
    const byDay: Record<SimDay, SimEntry[]> = { saturday: [], sunday: [] };
    [...entries]
      .sort((a, b) => a.bestTimeMs - b.bestTimeMs)
      .forEach((e) => byDay[e.day as SimDay]?.push(e));
    return byDay;
  }, [entries]);

  // Submit (upsert)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !canWrite) return;
    if (!nameInput.trim()) {
      setSubmitError("Name darf nicht leer sein.");
      return;
    }
    if (parsedMs === null || parsedMs <= 0) {
      setSubmitError("Ungültige Zeit. Eingabe z. B. \"1:23.456\" oder \"83.456\".");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      await adminSimulatorService.upsertEntry({
        eventId,
        name: nameInput.trim(),
        bestTimeMs: parsedMs,
        day
      });
      setNameInput("");
      setTimeInput("");
      await loadEntries(eventId);
    } catch (err) {
      setSubmitError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!canWrite || !eventId) return;
    if (!confirm("Eintrag löschen?")) return;
    try {
      await adminSimulatorService.deleteEntry(entryId);
      await loadEntries(eventId);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const selectAutocomplete = (entry: SimEntry) => {
    setNameInput(entry.name);
    setTimeInput(formatTimeMs(entry.bestTimeMs));
    setShowAutocomplete(false);
    nameRef.current?.blur();
  };

  if (eventLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 text-sm">
        Lade Event…
      </div>
    );
  }

  if (!eventId) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 text-sm">
        Kein aktives Event gefunden.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Simulator-Bestenliste</h1>
        <p className="text-sm text-slate-500 mt-1">
          Zeiten eintragen, überschreiben oder löschen. Anzeigetafel:{" "}
          <a
            href="https://sim.event.msc-oberlausitz.de"
            target="_blank"
            rel="noreferrer"
            className="underline text-blue-600"
          >
            sim.event.msc-oberlausitz.de
          </a>
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Day tabs */}
      <div className="flex gap-2">
        {(["saturday", "sunday"] as SimDay[]).map((d) => (
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

      {/* Entry form */}
      {canWrite && (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border bg-white p-5 shadow-sm space-y-4"
        >
          <h2 className="text-sm font-medium text-slate-700">
            Neuer Eintrag – {DAY_LABEL[day]}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name with autocomplete */}
            <div className="relative space-y-1">
              <Label htmlFor="sim-name">Name</Label>
              <Input
                id="sim-name"
                ref={nameRef}
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  setShowAutocomplete(true);
                }}
                onFocus={() => setShowAutocomplete(true)}
                onBlur={() => setTimeout(() => setShowAutocomplete(false), 150)}
                placeholder="Fahrer- oder Gästename"
                autoComplete="off"
              />
              {existingEntry && (
                <p className="text-xs text-amber-600 font-medium">
                  ⚠ Bisherige Zeit: {formatTimeMs(existingEntry.bestTimeMs)} – wird überschrieben
                </p>
              )}
              {showAutocomplete && autocompleteItems.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg text-sm overflow-hidden">
                  {autocompleteItems.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 flex justify-between"
                        onMouseDown={() => selectAutocomplete(item)}
                      >
                        <span>{item.name}</span>
                        <span className="text-slate-400 text-xs">{formatTimeMs(item.bestTimeMs)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Time input */}
            <div className="space-y-1">
              <Label htmlFor="sim-time">Bestzeit</Label>
              <Input
                id="sim-time"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                placeholder="1:23.456 oder 83.456"
              />
              {timeInput && parsedMs !== null && (
                <p className="text-xs text-slate-400">{formatTimeMs(parsedMs)}</p>
              )}
              {timeInput && parsedMs === null && (
                <p className="text-xs text-red-500">Ungültiges Format</p>
              )}
            </div>
          </div>

          {submitError && (
            <p className="text-sm text-red-600">{submitError}</p>
          )}

          <Button type="submit" disabled={submitting || !nameInput.trim() || parsedMs === null}>
            {submitting ? "Speichern…" : existingEntry ? "Zeit überschreiben" : "Eintrag speichern"}
          </Button>
        </form>
      )}

      {/* Results table */}
      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="text-sm font-medium text-slate-700">
            {DAY_LABEL[day]} · {grouped[day].length} Einträge
          </h2>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-400">Lade…</div>
        ) : grouped[day].length === 0 ? (
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
              {grouped[day].map((entry, index) => (
                <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-slate-400 font-mono">
                    {index === 0 ? (
                      <span className="text-yellow-500">
                        <Trophy className="h-4 w-4 inline -mt-0.5" /> 1
                      </span>
                    ) : (
                      index + 1
                    )}
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-900">{entry.name}</td>
                  <td className="px-5 py-3 text-right font-mono text-slate-700">
                    {formatTimeMs(entry.bestTimeMs)}
                  </td>
                  {canWrite && (
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="h-4 w-4" />
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
