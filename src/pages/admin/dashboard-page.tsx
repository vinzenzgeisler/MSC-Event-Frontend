import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Loader2, Mail, MapPin, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminEntriesService } from "@/services/admin-entries.service";
import { communicationService } from "@/services/communication.service";
import { getAdminEventId } from "@/services/api/event-context";
import { ApiError, getApiErrorMessage, requestJson } from "@/services/api/http-client";
import type { AdminEntriesFilter } from "@/types/admin";

type DashboardSummary = {
  entriesTotal: number;
  paymentsDueTotal: number;
  paymentsPaidTotal: number;
  paymentRelevantTotal: number;
  entriesLast7DaysTotal: number;
  checkinPendingTotal: number;
  mailFailedTotal: number;
  mailQueuedTotal: number;
  exportsQueuedTotal: number;
  exportsProcessingTotal: number;
  driverAgeStats: {
    oldestDriverAge: number | null;
    oldestDriverLabel: string;
    youngestDriverAge: number | null;
    youngestDriverLabel: string;
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

type DashboardDailyActivityItem = {
  day: string;
  count: number;
};

type DashboardDriverLocationPreview = {
  entryId: string;
  driverName: string;
  className: string;
  startNumber: string;
  vehicleLabel: string;
};

type DashboardDriverLocationItem = {
  locationKey: string;
  country: string;
  zip: string;
  city: string;
  lat: number;
  lng: number;
  driverCount: number;
  entryCount: number;
  driversPreview: DashboardDriverLocationPreview[];
};

type AdminDashboardSummaryResponse = {
  ok: boolean;
  summary?: unknown;
  classDistribution?: DashboardClassDistributionItem[];
  recentEntries?: DashboardRecentEntryItem[];
  dailyActivity?: DashboardDailyActivityItem[];
};

type AdminDashboardDriverLocationsResponse = {
  ok: boolean;
  locations?: unknown;
  totalLocations?: unknown;
  totalDrivers?: unknown;
  missingLocationsTotal?: unknown;
  missingEntriesTotal?: unknown;
  maxPoints?: unknown;
};

const EMPTY_SUMMARY: DashboardSummary = {
  entriesTotal: 0,
  paymentsDueTotal: 0,
  paymentsPaidTotal: 0,
  paymentRelevantTotal: 0,
  entriesLast7DaysTotal: 0,
  checkinPendingTotal: 0,
  mailFailedTotal: 0,
  mailQueuedTotal: 0,
  exportsQueuedTotal: 0,
  exportsProcessingTotal: 0,
  driverAgeStats: {
    oldestDriverAge: null,
    oldestDriverLabel: "",
    youngestDriverAge: null,
    youngestDriverLabel: "",
    medianDriverAge: null
  }
};

const RECENT_CHANGES_LIMIT = 4;
const ACTIVITY_WINDOW_DAYS = 7;
const CLASS_COLORS = ["#0f766e", "#2563eb", "#f59e0b", "#db2777", "#7c3aed", "#64748b"];
const BRAND_STATS_LIMIT = 8;
const QUICK_ACTION_PAGE_LIMIT = 100;
const DRIVER_MAP_BOUNDS = {
  minLng: -12,
  maxLng: 32,
  minLat: 35,
  maxLat: 60
};

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

function formatDayKeyLabel(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return formatDayLabel(parsed);
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
    youngestDriverLabel: pickFirstString(sources, ["youngestDriverLabel", "youngestLabel", "youngest_driver_label"]),
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
    paymentsPaidTotal: toNullableCount(record.paymentsPaidTotal) ?? EMPTY_SUMMARY.paymentsPaidTotal,
    paymentRelevantTotal: toNullableCount(record.paymentRelevantTotal) ?? EMPTY_SUMMARY.paymentRelevantTotal,
    entriesLast7DaysTotal: toNullableCount(record.entriesLast7DaysTotal) ?? EMPTY_SUMMARY.entriesLast7DaysTotal,
    checkinPendingTotal: toNullableCount(record.checkinPendingTotal) ?? EMPTY_SUMMARY.checkinPendingTotal,
    mailFailedTotal: toNullableCount(record.mailFailedTotal) ?? EMPTY_SUMMARY.mailFailedTotal,
    mailQueuedTotal: toNullableCount(record.mailQueuedTotal) ?? EMPTY_SUMMARY.mailQueuedTotal,
    exportsQueuedTotal: toNullableCount(record.exportsQueuedTotal) ?? EMPTY_SUMMARY.exportsQueuedTotal,
    exportsProcessingTotal: toNullableCount(record.exportsProcessingTotal) ?? EMPTY_SUMMARY.exportsProcessingTotal,
    driverAgeStats: normalizeDriverAgeStats(ageStatsSource)
  };
}

function normalizeDailyActivity(activity: unknown): DashboardDailyActivityItem[] {
  if (!Array.isArray(activity)) {
    return [];
  }
  return activity
    .map((item) => {
      const record = toRecord(item);
      if (!record) {
        return null;
      }
      const day = typeof record.day === "string" ? record.day.trim() : "";
      const count = toNullableCount(record.count);
      if (!day || count === null) {
        return null;
      }
      return { day, count };
    })
    .filter((item): item is DashboardDailyActivityItem => Boolean(item));
}

function normalizeDriverLocations(payload: unknown): DashboardDriverLocationItem[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .map((item) => {
      const record = toRecord(item);
      if (!record) {
        return null;
      }
      const locationKey = typeof record.locationKey === "string" ? record.locationKey.trim() : "";
      const lat = toNullableNumber(record.lat);
      const lng = toNullableNumber(record.lng);
      const driverCount = toNullableCount(record.driverCount);
      const entryCount = toNullableCount(record.entryCount) ?? driverCount;
      if (!locationKey || lat === null || lng === null || driverCount === null) {
        return null;
      }
      const driversPreview = Array.isArray(record.driversPreview)
        ? record.driversPreview
            .map((driver) => {
              const driverRecord = toRecord(driver);
              if (!driverRecord) {
                return null;
              }
              const entryId = typeof driverRecord.entryId === "string" ? driverRecord.entryId.trim() : "";
              const driverName = typeof driverRecord.driverName === "string" ? driverRecord.driverName.trim() : "";
              if (!entryId || !driverName) {
                return null;
              }
              return {
                entryId,
                driverName,
                className: typeof driverRecord.className === "string" ? driverRecord.className.trim() : "-",
                startNumber: typeof driverRecord.startNumber === "string" ? driverRecord.startNumber.trim() : "-",
                vehicleLabel: typeof driverRecord.vehicleLabel === "string" ? driverRecord.vehicleLabel.trim() : "Fahrzeug"
              };
            })
            .filter((driver): driver is DashboardDriverLocationPreview => Boolean(driver))
        : [];

      return {
        locationKey,
        country: typeof record.country === "string" ? record.country.trim() : "",
        zip: typeof record.zip === "string" ? record.zip.trim() : "",
        city: typeof record.city === "string" ? record.city.trim() : "",
        lat,
        lng,
        driverCount,
        entryCount: entryCount ?? driverCount,
        driversPreview
      };
    })
    .filter((item): item is DashboardDriverLocationItem => Boolean(item));
}

function projectDriverLocation(location: Pick<DashboardDriverLocationItem, "lat" | "lng">) {
  const lngRatio = (location.lng - DRIVER_MAP_BOUNDS.minLng) / (DRIVER_MAP_BOUNDS.maxLng - DRIVER_MAP_BOUNDS.minLng);
  const latRatio = (DRIVER_MAP_BOUNDS.maxLat - location.lat) / (DRIVER_MAP_BOUNDS.maxLat - DRIVER_MAP_BOUNDS.minLat);
  return {
    x: Math.min(620, Math.max(20, 20 + lngRatio * 600)),
    y: Math.min(300, Math.max(20, 20 + latRatio * 280))
  };
}

function formatLocationLabel(location: Pick<DashboardDriverLocationItem, "city" | "zip" | "country">) {
  const cityLine = [location.zip, location.city].filter(Boolean).join(" ");
  return [cityLine, location.country].filter(Boolean).join(", ") || "Unbekannter Ort";
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
  const [serverDailyActivity, setServerDailyActivity] = useState<DashboardDailyActivityItem[]>([]);
  const [driverLocations, setDriverLocations] = useState<DashboardDriverLocationItem[]>([]);
  const [driverLocationsLoading, setDriverLocationsLoading] = useState(false);
  const [driverLocationsError, setDriverLocationsError] = useState("");
  const [driverLocationsMeta, setDriverLocationsMeta] = useState({
    totalLocations: 0,
    totalDrivers: 0,
    missingLocationsTotal: 0,
    missingEntriesTotal: 0,
    maxPoints: 0
  });
  const [selectedDriverLocationKey, setSelectedDriverLocationKey] = useState<string | null>(null);
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
    kind: "verification" | "payment";
    label: string;
    entryIds: string[];
    finalCount: number;
  }>(null);
  const [confirmingQuickAction, setConfirmingQuickAction] = useState(false);

  const canReadOutbox = hasPermission(roles, "communication.read");
  const canManageCommunication = hasPermission(roles, "communication.write");

  const collectQuickActionEntryIds = useCallback(async (kind: "verification" | "payment") => {
    const filter: AdminEntriesFilter =
      kind === "payment"
        ? {
            query: "",
            classId: "all",
            acceptanceStatus: "accepted",
            registrationStatus: "all",
            paymentStatus: "due",
            checkinIdVerified: "all",
            sortBy: "createdAt",
            sortDir: "desc"
          }
        : {
            query: "",
            classId: "all",
            acceptanceStatus: "all",
            registrationStatus: "all",
            paymentStatus: "all",
            checkinIdVerified: "all",
            sortBy: "createdAt",
            sortDir: "desc"
          };

    const entryIds: string[] = [];
    let cursor: string | undefined;
    let safety = 0;

    while (safety < 80) {
      safety += 1;
      const page = await adminEntriesService.listEntriesPage(filter, {
        cursor,
        limit: QUICK_ACTION_PAGE_LIMIT
      });
      for (const row of page.entries) {
        if (kind === "verification" && row.confirmationMailVerified) {
          continue;
        }
        entryIds.push(row.id);
      }
      if (!page.meta.hasMore || !page.meta.nextCursor) {
        break;
      }
      cursor = page.meta.nextCursor;
    }

    return Array.from(new Set(entryIds));
  }, []);

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
        const label = kind === "verification" ? "Erneute Verifizierung" : "Zahlungserinnerung";
        const entryIds = await collectQuickActionEntryIds(kind);
        if (entryIds.length < 1) {
          setQuickActionMessage("Keine passenden Empfänger gefunden.");
          return;
        }

        setQuickActionConfirm({
          kind,
          label,
          entryIds,
          finalCount: entryIds.length
        });
      } catch (err) {
        setQuickActionMessage(getApiErrorMessage(err, "Quick-Aktion fehlgeschlagen."));
      } finally {
        setQuickActionBusy(null);
      }
    },
    [canManageCommunication, collectQuickActionEntryIds, quickActionBusy]
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
      setServerDailyActivity(normalizeDailyActivity(response.dailyActivity));
    } catch (err) {
      setSummary(EMPTY_SUMMARY);
      setClassDistribution([]);
      setRecentEntries([]);
      setServerDailyActivity([]);
      if (err instanceof ApiError && err.status === 404 && err.code === "NOT_FOUND") {
        setError("Aktuell ist kein Event als laufendes Event markiert. Bitte im Admin unter Einstellungen ein Event als aktuell anlegen oder aktivieren.");
      } else {
        setError(getApiErrorMessage(err, "Dashboard-Daten konnten nicht geladen werden."));
      }
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  const loadDriverLocations = useCallback(async () => {
    setDriverLocationsLoading(true);
    setDriverLocationsError("");
    try {
      const eventId = await getAdminEventId();
      const response = await requestJson<AdminDashboardDriverLocationsResponse>("/admin/dashboard/driver-locations", {
        query: {
          eventId
        }
      });
      const locations = normalizeDriverLocations(response.locations);
      setDriverLocations(locations);
      setDriverLocationsMeta({
        totalLocations: toNullableCount(response.totalLocations) ?? locations.length,
        totalDrivers: toNullableCount(response.totalDrivers) ?? locations.reduce((sum, item) => sum + item.driverCount, 0),
        missingLocationsTotal: toNullableCount(response.missingLocationsTotal) ?? 0,
        missingEntriesTotal: toNullableCount(response.missingEntriesTotal) ?? 0,
        maxPoints: toNullableCount(response.maxPoints) ?? 0
      });
      setSelectedDriverLocationKey((prev) => (prev && locations.some((item) => item.locationKey === prev) ? prev : locations[0]?.locationKey ?? null));
    } catch (err) {
      setDriverLocations([]);
      setDriverLocationsMeta({
        totalLocations: 0,
        totalDrivers: 0,
        missingLocationsTotal: 0,
        missingEntriesTotal: 0,
        maxPoints: 0
      });
      setSelectedDriverLocationKey(null);
      setDriverLocationsError(getApiErrorMessage(err, "Fahrerkarte konnte nicht geladen werden."));
    } finally {
      setDriverLocationsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (loading) {
      return;
    }
    void loadDriverLocations();
  }, [loadDriverLocations, loading]);

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

  const paymentRelevantTotal = Math.max(0, summary.paymentRelevantTotal);
  const paidCount = Math.min(Math.max(0, summary.paymentsPaidTotal), paymentRelevantTotal);
  const paymentCompletionPercent = paymentRelevantTotal > 0 ? Math.round((paidCount / paymentRelevantTotal) * 100) : 0;

  const dailyActivity = useMemo(() => {
    if (serverDailyActivity.length > 0) {
      return serverDailyActivity.map((item) => ({
        key: item.day,
        label: formatDayKeyLabel(item.day),
        count: item.count
      }));
    }

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
  }, [recentEntries, serverDailyActivity]);
  const maxDailyCount = Math.max(1, ...dailyActivity.map((item) => item.count));
  const newEntriesLast7Days = serverDailyActivity.length > 0
    ? summary.entriesLast7DaysTotal
    : dailyActivity.reduce((sum, item) => sum + item.count, 0);
  const medianDriverAge = summary.driverAgeStats.medianDriverAge;
  const youngestDriverAge = summary.driverAgeStats.youngestDriverAge;
  const youngestDriverLabel = summary.driverAgeStats.youngestDriverLabel?.trim() || "—";
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
        registrationStatus: "all",
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
  const maxDriverLocationCount = useMemo(() => Math.max(1, ...driverLocations.map((item) => item.driverCount)), [driverLocations]);
  const selectedDriverLocation = useMemo(
    () => driverLocations.find((item) => item.locationKey === selectedDriverLocationKey) ?? driverLocations[0] ?? null,
    [driverLocations, selectedDriverLocationKey]
  );

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
    <div className="flex flex-col gap-5">
      <Card className="border-slate-200 bg-gradient-to-r from-white via-slate-50 to-emerald-50/60">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600">Statistischer Überblick mit Fokus auf operative Entscheidungen.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading || refreshing}
                onClick={() => {
                  void loadDashboard({ refresh: true });
                  void loadDriverLocations();
                }}
              >
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
                {loading ? "…" : `${paidCount} von ${paymentRelevantTotal} zugelassenen Nennungen bezahlt`}
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
              <div className="mt-1 space-y-1 text-xs text-slate-500">
                <div>{loading ? "…" : `Jüngster Fahrer: ${youngestDriverLabel}`}</div>
                <div>{loading ? "…" : `Ältester Fahrer: ${oldestDriverLabel}`}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">Fahrer-Herkunft</CardTitle>
              <p className="mt-1 text-xs text-slate-500">Ort/PLZ-Cluster aus gecachten Koordinaten, getrennt vom Dashboard-Start geladen.</p>
            </div>
            <Button type="button" size="sm" variant="outline" disabled={driverLocationsLoading} onClick={() => void loadDriverLocations()}>
              {driverLocationsLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Lädt…
                </>
              ) : (
                "Neu laden"
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {driverLocationsError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{driverLocationsError}</div>
          )}
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <div className="overflow-hidden rounded-lg border bg-slate-50">
              <div className="relative aspect-[16/9] min-h-72">
                {driverLocationsLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm text-slate-600">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fahrerkarte wird geladen…
                  </div>
                )}
                <svg className="h-full w-full" viewBox="0 0 640 360" role="img" aria-label="Fahrer-Herkunftskarte">
                  <rect width="640" height="360" fill="#f8fafc" />
                  <path d="M20 188 H620 M20 244 H620 M20 300 H620 M156 20 V332 M292 20 V332 M429 20 V332 M565 20 V332" fill="none" stroke="#e2e8f0" strokeWidth="1" />
                  <path
                    d="M111 66 L156 47 L229 50 L281 69 L349 63 L424 80 L499 116 L546 169 L531 222 L471 264 L399 279 L333 258 L267 270 L204 248 L151 207 L105 151 Z"
                    fill="#e2e8f0"
                    stroke="#cbd5e1"
                    strokeWidth="2"
                  />
                  <path
                    d="M262 97 L288 81 L323 82 L348 98 L342 129 L316 145 L285 140 L265 120 Z"
                    fill="#dbeafe"
                    stroke="#93c5fd"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M288 81 L318 69 L369 76 L374 102 L348 98 L323 82 Z"
                    fill="#eef2ff"
                    stroke="#c7d2fe"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M342 129 L383 121 L421 139 L405 167 L361 160 L316 145 Z"
                    fill="#ecfdf5"
                    stroke="#bbf7d0"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M265 120 L236 132 L225 162 L251 181 L285 140 Z"
                    fill="#f1f5f9"
                    stroke="#cbd5e1"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M285 140 L316 145 L361 160 L349 197 L303 201 L251 181 Z"
                    fill="#fef3c7"
                    stroke="#fde68a"
                    strokeWidth="1.2"
                  />
                  <path d="M348 98 L383 121 M316 145 L303 201 M285 140 L262 97" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.55" />
                  <text x="301" y="118" fill="#1d4ed8" fontSize="16" fontWeight="700" textAnchor="middle">
                    DE
                  </text>
                  <text x="345" y="91" fill="#64748b" fontSize="11" fontWeight="600" textAnchor="middle">
                    PL
                  </text>
                  <text x="371" y="151" fill="#64748b" fontSize="11" fontWeight="600" textAnchor="middle">
                    CZ
                  </text>
                  <text x="247" y="154" fill="#64748b" fontSize="11" fontWeight="600" textAnchor="middle">
                    FR
                  </text>
                  <text x="311" y="181" fill="#64748b" fontSize="11" fontWeight="600" textAnchor="middle">
                    AT
                  </text>
                  <text x="28" y="334" fill="#94a3b8" fontSize="12">
                    Vereinfachte Europa-Karte · Marker nach Ort/PLZ
                  </text>
                  {driverLocations.map((location) => {
                    const point = projectDriverLocation(location);
                    const selected = selectedDriverLocation?.locationKey === location.locationKey;
                    const radius = Math.max(7, Math.min(24, 7 + (location.driverCount / maxDriverLocationCount) * 17));
                    return (
                      <g
                        key={location.locationKey}
                        role="button"
                        tabIndex={0}
                        aria-label={`${formatLocationLabel(location)}: ${location.driverCount} Fahrer`}
                        className="cursor-pointer outline-none"
                        onClick={() => setSelectedDriverLocationKey(location.locationKey)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedDriverLocationKey(location.locationKey);
                          }
                        }}
                      >
                        <circle cx={point.x} cy={point.y} r={radius + 3} fill={selected ? "#f59e0b" : "#2563eb"} opacity="0.18" />
                        <circle cx={point.x} cy={point.y} r={radius} fill={selected ? "#f59e0b" : "#2563eb"} opacity="0.82" />
                        <circle cx={point.x} cy={point.y} r="2.5" fill="#ffffff" />
                        <title>{`${formatLocationLabel(location)} · ${location.driverCount} Fahrer`}</title>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border bg-white p-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md border bg-slate-50 p-2">
                  <div className="text-xs text-slate-500">Orte mit Koordinaten</div>
                  <div className="font-semibold text-slate-900">{driverLocations.length}</div>
                </div>
                <div className="rounded-md border bg-slate-50 p-2">
                  <div className="text-xs text-slate-500">Fahrer auf Karte</div>
                  <div className="font-semibold text-slate-900">{driverLocations.reduce((sum, item) => sum + item.driverCount, 0)}</div>
                </div>
              </div>
              {driverLocationsMeta.missingLocationsTotal > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {driverLocationsMeta.missingLocationsTotal} Orte mit {driverLocationsMeta.missingEntriesTotal} Fahrern haben noch keine gecachten Koordinaten.
                </div>
              )}
              {!driverLocationsLoading && driverLocations.length === 0 && !driverLocationsError && (
                <div className="rounded-md border border-dashed p-3 text-sm text-slate-500">
                  Noch keine Fahrerorte mit Koordinaten verfügbar.
                </div>
              )}
              {selectedDriverLocation && (
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <MapPin className="h-4 w-4 text-primary" />
                      {formatLocationLabel(selectedDriverLocation)}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {selectedDriverLocation.driverCount} Fahrer · {selectedDriverLocation.entryCount} Nennungen
                    </div>
                  </div>
                  <div className="space-y-2">
                    {selectedDriverLocation.driversPreview.map((driver) => (
                      <Link key={driver.entryId} to={`/admin/entries/${driver.entryId}`} className="block rounded-md border p-2 text-sm transition hover:bg-slate-50">
                        <div className="font-medium text-slate-900">{driver.driverName}</div>
                        <div className="text-xs text-slate-600">
                          {driver.className} · #{driver.startNumber}
                        </div>
                        <div className="truncate text-xs text-slate-500">{driver.vehicleLabel}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
                <div className="text-xs text-slate-500">Neue Nennungen pro Kalendertag.</div>
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
                  <div className="relative h-36 w-36 rounded-full sm:h-44 sm:w-44" style={{ background: donutGradient }}>
                    <div className="absolute inset-[18%] flex flex-col items-center justify-center rounded-full bg-white px-2 text-center">
                      <div className="text-[11px] uppercase text-slate-500">Nennungen</div>
                      <div className="text-2xl font-semibold text-slate-900">{totalClassEntries}</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {classLegendItems.map((item, index) => {
                    const percentage = totalClassEntries > 0 ? Math.round((item.count / totalClassEntries) * 100) : 0;
                    return (
                      <div key={item.classId} className="flex flex-col gap-1 rounded border p-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CLASS_COLORS[index % CLASS_COLORS.length] }} />
                          <span className="break-words text-slate-700">{item.className}</span>
                        </div>
                        <span className="shrink-0 pl-4 font-medium text-slate-900 sm:pl-2">
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
                      {quickActionBusy === "verification" ? "Wird vorbereitet..." : "Erneute Verifizierung senden"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!canManageCommunication || Boolean(quickActionBusy)}
                      onClick={() => void runQuickAction("payment")}
                    >
                      {quickActionBusy === "payment" ? "Wird vorbereitet..." : "Offene Zahlungen erinnern"}
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
              <div>Typ: {quickActionConfirm.kind === "verification" ? "Erneute Verifizierung (Prozessmail)" : "Zahlungserinnerung"}</div>
              <div>Einträge: {quickActionConfirm.entryIds.length}</div>
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
                    let queuedTotal = 0;
                    let skippedTotal = 0;
                    for (const entryId of quickActionConfirm.entryIds) {
                      const result =
                        quickActionConfirm.kind === "verification"
                          ? await communicationService.queueVerificationMailForEntry(entryId, { allowDuplicate: true })
                          : await communicationService.queuePaymentReminderForEntry(entryId, { allowDuplicate: true });
                      queuedTotal += result.queued;
                      skippedTotal += result.skipped;
                    }
                    setQuickActionMessage(
                      `Quick-Aktion eingeplant: ${queuedTotal} gesendet${skippedTotal > 0 ? `, ${skippedTotal} übersprungen` : ""}.`
                    );
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
