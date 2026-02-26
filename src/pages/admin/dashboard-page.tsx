import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, ClipboardCheck, FileDown, Filter, Loader2, Mail, MessageSquareWarning, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminEventId } from "@/services/api/event-context";
import { getApiErrorMessage, requestJson } from "@/services/api/http-client";

type DashboardSummary = {
  entriesTotal: number;
  paymentsDueTotal: number;
  checkinPendingTotal: number;
  mailFailedTotal: number;
  mailQueuedTotal: number;
  exportsQueuedTotal: number;
  exportsProcessingTotal: number;
};

type DashboardClassDistributionItem = {
  classId: string;
  className: string;
  count: number;
};

type DashboardRecentEntryItem = {
  entryId: string;
  driverName: string;
  className: string;
  createdAt: string;
};

type AdminDashboardSummaryResponse = {
  ok: boolean;
  summary: DashboardSummary;
  classDistribution: DashboardClassDistributionItem[];
  recentEntries: DashboardRecentEntryItem[];
};

const EMPTY_SUMMARY: DashboardSummary = {
  entriesTotal: 0,
  paymentsDueTotal: 0,
  checkinPendingTotal: 0,
  mailFailedTotal: 0,
  mailQueuedTotal: 0,
  exportsQueuedTotal: 0,
  exportsProcessingTotal: 0
};

const RECENT_CHANGES_LIMIT = 5;

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("de-DE");
}

export function AdminDashboardPage() {
  const { roles } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [classDistribution, setClassDistribution] = useState<DashboardClassDistributionItem[]>([]);
  const [recentEntries, setRecentEntries] = useState<DashboardRecentEntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const canReadOutbox = hasPermission(roles, "communication.read");
  const canReadExports = hasPermission(roles, "exports.read");

  const loadDashboard = useCallback(async (options?: { refresh?: boolean }) => {
    const isRefresh = options?.refresh === true;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");
    try {
      const eventId = await getAdminEventId();
      const response = await requestJson<AdminDashboardSummaryResponse>("/admin/dashboard/summary", {
        query: {
          eventId
        }
      });

      setSummary(response.summary ?? EMPTY_SUMMARY);
      setClassDistribution(response.classDistribution ?? []);
      setRecentEntries(response.recentEntries ?? []);
    } catch (err) {
      setSummary(EMPTY_SUMMARY);
      setClassDistribution([]);
      setRecentEntries([]);
      setError(getApiErrorMessage(err, "Dashboard-Daten konnten nicht geladen werden."));
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const recentChanges = useMemo(() => {
    return [...recentEntries]
      .sort((left, right) => Number(new Date(right.createdAt)) - Number(new Date(left.createdAt)))
      .slice(0, RECENT_CHANGES_LIMIT)
      .map((item) => ({
        entryId: item.entryId,
        title: item.driverName,
        subtitle: item.className,
        time: formatDateTime(item.createdAt)
      }));
  }, [recentEntries]);

  const focusItems = useMemo(
    () =>
      [
        {
          label: "Offene Zahlungen prüfen",
          description: "Zahlungserinnerung oder Zahlungseingang setzen",
          count: summary.paymentsDueTotal,
          to: "/admin/entries?status=accepted&payment=due"
        },
        {
          label: "Check-in vorbereiten",
          description: "Zugelassene Nennungen ohne Check-in",
          count: summary.checkinPendingTotal,
          to: "/admin/entries?status=accepted&checkin=false"
        },
        canReadOutbox
          ? {
              label: "Mail-Fehler beheben",
              description: "Fehlgeschlagene Mails erneut einplanen",
              count: summary.mailFailedTotal,
              to: "/admin/communication"
            }
          : null,
        canReadExports
          ? {
              label: "Exporte beobachten",
              description: "Laufende und wartende Exporte prüfen",
              count: summary.exportsProcessingTotal + summary.exportsQueuedTotal,
              to: "/admin/exports"
            }
          : null
      ].filter(Boolean) as Array<{ label: string; description: string; count: number; to: string }>,
    [summary, canReadOutbox, canReadExports]
  );

  const classDistributionSorted = useMemo(
    () => [...classDistribution].sort((left, right) => right.count - left.count),
    [classDistribution]
  );
  const topClasses = classDistributionSorted.slice(0, 6);
  const extraClassesCount = Math.max(classDistributionSorted.length - topClasses.length, 0);

  const maxClass = classDistribution.length > 0 ? Math.max(...classDistribution.map((item) => item.count)) : 1;

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 bg-gradient-to-br from-slate-50 to-white">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600">Schneller Überblick für Zahlungen, Check-in und Kommunikation.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={loading || refreshing} onClick={() => void loadDashboard({ refresh: true })}>
                {refreshing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Aktualisiere…
                  </>
                ) : (
                  "Aktualisieren"
                )}
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/admin/entries">
                  <Filter className="mr-1 h-4 w-4" />
                  Nennungen
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border bg-white p-3">
              <div className="text-xs uppercase text-slate-500">Nennungen gesamt</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "…" : summary.entriesTotal}</div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="text-xs uppercase text-slate-500">Offene Zahlungen</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "…" : summary.paymentsDueTotal}</div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="text-xs uppercase text-slate-500">Check-in ausstehend</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "…" : summary.checkinPendingTotal}</div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="text-xs uppercase text-slate-500">Mail-Fehler</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "…" : canReadOutbox ? summary.mailFailedTotal : "-"}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Mail Queue: {loading || !canReadOutbox ? "-" : summary.mailQueuedTotal}</Badge>
            <Badge variant="outline">Exporte aktiv: {loading || !canReadExports ? "-" : summary.exportsProcessingTotal}</Badge>
            <Badge variant="outline">Exporte wartend: {loading || !canReadExports ? "-" : summary.exportsQueuedTotal}</Badge>
          </div>
        </CardContent>
      </Card>

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fokus heute</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {focusItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-2 rounded-md border p-2.5">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">{item.label}</div>
                  <div className="truncate text-xs text-slate-600">{item.description}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.count > 0 ? "default" : "outline"}>{loading ? "…" : item.count}</Badge>
                  <Button asChild size="sm" variant="outline">
                    <Link to={item.to}>Öffnen</Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Letzte Änderungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading && <div className="text-sm text-slate-500">Lade Änderungen…</div>}
            {!loading &&
              recentChanges.map((item) => (
                <Link key={item.entryId} to={`/admin/entries/${item.entryId}`} className="block rounded-md border p-2.5 transition hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">{item.title}</div>
                      <div className="truncate text-xs text-slate-600">{item.subtitle}</div>
                    </div>
                    <div className="shrink-0 text-xs text-slate-500">{item.time}</div>
                  </div>
                </Link>
              ))}
            {!loading && recentChanges.length === 0 && <div className="text-sm text-slate-500">Keine Einträge verfügbar.</div>}
            {!loading && recentEntries.length > RECENT_CHANGES_LIMIT && (
              <div className="pt-1">
                <Button asChild size="sm" variant="outline">
                  <Link to="/admin/entries">Alle Nennungen öffnen</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Klassenverteilung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(loading ? [] : topClasses).map((item) => (
              <div key={item.classId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate pr-2">{item.className}</span>
                  <span className="font-medium">{item.count}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-2 bg-primary" style={{ width: `${Math.round((item.count / maxClass) * 100)}%` }} />
                </div>
              </div>
            ))}
            {!loading && topClasses.length === 0 && <div className="text-sm text-slate-500">Keine Klassenverteilung verfügbar.</div>}
            {!loading && extraClassesCount > 0 && <div className="text-xs text-slate-500">+ {extraClassesCount} weitere Klassen</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schnellzugriffe</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <Button asChild variant="outline" className="justify-start">
              <Link to="/admin/entries">
                <Filter className="mr-2 h-4 w-4" />
                Alle Nennungen
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/admin/entries?status=accepted&payment=due">
                <Wallet className="mr-2 h-4 w-4" />
                Offene Zahlungen
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/admin/entries?status=accepted&checkin=false">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Check-in offen
              </Link>
            </Button>
            {canReadOutbox && (
              <Button asChild variant="outline" className="justify-start">
                <Link to="/admin/communication">
                  <BellRing className="mr-2 h-4 w-4" />
                  Kommunikation
                </Link>
              </Button>
            )}
            {canReadOutbox && (
              <Button asChild variant="outline" className="justify-start">
                <Link to="/admin/communication">
                  <MessageSquareWarning className="mr-2 h-4 w-4" />
                  Mail-Fehler prüfen
                </Link>
              </Button>
            )}
            {canReadExports && (
              <Button asChild variant="outline" className="justify-start">
                <Link to="/admin/exports">
                  <FileDown className="mr-2 h-4 w-4" />
                  Exporte
                </Link>
              </Button>
            )}
            {canReadOutbox && (
              <Button asChild variant="outline" className="justify-start">
                <Link to="/admin/communication">
                  <Mail className="mr-2 h-4 w-4" />
                  Broadcast
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
