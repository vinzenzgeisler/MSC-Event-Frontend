import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Loader2, Mail, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
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

const RECENT_CHANGES_LIMIT = 4;
const ACTIVITY_WINDOW_DAYS = 7;
const CLASS_COLORS = ["#0f766e", "#2563eb", "#f59e0b", "#db2777", "#7c3aed", "#64748b"];

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("de-DE");
}

function toDayKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayLabel(value: Date) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(value);
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

  const paidCount = Math.max(0, summary.entriesTotal - summary.paymentsDueTotal);
  const paymentCompletionPercent = summary.entriesTotal > 0 ? Math.round((paidCount / summary.entriesTotal) * 100) : 0;

  const dailyActivity = useMemo(() => {
    const counts = new Map<string, number>();
    recentEntries.forEach((item) => {
      const parsed = new Date(item.createdAt);
      if (Number.isNaN(parsed.getTime())) {
        return;
      }
      const key = toDayKey(parsed);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    const days: Array<{ key: string; label: string; count: number }> = [];
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    for (let offset = ACTIVITY_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
      const day = new Date(now);
      day.setDate(now.getDate() - offset);
      const key = toDayKey(day);
      days.push({
        key,
        label: formatDayLabel(day),
        count: counts.get(key) ?? 0
      });
    }

    return days;
  }, [recentEntries]);
  const maxDailyCount = Math.max(1, ...dailyActivity.map((item) => item.count));
  const newEntriesLast7Days = dailyActivity.reduce((sum, item) => sum + item.count, 0);
  const averageNewEntriesPerDay = (newEntriesLast7Days / ACTIVITY_WINDOW_DAYS).toFixed(1);

  const classDistributionSorted = useMemo(
    () => [...classDistribution].sort((left, right) => right.count - left.count),
    [classDistribution]
  );
  const topClasses = classDistributionSorted.slice(0, 5);
  const totalClassEntries = classDistributionSorted.reduce((sum, item) => sum + item.count, 0);
  const shownClassEntries = topClasses.reduce((sum, item) => sum + item.count, 0);
  const otherClassEntries = Math.max(0, totalClassEntries - shownClassEntries);
  const activeClassesCount = classDistributionSorted.filter((item) => item.count > 0).length;
  const topClassesSharePercent = totalClassEntries > 0 ? Math.round((shownClassEntries / totalClassEntries) * 100) : 0;
  const classLegendItems = otherClassEntries > 0 ? [...topClasses, { classId: "other", className: "Weitere Klassen", count: otherClassEntries }] : topClasses;
  const donutGradient = useMemo(() => {
    if (totalClassEntries <= 0 || classLegendItems.length === 0) {
      return "conic-gradient(#e2e8f0 0deg 360deg)";
    }
    let cursor = 0;
    const segments = classLegendItems.map((item, index) => {
      const start = cursor;
      const ratio = item.count / totalClassEntries;
      const sweep = ratio * 360;
      cursor += sweep;
      return `${CLASS_COLORS[index % CLASS_COLORS.length]} ${start.toFixed(2)}deg ${cursor.toFixed(2)}deg`;
    });
    return `conic-gradient(${segments.join(",")})`;
  }, [classLegendItems, totalClassEntries]);
  const maxClass = classDistribution.length > 0 ? Math.max(...classDistribution.map((item) => item.count)) : 1;

  const actionItems = useMemo(
    () =>
      [
        {
          label: "Offene Zahlungen",
          subtitle: "Zugelassen + Zahlung offen",
          to: "/admin/entries?status=accepted&payment=due",
          icon: Wallet
        },
        {
          label: "Nennungen",
          subtitle: "Liste mit Filtern öffnen",
          to: "/admin/entries",
          icon: Filter
        },
        canReadOutbox
          ? {
              label: "Kommunikation",
              subtitle: "Outbox und Broadcasts",
              to: "/admin/communication",
              icon: Mail
            }
          : null
      ].filter(Boolean) as Array<{
        label: string;
        subtitle: string;
        to: string;
        icon: typeof Wallet;
      }>,
    [canReadOutbox]
  );

  return (
    <div className="space-y-5">
      <Card className="border-slate-200 bg-gradient-to-r from-white via-slate-50 to-emerald-50/60">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600">Statistischer Überblick mit Fokus auf operative Entscheidungen.</p>
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
              <Button asChild size="sm" variant="default">
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
              <div className="text-xs uppercase text-slate-500">Klassen aktiv</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "…" : activeClassesCount}</div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="text-xs uppercase text-slate-500">Neue Nennungen (7 Tage)</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "…" : newEntriesLast7Days}</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-white p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-700">Zahlungsquote</span>
                <span className="font-semibold text-slate-900">{loading ? "…" : `${paymentCompletionPercent}%`}</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${loading ? 0 : paymentCompletionPercent}%` }} />
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {loading ? "…" : `${paidCount} von ${summary.entriesTotal} Nennungen bezahlt`}
              </div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-700">Top-Klassenanteil</span>
                <span className="font-semibold text-slate-900">{loading ? "…" : `${topClassesSharePercent}%`}</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-sky-500" style={{ width: `${loading ? 0 : topClassesSharePercent}%` }} />
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {loading ? "…" : `${averageNewEntriesPerDay} neue Nennungen pro Tag (Ø letzte 7 Tage)`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Aktivität der letzten 7 Tage</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-slate-500">Lade Aktivitätsdaten…</div>
            ) : (
              <div className="space-y-3">
                <div className="grid h-44 grid-cols-7 items-end gap-2 rounded-md border bg-slate-50 p-3">
                  {dailyActivity.map((item) => {
                    const height = Math.max(8, Math.round((item.count / maxDailyCount) * 100));
                    return (
                      <div key={item.key} className="flex h-full flex-col items-center justify-end gap-1">
                        <span className="text-[11px] text-slate-600">{item.count}</span>
                        <div className="w-full rounded-t-sm bg-primary/85 transition-all" style={{ height: `${height}%` }} />
                        <span className="text-[11px] text-slate-500">{item.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="text-xs text-slate-500">Neue Nennungen pro Tag (auf Basis der letzten gemeldeten Änderungen).</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Klassenanteile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="text-sm text-slate-500">Lade Klassenverteilung…</div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-center">
                  <div className="relative h-44 w-44 rounded-full" style={{ background: donutGradient }}>
                    <div className="absolute inset-[18%] flex flex-col items-center justify-center rounded-full bg-white text-center">
                      <div className="text-[11px] uppercase text-slate-500">Nennungen</div>
                      <div className="text-2xl font-semibold text-slate-900">{totalClassEntries}</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {classLegendItems.map((item, index) => {
                    const percentage = totalClassEntries > 0 ? Math.round((item.count / totalClassEntries) * 100) : 0;
                    return (
                      <div key={item.classId} className="flex items-center justify-between rounded border p-2 text-xs">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CLASS_COLORS[index % CLASS_COLORS.length] }} />
                          <span className="truncate text-slate-700">{item.className}</span>
                        </div>
                        <span className="shrink-0 font-medium text-slate-900">
                          {item.count} · {percentage}%
                        </span>
                      </div>
                    );
                  })}
                  {classLegendItems.length === 0 && <div className="text-sm text-slate-500">Keine Klassenverteilung verfügbar.</div>}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Letzte Änderungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schnellzugriffe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {actionItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button key={item.label} asChild variant="outline" className="h-auto w-full justify-between px-3 py-2">
                  <Link to={item.to}>
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="text-left">
                        <span className="block text-sm">{item.label}</span>
                        <span className="block text-xs text-slate-500">{item.subtitle}</span>
                      </span>
                    </span>
                    <span className="text-xs text-slate-500">Öffnen</span>
                  </Link>
                </Button>
              );
            })}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
