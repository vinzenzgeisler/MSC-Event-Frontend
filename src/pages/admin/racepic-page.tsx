import { FormEvent, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminRacepicService } from "@/services/admin-racepic.service";
import { getApiErrorMessage } from "@/services/api/http-client";
import type {
  RacepicEventConfig,
  RacepicEventListItem,
  RacepicEventStats,
  RacepicLicenseOption,
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setExpandedEventId(expandedEventId === item.eventId ? null : item.eventId)}
                    >
                      {expandedEventId === item.eventId ? "Schließen" : "Konfigurieren"}
                    </Button>
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
