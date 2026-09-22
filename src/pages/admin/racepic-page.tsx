import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminRacepicService } from "@/services/admin-racepic.service";
import { getApiErrorMessage } from "@/services/api/http-client";
import type {
  RacepicAdminImage,
  RacepicEventConfig,
  RacepicEventListItem,
  RacepicEventStats,
  RacepicImageAssignment,
  RacepicLicenseOption,
  RacepicMatchingConfig,
  RacepicMatchQualityReport,
  RacepicPhotographer,
  RacepicReviewItem,
} from "@/types/admin-racepic";

/**
 * RacePic Admin-Basis (Paket 5), siehe docs/memory-bank/racepic-architecture.md Abschnitt H.
 * Review-Queue (Paket 7) und KI-Konfiguration (Paket 6) folgen als eigene Bereiche.
 */
export function AdminRacepicPage() {
  const [events, setEvents] = useState<RacepicEventListItem[]>([]);
  const [licenses, setLicenses] = useState<RacepicLicenseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = () => {
    setLoading(true);
    Promise.all([adminRacepicService.listEvents(), adminRacepicService.listLicenses()])
      .then(([eventsRes, licensesRes]) => {
        setEvents(eventsRes);
        setLicenses(licensesRes);
        setError("");
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold">RacePic</h1>
        <p className="text-sm text-slate-500">
          Event aufklappen, um Einstellungen, Fotograf:innen, Bilder, Zuordnung und KI-Konfiguration zu verwalten.
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Lädt…</p>}

      {!loading && <EventsSection events={events} licenses={licenses} onChanged={reload} />}
    </div>
  );
}

function EventsSection({
  events,
  licenses,
  onChanged,
}: {
  events: RacepicEventListItem[];
  licenses: RacepicLicenseOption[];
  onChanged: () => void;
}) {
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Events</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3">Event</th>
              <th className="p-3">RacePic-Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {events.map((item) => (
              <>
                <tr key={item.eventId} className="border-t">
                  <td className="p-3">{item.eventName}</td>
                  <td className="p-3">
                    {item.racepic ? (
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={item.racepic.enabled ? "default" : "secondary"}>
                          {item.racepic.enabled ? "aktiviert" : "deaktiviert"}
                        </Badge>
                        <Badge variant={item.racepic.published ? "default" : "outline"}>
                          {item.racepic.published ? "veröffentlicht" : "nicht veröffentlicht"}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-slate-400">nicht konfiguriert</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/admin/racepic/review/${item.eventId}`}>Review</Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandedEventId(expandedEventId === item.eventId ? null : item.eventId)}
                      >
                        {expandedEventId === item.eventId ? "Schließen" : "Konfigurieren"}
                      </Button>
                    </div>
                  </td>
                </tr>
                {expandedEventId === item.eventId && (
                  <tr className="border-t bg-slate-50/50" key={`${item.eventId}-detail`}>
                    <td colSpan={3} className="p-4">
                      <EventConfigForm event={item} licenses={licenses} onSaved={onChanged} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

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

function EventConfigForm({ event, licenses, onSaved }: { event: RacepicEventListItem; licenses: RacepicLicenseOption[]; onSaved: () => void }) {
  const existing = event.racepic;
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [title, setTitle] = useState(existing?.title ?? event.eventName);
  const [enabled, setEnabled] = useState(existing?.enabled ?? false);
  const [published, setPublished] = useState(existing?.published ?? false);
  const [uploadOpensAt, setUploadOpensAt] = useState(toDatetimeLocal(existing?.uploadOpensAt ?? null));
  const [uploadClosesAt, setUploadClosesAt] = useState(toDatetimeLocal(existing?.uploadClosesAt ?? null));
  const [defaultLicenseId, setDefaultLicenseId] = useState(existing?.defaultLicenseId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<RacepicEventStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      adminRacepicService
        .getEventStats(event.eventId)
        .then((result) => {
          if (!cancelled) setStats(result);
        })
        .catch(() => {
          if (!cancelled) setStats(null);
        });
    };
    load();
    // Pollt alle 8s, solange dieses Event aufgeklappt ist, damit der KI-Pipeline-Status live
    // weiterläuft (Feedback 2026-09-22) statt nur beim manuellen Neuladen der Seite zu aktualisieren.
    const interval = window.setInterval(load, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [event.eventId]);

  const handleSubmit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    setSaving(true);
    setError("");
    try {
      await adminRacepicService.putEventConfig(event.eventId, {
        slug,
        title,
        enabled,
        published,
        uploadOpensAt: fromDatetimeLocal(uploadOpensAt),
        uploadClosesAt: fromDatetimeLocal(uploadClosesAt),
        defaultLicenseId: defaultLicenseId || null,
      });
      onSaved();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const tabTriggerClass =
    "rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-slate-500 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none";

  return (
    <Tabs defaultValue="settings" className="w-full">
      <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b bg-transparent p-0">
        <TabsTrigger value="settings" className={tabTriggerClass}>
          Einstellungen
        </TabsTrigger>
        <TabsTrigger value="photographers" className={tabTriggerClass}>
          Fotograf:innen
        </TabsTrigger>
        <TabsTrigger value="images" className={tabTriggerClass}>
          Bilder
        </TabsTrigger>
        <TabsTrigger value="assignment" className={tabTriggerClass}>
          Zuordnung
        </TabsTrigger>
        <TabsTrigger value="matching" className={tabTriggerClass}>
          KI-Konfiguration
        </TabsTrigger>
      </TabsList>

      <TabsContent value="settings" className="pt-4">
    <div className="grid gap-6 md:grid-cols-2">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`slug-${event.eventId}`}>Slug</Label>
            <Input id={`slug-${event.eventId}`} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="old-2026" required />
          </div>
          <div>
            <Label htmlFor={`title-${event.eventId}`}>Titel</Label>
            <Input id={`title-${event.eventId}`} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`opens-${event.eventId}`}>Upload öffnet</Label>
            <Input id={`opens-${event.eventId}`} type="datetime-local" value={uploadOpensAt} onChange={(e) => setUploadOpensAt(e.target.value)} />
          </div>
          <div>
            <Label htmlFor={`closes-${event.eventId}`}>Upload schließt</Label>
            <Input id={`closes-${event.eventId}`} type="datetime-local" value={uploadClosesAt} onChange={(e) => setUploadClosesAt(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor={`license-${event.eventId}`}>Standard-Lizenz</Label>
          <select
            id={`license-${event.eventId}`}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={defaultLicenseId}
            onChange={(e) => setDefaultLicenseId(e.target.value)}
          >
            <option value="">– keine –</option>
            {licenses.map((license) => (
              <option key={license.id} value={license.id}>
                {license.title.de ?? license.code}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Aktiviert
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            Veröffentlicht (öffentlich sichtbar)
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={saving}>
          {saving ? "Speichert…" : "Speichern"}
        </Button>
      </form>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Statistik</h3>
        {!stats && <p className="text-sm text-slate-400">Lädt…</p>}
        {stats && (
          <div className="space-y-3 text-sm">
            <p>{stats.photographerCount} Fotograf:innen mit Zugang</p>
            <div>
              <p className="mb-1 font-medium">KI-Pipeline: Bilder nach Verarbeitungsstatus</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  ...PROCESSING_STATUS_ORDER,
                  ...Object.keys(stats.imagesByStatus).filter((status) => !PROCESSING_STATUS_ORDER.includes(status)),
                ]
                  .filter((status) => stats.imagesByStatus[status] > 0)
                  .map((status) => (
                    <span key={status} className="inline-flex items-center gap-1">
                      <ProcessingStatusBadge status={status} />
                      <span className="text-xs text-slate-500">×{stats.imagesByStatus[status]}</span>
                    </span>
                  ))}
                {Object.keys(stats.imagesByStatus).length === 0 && <span className="text-slate-400">keine Bilder</span>}
              </div>
            </div>
            <div>
              <p className="mb-1 font-medium">Zuordnungen nach Status</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  ...ASSIGNMENT_STATUS_ORDER,
                  ...Object.keys(stats.assignmentsByStatus).filter((status) => !ASSIGNMENT_STATUS_ORDER.includes(status)),
                ]
                  .filter((status) => stats.assignmentsByStatus[status] > 0)
                  .map((status) => (
                    <span key={status} className="inline-flex items-center gap-1">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${status === "REVIEW_REQUIRED" ? "border-amber-300 text-amber-700" : "border-slate-300 text-slate-500"}`}
                      >
                        {ASSIGNMENT_STATUS_LABELS[status] ?? status}
                      </Badge>
                      <span className="text-xs text-slate-500">×{stats.assignmentsByStatus[status]}</span>
                    </span>
                  ))}
                {Object.keys(stats.assignmentsByStatus).length === 0 && <span className="text-slate-400">noch keine Zuordnungen</span>}
              </div>
            </div>
            <div>
              <p className="font-medium">Bilder nach Sichtbarkeit</p>
              <ul className="ml-4 list-disc">
                {Object.entries(stats.imagesByVisibility).map(([visibility, count]) => (
                  <li key={visibility}>
                    {visibility}: {count}
                  </li>
                ))}
                {Object.keys(stats.imagesByVisibility).length === 0 && <li className="text-slate-400">keine Bilder</li>}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
      </TabsContent>

      <TabsContent value="photographers" className="pt-4">
        <EventPhotographersTab eventId={event.eventId} />
      </TabsContent>

      <TabsContent value="images" className="pt-4">
        <ImagesSection eventId={event.eventId} />
      </TabsContent>

      <TabsContent value="assignment" className="pt-4">
        <AssignmentOverviewTab eventId={event.eventId} />
      </TabsContent>

      <TabsContent value="matching" className="pt-4">
        <MatchingSection eventId={event.eventId} />
      </TabsContent>
    </Tabs>
  );
}

/**
 * KI-Pipeline-Status pro Bild (Feedback 2026-09-22: "einen besseren Status der KI-Analyse" - ein
 * frisch hochgeladenes Bild durchläuft Ingest → Analyze → Match asynchron über SQS und taucht
 * deshalb nicht sofort in der Review-Queue auf; die rohen Enum-Werte allein erklären das nicht).
 */
const PROCESSING_STATUS_ORDER = ["UPLOADED", "VALIDATED", "DERIVED", "ANALYZED", "MATCHED", "FAILED", "DUPLICATE"];
const PROCESSING_STATUS_LABELS: Record<string, string> = {
  UPLOADED: "Hochgeladen",
  VALIDATED: "Geprüft",
  DERIVED: "Varianten werden erzeugt",
  ANALYZED: "KI-Analyse fertig",
  MATCHED: "Zuordnung berechnet",
  FAILED: "Fehlgeschlagen",
  DUPLICATE: "Duplikat",
};
// Bilder in diesen Stati werden noch von der Pipeline verarbeitet - solange mindestens eins davon
// existiert, lohnt sich Polling, damit der Status ohne manuelles Neuladen weiterläuft.
const PROCESSING_NON_TERMINAL_STATUSES = new Set(["UPLOADED", "VALIDATED", "DERIVED", "ANALYZED"]);
const PROCESSING_STATUS_BADGE_CLASS: Record<string, string> = {
  UPLOADED: "border-slate-300 text-slate-500",
  VALIDATED: "border-slate-300 text-slate-500",
  DERIVED: "border-blue-300 text-blue-600",
  ANALYZED: "border-blue-300 text-blue-600",
  MATCHED: "border-green-300 text-green-700",
  FAILED: "border-red-300 text-red-700",
  DUPLICATE: "border-amber-300 text-amber-700",
};

function ProcessingStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`text-[10px] ${PROCESSING_STATUS_BADGE_CLASS[status] ?? "border-slate-300 text-slate-500"}`}>
      {PROCESSING_NON_TERMINAL_STATUSES.has(status) && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {PROCESSING_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

const ASSIGNMENT_STATUS_ORDER = ["REVIEW_REQUIRED", "AUTO_MATCHED", "MANUALLY_CONFIRMED", "MANUALLY_CORRECTED", "REJECTED"];
const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  REVIEW_REQUIRED: "Wartet auf Entscheidung",
  AUTO_MATCHED: "Automatisch zugeordnet",
  MANUALLY_CONFIRMED: "Bestätigt",
  MANUALLY_CORRECTED: "Manuell korrigiert",
  REJECTED: "Abgelehnt",
};

const VISIBILITY_ACTIONS: Record<string, { label: string; next: "PUBLISHED" | "HIDDEN" | "REMOVED"; permission?: "manage" }[]> = {
  DRAFT: [{ label: "Veröffentlichen", next: "PUBLISHED" }],
  HIDDEN: [
    { label: "Veröffentlichen", next: "PUBLISHED" },
    { label: "Entfernen", next: "REMOVED" },
  ],
  PUBLISHED: [
    { label: "Verbergen", next: "HIDDEN" },
    { label: "Entfernen", next: "REMOVED" },
  ],
};

/**
 * Paket 11: allgemeine Bildliste je Event, Paket 16: von der Tabelle auf ein Kontaktabzug-Grid mit
 * Mehrfachauswahl (Bulk-Veröffentlichen/-Verbergen) und einem Klick-Detail zur Zuordnung
 * umgebaut, siehe racepic-ux-redesign-plan.md.
 */
function ImagesSection({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<RacepicAdminImage[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [visibilityFilter, setVisibilityFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyImageId, setBusyImageId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [detailImageId, setDetailImageId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const pageSize = 20;

  const reload = () => {
    setLoading(true);
    adminRacepicService
      .listImages(eventId, { visibility: visibilityFilter || undefined }, offset, pageSize)
      .then((result) => {
        setItems(result.items);
        setTotal(result.total);
        setSelected(new Set());
        setError("");
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [eventId, visibilityFilter, offset]);

  // Solange noch Bilder auf dieser Seite in der Pipeline stecken (UPLOADED/VALIDATED/DERIVED/
  // ANALYZED), alle 5s neu laden - Feedback 2026-09-22: ein frisch hochgeladenes Bild soll seinen
  // Fortschritt zeigen, ohne dass man die Seite manuell neu lädt. Stoppt automatisch, sobald alle
  // sichtbaren Bilder einen Endstatus (MATCHED/FAILED/DUPLICATE) erreicht haben.
  useEffect(() => {
    if (!items.some((item) => PROCESSING_NON_TERMINAL_STATUSES.has(item.processingStatus))) return;
    const timeout = window.setTimeout(reload, 5000);
    return () => window.clearTimeout(timeout);
  }, [items, eventId, visibilityFilter, offset]);

  const runAction = async (imageId: string, next: "PUBLISHED" | "HIDDEN" | "REMOVED") => {
    if (next === "REMOVED" && !window.confirm("Bild wirklich endgültig entfernen? Das löscht die Bilddateien.")) return;
    setBusyImageId(imageId);
    try {
      await adminRacepicService.setImageVisibility(imageId, next);
      reload();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusyImageId(null);
    }
  };

  const toggleSelected = (imageId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  };

  const runBulkAction = async (next: "PUBLISHED" | "HIDDEN") => {
    setBulkRunning(true);
    setError("");
    try {
      for (const imageId of selected) {
        await adminRacepicService.setImageVisibility(imageId, next).catch(() => undefined);
      }
      reload();
    } finally {
      setBulkRunning(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Bilder ({total})</h3>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <span className="text-xs text-slate-500">{selected.size} ausgewählt</span>
              <Button size="sm" variant="outline" disabled={bulkRunning} onClick={() => runBulkAction("PUBLISHED")}>
                Veröffentlichen
              </Button>
              <Button size="sm" variant="outline" disabled={bulkRunning} onClick={() => runBulkAction("HIDDEN")}>
                Verbergen
              </Button>
            </>
          )}
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={visibilityFilter}
            onChange={(e) => {
              setOffset(0);
              setVisibilityFilter(e.target.value);
            }}
          >
            <option value="">Alle Sichtbarkeiten</option>
            <option value="DRAFT">DRAFT</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="HIDDEN">HIDDEN</option>
            <option value="REMOVED">REMOVED</option>
          </select>
        </div>
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-400">Lädt…</p>}
      {!loading && (
        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((image) => (
            <div key={image.id} className="overflow-hidden rounded-lg border bg-white">
              <div className="relative flex aspect-[4/3] items-center justify-center bg-slate-100">
                {image.previewUrl ? (
                  <img src={image.previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] text-slate-400">
                    {image.visibility === "REMOVED" ? "Entfernt" : "Wird verarbeitet…"}
                  </span>
                )}
                <label className="absolute left-1.5 top-1.5 rounded bg-white/90 p-1">
                  <input type="checkbox" checked={selected.has(image.id)} onChange={() => toggleSelected(image.id)} />
                </label>
              </div>
              <div className="space-y-1 p-2">
                <p className="truncate text-[11px] text-slate-500">{image.photographerDisplayName}</p>
                <div className="flex items-center justify-between">
                  <Badge variant={image.visibility === "PUBLISHED" ? "default" : "secondary"} className="text-[10px]">
                    {image.visibility}
                  </Badge>
                  <ProcessingStatusBadge status={image.processingStatus} />
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {(VISIBILITY_ACTIONS[image.visibility] ?? []).map((action) => (
                    <Button
                      key={action.next}
                      size="sm"
                      variant="outline"
                      className="h-6 px-1.5 text-[10px]"
                      disabled={busyImageId === image.id}
                      onClick={() => runAction(image.id, action.next)}
                    >
                      {action.label}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-1.5 text-[10px]"
                    onClick={() => setDetailImageId(detailImageId === image.id ? null : image.id)}
                  >
                    Zuordnung
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="col-span-full p-3 text-center text-sm text-slate-400">Keine Bilder.</p>}
        </div>
      )}
      {detailImageId && <ImageAssignmentDetail imageId={detailImageId} onClose={() => setDetailImageId(null)} />}
      {total > pageSize && (
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - pageSize))}>
            Zurück
          </Button>
          <Button size="sm" variant="outline" disabled={offset + pageSize >= total} onClick={() => setOffset(offset + pageSize)}>
            Weiter
          </Button>
        </div>
      )}
    </div>
  );
}

/** Paket 16: Zuordnungs-Detail zu einem Bild direkt aus dem Bilder-Grid, siehe racepic-ux-redesign-plan.md. */
function ImageAssignmentDetail({ imageId, onClose }: { imageId: string; onClose: () => void }) {
  const [assignments, setAssignments] = useState<RacepicImageAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const reload = () => {
    setLoading(true);
    adminRacepicService
      .getImageAssignments(imageId)
      .then((result) => {
        setAssignments(result);
        setError("");
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [imageId]);

  const handleConfirm = async (assignmentId: string) => {
    setBusyId(assignmentId);
    try {
      await adminRacepicService.confirmAssignment(assignmentId);
      reload();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (assignmentId: string) => {
    setBusyId(assignmentId);
    try {
      await adminRacepicService.rejectAssignment(assignmentId);
      reload();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mt-3 rounded-lg border bg-slate-50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold">Zuordnungen dieses Bildes</h4>
        <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={onClose}>
          Schließen
        </Button>
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="text-xs text-slate-400">Lädt…</p>}
      {!loading && assignments.length === 0 && <p className="text-xs text-slate-400">Noch keine Zuordnung für dieses Bild.</p>}
      {!loading && assignments.length > 0 && (
        <ul className="space-y-2">
          {assignments.map((a) => (
            <li key={a.assignmentId} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-white p-2 text-xs">
              <span>
                #{a.startNumber} {a.driverName} – {a.vehicleMake} {a.vehicleModel} ·{" "}
                <Badge variant={a.status === "REJECTED" ? "secondary" : "default"} className="text-[10px]">
                  {a.status}
                </Badge>{" "}
                ({a.source}
                {a.confidence !== null ? `, ${Math.round(a.confidence * 100)}%` : ""})
              </span>
              {a.status !== "REJECTED" && a.status !== "MANUALLY_CONFIRMED" && (
                <div className="flex gap-1">
                  <Button size="sm" className="h-6 px-2 text-[11px]" disabled={busyId === a.assignmentId} onClick={() => handleConfirm(a.assignmentId)}>
                    Bestätigen
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
                    disabled={busyId === a.assignmentId}
                    onClick={() => handleReject(a.assignmentId)}
                  >
                    Ablehnen
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-slate-400">
        Einem anderen Fahrer zuordnen geht über die Review-Queue (Tab "Zuordnung").
      </p>
    </div>
  );
}

const PREVIEW_LIMIT = 4;

/**
 * "Zuordnung"-Tab (Bestandsaufnahme 2026-09-22: bisher "immer nur ein Button, der zu Review
 * führt" ohne jede Übersicht). Zeigt jetzt, wie viele Bilder in welchem Zuordnungsstatus stecken
 * und eine kleine Vorschau der ersten offenen Fälle direkt hier - Bestätigen/Ablehnen geht schon
 * von hier aus, für alles Weitere (BBox-Overlay, "anderer Fahrer") bleibt der Sprung in die volle
 * Review-Queue nötig.
 */
function AssignmentOverviewTab({ eventId }: { eventId: string }) {
  const [stats, setStats] = useState<RacepicEventStats | null>(null);
  const [preview, setPreview] = useState<RacepicReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const reload = () => {
    Promise.all([adminRacepicService.getEventStats(eventId), adminRacepicService.listReviewQueue(eventId, 0, PREVIEW_LIMIT)])
      .then(([statsResult, reviewResult]) => {
        setStats(statsResult);
        setPreview(reviewResult.items);
        setTotal(reviewResult.total);
        setError("");
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    const interval = window.setInterval(reload, 8000);
    return () => window.clearInterval(interval);
  }, [eventId]);

  const decide = async (assignmentId: string, action: "confirm" | "reject") => {
    setBusyId(assignmentId);
    try {
      if (action === "confirm") await adminRacepicService.confirmAssignment(assignmentId);
      else await adminRacepicService.rejectAssignment(assignmentId);
      reload();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const pendingImages = stats?.imagesByStatus.UPLOADED ?? 0;
  const processingImages =
    (stats?.imagesByStatus.VALIDATED ?? 0) + (stats?.imagesByStatus.DERIVED ?? 0) + (stats?.imagesByStatus.ANALYZED ?? 0);
  const reviewRequired = stats?.assignmentsByStatus.REVIEW_REQUIRED ?? 0;
  const autoMatched = stats?.assignmentsByStatus.AUTO_MATCHED ?? 0;
  const confirmed = (stats?.assignmentsByStatus.MANUALLY_CONFIRMED ?? 0) + (stats?.assignmentsByStatus.MANUALLY_CORRECTED ?? 0);

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-400">Lädt…</p>}

      {!loading && (
        <div className="grid gap-2 sm:grid-cols-4">
          <StatusTile label="Werden noch verarbeitet" value={pendingImages + processingImages} tone="slate" />
          <StatusTile label="Wartet auf Entscheidung" value={reviewRequired} tone="amber" />
          <StatusTile label="Automatisch zugeordnet" value={autoMatched} tone="green" />
          <StatusTile label="Bestätigt / korrigiert" value={confirmed} tone="slate" />
        </div>
      )}

      {!loading && pendingImages + processingImages > 0 && (
        <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
          {pendingImages + processingImages} Bild(er) laufen gerade durch die KI-Pipeline (Ingest → Analyse → Zuordnung) - sie tauchen erst hier
          auf, sobald die Zuordnung berechnet wurde. Fortschritt siehe Tab "Bilder" bzw. Statistik im Tab "Einstellungen".
        </p>
      )}

      {!loading && reviewRequired === 0 && pendingImages + processingImages === 0 && (
        <p className="text-sm text-slate-400">Keine offenen Zuordnungen - alle Bilder sind entweder automatisch zugeordnet oder entschieden.</p>
      )}

      {preview.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Erste offene Fälle</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {preview.map((item) => {
              const suggested = item.candidates.find((c) => c.entryId === item.suggestedEntryId) ?? item.candidates[0];
              return (
                <div key={item.assignmentId} className="overflow-hidden rounded-lg border bg-white">
                  <img src={item.imagePreviewUrl} alt="" className="aspect-[4/3] w-full object-cover" />
                  <div className="space-y-1 p-2">
                    {suggested && (
                      <p className="text-[11px]">
                        #{suggested.startNumber} {suggested.driverName}
                        <span className="ml-1 text-slate-400">{Math.round(item.confidence * 100)}%</span>
                      </p>
                    )}
                    <div className="flex gap-1">
                      <Button size="sm" className="h-6 flex-1 px-1.5 text-[10px]" disabled={busyId === item.assignmentId} onClick={() => decide(item.assignmentId, "confirm")}>
                        Bestätigen
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 flex-1 px-1.5 text-[10px]"
                        disabled={busyId === item.assignmentId}
                        onClick={() => decide(item.assignmentId, "reject")}
                      >
                        Ablehnen
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {total > 0 && (
        <Button size="sm" variant="outline" asChild>
          <Link to={`/admin/racepic/review/${eventId}`}>
            {total > PREVIEW_LIMIT ? `Alle ${total} offenen Zuordnungen öffnen` : "Review-Queue öffnen"}
          </Link>
        </Button>
      )}
    </div>
  );
}

function StatusTile({ label, value, tone }: { label: string; value: number; tone: "slate" | "amber" | "green" }) {
  const toneClass = tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : tone === "green" ? "border-green-200 bg-green-50 text-green-800" : "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}

/** Paket 11: Matching-Config, Rematch und Qualitätsreport, siehe Bestandsaufnahme 2026-09-22. */
function MatchingSection({ eventId }: { eventId: string }) {
  const [configs, setConfigs] = useState<RacepicMatchingConfig[]>([]);
  const [report, setReport] = useState<RacepicMatchQualityReport | null>(null);
  const [rematching, setRematching] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState("");

  const reloadConfigs = () => {
    adminRacepicService
      .listMatchingConfigs(eventId)
      .then(setConfigs)
      .catch((err) => setError(getApiErrorMessage(err)));
  };

  useEffect(reloadConfigs, [eventId]);

  const activeEventConfig = configs.find((c) => c.eventId === eventId && c.active);

  const handleRematch = async () => {
    setRematching(true);
    setError("");
    try {
      await adminRacepicService.triggerRematch(eventId);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setRematching(false);
    }
  };

  const handleLoadReport = async () => {
    setLoadingReport(true);
    setError("");
    try {
      setReport(await adminRacepicService.getMatchQualityReport(eventId));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoadingReport(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">KI-Zuordnung: Kalibrierung (Paket 10)</h3>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-lg border p-3 text-xs">
        <p className="mb-1 font-medium">Aktive Config (dieses Event)</p>
        {activeEventConfig ? (
          <p>
            v{activeEventConfig.version} – autoThreshold {activeEventConfig.autoThreshold}, reviewThreshold{" "}
            {activeEventConfig.reviewThreshold}, minMargin {activeEventConfig.minMargin}
          </p>
        ) : (
          <p className="text-slate-400">Keine event-spezifische Config – es gilt die globale bzw. die Fallback-Konstanten.</p>
        )}
      </div>

      <MatchingConfigForm eventId={eventId} onCreated={reloadConfigs} />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={rematching} onClick={handleRematch}>
          {rematching ? "Reiht ein…" : "Re-Match auslösen"}
        </Button>
        <Button size="sm" variant="outline" disabled={loadingReport} onClick={handleLoadReport}>
          {loadingReport ? "Lädt…" : "Qualitätsreport laden"}
        </Button>
      </div>

      {report && (
        <div className="overflow-x-auto rounded-lg border">
          <p className="p-2 text-xs text-slate-500">
            {report.reviewedDetectionCount} geprüfte Erkennungen, {report.detectionsWithConfirmedMatchCount} mit bestätigtem Treffer.
          </p>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-2">Schwelle</th>
                <th className="p-2">Kandidaten</th>
                <th className="p-2">Precision</th>
                <th className="p-2">Recall</th>
              </tr>
            </thead>
            <tbody>
              {report.thresholds.map((row) => (
                <tr key={row.threshold} className="border-t">
                  <td className="p-2">{row.threshold}</td>
                  <td className="p-2">
                    {row.correctCount}/{row.candidateCount}
                  </td>
                  <td className="p-2">{row.precision === null ? "–" : `${Math.round(row.precision * 100)}%`}</td>
                  <td className="p-2">{row.recall === null ? "–" : `${Math.round(row.recall * 100)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MatchingConfigForm({ eventId, onCreated }: { eventId: string; onCreated: () => void }) {
  const [autoThreshold, setAutoThreshold] = useState("0.85");
  const [reviewThreshold, setReviewThreshold] = useState("0.55");
  const [minMargin, setMinMargin] = useState("0.08");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await adminRacepicService.createMatchingConfig({
        eventId,
        // Gewichte im MVP nicht per UI anpassbar - nur die Schwellen, die laut Runbook
        // ("Schwellen kalibrieren", Paket 10) primaer kalibriert werden. Vollstaendige
        // Gewichts-Bearbeitung kann bei Bedarf nachgezogen werden.
        weights: { ocrExact: 0.5, ocrConfidence: 0.1, vehicleTypeMatch: 0.1, embeddingSimilarity: 0.2, colorSimilarity: 0.1, ambiguityPenalty: 0.15 },
        autoThreshold: Number(autoThreshold),
        reviewThreshold: Number(reviewThreshold),
        minMargin: Number(minMargin),
      });
      onCreated();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
      <div>
        <Label htmlFor={`auto-${eventId}`} className="text-xs">
          autoThreshold
        </Label>
        <Input
          id={`auto-${eventId}`}
          type="number"
          step="0.01"
          min="0"
          max="1"
          className="h-8 w-24"
          value={autoThreshold}
          onChange={(e) => setAutoThreshold(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor={`review-${eventId}`} className="text-xs">
          reviewThreshold
        </Label>
        <Input
          id={`review-${eventId}`}
          type="number"
          step="0.01"
          min="0"
          max="1"
          className="h-8 w-24"
          value={reviewThreshold}
          onChange={(e) => setReviewThreshold(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor={`margin-${eventId}`} className="text-xs">
          minMargin
        </Label>
        <Input
          id={`margin-${eventId}`}
          type="number"
          step="0.01"
          min="0"
          max="1"
          className="h-8 w-24"
          value={minMargin}
          onChange={(e) => setMinMargin(e.target.value)}
        />
      </div>
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Speichert…" : "Neue Version anlegen"}
      </Button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}

/** Paket 16: event-gescopte Fotograf:innen-Ansicht innerhalb der Event-Tabs (statt der globalen Liste unten auf der Seite). */
function EventPhotographersTab({ eventId }: { eventId: string }) {
  const [photographers, setPhotographers] = useState<RacepicPhotographer[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    adminRacepicService
      .listPhotographers()
      .then((all) => setPhotographers(all.filter((p) => p.events.some((e) => e.eventId === eventId))))
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [eventId]);

  const handleInvite = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    setInviting(true);
    setError("");
    try {
      await adminRacepicService.invitePhotographer({ email, displayName, eventIds: [eventId] });
      setEmail("");
      setDisplayName("");
      reload();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div>
          <Label htmlFor={`event-invite-email-${eventId}`} className="text-xs">
            E-Mail
          </Label>
          <Input id={`event-invite-email-${eventId}`} type="email" className="h-8 w-56" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor={`event-invite-name-${eventId}`} className="text-xs">
            Anzeigename
          </Label>
          <Input id={`event-invite-name-${eventId}`} className="h-8 w-48" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </div>
        <Button type="submit" size="sm" disabled={inviting}>
          {inviting ? "Sendet…" : "Für dieses Event einladen"}
        </Button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>

      {loading && <p className="text-sm text-slate-400">Lädt…</p>}
      {!loading && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">E-Mail</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {photographers.map((photographer) => (
                <tr key={photographer.id} className="border-t">
                  <td className="p-3">{photographer.displayName}</td>
                  <td className="p-3">{photographer.email}</td>
                  <td className="p-3">
                    <Badge variant={photographer.status === "ACTIVE_FREE" ? "default" : "secondary"}>{photographer.status}</Badge>
                  </td>
                </tr>
              ))}
              {photographers.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-3 text-center text-slate-400">
                    Noch keine Fotograf:innen für dieses Event.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PhotographersSection({
  photographers,
  events,
  onChanged,
}: {
  photographers: RacepicPhotographer[];
  events: RacepicEventListItem[];
  onChanged: () => void;
}) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");

  const toggleEvent = (eventId: string) => {
    setSelectedEventIds((prev) => (prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]));
  };

  const handleInvite = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    if (selectedEventIds.length === 0) {
      setError("Bitte mindestens ein Event auswählen.");
      return;
    }
    setInviting(true);
    setError("");
    try {
      await adminRacepicService.invitePhotographer({ email, displayName, eventIds: selectedEventIds });
      setEmail("");
      setDisplayName("");
      setSelectedEventIds([]);
      onChanged();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setInviting(false);
    }
  };

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Fotograf:innen</h2>

      <form onSubmit={handleInvite} className="mb-6 space-y-3 rounded-lg border p-4">
        <p className="text-sm font-medium">Fotograf:in einladen</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="invite-email">E-Mail</Label>
            <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="invite-name">Anzeigename</Label>
            <Input id="invite-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Event-Zugang</p>
          <div className="flex flex-wrap gap-3">
            {events.map((item) => (
              <label key={item.eventId} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selectedEventIds.includes(item.eventId)} onChange={() => toggleEvent(item.eventId)} />
                {item.eventName}
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={inviting}>
          {inviting ? "Sendet Einladung…" : "Einladen"}
        </Button>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">E-Mail</th>
              <th className="p-3">Status</th>
              <th className="p-3">Events</th>
            </tr>
          </thead>
          <tbody>
            {photographers.map((photographer) => (
              <tr key={photographer.id} className="border-t">
                <td className="p-3">{photographer.displayName}</td>
                <td className="p-3">{photographer.email}</td>
                <td className="p-3">
                  <Badge variant={photographer.status === "ACTIVE_FREE" ? "default" : "secondary"}>{photographer.status}</Badge>
                </td>
                <td className="p-3">{photographer.events.map((e) => e.eventName).join(", ") || "–"}</td>
              </tr>
            ))}
            {photographers.length === 0 && (
              <tr>
                <td colSpan={4} className="p-3 text-center text-slate-400">
                  Noch keine Fotograf:innen eingeladen.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
