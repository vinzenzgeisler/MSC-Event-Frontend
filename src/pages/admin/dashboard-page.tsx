import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  Loader2,
  Mail,
  MapPinned,
  RefreshCw,
  ShieldAlert,
  Users,
  Wrench
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DriverOriginMap } from "@/components/features/admin/driver-origin-map";
import { getAdminEventId } from "@/services/api/event-context";
import { getApiErrorMessage } from "@/services/api/http-client";
import {
  adminDashboardService,
  formatDateTime,
  formatMoney,
  numberValue,
  rowsValue,
  textValue,
  type DashboardOverview,
  type DashboardInspectionTimelineItem,
  type DashboardInspectorStatistic,
  type DashboardSeverity,
  type DashboardWarningCheck
} from "@/services/admin-dashboard.service";
import type { DashboardDriverLocationItem, DashboardDriverLocationsMeta } from "@/components/features/admin/driver-origin-map";

const EMPTY_MAP_META: DashboardDriverLocationsMeta = {
  totalLocations: 0,
  totalDrivers: 0,
  missingLocationsTotal: 0,
  missingEntriesTotal: 0,
  pendingGeocodeTotal: 0,
  geocodeAttemptedTotal: 0,
  geocodeResolvedTotal: 0,
  autoRefreshTriggered: false,
  hasPendingGeocoding: false,
  maxPoints: 0
};

const tabs = [
  { id: "overview", label: "Übersicht", icon: Gauge },
  { id: "warnings", label: "Warnungen", icon: ShieldAlert },
  { id: "registrations", label: "Nennungen", icon: Users },
  { id: "finance", label: "Finanzen", icon: CircleDollarSign },
  { id: "communication", label: "Kommunikation", icon: Mail },
  { id: "drivers", label: "Fahrer", icon: MapPinned },
  { id: "vehicles", label: "Fahrzeuge", icon: BarChart3 },
  { id: "operations", label: "Betrieb", icon: Wrench }
] as const;

type DashboardTab = (typeof tabs)[number]["id"];

function severityLabel(severity: DashboardSeverity) {
  if (severity === "critical") return "Kritisch";
  if (severity === "warning") return "Warnung";
  return "OK";
}

function severityClasses(severity: DashboardSeverity) {
  if (severity === "critical") return "border-red-300 bg-red-50 text-red-900";
  if (severity === "warning") return "border-amber-300 bg-amber-50 text-amber-900";
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

function percent(value: unknown) {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return `${Number.isFinite(number) ? Math.round(number) : 0}%`;
}

function sampleText(sample: Record<string, unknown>) {
  return [
    textValue(sample, "eventName"),
    textValue(sample, "startNumber") ? `#${textValue(sample, "startNumber")}` : "",
    textValue(sample, "driverName"),
    textValue(sample, "className"),
    textValue(sample, "emailMasked"),
    textValue(sample, "templateId"),
    textValue(sample, "errorLast")
  ]
    .filter(Boolean)
    .slice(0, 5)
    .join(" · ");
}

function Metric({ label, value, sub, tone = "default" }: { label: string; value: string | number; sub?: string; tone?: "default" | "good" | "warn" | "bad" }) {
  const toneClass = tone === "bad" ? "text-red-700" : tone === "warn" ? "text-amber-700" : tone === "good" ? "text-emerald-700" : "text-slate-900";
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}

function BarList({ rows, labelKey, valueKey = "count", empty = "Keine Daten verfügbar." }: { rows: Array<Record<string, unknown>>; labelKey: string; valueKey?: string; empty?: string }) {
  const max = Math.max(1, ...rows.map((row) => numberValue(row, valueKey)));
  if (!rows.length) return <div className="text-sm text-slate-500">{empty}</div>;
  return (
    <div className="space-y-2">
      {rows.map((row, index) => {
        const value = numberValue(row, valueKey);
        const label = textValue(row, labelKey, "Unbekannt");
        return (
          <div key={`${label}-${index}`} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-slate-700">{label}</span>
              <span className="shrink-0 font-medium text-slate-900">{value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, Math.round((value / max) * 100))}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActivityBars({ rows }: { rows: Array<Record<string, unknown>> }) {
  const max = Math.max(1, ...rows.map((row) => numberValue(row, "count")));
  return (
    <div className="grid h-40 grid-cols-[repeat(10,minmax(0,1fr))] items-end gap-1 rounded-md border bg-slate-50 p-3 sm:grid-cols-[repeat(15,minmax(0,1fr))] xl:grid-cols-[repeat(30,minmax(0,1fr))]">
      {rows.map((row) => {
        const value = numberValue(row, "count");
        const day = textValue(row, "day");
        return (
          <div key={day} className="flex h-full flex-col items-center justify-end gap-1">
            <div className="w-full rounded-t-sm bg-primary/85" title={`${day}: ${value}`} style={{ height: `${Math.max(6, Math.round((value / max) * 100))}%` }} />
          </div>
        );
      })}
    </div>
  );
}

function ProgressCard({
  title,
  complete,
  total,
  open,
  failed = 0,
  completeLabel
}: {
  title: string;
  complete: number;
  total: number;
  open: number;
  failed?: number;
  completeLabel: string;
}) {
  const completedPercent = total > 0 ? Math.min(100, Math.round((complete / total) * 100)) : 0;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <span className="text-2xl font-semibold tabular-nums text-slate-900">{complete} / {total}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-3 overflow-hidden rounded-full bg-slate-200" aria-label={`${completedPercent} Prozent erledigt`}>
          <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${completedPercent}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div><span className="block text-xs text-slate-500">{completeLabel}</span><strong className="text-emerald-700">{complete}</strong></div>
          <div><span className="block text-xs text-slate-500">Offen</span><strong className={open > 0 ? "text-amber-700" : "text-emerald-700"}>{open}</strong></div>
          <div><span className="block text-xs text-slate-500">Fortschritt</span><strong>{completedPercent} %</strong></div>
        </div>
        {failed > 0 ? <div className="text-xs font-medium text-red-700">Davon {failed} mit Mangel / abgelehnt</div> : null}
      </CardContent>
    </Card>
  );
}

const INSPECTOR_COLORS = ["bg-sky-500", "bg-violet-500", "bg-orange-500", "bg-teal-500"] as const;

function formatTimelineBucket(bucket: string) {
  const match = bucket.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):00$/);
  return match ? `${match[3]}.${match[2]}. · ${match[4]} Uhr` : bucket;
}

function InspectorActivityChart({ timeline, inspectors }: { timeline: DashboardInspectionTimelineItem[]; inspectors: DashboardInspectorStatistic[] }) {
  const labels = new Map(inspectors.map((item) => [item.inspectorUserId, item.inspectorDisplay]));
  const ids = Array.from(new Set([...inspectors.map((item) => item.inspectorUserId), ...timeline.map((item) => item.inspectorUserId)])).filter(Boolean);
  const buckets = Array.from(new Set(timeline.map((item) => item.bucket))).filter(Boolean).slice(-16);
  const grouped = buckets.map((bucket) => ({
    bucket,
    values: ids.map((id) => ({ id, count: timeline.filter((item) => item.bucket === bucket && item.inspectorUserId === id).reduce((sum, item) => sum + item.count, 0) }))
  }));
  const max = Math.max(1, ...grouped.map((group) => group.values.reduce((sum, item) => sum + item.count, 0)));

  if (!timeline.length) return <div className="text-sm text-slate-500">Noch keine Abnahmen erfasst.</div>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
        {ids.map((id, index) => <span key={id} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${INSPECTOR_COLORS[index % INSPECTOR_COLORS.length]}`} />{labels.get(id) ?? "Unbekannter Prüfer"}</span>)}
      </div>
      <div className="space-y-2">
        {grouped.map((group) => {
          const total = group.values.reduce((sum, item) => sum + item.count, 0);
          return (
            <div key={group.bucket} className="grid grid-cols-[7.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-xs">
              <span className="text-slate-500">{formatTimelineBucket(group.bucket)}</span>
              <div className="flex h-5 overflow-hidden rounded bg-slate-100" title={`${total} Entscheidungen`}>
                {group.values.map((item, index) => item.count > 0 ? <div key={item.id} className={`${INSPECTOR_COLORS[index % INSPECTOR_COLORS.length]} h-full`} style={{ width: `${(item.count / max) * 100}%` }} title={`${labels.get(item.id) ?? "Prüfer"}: ${item.count}`} /> : null)}
              </div>
              <strong className="text-right tabular-nums">{total}</strong>
            </div>
          );
        })}
      </div>
      {buckets.length === 16 ? <div className="text-xs text-slate-500">Die letzten 16 Stunden mit Aktivität.</div> : null}
    </div>
  );
}

function WarningList({ checks, canQueue, onQueueMissing, actionBusy }: { checks: DashboardWarningCheck[]; canQueue: boolean; onQueueMissing: () => void; actionBusy: boolean }) {
  const active = checks.filter((check) => check.status === "active" || check.count > 0);
  if (!active.length) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        Keine aktiven Warnungen in diesem Bereich.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {active.map((check) => (
        <div key={check.code} className={`rounded-lg border p-3 ${severityClasses(check.severity)}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{check.title}</span>
                <Badge variant="outline" className="bg-white/70">{check.count}</Badge>
              </div>
              <p className="mt-1 text-sm opacity-90">{check.description}</p>
              {check.actionHint ? <p className="mt-1 text-xs opacity-80">{check.actionHint}</p> : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {check.code === "accepted_entry_without_acceptance_mail" && canQueue ? (
                <Button type="button" size="sm" disabled={actionBusy} onClick={onQueueMissing}>
                  {actionBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Nachqueueen
                </Button>
              ) : null}
              <Button asChild size="sm" variant="outline" className="bg-white/80">
                <Link to={check.code.includes("mail") || check.code.includes("outbox") ? "/admin/communication" : "/admin/entries"}>Öffnen</Link>
              </Button>
            </div>
          </div>
          {check.samples.length > 0 ? (
            <div className="mt-3 space-y-1 border-t border-current/15 pt-2 text-xs">
              {check.samples.slice(0, 4).map((sample, index) => (
                <div key={index} className="truncate">{sampleText(sample) || "Details im Befund"}</div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function AdminDashboardPage() {
  const { roles } = useAuth();
  const canQueueLifecycle = hasPermission(roles, "communication.write");
  const [eventId, setEventId] = useState("");
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [locations, setLocations] = useState<DashboardDriverLocationItem[]>([]);
  const [mapMeta, setMapMeta] = useState<DashboardDriverLocationsMeta>(EMPTY_MAP_META);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapRefreshing, setMapRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [mapError, setMapError] = useState("");
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [queueBusy, setQueueBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const loadOverview = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setRefreshing(true);
    setError("");
    try {
      const currentEventId = eventId || (await getAdminEventId());
      if (!eventId) setEventId(currentEventId);
      setOverview(await adminDashboardService.getOverview(currentEventId, 8));
    } catch (err) {
      setError(getApiErrorMessage(err, "Dashboard konnte nicht geladen werden."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  const loadLocations = useCallback(async (options?: { refresh?: boolean; silent?: boolean }) => {
    if (options?.refresh) setMapRefreshing(true);
    if (!options?.silent && !options?.refresh) setMapLoading(true);
    setMapError("");
    try {
      const currentEventId = eventId || (await getAdminEventId());
      if (!eventId) setEventId(currentEventId);
      const result = await adminDashboardService.getDriverLocations(currentEventId, { refresh: options?.refresh, refreshLimit: 10 });
      setLocations(result.locations);
      setMapMeta(result.meta);
    } catch (err) {
      setMapError(getApiErrorMessage(err, "Fahrerkarte konnte nicht geladen werden."));
    } finally {
      setMapLoading(false);
      setMapRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadOverview();
    void loadLocations();
  }, [loadOverview, loadLocations]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && !queueBusy) {
        void loadOverview({ silent: true });
      }
    }, 60000);
    return () => window.clearInterval(interval);
  }, [loadOverview, queueBusy]);

  useEffect(() => {
    if (!mapMeta.hasPendingGeocoding) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadLocations({ silent: true });
      }
    }, 30000);
    return () => window.clearInterval(interval);
  }, [loadLocations, mapMeta.hasPendingGeocoding]);

  const allWarnings = useMemo(() => {
    const globalCodes = new Set(overview?.warnings.global.checks.map((check) => check.code) ?? []);
    return [
      ...(overview?.warnings.global.checks ?? []),
      ...(overview?.warnings.event.checks ?? []).filter((check) => !globalCodes.has(check.code))
    ];
  }, [overview]);

  const activeWarningTotal = allWarnings.filter((check) => check.status === "active" || check.count > 0).length;

  const queueMissingMails = useCallback(async () => {
    const confirmed = window.confirm("Fehlende Zulassungsmails jetzt über den normalen Lifecycle-Prozess nachqueueen?");
    if (!confirmed) return;
    setQueueBusy(true);
    setActionMessage("");
    try {
      const result = await adminDashboardService.queueMissingLifecycleMails({ limit: 500 });
      setActionMessage(`Nachqueue abgeschlossen: ${result.queued} queued, ${result.skipped} übersprungen.`);
      await loadOverview({ silent: true });
    } catch (err) {
      setActionMessage(getApiErrorMessage(err, "Nachqueue-Aktion fehlgeschlagen."));
    } finally {
      setQueueBusy(false);
    }
  }, [loadOverview]);

  const event = overview?.event;
  const healthSeverity = overview?.health.severity ?? "ok";
  const registrations = overview?.registrations;
  const finance = overview?.finance;
  const communication = overview?.communication;
  const drivers = overview?.drivers;
  const vehicles = overview?.vehicles;
  const operations = overview?.operations ?? { inspectorStatistics: [], inspectionTimeline: [], recentInspections: [] };
  const documents = overview?.documents;
  const signingCompletedTotal = numberValue(operations, "signingCompletedTotal");
  const signingOpenTotal = numberValue(operations, "signingOpenTotal");
  const signingRequiredTotal = numberValue(operations, "signingRequiredTotal") || signingCompletedTotal + signingOpenTotal;
  const techPendingTotal = numberValue(operations, "techPendingTotal");
  const techPassedTotal = numberValue(operations, "techPassedTotal");
  const techFailedTotal = numberValue(operations, "techFailedTotal");
  const techRequiredTotal = numberValue(operations, "techRequiredTotal") || techPendingTotal + techPassedTotal + techFailedTotal;
  const techCheckedTotal = techPassedTotal + techFailedTotal;

  return (
    <div className="flex flex-col gap-5">
      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
                <Badge variant="outline" className="bg-white">{event?.name ?? "Aktuelles Event"}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(overview?.generatedAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={refreshing || loading}
                onClick={() => {
                  void loadOverview();
                  void loadLocations();
                }}
              >
                {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Aktualisieren
              </Button>
              <Button asChild size="sm">
                <Link to="/admin/entries">Nennungen öffnen</Link>
              </Button>
            </div>
          </div>

          <div className={`rounded-lg border p-3 ${severityClasses(healthSeverity)}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                {healthSeverity === "ok" ? <CheckCircle2 className="h-5 w-5" /> : healthSeverity === "critical" ? <ShieldAlert className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                <div>
                  <div className="font-semibold">Systemstatus: {severityLabel(healthSeverity)}</div>
                  <div className="text-sm opacity-85">
                    {overview ? `${overview.health.globalCriticalTotal} systemweit kritische Warnungen, ${overview.health.eventWarningTotal} Event-Warnungen, ${overview.health.issueTotal} Befunde` : "Status wird geladen"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error ? <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
          {actionMessage ? <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700">{actionMessage}</div> : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <Metric label="Nennungen" value={loading ? "…" : numberValue(overview?.kpis, "entriesTotal")} sub="aktiv" />
            <Metric label="Zugelassen" value={loading ? "…" : numberValue(overview?.kpis, "acceptedTotal")} sub={percent(registrations?.acceptanceRatePercent)} tone="good" />
            <Metric label="Offene Zahlungen" value={loading ? "…" : numberValue(overview?.kpis, "paymentsDueTotal")} sub={formatMoney(finance?.openCents)} tone={numberValue(overview?.kpis, "paymentsDueTotal") > 0 ? "warn" : "good"} />
            <Metric label="Mailfehler" value={loading ? "…" : numberValue(overview?.kpis, "mailFailedTotal")} tone={numberValue(overview?.kpis, "mailFailedTotal") > 0 ? "bad" : "good"} />
            <Metric label="Warnungen" value={loading ? "…" : activeWarningTotal} tone={activeWarningTotal > 0 ? "warn" : "good"} />
            <Metric label="Neue 7 Tage" value={loading ? "…" : numberValue(overview?.kpis, "new7DaysTotal")} />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button key={tab.id} type="button" size="sm" variant={activeTab === tab.id ? "default" : "outline"} onClick={() => setActiveTab(tab.id)} className="shrink-0">
              <Icon className="mr-2 h-4 w-4" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {activeTab === "overview" && (
        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader><CardTitle className="text-base">Aktivität der letzten 30 Tage</CardTitle></CardHeader>
            <CardContent>{overview ? <ActivityBars rows={rowsValue(overview.activity as Record<string, unknown>, "last30Days")} /> : <div className="text-sm text-slate-500">Lade Aktivität…</div>}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Klassen nach Nennungen</CardTitle></CardHeader>
            <CardContent><BarList rows={overview?.classes ?? []} labelKey="className" /></CardContent>
          </Card>
          <ProgressCard
            title="Haftverzichte"
            complete={signingCompletedTotal}
            total={signingRequiredTotal}
            open={signingOpenTotal}
            completeLabel="Unterschrieben"
          />
          <ProgressCard
            title="Technische Abnahmen"
            complete={techCheckedTotal}
            total={techRequiredTotal}
            open={techPendingTotal}
            failed={techFailedTotal}
            completeLabel="Geprüft"
          />
          <Card>
            <CardHeader><CardTitle className="text-base">Dokumente</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Generiert" value={numberValue(documents, "generatedTotal")} tone="good" />
                <Metric label="Fehler" value={numberValue(documents, "failedTotal") + numberValue(documents, "jobsFailedTotal")} tone={numberValue(documents, "failedTotal") > 0 ? "bad" : "good"} />
              </div>
              <BarList rows={rowsValue(documents, "byType")} labelKey="type" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Weitere Kennzahlen</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              <div>Median-Alter: <span className="font-semibold text-slate-900">{String((overview?.niceToKnow.driverAgeStats as Record<string, unknown> | undefined)?.medianDriverAge ?? "-")}</span></div>
              <div>Fahrer auf Karte: <span className="font-semibold text-slate-900">{numberValue(overview?.map, "resolvedLocationTotal")} Orte gepflegt</span></div>
              <div>Internationale Fahrer: <span className="font-semibold text-slate-900">{numberValue(drivers, "internationalTotal")}</span></div>
            </CardContent>
          </Card>
        </section>
      )}

      {activeTab === "warnings" && (
        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Systemweite kritische Warnungen</CardTitle></CardHeader>
            <CardContent><WarningList checks={overview?.warnings.global.checks ?? []} canQueue={canQueueLifecycle} onQueueMissing={queueMissingMails} actionBusy={queueBusy} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Event-Warnungen</CardTitle></CardHeader>
            <CardContent><WarningList checks={overview?.warnings.event.checks ?? []} canQueue={canQueueLifecycle} onQueueMissing={queueMissingMails} actionBusy={queueBusy} /></CardContent>
          </Card>
        </section>
      )}

      {activeTab === "registrations" && (
        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2"><CardHeader><CardTitle className="text-base">Nennstatus</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Pending" value={numberValue(registrations, "pendingTotal")} /><Metric label="Shortlist" value={numberValue(registrations, "shortlistTotal")} /><Metric label="Zugelassen" value={numberValue(registrations, "acceptedTotal")} tone="good" /><Metric label="Abgelehnt" value={numberValue(registrations, "rejectedTotal")} /><Metric label="Abgesagt" value={numberValue(registrations, "withdrawnTotal")} /></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Verifizierung</CardTitle></CardHeader><CardContent className="grid gap-3"><Metric label="Verifiziert" value={numberValue(registrations, "verifiedTotal")} sub={percent(registrations?.verificationRatePercent)} tone="good" /><Metric label="Unverifiziert" value={numberValue(registrations, "unverifiedTotal")} tone={numberValue(registrations, "unverifiedTotal") > 0 ? "warn" : "good"} /></CardContent></Card>
          <Card className="xl:col-span-3"><CardHeader><CardTitle className="text-base">Neue Nennungen</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><Metric label="Heute" value={numberValue(registrations, "newTodayTotal")} /><Metric label="7 Tage" value={numberValue(registrations, "new7DaysTotal")} /><Metric label="30 Tage" value={numberValue(registrations, "new30DaysTotal")} /></CardContent></Card>
        </section>
      )}

      {activeTab === "finance" && (
        <section className="grid gap-4 xl:grid-cols-4">
          <Metric label="Erwartet" value={formatMoney(finance?.expectedCents)} />
          <Metric label="Bezahlt" value={formatMoney(finance?.paidCents)} sub={percent(finance?.paymentCompletionPercent)} tone="good" />
          <Metric label="Offen" value={formatMoney(finance?.openCents)} tone={numberValue(finance, "openCents") > 0 ? "warn" : "good"} />
          <Metric label="0-Euro-Fälle" value={numberValue(finance, "zeroEuroInvoiceTotal")} />
        </section>
      )}

      {activeTab === "communication" && (
        <section className="grid gap-4 xl:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-base">Outbox</CardTitle></CardHeader><CardContent className="grid gap-3"><Metric label="Queued" value={numberValue(communication, "queuedTotal")} /><Metric label="Sending" value={numberValue(communication, "sendingTotal")} /><Metric label="Sent" value={numberValue(communication, "sentTotal")} tone="good" /><Metric label="Failed" value={numberValue(communication, "failedTotal")} tone={numberValue(communication, "failedTotal") > 0 ? "bad" : "good"} /></CardContent></Card>
          <Card className="xl:col-span-2"><CardHeader><CardTitle className="text-base">Templates</CardTitle></CardHeader><CardContent><BarList rows={rowsValue(communication, "templates")} labelKey="templateId" /></CardContent></Card>
        </section>
      )}

      {activeTab === "drivers" && (
        <section className="space-y-4">
          <Card><CardContent className="p-4 sm:p-5"><DriverOriginMap locations={locations} meta={mapMeta} loading={mapLoading} refreshingCoordinates={mapRefreshing} error={mapError} /></CardContent></Card>
          <section className="grid gap-4 xl:grid-cols-3">
            <Card><CardHeader><CardTitle className="text-base">Fahrerstatistik</CardTitle></CardHeader><CardContent className="grid gap-3"><Metric label="Fahrer" value={numberValue(drivers, "driverTotal")} /><Metric label="International" value={numberValue(drivers, "internationalTotal")} /><Metric label="U18" value={numberValue(drivers, "under18Total")} /><Metric label="Median-Alter" value={String(drivers?.medianAge ?? "-")} /></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Länder</CardTitle></CardHeader><CardContent><BarList rows={rowsValue(drivers, "countries")} labelKey="country" /></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Städte</CardTitle></CardHeader><CardContent><BarList rows={rowsValue(drivers, "cities")} labelKey="city" /></CardContent></Card>
          </section>
        </section>
      )}

      {activeTab === "vehicles" && (
        <section className="grid gap-4 xl:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-base">Fahrzeuge</CardTitle></CardHeader><CardContent className="grid gap-3"><Metric label="Autos" value={numberValue(vehicles, "autoTotal")} /><Metric label="Motorräder" value={numberValue(vehicles, "motoTotal")} /><Metric label="Bilder fehlen" value={numberValue(vehicles, "missingImageTotal")} tone={numberValue(vehicles, "missingImageTotal") > 0 ? "warn" : "good"} /><Metric label="Baujahre" value={`${vehicles?.oldestYear ?? "-"} - ${vehicles?.newestYear ?? "-"}`} /></CardContent></Card>
          <Card className="xl:col-span-2"><CardHeader><CardTitle className="text-base">Marken</CardTitle></CardHeader><CardContent><BarList rows={rowsValue(vehicles, "brands")} labelKey="brand" /></CardContent></Card>
        </section>
      )}

      {activeTab === "operations" && (
        <section className="grid gap-4 xl:grid-cols-2">
          <ProgressCard
            title="Haftverzichte · Ist / Soll"
            complete={signingCompletedTotal}
            total={signingRequiredTotal}
            open={signingOpenTotal}
            completeLabel="Unterschrieben"
          />
          <ProgressCard
            title="Technische Abnahmen · Ist / Soll"
            complete={techCheckedTotal}
            total={techRequiredTotal}
            open={techPendingTotal}
            failed={techFailedTotal}
            completeLabel="Geprüft"
          />

          <Card>
            <CardHeader><CardTitle className="text-base">Abnahmen je Prüfer</CardTitle></CardHeader>
            <CardContent>
              {operations.inspectorStatistics.length === 0 ? <div className="text-sm text-slate-500">Noch keine Prüferentscheidungen erfasst.</div> : (
                <div className="space-y-3">
                  {operations.inspectorStatistics.map((inspector) => (
                    <div key={inspector.inspectorUserId} className="rounded-lg border bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">{inspector.inspectorDisplay}</div>
                          <div className="mt-1 text-xs text-slate-500">Zuletzt: {formatDateTime(inspector.lastDecisionAt)}</div>
                        </div>
                        <div className="text-right"><div className="text-2xl font-semibold tabular-nums">{inspector.decisionTotal}</div><div className="text-xs text-slate-500">Entscheidungen</div></div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs">
                        <span className="text-emerald-700">{inspector.passedTotal} bestanden</span>
                        <span className="text-red-700">{inspector.failedTotal} abgelehnt</span>
                        {inspector.resetTotal > 0 ? <span className="text-slate-500">{inspector.resetTotal} zurückgesetzt</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prüferaktivität nach Stunde</CardTitle>
              <p className="text-xs text-slate-500">Bestätigte und abgelehnte Entscheidungen, nach Prüfer aufgeteilt.</p>
            </CardHeader>
            <CardContent><InspectorActivityChart timeline={operations.inspectionTimeline} inspectors={operations.inspectorStatistics} /></CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader><CardTitle className="text-base">Letzte technische Abnahmen</CardTitle></CardHeader>
            <CardContent>
              {operations.recentInspections.length === 0 ? <div className="text-sm text-slate-500">Noch keine Abnahmen erfasst.</div> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b text-xs uppercase text-slate-500"><tr><th className="px-2 py-2">Zeit</th><th className="px-2 py-2">Nennung</th><th className="px-2 py-2">Ergebnis</th><th className="px-2 py-2">Prüfer</th></tr></thead>
                    <tbody className="divide-y">
                      {operations.recentInspections.map((item) => (
                        <tr key={item.id}>
                          <td className="whitespace-nowrap px-2 py-3 text-slate-600">{formatDateTime(item.createdAt)}</td>
                          <td className="px-2 py-3"><Link className="font-semibold text-primary hover:underline" to={`/inspection/${item.entryId}`}>#{item.startNumber || "–"}</Link>{item.target === "backup" ? <span className="ml-1 text-xs text-slate-500">Ersatzfahrzeug</span> : null}</td>
                          <td className="px-2 py-3"><Badge className={item.status === "passed" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-800"}>{item.status === "passed" ? "Bestanden" : "Abgelehnt"}</Badge></td>
                          <td className="px-2 py-3 text-slate-700">{item.inspectorDisplay}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="xl:col-span-2"><CardHeader><CardTitle className="text-base">Weitere Betriebsdaten</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><Metric label="Exporte in Warteschlange" value={numberValue(operations, "exportsQueuedTotal")} /><Metric label="Exporte in Arbeit" value={numberValue(operations, "exportsProcessingTotal")} /><Metric label="Exporte fehlgeschlagen" value={numberValue(operations, "exportsFailedTotal")} tone={numberValue(operations, "exportsFailedTotal") > 0 ? "bad" : "good"} /></CardContent></Card>
        </section>
      )}
    </div>
  );
}
