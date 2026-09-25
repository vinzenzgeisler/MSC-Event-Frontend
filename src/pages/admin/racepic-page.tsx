import { FormEvent, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminRacepicService } from "@/services/admin-racepic.service";
import { getApiErrorMessage } from "@/services/api/http-client";
import { HideParticipantSection, ReviewCard } from "./racepic-review-page";
import type {
  RacepicAdminImage,
  RacepicImagePipelineStatus,
  RacepicEntrySearchResult,
  RacepicEventListItem,
  RacepicEventStats,
  RacepicImageAssignment,
  RacepicLicenseOption,
  RacepicMatchingConfig,
  RacepicMatchQualityReport,
  RacepicPhotographer,
  RacepicReviewItem,
} from "@/types/admin-racepic";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";

/**
 * RacePic Admin-Basis (Paket 5), siehe docs/memory-bank/racepic-architecture.md Abschnitt H.
 * Review-Queue (Paket 7) und KI-Konfiguration (Paket 6) folgen als eigene Bereiche.
 */
export function AdminRacepicPage() {
  const { roles } = useAuth();
  const canManage = hasPermission(roles, 'racepic.manage');
  const [searchParams, setSearchParams] = useSearchParams();
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
        <p className="text-sm text-slate-500">Bilder, Zuordnungen und Fotograf:innen direkt verwalten.</p>
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Lädt…</p>}

      {!loading && <EventsSection
        events={events}
        licenses={licenses}
        onChanged={reload}
        canManage={canManage}
        requestedEventId={searchParams.get('event')}
        requestedTab={searchParams.get('tab')}
        onSelectionChange={(eventId, tab) => setSearchParams({ event: eventId, tab }, { replace: true })}
      />}
    </div>
  );
}

function EventsSection({
  events,
  licenses,
  onChanged,
  canManage,
  requestedEventId,
  requestedTab,
  onSelectionChange,
}: {
  events: RacepicEventListItem[];
  licenses: RacepicLicenseOption[];
  onChanged: () => void;
  canManage: boolean;
  requestedEventId: string | null;
  requestedTab: string | null;
  onSelectionChange: (eventId: string, tab: string) => void;
}) {
  const [selectedEventId, setSelectedEventId] = useState(() => {
    const remembered = window.sessionStorage.getItem('racepic_admin_event');
    return events.find((item) => item.eventId === requestedEventId)?.eventId ?? events.find((item) => item.eventId === remembered)?.eventId ?? events.find((item) => item.racepic?.enabled)?.eventId ?? events[0]?.eventId ?? '';
  });
  const selectedEvent = events.find((item) => item.eventId === selectedEventId) ?? events[0];

  return (
    <section className="space-y-5">
      {selectedEvent ? <>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aktives Event</p><h2 className="text-lg font-semibold">{selectedEvent.eventName}</h2></div>
          <div className="flex items-center gap-3">
            <Badge variant={selectedEvent.racepic?.published ? 'default' : 'secondary'}>{selectedEvent.racepic?.published ? 'Öffentlich' : 'Nicht öffentlich'}</Badge>
            {events.length > 1 && <select aria-label="RacePic-Event wählen" className="h-9 rounded-md border px-3 text-sm" value={selectedEvent.eventId} onChange={(event) => { setSelectedEventId(event.target.value); window.sessionStorage.setItem('racepic_admin_event', event.target.value); onSelectionChange(event.target.value, 'overview'); }}>{events.map((item) => <option key={item.eventId} value={item.eventId}>{item.eventName}</option>)}</select>}
          </div>
        </div>
        <EventConfigForm key={selectedEvent.eventId} event={selectedEvent} licenses={licenses} onSaved={onChanged} canManage={canManage} initialTab={requestedTab} onTabChange={(tab) => onSelectionChange(selectedEvent.eventId, tab)} />
      </> : <p className="text-sm text-slate-500">Keine Events verfügbar.</p>}
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

function EventConfigForm({ event, licenses, onSaved, canManage, initialTab, onTabChange }: { event: RacepicEventListItem; licenses: RacepicLicenseOption[]; onSaved: () => void; canManage: boolean; initialTab: string | null; onTabChange: (tab: string) => void }) {
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
  const allowedInitialTab = initialTab === 'assignments' ? 'assignment' : initialTab;
  const [activeTab, setActiveTab] = useState(allowedInitialTab && ['overview', 'assignment', ...(canManage ? ['settings', 'photographers', 'images', 'matching'] : [])].includes(allowedInitialTab) ? allowedInitialTab : 'overview');

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
    <Tabs value={activeTab} onValueChange={(tab) => { setActiveTab(tab); onTabChange(tab === 'assignment' ? 'assignments' : tab); }} className="w-full">
      <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b bg-transparent p-0">
        <TabsTrigger value="overview" className={tabTriggerClass}>Übersicht</TabsTrigger>
        {canManage && <TabsTrigger value="settings" className={tabTriggerClass}>
          Einstellungen
        </TabsTrigger>}
        {canManage && <TabsTrigger value="photographers" className={tabTriggerClass}>
          Fotograf:innen
        </TabsTrigger>}
        {canManage && <TabsTrigger value="images" className={tabTriggerClass}>
          Bilder
        </TabsTrigger>}
        <TabsTrigger value="assignment" className={tabTriggerClass}>
          Zuordnung
        </TabsTrigger>
        {canManage && <TabsTrigger value="matching" className={tabTriggerClass}>
          KI-Konfiguration
        </TabsTrigger>}
      </TabsList>

      <TabsContent value="overview" className="space-y-5 pt-5">
        <p className="text-sm text-slate-600">Verarbeitung und Zuordnung sind getrennte Schritte: „Zuordnung berechnet“ bedeutet nicht automatisch, dass ein Fahrer gefunden wurde.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Bilder gesamt', value: Object.values(stats?.imagesByStatus ?? {}).reduce((sum, count) => sum + count, 0), tab: 'images' },
            { label: 'In Verarbeitung', value: Object.entries(stats?.imagesByStatus ?? {}).filter(([status]) => PROCESSING_NON_TERMINAL_STATUSES.has(status)).reduce((sum, [, count]) => sum + count, 0), tab: 'images' },
            { label: 'Fehlgeschlagen', value: stats?.imagesByStatus.FAILED ?? 0, tab: 'images' },
            { label: 'Zu prüfen', value: stats?.assignmentsByStatus.REVIEW_REQUIRED ?? 0, tab: 'assignment' },
          ].map((card) => <button type="button" key={card.label} onClick={() => setActiveTab(card.tab)} className="rounded-xl border bg-white p-5 text-left shadow-sm transition hover:border-primary hover:shadow"><span className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</span><span className="mt-2 block text-3xl font-bold">{card.value}</span></button>)}
        </div>
        <div className="flex flex-wrap gap-2">{canManage && <Button size="sm" onClick={() => setActiveTab('images')}>Bilder öffnen</Button>}{canManage && <Button size="sm" variant="outline" onClick={() => setActiveTab('photographers')}>Fotograf:innen verwalten</Button>}<Button size="sm" variant="outline" onClick={() => setActiveTab('assignment')}>Zuordnung öffnen</Button></div>
      </TabsContent>

      {canManage && <TabsContent value="settings" className="pt-4">
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
      </TabsContent>}

      {canManage && <TabsContent value="photographers" className="pt-4">
        <EventPhotographersTab eventId={event.eventId} />
      </TabsContent>}

      {canManage && <TabsContent value="images" className="pt-4">
        <ImagesSection eventId={event.eventId} />
      </TabsContent>}

      <TabsContent value="assignment" className="pt-4">
        <AssignmentOverviewTab eventId={event.eventId} />
      </TabsContent>

      {canManage && <TabsContent value="matching" className="pt-4">
        <MatchingSection eventId={event.eventId} />
      </TabsContent>}
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

const ASSIGNMENT_STATE_LABEL: Record<string, string> = {
  CONFIRMED: 'Bestätigt', AUTO_MATCHED: 'Automatisch zugeordnet', REVIEW_REQUIRED: 'Prüfung nötig', UNASSIGNED: 'Kein Fahrer zugeordnet'
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

  // `silent` fuer den Hintergrund-Poll unten: kein setLoading(true) (das ersetzte bisher alle 5s
  // kurz das komplette Grid durch "Lädt…" - Bug gefunden 2026-09-22, Nutzer-Feedback "reloaded
  // immer ganz komisch und hängt ein wenig") und keine Auswahl-Zuruecksetzung (sonst verschwand
  // eine laufende Mehrfachauswahl alle 5s von selbst).
  const reload = useCallback((opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    adminRacepicService
      .listImages(eventId, { visibility: visibilityFilter || undefined }, offset, pageSize)
      .then((result) => {
        setItems(result.items);
        setTotal(result.total);
        if (!opts?.silent) setSelected(new Set());
        setError("");
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [eventId, offset, pageSize, visibilityFilter]);

  useEffect(() => reload(), [reload]);

  // Solange noch Bilder auf dieser Seite in der Pipeline stecken (UPLOADED/VALIDATED/DERIVED/
  // ANALYZED), alle 5s neu laden - Feedback 2026-09-22: ein frisch hochgeladenes Bild soll seinen
  // Fortschritt zeigen, ohne dass man die Seite manuell neu lädt. Stoppt automatisch, sobald alle
  // sichtbaren Bilder einen Endstatus (MATCHED/FAILED/DUPLICATE) erreicht haben.
  useEffect(() => {
    if (!items.some((item) => PROCESSING_NON_TERMINAL_STATUSES.has(item.processingStatus))) return;
    const timeout = window.setTimeout(() => reload({ silent: true }), 5000);
    return () => window.clearTimeout(timeout);
  }, [items, reload]);

  // Aendert Sichtbarkeit/Auswahl direkt im lokalen State statt per volley reload() (Bug gefunden
  // 2026-09-22, Nutzer-Feedback "entfernen von Bildern läuft sehr unflüssig"): ein voller
  // Server-Rundtrip + setLoading(true) liess das komplette Grid nach jeder einzelnen Aktion kurz
  // verschwinden ("Lädt…"). Ist ein Sichtbarkeits-Filter aktiv und das Bild passt danach nicht
  // mehr dazu, wird es aus der sichtbaren Liste genommen statt eine falsche Sichtbarkeit zu zeigen.
  const applyVisibilityChange = (imageId: string, next: "PUBLISHED" | "HIDDEN" | "REMOVED") => {
    const stillMatchesFilter = !visibilityFilter || next === visibilityFilter;
    if (!stillMatchesFilter) {
      setItems((prev) => prev.filter((item) => item.id !== imageId));
      setTotal((prev) => Math.max(0, prev - 1));
    } else {
      setItems((prev) =>
        prev.map((item) => (item.id === imageId ? { ...item, visibility: next, previewUrl: next === "REMOVED" ? null : item.previewUrl } : item)),
      );
    }
    setSelected((prev) => {
      const nextSelected = new Set(prev);
      nextSelected.delete(imageId);
      return nextSelected;
    });
  };

  const runAction = async (imageId: string, next: "PUBLISHED" | "HIDDEN" | "REMOVED") => {
    if (next === "REMOVED" && !window.confirm("Bild wirklich entfernen? Das löscht die Bilddateien (Datenbank-Eintrag bleibt vorerst erhalten).")) return;
    setBusyImageId(imageId);
    try {
      await adminRacepicService.setImageVisibility(imageId, next);
      applyVisibilityChange(imageId, next);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusyImageId(null);
    }
  };

  const runHardDelete = async (imageId: string) => {
    if (!window.confirm("Bild wirklich endgültig aus der Datenbank löschen? Das kann nicht rückgängig gemacht werden.")) return;
    setBusyImageId(imageId);
    try {
      await adminRacepicService.hardDeleteImage(imageId);
      setItems((prev) => prev.filter((item) => item.id !== imageId));
      setTotal((prev) => Math.max(0, prev - 1));
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

  // Nutzerwunsch 2026-09-23: "im Admin will ich schneller auswählen können oder ein Button für alle
  // auswählen auf der Seite" - bisher musste jedes Bild einzeln angeklickt werden, was bei
  // Bulk-Aktionen (Veröffentlichen/Verbergen/Entfernen) über 20 Bilder pro Seite mühsam war.
  const allOnPageSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  const toggleSelectAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) items.forEach((item) => next.delete(item.id));
      else items.forEach((item) => next.add(item.id));
      return next;
    });
  };

  const runBulkAction = async (next: "PUBLISHED" | "HIDDEN" | "REMOVED") => {
    if (next === "REMOVED" && !window.confirm(`${selected.size} Bild(er) wirklich entfernen? Das löscht die Bilddateien (Datenbank-Eintrag bleibt vorerst erhalten).`)) return;
    setBulkRunning(true);
    setError("");
    try {
      const succeeded: string[] = [];
      for (const imageId of selected) {
        try {
          await adminRacepicService.setImageVisibility(imageId, next);
          succeeded.push(imageId);
        } catch {
          // einzelne Fehlschläge sollen den Rest der Batch-Aktion nicht abbrechen
        }
      }
      succeeded.forEach((imageId) => applyVisibilityChange(imageId, next));
    } finally {
      setBulkRunning(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Bilder ({total})</h3>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <label className="flex items-center gap-1 text-xs text-slate-500">
              <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAllOnPage} />
              Alle auf dieser Seite
            </label>
          )}
          {selected.size > 0 && (
            <>
              <span className="text-xs text-slate-500">{selected.size} ausgewählt</span>
              <Button size="sm" variant="outline" disabled={bulkRunning} onClick={() => runBulkAction("PUBLISHED")}>
                Veröffentlichen
              </Button>
              <Button size="sm" variant="outline" disabled={bulkRunning} onClick={() => runBulkAction("HIDDEN")}>
                Verbergen
              </Button>
              <Button size="sm" variant="outline" className="text-destructive" disabled={bulkRunning} onClick={() => runBulkAction("REMOVED")}>
                Entfernen
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
                <p className={`text-[11px] font-medium ${image.assignmentState === 'UNASSIGNED' ? 'text-amber-700' : 'text-slate-600'}`}>{ASSIGNMENT_STATE_LABEL[image.assignmentState] ?? image.assignmentState}</p>
                {image.processingError && <p className="line-clamp-2 text-[10px] text-red-700" title={image.processingError}>{image.processingError}</p>}
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
                  {image.visibility === "REMOVED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-1.5 text-[10px] text-destructive"
                      disabled={busyImageId === image.id}
                      onClick={() => runHardDelete(image.id)}
                    >
                      Endgültig löschen
                    </Button>
                  )}
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
      {detailImageId && <ImageAssignmentDetail imageId={detailImageId} eventId={eventId} onClose={() => setDetailImageId(null)} />}
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

/**
 * Paket 16: Zuordnungs-Detail zu einem Bild direkt aus dem Bilder-Grid, siehe
 * racepic-ux-redesign-plan.md. Bestandsaufnahme 2026-09-22: ein Bild mit processingStatus=MATCHED
 * zeigte hier oft "keine Zuordnung" ohne jede Erklärung oder Handlungsoption - MATCHED bedeutet
 * nur, dass der Match-Schritt durchgelaufen ist (siehe matchWorker.ts), nicht, dass die KI
 * tatsächlich einen Kandidaten über der Review-Schwelle gefunden hat (kein erkanntes Fahrzeug im
 * Bild, oder alle Scores zu niedrig). Für genau diesen Fall gibt es jetzt eine manuelle
 * Zuordnungs-Suche direkt hier, statt nur auf die Review-Queue zu verweisen (die nur Bilder mit
 * bereits vorhandenem KI-Vorschlag zeigt).
 */
function ImageAssignmentDetail({ imageId, eventId, onClose }: { imageId: string; eventId: string; onClose: () => void }) {
  const [assignments, setAssignments] = useState<RacepicImageAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeMessage, setReanalyzeMessage] = useState("");
  const [pipeline, setPipeline] = useState<RacepicImagePipelineStatus | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([adminRacepicService.getImageAssignments(imageId), adminRacepicService.getImagePipelineStatus(imageId)])
      .then(([result, status]) => {
        setAssignments(result);
        setPipeline(status);
        setError("");
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [imageId]);

  useEffect(reload, [reload]);

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

  const handleAdd = async (entryId: string) => {
    setBusyId("add");
    try {
      await adminRacepicService.addAssignment(imageId, entryId, null);
      reload();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleReanalyze = async () => {
    setReanalyzing(true);
    setReanalyzeMessage("");
    try {
      await adminRacepicService.reanalyzeImage(imageId);
      setReanalyzeMessage("Neu eingereiht - Status läuft im Tab „Bilder“ automatisch weiter (kann ein bis zwei Minuten dauern).");
      reload();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setReanalyzing(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border bg-slate-50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold">Zuordnungen dieses Bildes</h4>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" disabled={reanalyzing} onClick={handleReanalyze}>
            {reanalyzing ? "Reiht ein…" : "Neu analysieren"}
          </Button>
          <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={onClose}>
            Schließen
          </Button>
        </div>
      </div>
      {reanalyzeMessage && <p className="mb-2 text-xs text-green-700">{reanalyzeMessage}</p>}
      {pipeline && <div className="mb-4 grid gap-3 rounded-lg border bg-white p-3 text-xs sm:grid-cols-2">
        <div><p className="font-semibold">Verarbeitung</p><ProcessingStatusBadge status={pipeline.processingStatus} />{pipeline.processingError && <p className="mt-2 text-red-700">{pipeline.processingError}</p>}<p className="mt-2">{pipeline.detectionCount} Fahrzeugerkennung(en) · {pipeline.candidateCount} Kandidat(en)</p></div>
        <div><p className="font-semibold">Zuordnung</p><p className="mt-1">{ASSIGNMENT_STATE_LABEL[pipeline.assignmentState] ?? pipeline.assignmentState}</p><p className="mt-2 text-slate-500">{pipeline.offerMode === 'PAID' ? 'Interner Bezahlentwurf' : 'Kostenlos'} · {pipeline.visibility}</p></div>
        <div className="sm:col-span-2"><p className="font-semibold">Letzte Pipeline-Schritte</p><div className="mt-1 flex flex-wrap gap-2">{pipeline.steps.slice(0, 8).map((step, index) => <span key={`${step.step}-${step.pipelineVersion}-${index}`} title={step.error ?? step.pipelineVersion} className="rounded border px-2 py-1">{step.step}: {step.status}</span>)}</div></div>
      </div>}
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="text-xs text-slate-400">Lädt…</p>}
      {!loading && assignments.length === 0 && (
        <p className="text-xs text-slate-400">
          Keine Zuordnung gefunden. Die KI hat entweder kein Fahrzeug im Bild erkannt oder keinen Kandidaten mit
          ausreichender Sicherheit gefunden - das Bild gilt trotzdem als "MATCHED" (der Zuordnungsschritt ist
          durchgelaufen, hat nur nichts gefunden). War tatsächlich ein Fahrzeug im Bild zu sehen? Mit "Neu
          analysieren" oben läuft die Bilderkennung erneut (hilfreich nach einer Pipeline-Verbesserung). Sonst
          Fahrer unten manuell zuordnen.
        </p>
      )}
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
              {a.status !== "REJECTED" && (
                <div className="flex gap-1">
                  {a.status !== "MANUALLY_CONFIRMED" && (
                    <Button size="sm" className="h-6 px-2 text-[11px]" disabled={busyId === a.assignmentId} onClick={() => handleConfirm(a.assignmentId)}>
                      Bestätigen
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
                    disabled={busyId === a.assignmentId}
                    onClick={() => handleReject(a.assignmentId)}
                  >
                    {/* Nimmt eine bereits bestaetigte Zuordnung wieder raus (Bug gefunden 2026-09-22,
                        Nutzer-Feedback "ich kann Fahrer Zuordnungen nicht wieder rausnehmen"): der
                        Button verschwand bisher fuer status=MANUALLY_CONFIRMED komplett, obwohl das
                        Backend (rejectAssignment in reviewQueue.ts) einen Wechsel von jedem Status
                        nach REJECTED erlaubt.
                        Beschriftung 2026-09-23 (Nutzer-Feedback: "Ablehnen passt ja nicht, was wenn
                        ich aus Versehen einen reingenommen habe") - fachlich macht der Klick exakt
                        dasselbe (status -> REJECTED), aber "Ablehnen" liest sich wie "der
                        KI-Vorschlag ist falsch", nicht wie "ich nehme meine eigene Zuordnung
                        zurueck". Bei MANUAL/MANUALLY_CONFIRMED/MANUALLY_CORRECTED (der Mensch hat
                        selbst gehandelt) daher "Entfernen" statt "Ablehnen". */}
                    {a.source === "MANUAL" ? "Entfernen" : "Ablehnen"}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 border-t pt-3">
        <p className="mb-1 text-[11px] font-medium text-slate-500">
          Fahrer zuordnen {assignments.length > 0 && "(weiteres Fahrzeug auf diesem Bild)"}
        </p>
        <EntryAssignPicker eventId={eventId} disabled={busyId !== null} onPick={handleAdd} />
      </div>
    </div>
  );
}

/** Fahrersuche + Zuordnen fuer `ImageAssignmentDetail`, analog zu `EntrySearchPicker` in racepic-review-page.tsx. */
function EntryAssignPicker({ eventId, disabled, onPick }: { eventId: string; disabled: boolean; onPick: (entryId: string) => void }) {
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
      <Input
        className="h-7 text-xs"
        placeholder="Name, Startnummer oder Fahrzeug…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
      />
      {results.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {results.map((result) => (
            <Button
              key={result.entryId}
              size="sm"
              variant="outline"
              className="h-6 px-1.5 text-[10px]"
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

const REVIEW_PAGE_SIZE = 10;

/**
 * "Zuordnung"-Tab (Feedback 2026-09-22: "kann der Tab Zuordnung nicht zusammengeführt werden mit
 * der 'Review Queue öffnen'? Also eine zentrale Stelle zum Zuordnen der Bilder mit den Fahrern.").
 * War bisher nur eine kleine Statistik + 4er-Vorschau mit Link auf die separate Review-Queue-Seite
 * (`/admin/racepic/review/:eventId`, racepic-review-page.tsx) - jetzt ist der Tab selbst die volle,
 * paginierte Queue (gleiche `ReviewCard`/`HideParticipantSection`-Komponenten wie die separate
 * Seite, die bleibt als eigenstaendige Route zusaetzlich nutzbar, ist aber nicht mehr verlinkt).
 */
function AssignmentOverviewTab({ eventId }: { eventId: string }) {
  const [stats, setStats] = useState<RacepicEventStats | null>(null);
  const [items, setItems] = useState<RacepicReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    Promise.all([adminRacepicService.getEventStats(eventId), adminRacepicService.listReviewQueue(eventId, offset, REVIEW_PAGE_SIZE)])
      .then(([statsResult, reviewResult]) => {
        setStats(statsResult);
        setItems(reviewResult.items);
        setTotal(reviewResult.total);
        setError("");
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [eventId, offset]);

  useEffect(() => {
    reload();
    const interval = window.setInterval(reload, 8000);
    return () => window.clearInterval(interval);
  }, [reload]);

  const runAction = async (key: string, action: () => Promise<void>) => {
    setBusyKey(key);
    try {
      await action();
      reload();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusyKey(null);
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

      {!loading && (
        <div className="grid gap-2 sm:grid-cols-4">
          <StatusTile label="Werden noch verarbeitet" value={pendingImages + processingImages} tone="slate" />
          <StatusTile label="Wartet auf Entscheidung" value={total} tone="amber" />
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

      <HideParticipantSection eventId={eventId} onHidden={reload} />

      {loading && <p className="text-sm text-slate-400">Lädt…</p>}
      {!loading && total === 0 && reviewRequired === 0 && (
        <p className="text-sm text-slate-400">Keine offenen Zuordnungen - alle Bilder sind entweder automatisch zugeordnet oder entschieden.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => {
          const itemKey = item.assignmentId ?? `orphan:${item.detection?.id ?? item.imageId}`;
          return (
            <ReviewCard
              key={itemKey}
              item={item}
              eventId={eventId}
              busy={busyKey === itemKey}
              onConfirm={() => item.assignmentId && runAction(itemKey, () => adminRacepicService.confirmAssignment(item.assignmentId!))}
              onReject={() => item.assignmentId && runAction(itemKey, () => adminRacepicService.rejectAssignment(item.assignmentId!))}
              onCorrect={(entryId) => item.assignmentId && runAction(itemKey, () => adminRacepicService.correctAssignment(item.assignmentId!, entryId))}
              onAdd={(entryId) => runAction(itemKey, () => adminRacepicService.addAssignment(item.imageId, entryId, item.detection?.id ?? null))}
              onDismiss={item.detection ? () => runAction(itemKey, () => adminRacepicService.dismissDetection(item.detection!.id)) : undefined}
            />
          );
        })}
      </div>

      {total > REVIEW_PAGE_SIZE && (
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - REVIEW_PAGE_SIZE))}>
            Zurück
          </Button>
          <Button variant="outline" size="sm" disabled={offset + REVIEW_PAGE_SIZE >= total} onClick={() => setOffset(offset + REVIEW_PAGE_SIZE)}>
            Weiter
          </Button>
        </div>
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
  const [warming, setWarming] = useState(false);
  const [warmProgress, setWarmProgress] = useState<{ processed: number; skipped: number; total: number } | null>(null);

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

  // Nutzerwunsch 2026-09-23: alle Fahrzeugreferenzen kontrolliert vorab in den Cache bringen,
  // statt sie nur beilaeufig waehrend eines Match-Laufs zu berechnen ("das kann ruhig eine Weile
  // dauern und nacheinander jedes Referenzbild durchlaufen lassen"). Ein Serveraufruf verarbeitet
  // nur, was in dessen Zeitbudget passt (siehe warmEventVehicleReferences im Backend) - hier
  // einfach wiederholt aufrufen, bis `done` true ist, und den Fortschritt dabei anzeigen.
  const handleWarmReferences = async () => {
    setWarming(true);
    setError("");
    setWarmProgress(null);
    let totalProcessed = 0;
    let totalSkipped = 0;
    try {
      let done = false;
      while (!done) {
        const result = await adminRacepicService.warmVehicleReferences(eventId);
        totalProcessed += result.processed;
        totalSkipped += result.skipped;
        setWarmProgress({ processed: totalProcessed, skipped: totalSkipped, total: result.total });
        done = result.done;
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setWarming(false);
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
        <Button size="sm" variant="outline" disabled={warming} onClick={handleWarmReferences}>
          {warming ? "Läuft…" : "Referenzfotos vorbereiten"}
        </Button>
      </div>
      {warmProgress && (
        <p className="text-xs text-slate-500">
          {warmProgress.processed} neu berechnet, {warmProgress.skipped} bereits gecacht, von {warmProgress.total} Fahrzeugen insgesamt
          {warming && " · läuft weiter…"}
        </p>
      )}

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
  const [weights, setWeights] = useState({ ocrExact: 0.5, ocrConfidence: 0.1, vehicleTypeMatch: 0.1, embeddingSimilarity: 0.2, colorSimilarity: 0.1, ambiguityPenalty: 0.15 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await adminRacepicService.createMatchingConfig({
        eventId,
        weights,
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
      <div className="w-full text-xs font-medium">Gewichte für die nächste Matching-Version</div>
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {([
          ['ocrExact', 'Startnummer'], ['ocrConfidence', 'OCR-Sicherheit'], ['vehicleTypeMatch', 'Fahrzeugtyp'],
          ['embeddingSimilarity', 'Bildähnlichkeit'], ['colorSimilarity', 'Farbe'], ['ambiguityPenalty', 'Mehrdeutigkeit'],
        ] as const).map(([key, label]) => <div key={key}><Label htmlFor={`${key}-${eventId}`} className="text-xs">{label}</Label><Input id={`${key}-${eventId}`} type="number" min="0" max="1" step="0.01" required className="h-8" value={weights[key]} onChange={(e) => setWeights((previous) => ({ ...previous, [key]: Number(e.target.value) }))} /></div>)}
      </div>
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
  const [pendingRegistrations, setPendingRegistrations] = useState<RacepicPhotographer[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    adminRacepicService
      .listPhotographers()
      .then((all) => {
        setPhotographers(all.filter((p) => p.events.some((e) => e.eventId === eventId)));
        setPendingRegistrations(all.filter((p) => p.status === 'PENDING_APPROVAL'));
      })
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

  const review = async (photographerId: string, decision: 'approve' | 'reject') => {
    if (decision === 'reject' && !window.confirm('Registrierung wirklich ablehnen?')) return;
    setReviewingId(photographerId); setError('');
    try { await adminRacepicService.reviewPhotographerRegistration(photographerId, decision, decision === 'approve' ? [eventId] : []); reload(); }
    catch (err) { setError(getApiErrorMessage(err)); }
    finally { setReviewingId(null); }
  };

  const handleDeletePhotographer = async (photographerId: string, displayName: string) => {
    if (!window.confirm(`${displayName} wirklich löschen? Der Zugang wird gesperrt, bereits hochgeladene Bilder bleiben erhalten.`)) return;
    setReviewingId(photographerId); setError('');
    try { await adminRacepicService.deletePhotographer(photographerId); reload(); }
    catch (err) { setError(getApiErrorMessage(err)); }
    finally { setReviewingId(null); }
  };

  return (
    <div className="space-y-4">
      {pendingRegistrations.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-semibold text-amber-950">Neue Registrierungen ({pendingRegistrations.length})</h3><p className="mt-1 text-xs text-amber-900">Freigabe gibt Upload-Rechte für dieses Event. Prüfe Identität und Bildrechte vor der Entscheidung.</p><div className="mt-3 space-y-2">{pendingRegistrations.map((photographer) => <div key={photographer.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3 text-sm"><span><strong>{photographer.displayName}</strong> · {photographer.email}</span><div className="flex gap-2"><Button size="sm" disabled={reviewingId === photographer.id} onClick={() => review(photographer.id, 'approve')}>Für Event freigeben</Button><Button size="sm" variant="outline" disabled={reviewingId === photographer.id} onClick={() => review(photographer.id, 'reject')}>Ablehnen</Button></div></div>)}</div></div>}
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
                <th className="p-3" />
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
                  <td className="p-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px] text-destructive"
                      disabled={reviewingId === photographer.id}
                      onClick={() => handleDeletePhotographer(photographer.id, photographer.displayName)}
                    >
                      Löschen
                    </Button>
                  </td>
                </tr>
              ))}
              {photographers.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-3 text-center text-slate-400">
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

export function PhotographersSection({
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
