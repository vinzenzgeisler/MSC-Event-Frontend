import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminRacepicService } from "@/services/admin-racepic.service";
import { getApiErrorMessage } from "@/services/api/http-client";
import type {
  RacepicAdminImage,
  RacepicEventConfig,
  RacepicEventListItem,
  RacepicEventStats,
  RacepicLicenseOption,
  RacepicMatchingConfig,
  RacepicMatchQualityReport,
  RacepicPhotographer,
} from "@/types/admin-racepic";

/**
 * RacePic Admin-Basis (Paket 5), siehe docs/memory-bank/racepic-architecture.md Abschnitt H.
 * Review-Queue (Paket 7) und KI-Konfiguration (Paket 6) folgen als eigene Bereiche.
 */
export function AdminRacepicPage() {
  const [events, setEvents] = useState<RacepicEventListItem[]>([]);
  const [photographers, setPhotographers] = useState<RacepicPhotographer[]>([]);
  const [licenses, setLicenses] = useState<RacepicLicenseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = () => {
    setLoading(true);
    Promise.all([adminRacepicService.listEvents(), adminRacepicService.listPhotographers(), adminRacepicService.listLicenses()])
      .then(([eventsRes, photographersRes, licensesRes]) => {
        setEvents(eventsRes);
        setPhotographers(photographersRes);
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
        <p className="text-sm text-slate-500">Events aktivieren, Fotograf:innen einladen und den Status verfolgen.</p>
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Lädt…</p>}

      {!loading && (
        <>
          <EventsSection events={events} licenses={licenses} onChanged={reload} />
          <PhotographersSection photographers={photographers} events={events} onChanged={reload} />
        </>
      )}
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
    adminRacepicService
      .getEventStats(event.eventId)
      .then(setStats)
      .catch(() => setStats(null));
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

  return (
    <div className="space-y-6">
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
          <div className="space-y-2 text-sm">
            <p>{stats.photographerCount} Fotograf:innen mit Zugang</p>
            <div>
              <p className="font-medium">Bilder nach Status</p>
              <ul className="ml-4 list-disc">
                {Object.entries(stats.imagesByStatus).map(([status, count]) => (
                  <li key={status}>
                    {status}: {count}
                  </li>
                ))}
                {Object.keys(stats.imagesByStatus).length === 0 && <li className="text-slate-400">keine Bilder</li>}
              </ul>
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

      <ImagesSection eventId={event.eventId} />
      <MatchingSection eventId={event.eventId} />
    </div>
  );
}

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

/** Paket 11: allgemeine Bildliste je Event mit Sichtbarkeits-Aktionen, siehe Bestandsaufnahme 2026-09-22. */
function ImagesSection({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<RacepicAdminImage[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [visibilityFilter, setVisibilityFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyImageId, setBusyImageId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const pageSize = 10;

  const reload = () => {
    setLoading(true);
    adminRacepicService
      .listImages(eventId, { visibility: visibilityFilter || undefined }, offset, pageSize)
      .then((result) => {
        setItems(result.items);
        setTotal(result.total);
        setError("");
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [eventId, visibilityFilter, offset]);

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

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Bilder ({total})</h3>
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
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-400">Lädt…</p>}
      {!loading && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-2">Vorschau</th>
                <th className="p-2">Fotograf:in</th>
                <th className="p-2">Status</th>
                <th className="p-2">Sichtbarkeit</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((image) => (
                <tr key={image.id} className="border-t">
                  <td className="p-2">
                    {image.previewUrl ? <img src={image.previewUrl} alt="" className="h-12 w-16 rounded object-cover" /> : "–"}
                  </td>
                  <td className="p-2">{image.photographerDisplayName}</td>
                  <td className="p-2">{image.processingStatus}</td>
                  <td className="p-2">
                    <Badge variant={image.visibility === "PUBLISHED" ? "default" : "secondary"}>{image.visibility}</Badge>
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex justify-end gap-1">
                      {(VISIBILITY_ACTIONS[image.visibility] ?? []).map((action) => (
                        <Button
                          key={action.next}
                          size="sm"
                          variant="outline"
                          disabled={busyImageId === image.id}
                          onClick={() => runAction(image.id, action.next)}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-slate-400">
                    Keine Bilder.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
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
