import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Loader2, Mail, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminEntriesService } from "@/services/admin-entries.service";
import { communicationService } from "@/services/communication.service";
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
  driverAgeStats: {
    oldestDriverAge: number | null;
    oldestDriverLabel: string;
    youngestDriverAge: number | null;
    medianDriverAge: number | null;
  };
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
  summary?: unknown;
  classDistribution?: DashboardClassDistributionItem[];
  recentEntries?: DashboardRecentEntryItem[];
};

const EMPTY_SUMMARY: DashboardSummary = {
  entriesTotal: 0,
  paymentsDueTotal: 0,
  checkinPendingTotal: 0,
  mailFailedTotal: 0,
  mailQueuedTotal: 0,
  exportsQueuedTotal: 0,
  exportsProcessingTotal: 0,
  driverAgeStats: {
    oldestDriverAge: null,
    oldestDriverLabel: "",
    youngestDriverAge: null,
    medianDriverAge: null
  }
};

const RECENT_CHANGES_LIMIT = 4;
const ACTIVITY_WINDOW_DAYS = 7;
const CLASS_COLORS = ["#0f766e", "#2563eb", "#f59e0b", "#db2777", "#7c3aed", "#64748b"];
const BRAND_STATS_LIMIT = 8;

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

function formatAge(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatAgeWithUnit(value: number | null | undefined) {
  const formatted = formatAge(value);
  return formatted === "—" ? formatted : `${formatted} J.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) {
    return value;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(",", "."));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function toNullableCount(value: unknown): number | null {
  const parsed = toNullableNumber(value);
  if (parsed === null) {
    return null;
  }
  return Math.max(0, Math.round(parsed));
}

function pickFirstNumber(sources: Record<string, unknown>[], keys: string[]): number | null {
  for (const source of sources) {
    for (const key of keys) {
      const parsed = toNullableNumber(source[key]);
      if (parsed !== null) {
        return parsed;
      }
    }
  }
  return null;
}

function pickFirstString(sources: Record<string, unknown>[], keys: string[]): string {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed) {
          return trimmed;
        }
      }
    }
  }
  return "";
}

function normalizeDriverAgeStats(summaryStats: unknown): DashboardSummary["driverAgeStats"] {
  const record = toRecord(summaryStats);
  const sources = record ? [record] : [];
  if (!sources.length) {
    return EMPTY_SUMMARY.driverAgeStats;
  }

  return {
    oldestDriverAge: pickFirstNumber(sources, ["oldestDriverAge", "oldestAge", "oldest_driver_age"]),
    oldestDriverLabel: pickFirstString(sources, ["oldestDriverLabel", "oldestLabel", "oldest_driver_label"]),
    youngestDriverAge: pickFirstNumber(sources, ["youngestDriverAge", "youngestAge", "youngest_driver_age"]),
    medianDriverAge: pickFirstNumber(sources, ["medianDriverAge", "medianAge", "median_driver_age"])
  };
}

function normalizeDashboardSummary(summary: unknown): DashboardSummary {
  const record = toRecord(summary);
  if (!record) {
    return EMPTY_SUMMARY;
  }

  const ageStatsSource = record.driverAgeStats ?? record.driver_age_stats ?? record.ageStats ?? record.age_stats;
  return {
    entriesTotal: toNullableCount(record.entriesTotal) ?? EMPTY_SUMMARY.entriesTotal,
    paymentsDueTotal: toNullableCount(record.paymentsDueTotal) ?? EMPTY_SUMMARY.paymentsDueTotal,
    checkinPendingTotal: toNullableCount(record.checkinPendingTotal) ?? EMPTY_SUMMARY.checkinPendingTotal,
    mailFailedTotal: toNullableCount(record.mailFailedTotal) ?? EMPTY_SUMMARY.mailFailedTotal,
    mailQueuedTotal: toNullableCount(record.mailQueuedTotal) ?? EMPTY_SUMMARY.mailQueuedTotal,
    exportsQueuedTotal: toNullableCount(record.exportsQueuedTotal) ?? EMPTY_SUMMARY.exportsQueuedTotal,
    exportsProcessingTotal: toNullableCount(record.exportsProcessingTotal) ?? EMPTY_SUMMARY.exportsProcessingTotal,
    driverAgeStats: normalizeDriverAgeStats(ageStatsSource)
  };
}

function normalizeVehicleBrand(label: string) {
  const raw = (label ?? "").trim();
  if (!raw || raw === "-") {
    return "Unbekannt";
  }

  const cleaned = raw.replace(/^\d{2,4}\s+/, "").trim();
  const parts = cleaned.split(/[\s/,-]+/).filter(Boolean);
  if (!parts.length) {
    return "Unbekannt";
  }

  const pairKey = `${(parts[0] ?? "").toLowerCase()} ${(parts[1] ?? "").toLowerCase()}`.trim();
  const pairLabels: Record<string, string> = {
    "alfa romeo": "Alfa Romeo",
    "aston martin": "Aston Martin",
    "land rover": "Land Rover",
    "can am": "Can-Am",
    "mercedes benz": "Mercedes-Benz"
  };
  if (pairLabels[pairKey]) {
    return pairLabels[pairKey];
  }

  const token = parts[0] ?? "Unbekannt";
  if (token.length <= 3) {
    return token.toUpperCase();
  }
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

type BrandDistributionItem = {
  brand: string;
  count: number;
  sharePercent: number;
};

export function AdminDashboardPage() {
  const { roles } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [classDistribution, setClassDistribution] = useState<DashboardClassDistributionItem[]>([]);
  const [recentEntries, setRecentEntries] = useState<DashboardRecentEntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [advancedLoading, setAdvancedLoading] = useState(false);
  const [advancedError, setAdvancedError] = useState("");
  const [brandDistribution, setBrandDistribution] = useState<BrandDistributionItem[] | null>(null);
  const [error, setError] = useState("");
  const [quickActionBusy, setQuickActionBusy] = useState<null | "verification" | "payment">(null);
  const [quickActionMessage, setQuickActionMessage] = useState("");
  const [quickActionConfirm, setQuickActionConfirm] = useState<null | {
    label: string;
    templateKey: string;
    finalCount: number;
    filters: {
      acceptanceStatus?: "pending" | "shortlist" | "accepted" | "rejected";
      registrationStatus?: "submitted_unverified" | "submitted_verified";
      paymentStatus?: "due" | "paid";
      classId?: string;
    };
  }>(null);
  const [confirmingQuickAction, setConfirmingQuickAction] = useState(false);

  const canReadOutbox = hasPermission(roles, "communication.read");
  const canManageCommunication = hasPermission(roles, "communication.write");

  const runQuickAction = useCallback(
    async (kind: "verification" | "payment") => {
      if (!canManageCommunication) {
        setQuickActionMessage("Nur Admin-Rollen dürfen Mails senden.");
        return;
      }
      if (quickActionBusy) {
        return;
      }

      setQuickActionMessage("");
      setQuickActionBusy(kind);
      try {
        const label = kind === "verification" ? "Verifizierungs-Erinnerung" : "Zahlungs-Followup";
        const templateKey = kind === "verification" ? "email_confirmation" : "payment_reminder_followup";
        const resolved = await communicationService.resolveBroadcastRecipients(
          kind === "verification"
            ? { registrationStatus: "submitted_unverified" }
            : { acceptanceStatus: "accepted", registrationStatus: "submitted_verified", paymentStatus: "due" }
        );

        if (resolved.finalCount < 1) {
          setQuickActionMessage("Keine passenden Empfänger gefunden.");
          return;
        }

        setQuickActionConfirm({
          label,
          templateKey,
          finalCount: resolved.finalCount,
          filters:
            kind === "verification"
              ? { registrationStatus: "submitted_unverified" }
              : { acceptanceStatus: "accepted", registrationStatus: "submitted_verified", paymentStatus: "due" }
        });
      } catch (err) {
        setQuickActionMessage(getApiErrorMessage(err, "Quick-Aktion fehlgeschlagen."));
      } finally {
        setQuickActionBusy(null);
      }
    },
    [canManageCommunication, quickActionBusy]
  );

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
      setSummary(normalizeDashboardSummary(response.summary));
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
  const medianDriverAge = summary.driverAgeStats.medianDriverAge;
  const youngestDriverAge = summary.driverAgeStats.youngestDriverAge;
  const oldestDriverAge = summary.driverAgeStats.oldestDriverAge;
  const oldestDriverLabel = summary.driverAgeStats.oldestDriverLabel?.trim() || "—";
  const ageRangeText =
    typeof youngestDriverAge === "number" && typeof oldestDriverAge === "number"
      ? `${formatAge(youngestDriverAge)} - ${formatAge(oldestDriverAge)} J.`
      : "—";

  const classDistributionSorted = useMemo(
    () => [...classDistribution].sort((left, right) => right.count - left.count),
    [classDistribution]
  );
  const topClasses = classDistributionSorted.slice(0, 5);
  const totalClassEntries = classDistributionSorted.reduce((sum, item) => sum + item.count, 0);
  const shownClassEntries = topClasses.reduce((sum, item) => sum + item.count, 0);
  const otherClassEntries = Math.max(0, totalClassEntries - shownClassEntries);
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

  const loadBrandDistribution = useCallback(async () => {
    setAdvancedLoading(true);
    setAdvancedError("");
    try {
      const filter = {
        query: "",
        classId: "all",
        acceptanceStatus: "all",
        paymentStatus: "all",
        checkinIdVerified: "all",
        sortBy: "createdAt",
        sortDir: "desc"
      } as const;

      const seenIds = new Set<string>();
      const brandCounts = new Map<string, number>();
      let cursor: string | undefined;
      let safetyCounter = 0;

      while (safetyCounter < 50) {
        safetyCounter += 1;
        const page = await adminEntriesService.listEntriesPage(filter, {
          cursor,
          limit: 100
        });

        page.entries.forEach((entry) => {
          if (seenIds.has(entry.id)) {
            return;
          }
          seenIds.add(entry.id);
          const brand = normalizeVehicleBrand(entry.vehicleLabel);
          brandCounts.set(brand, (brandCounts.get(brand) ?? 0) + 1);
        });

        if (!page.meta.hasMore || !page.meta.nextCursor) {
          break;
        }
        cursor = page.meta.nextCursor;
      }

      const total = Array.from(brandCounts.values()).reduce((sum, count) => sum + count, 0);
      const sorted = Array.from(brandCounts.entries())
        .map(([brand, count]) => ({ brand, count }))
        .sort((left, right) => right.count - left.count);

      const top = sorted.slice(0, BRAND_STATS_LIMIT);
      const otherCount = sorted.slice(BRAND_STATS_LIMIT).reduce((sum, item) => sum + item.count, 0);
      const combined = otherCount > 0 ? [...top, { brand: "Weitere Marken", count: otherCount }] : top;
      const withShare = combined.map((item) => ({
        brand: item.brand,
        count: item.count,
        sharePercent: total > 0 ? Math.round((item.count / total) * 1000) / 10 : 0
      }));

      setBrandDistribution(withShare);
    } catch (err) {
      setBrandDistribution([]);
      setAdvancedError(getApiErrorMessage(err, "Markenverteilung konnte nicht geladen werden."));
    } finally {
      setAdvancedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!advancedExpanded || brandDistribution !== null || advancedLoading) {
      return;
    }
    void loadBrandDistribution();
  }, [advancedExpanded, advancedLoading, brandDistribution, loadBrandDistribution]);

  const brandMaxCount = useMemo(() => {
    const counts = (brandDistribution ?? []).map((item) => item.count);
    return counts.length ? Math.max(...counts) : 1;
  }, [brandDistribution]);

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
              <div className="text-xs uppercase text-slate-500">Aktive Nennungen</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "…" : summary.entriesTotal}</div>
              <div className="mt-1 text-[11px] text-slate-500">Ohne archivierte/gelöschte Nennungen</div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="text-xs uppercase text-slate-500">Offene Zahlungen</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "…" : summary.paymentsDueTotal}</div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="text-xs uppercase text-slate-500">Median-Alter</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{loading ? "…" : formatAgeWithUnit(medianDriverAge)}</div>
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
                {loading ? "…" : `${paidCount} von ${summary.entriesTotal} aktiven Nennungen bezahlt`}
              </div>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-700">Fahrer-Altersspanne</span>
                <span className="font-semibold text-slate-900">{loading ? "…" : ageRangeText}</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-sky-500" style={{ width: `${loading ? 0 : 100}%` }} />
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {loading ? "…" : `Ältester Fahrer: ${oldestDriverLabel}`}
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

            {canReadOutbox && (
              <div className="pt-2">
                <div className="rounded-md border bg-white p-3">
                  <div className="text-xs font-semibold text-slate-700">Quick-Aktionen</div>
                  <div className="mt-2 flex flex-col gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!canManageCommunication || Boolean(quickActionBusy)}
                      onClick={() => void runQuickAction("verification")}
                    >
                      {quickActionBusy === "verification" ? "Wird vorbereitet..." : "Verifizierung erinnern (unverifiziert)"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!canManageCommunication || Boolean(quickActionBusy)}
                      onClick={() => void runQuickAction("payment")}
                    >
                      {quickActionBusy === "payment" ? "Wird vorbereitet..." : "Zahlung-Followup (offen)"}
                    </Button>
                  </div>
                  {quickActionMessage ? <div className="mt-2 text-xs text-slate-600">{quickActionMessage}</div> : null}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Weitere Statistiken</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={advancedLoading}
              onClick={() => setAdvancedExpanded((prev) => !prev)}
            >
              {advancedExpanded ? "Ausblenden" : "Aufklappen"}
            </Button>
          </div>
        </CardHeader>
        {advancedExpanded && (
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border bg-slate-50 p-3 text-sm">
              <span className="text-slate-700">Markenverteilung über alle Nennungen</span>
              <Button type="button" size="sm" variant="outline" disabled={advancedLoading} onClick={() => void loadBrandDistribution()}>
                {advancedLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Lädt…
                  </>
                ) : (
                  "Neu laden"
                )}
              </Button>
            </div>
            {advancedError && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{advancedError}</div>}
            {advancedLoading && <div className="text-sm text-slate-500">Markenstatistik wird geladen…</div>}
            {!advancedLoading && brandDistribution && brandDistribution.length > 0 && (
              <div className="space-y-2">
                {brandDistribution.map((item) => (
                  <div key={item.brand} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate pr-2 text-slate-700">{item.brand}</span>
                      <span className="shrink-0 font-medium text-slate-900">
                        {item.count} · {item.sharePercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.round((item.count / brandMaxCount) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!advancedLoading && brandDistribution && brandDistribution.length === 0 && (
              <div className="text-sm text-slate-500">Keine Markenstatistik verfügbar.</div>
            )}
            <div className="text-xs text-slate-500">Marken werden aus den Fahrzeugbezeichnungen der Nennungen abgeleitet.</div>
          </CardContent>
        )}
      </Card>

      {quickActionConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-4 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">{quickActionConfirm.label} senden?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Diese Aktion plant den Versand an <span className="font-semibold text-slate-900">{quickActionConfirm.finalCount}</span>{" "}
              Empfänger ein.
            </p>
            <div className="mt-3 rounded-md border bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <div>Template: {quickActionConfirm.templateKey}</div>
              {quickActionConfirm.filters.registrationStatus ? <div>Verifizierung: {quickActionConfirm.filters.registrationStatus}</div> : null}
              {quickActionConfirm.filters.acceptanceStatus ? <div>Status: {quickActionConfirm.filters.acceptanceStatus}</div> : null}
              {quickActionConfirm.filters.paymentStatus ? <div>Zahlung: {quickActionConfirm.filters.paymentStatus}</div> : null}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={confirmingQuickAction}
                onClick={() => setQuickActionConfirm(null)}
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                disabled={confirmingQuickAction}
                onClick={async () => {
                  setConfirmingQuickAction(true);
                  try {
                    const result = await communicationService.sendMail({
                      templateKey: quickActionConfirm.templateKey,
                      renderOptions: { showBadge: false, mailLabel: null },
                      filters: quickActionConfirm.filters
                    });
                    setQuickActionMessage(`Mailversand eingeplant (${result.queued} Empfänger).`);
                    setQuickActionConfirm(null);
                  } catch (err) {
                    setQuickActionMessage(getApiErrorMessage(err, "Quick-Aktion fehlgeschlagen."));
                  } finally {
                    setConfirmingQuickAction(false);
                  }
                }}
              >
                {confirmingQuickAction ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird eingeplant…
                  </>
                ) : (
                  "Ja, senden"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
