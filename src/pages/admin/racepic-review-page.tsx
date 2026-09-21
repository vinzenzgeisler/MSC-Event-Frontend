import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminRacepicService } from "@/services/admin-racepic.service";
import { getApiErrorMessage } from "@/services/api/http-client";
import type { RacepicEntrySearchResult, RacepicReviewItem } from "@/types/admin-racepic";

const PAGE_SIZE = 10;

/**
 * Review-Queue (Paket 7), siehe docs/memory-bank/racepic-architecture.md Abschnitt H/18.
 *
 * Vereinfachungen ggü. dem Architekturplan (siehe racepic-progress.md fuer die Begruendung):
 * kein Soft-Lock pro Item, keine Tastaturbedienung, kein Qualitätsreport.
 */
export function AdminRacepicReviewPage() {
  const { eventId = "" } = useParams<{ eventId: string }>();
  const [items, setItems] = useState<RacepicReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyAssignmentId, setBusyAssignmentId] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    adminRacepicService
      .listReviewQueue(eventId, offset, PAGE_SIZE)
      .then((result) => {
        setItems(result.items);
        setTotal(result.total);
        setError("");
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [eventId, offset]);

  useEffect(reload, [reload]);

  const runAction = async (assignmentId: string, action: () => Promise<void>) => {
    setBusyAssignmentId(assignmentId);
    try {
      await action();
      reload();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusyAssignmentId(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">RacePic – Review</h1>
        <p className="text-sm text-slate-500">{total} Zuordnung(en) benötigen eine Entscheidung.</p>
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Lädt…</p>}

      {!loading && items.length === 0 && <p className="text-sm text-slate-400">Keine offenen Zuordnungen.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <ReviewCard
            key={item.assignmentId}
            item={item}
            eventId={eventId}
            busy={busyAssignmentId === item.assignmentId}
            onConfirm={() => runAction(item.assignmentId, () => adminRacepicService.confirmAssignment(item.assignmentId))}
            onReject={() => runAction(item.assignmentId, () => adminRacepicService.rejectAssignment(item.assignmentId))}
            onCorrect={(entryId) => runAction(item.assignmentId, () => adminRacepicService.correctAssignment(item.assignmentId, entryId))}
            onAdd={(entryId) => runAction(item.assignmentId, () => adminRacepicService.addAssignment(item.imageId, entryId, item.detection?.id ?? null))}
          />
        ))}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
            Zurück
          </Button>
          <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>
            Weiter
          </Button>
        </div>
      )}
    </div>
  );
}

function ReviewCard({
  item,
  eventId,
  busy,
  onConfirm,
  onReject,
  onCorrect,
  onAdd,
}: {
  item: RacepicReviewItem;
  eventId: string;
  busy: boolean;
  onConfirm: () => void;
  onReject: () => void;
  onCorrect: (entryId: string) => void;
  onAdd: (entryId: string) => void;
}) {
  const suggested = item.candidates.find((c) => c.entryId === item.suggestedEntryId) ?? item.candidates[0];

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="relative overflow-hidden rounded-md bg-slate-100">
        <img src={item.imagePreviewUrl} alt="" className="w-full" />
        {item.detection && (
          <div
            className="absolute border-2 border-red-500"
            style={{
              left: `${item.detection.bbox.left * 100}%`,
              top: `${item.detection.bbox.top * 100}%`,
              width: `${item.detection.bbox.width * 100}%`,
              height: `${item.detection.bbox.height * 100}%`,
            }}
          />
        )}
      </div>

      {suggested && (
        <p className="text-sm">
          <span className="font-medium">
            #{suggested.startNumber} {suggested.driverName}
          </span>{" "}
          – {suggested.vehicleMake} {suggested.vehicleModel}
          <span className="ml-2 text-slate-500">{Math.round(item.confidence * 100)}% Konfidenz</span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={onConfirm}>
          Bestätigen
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onReject}>
          Keine Zuordnung
        </Button>
      </div>

      {item.candidates.length > 1 && (
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">Alternative Kandidaten</p>
          <div className="flex flex-wrap gap-2">
            {item.candidates
              .filter((c) => c.entryId !== item.suggestedEntryId)
              .map((candidate) => (
                <Button key={candidate.candidateId} size="sm" variant="outline" disabled={busy} onClick={() => onCorrect(candidate.entryId)}>
                  #{candidate.startNumber} {candidate.driverName} ({Math.round(candidate.score * 100)}%)
                </Button>
              ))}
          </div>
        </div>
      )}

      <EntrySearchPicker eventId={eventId} disabled={busy} onPick={onAdd} label="Weitere Zuordnung / anderer Fahrer" />
    </div>
  );
}

function EntrySearchPicker({
  eventId,
  disabled,
  onPick,
  label,
}: {
  eventId: string;
  disabled: boolean;
  onPick: (entryId: string) => void;
  label: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RacepicEntrySearchResult[]>([]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      adminRacepicService.searchEntries(eventId, query).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [eventId, query]);

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      <Input placeholder="Name, Startnummer oder Fahrzeug…" value={query} onChange={(e) => setQuery(e.target.value)} disabled={disabled} />
      {results.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2">
          {results.map((result) => (
            <Button
              key={result.entryId}
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => {
                onPick(result.entryId);
                setQuery("");
                setResults([]);
              }}
            >
              #{result.startNumber} {result.driverName} ({result.vehicleMake} {result.vehicleModel})
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
