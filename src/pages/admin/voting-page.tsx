import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, EyeOff, Pin, RotateCcw, Star, Trophy } from "lucide-react";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminVotingService } from "@/services/admin-voting.service";
import { getAdminEventId } from "@/services/api/event-context";
import { getApiErrorMessage } from "@/services/api/http-client";
import type { AdminCandidate, CandidateExclusionReason, EventHubConfig, VotingMode, VotingResults } from "@/types/admin-voting";
import { AuctionAdminPanel } from "@/components/features/admin/auction-admin-panel";

const EXCLUSION_LABEL: Record<Exclude<CandidateExclusionReason, null>, string> = {
  processing_restricted: "Verarbeitung eingeschränkt",
  objection_flag: "Widerspruch eingelegt",
  publication_name_protected: "Veröffentlichungsname geschützt",
  hidden: "Administrativ ausgeblendet"
};

const MODE_LABEL: Record<VotingMode, string> = {
  auto: "Automatisch (Zeiten)",
  forced_open: "Manuell geöffnet",
  forced_closed: "Manuell geschlossen"
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

export function AdminVotingPage() {
  const { roles } = useAuth();
  const canWrite = hasPermission(roles, "voting.write");

  const [eventId, setEventId] = useState<string | null>(null);
  const [config, setConfig] = useState<EventHubConfig | null>(null);
  const [candidates, setCandidates] = useState<AdminCandidate[]>([]);
  const [results, setResults] = useState<VotingResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewEntryId, setPreviewEntryId] = useState<string | null>(null);

  const load = useCallback(async (eid: string, options: { silent?: boolean } = {}) => {
    if (!options.silent) setLoading(true);
    try {
      const [cfg, cands, res] = await Promise.all([
        adminVotingService.getConfig(eid),
        adminVotingService.getCandidates(eid),
        adminVotingService.getResults(eid)
      ]);
      setConfig(cfg);
      setCandidates(cands);
      setResults(res);
      setError("");
    } catch (e) {
      if (!options.silent) setError(getApiErrorMessage(e));
    } finally {
      if (!options.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    getAdminEventId()
      .then((id) => {
        setEventId(id);
        return load(id);
      })
      .catch(() => setError("Event konnte nicht geladen werden."));
  }, [load]);

  useEffect(() => {
    if (!eventId) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load(eventId, { silent: true });
      }
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [eventId, load]);

  const resultsByClass = useMemo(() => new Map((results?.classes ?? []).map((c) => [c.classId, c])), [results]);
  const candidatesByClass = useMemo(() => {
    const map = new Map<string, AdminCandidate[]>();
    for (const candidate of candidates) {
      const list = map.get(candidate.classId) ?? [];
      list.push(candidate);
      map.set(candidate.classId, list);
    }
    return map;
  }, [candidates]);

  const previewCandidate = candidates.find((c) => c.entryId === previewEntryId) ?? null;

  const saveConfigField = async (patch: Partial<{ votingOpensAt: string | null; votingClosesAt: string | null; votingMode: VotingMode }>) => {
    if (!eventId || !canWrite) return;
    setSavingConfig(true);
    try {
      const updated = await adminVotingService.patchConfig(eventId, patch);
      setConfig(updated);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSavingConfig(false);
    }
  };

  const setOverride = async (entryId: string, state: "auto" | "pinned" | "hidden") => {
    if (!eventId || !canWrite) return;
    try {
      await adminVotingService.setCandidateOverride(eventId, entryId, state);
      await load(eventId, { silent: true });
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  const setFeatured = async (candidate: AdminCandidate) => {
    if (!eventId || !canWrite) return;
    try {
      await adminVotingService.setCandidateOverride(eventId, candidate.entryId, undefined, !candidate.featured);
      await load(eventId, { silent: true });
    } catch (e) { setError(getApiErrorMessage(e)); }
  };

  const downloadCsv = async () => {
    if (!eventId) return;
    setExporting(true);
    try {
      await adminVotingService.downloadResultsCsv(eventId);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  if (loading && !config) {
    return <div className="p-6 text-sm text-slate-500">Lade Publikumsvoting…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Event-Interaktion</h1>
        <p className="text-sm text-slate-500 mt-1">Voting, Fahrer-Highlights und Helm-Versteigerung steuern</p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Status & Zeitsteuerung */}
      <div className="rounded-lg border bg-white shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-medium text-slate-700">Status &amp; Zeitfenster</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label>Modus</Label>
            <Select
              value={config?.votingMode ?? "auto"}
              disabled={!canWrite || savingConfig}
              onValueChange={(value) => void saveConfigField({ votingMode: value as VotingMode })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MODE_LABEL) as VotingMode[]).map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {MODE_LABEL[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Öffnet</Label>
            <Input
              type="datetime-local"
              disabled={!canWrite || savingConfig}
              value={toDatetimeLocal(config?.votingOpensAt ?? null)}
              onChange={(e) => void saveConfigField({ votingOpensAt: fromDatetimeLocal(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label>Schließt</Label>
            <Input
              type="datetime-local"
              disabled={!canWrite || savingConfig}
              value={toDatetimeLocal(config?.votingClosesAt ?? null)}
              onChange={(e) => void saveConfigField({ votingClosesAt: fromDatetimeLocal(e.target.value) })}
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Im Modus „Automatisch" richtet sich der Status nach den Zeiten. „Manuell geöffnet/geschlossen" übersteuert die Zeiten sofort.
        </p>
      </div>

      {/* Ergebnisse je Klasse */}
      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-medium text-slate-700">
            Rangliste je Klasse{results ? ` · ${results.invalidVoteCount} ungültige Stimmen` : ""}
          </h2>
          <Button type="button" variant="outline" size="sm" disabled={exporting} onClick={() => void downloadCsv()}>
            <Download className="mr-2 h-4 w-4" />
            CSV-Export
          </Button>
        </div>
        {!results || results.classes.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">Noch keine Stimmen erfasst.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {results.classes.map((cls) => (
              <div key={cls.classId} className="px-5 py-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Klasse {cls.classId}</h3>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {cls.entries.map((entry) => (
                      <tr key={entry.entryId}>
                        <td className="py-2 pr-3 w-10">
                          {entry.rank === 1 ? <Trophy size={16} className="text-yellow-500" /> : <span className="text-slate-400">{entry.rank}</span>}
                        </td>
                        <td className="py-2 pr-3 font-medium text-slate-900">
                          {entry.startNumberNorm ? `#${entry.startNumberNorm} · ` : ""}
                          {entry.driverName}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-slate-700">{entry.voteCount}</td>
                        <td className="py-2 text-right text-slate-500">{entry.percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kandidatenliste mit Pin/Hide */}
      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="text-sm font-medium text-slate-700">Kandidaten · {candidates.length}</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from(candidatesByClass.entries()).map(([classId, list]) => (
            <div key={classId} className="px-5 py-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                Klasse {classId} · {resultsByClass.get(classId)?.entries.length ?? 0} mit Stimmen
              </h3>
              <div className="space-y-2">
                {list.map((candidate) => (
                  <div
                    key={candidate.entryId}
                    className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${
                      candidate.eligible ? "border-slate-200" : "border-red-100 bg-red-50/50"
                    }`}
                  >
                    <div className="min-w-0">
                      <button type="button" className="font-medium text-slate-900 hover:underline" onClick={() => setPreviewEntryId(candidate.entryId)}>
                        {candidate.startNumberNorm ? `#${candidate.startNumberNorm} · ` : ""}
                        {candidate.driverName}
                      </button>
                      {candidate.exclusionReason && (
                        <p className="text-xs text-red-600">{EXCLUSION_LABEL[candidate.exclusionReason]}</p>
                      )}
                    </div>
                    {canWrite && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" title="Als Fahrer-Highlight zeigen" onClick={() => void setFeatured(candidate)} className={`p-1.5 rounded ${candidate.featured ? "bg-yellow-100 text-yellow-700" : "text-slate-400 hover:bg-slate-100"}`}><Star size={14} fill={candidate.featured ? "currentColor" : "none"}/></button>
                        <button
                          type="button"
                          title="Anpinnen"
                          onClick={() => void setOverride(candidate.entryId, candidate.overrideState === "pinned" ? "auto" : "pinned")}
                          className={`p-1.5 rounded ${candidate.overrideState === "pinned" ? "bg-amber-100 text-amber-700" : "text-slate-400 hover:bg-slate-100"}`}
                        >
                          <Pin size={14} />
                        </button>
                        <button
                          type="button"
                          title="Ausblenden"
                          onClick={() => void setOverride(candidate.entryId, candidate.overrideState === "hidden" ? "auto" : "hidden")}
                          className={`p-1.5 rounded ${candidate.overrideState === "hidden" ? "bg-red-100 text-red-700" : "text-slate-400 hover:bg-slate-100"}`}
                        >
                          {candidate.overrideState === "hidden" ? <RotateCcw size={14} /> : <EyeOff size={14} />}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vorschau öffentliche Fahrerkarte */}
      {previewCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreviewEntryId(null)}>
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-3 text-white">
              <p className="text-xs uppercase tracking-wide text-white/70">Vorschau öffentliche Karte</p>
              <p className="font-semibold">{previewCandidate.startNumberNorm ? `#${previewCandidate.startNumberNorm}` : "Ohne Startnummer"}</p>
            </div>
            <div className="p-4 space-y-1">
              {previewCandidate.eligible ? (
                <>
                  <p className="text-lg font-semibold text-slate-900">{previewCandidate.driverName}</p>
                  <p className="text-sm text-slate-500">
                    {[previewCandidate.vehicleMake, previewCandidate.vehicleModel].filter(Boolean).join(" ") || "Fahrzeug unbekannt"}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-500 italic">
                  Dieser Kandidat wird öffentlich nicht angezeigt ({previewCandidate.exclusionReason ? EXCLUSION_LABEL[previewCandidate.exclusionReason] : "ausgeschlossen"}).
                </p>
              )}
            </div>
            <div className="px-4 pb-4">
              <Button type="button" variant="outline" className="w-full" onClick={() => setPreviewEntryId(null)}>
                Schließen
              </Button>
            </div>
          </div>
        </div>
      )}
      {eventId && <AuctionAdminPanel eventId={eventId} canWrite={canWrite} />}
    </div>
  );
}
