import { useEffect, useMemo, useState } from "react";
import { BarChart3, BellRing, ClipboardCheck, FileDown, Filter, Mail, MessageSquareWarning, Wallet } from "lucide-react";
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

export function AdminDashboardPage() {
  const { roles } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [classDistribution, setClassDistribution] = useState<DashboardClassDistributionItem[]>([]);
  const [recentEntries, setRecentEntries] = useState<DashboardRecentEntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canReadOutbox = hasPermission(roles, "communication.read");
  const canReadExports = hasPermission(roles, "exports.read");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
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
        setLoading(false);
      }
    };

    void load();
  }, []);

  const kpis = useMemo(
    () => [
      { label: "Nennungen gesamt", value: String(summary.entriesTotal), icon: BarChart3 },
      { label: "Offene Zahlungen", value: String(summary.paymentsDueTotal), icon: Wallet },
      { label: "Nicht eingecheckt", value: String(summary.checkinPendingTotal), icon: ClipboardCheck },
      {
        label: "Mail-Fehler",
        value: canReadOutbox ? String(summary.mailFailedTotal) : "-",
        icon: MessageSquareWarning
      }
    ],
    [summary, canReadOutbox]
  );

  const queueItems = useMemo(
    () => [
      { area: "Mail-Outbox", status: "In Warteschlange", count: canReadOutbox ? summary.mailQueuedTotal : null },
      { area: "Mail-Outbox", status: "Fehlgeschlagen", count: canReadOutbox ? summary.mailFailedTotal : null },
      { area: "Exporte", status: "In Bearbeitung", count: canReadExports ? summary.exportsProcessingTotal : null },
      { area: "Exporte", status: "In Warteschlange", count: canReadExports ? summary.exportsQueuedTotal : null }
    ],
    [summary, canReadOutbox, canReadExports]
  );

  const recentChanges = useMemo(() => {
    return recentEntries.map((item) => ({
      text: `Neue Nennung: ${item.driverName} (${item.className})`,
      time: new Date(item.createdAt).toLocaleString("de-DE")
    }));
  }, [recentEntries]);

  const maxClass = classDistribution.length > 0 ? Math.max(...classDistribution.map((item) => item.count)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/entries">
              <Filter className="mr-1 h-4 w-4" />
              Offene Fälle
            </Link>
          </Button>
          {canReadOutbox && (
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/communication">
                <Mail className="mr-1 h-4 w-4" />
                Broadcast
              </Link>
            </Button>
          )}
        </div>
      </div>

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="text-xs uppercase text-slate-500">{item.label}</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "…" : item.value}</div>
                </div>
                <div className="rounded-md border bg-slate-50 p-2 text-slate-600">
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operative Warteschlangen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {queueItems.map((item) => (
              <div key={`${item.area}-${item.status}`} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <div>
                  <div className="font-medium text-slate-900">{item.area}</div>
                  <div className="text-xs text-slate-600">{item.status}</div>
                </div>
                <Badge variant="outline">{loading ? "…" : item.count === null ? "-" : item.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Letzte Änderungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(loading ? [] : recentChanges).map((item) => (
              <div key={item.text} className="rounded-md border p-2 text-sm">
                <div className="font-medium text-slate-900">{item.text}</div>
                <div className="text-xs text-slate-500">{item.time}</div>
              </div>
            ))}
            {!loading && recentChanges.length === 0 && <div className="text-sm text-slate-500">Keine Einträge verfügbar.</div>}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reporting: Klassenverteilung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(loading ? [] : classDistribution).map((item) => (
              <div key={item.classId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{item.className}</span>
                  <span className="font-medium">{item.count}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-2 bg-primary" style={{ width: `${Math.round((item.count / maxClass) * 100)}%` }} />
                </div>
              </div>
            ))}
            {!loading && classDistribution.length === 0 && <div className="text-sm text-slate-500">Keine Klassenverteilung verfügbar.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <Button asChild variant="outline" className="justify-start">
              <Link to="/admin/entries">
                <Filter className="mr-2 h-4 w-4" />
                Zahlungen offen filtern
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/admin/entries">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Eincheck-Liste öffnen
              </Link>
            </Button>
            {canReadOutbox && (
              <Button asChild variant="outline" className="justify-start">
                <Link to="/admin/communication">
                  <BellRing className="mr-2 h-4 w-4" />
                  Broadcast starten
                </Link>
              </Button>
            )}
            {canReadExports && (
              <Button asChild variant="outline" className="justify-start">
                <Link to="/admin/exports">
                  <FileDown className="mr-2 h-4 w-4" />
                  Startliste exportieren
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
