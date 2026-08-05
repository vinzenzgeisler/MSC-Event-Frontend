import { requestJson } from "@/services/api/http-client";
import type { DashboardDriverLocationItem, DashboardDriverLocationsMeta } from "@/components/features/admin/driver-origin-map";

export type DashboardSeverity = "ok" | "warning" | "critical";

export type DashboardWarningCheck = {
  code: string;
  severity: DashboardSeverity;
  title: string;
  description: string;
  count: number;
  status: "ok" | "active";
  actionHint: string | null;
  samples: Record<string, unknown>[];
};

export type DashboardWarningBundle = {
  checkedAt: string;
  summary: {
    severity: DashboardSeverity;
    activeCheckTotal: number;
    criticalTotal: number;
    warningTotal: number;
    issueTotal: number;
  };
  checks: DashboardWarningCheck[];
};

export type DashboardOverview = {
  generatedAt: string;
  event: {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
    status: string;
    isCurrent: boolean;
    registrationOpenAt: string | null;
    registrationCloseAt: string | null;
  };
  health: {
    severity: DashboardSeverity;
    globalCriticalTotal: number;
    eventWarningTotal: number;
    issueTotal: number;
    checkedAt: string;
  };
  kpis: Record<string, number>;
  warnings: {
    global: DashboardWarningBundle;
    event: DashboardWarningBundle;
  };
  registrations: Record<string, unknown>;
  finance: Record<string, unknown>;
  communication: Record<string, unknown> & { templates?: Array<Record<string, unknown>> };
  drivers: Record<string, unknown> & { countries?: Array<Record<string, unknown>>; cities?: Array<Record<string, unknown>> };
  vehicles: Record<string, unknown> & { brands?: Array<Record<string, unknown>> };
  classes: Array<Record<string, unknown>>;
  operations: Record<string, unknown>;
  documents: Record<string, unknown> & { byType?: Array<Record<string, unknown>> };
  activity: { last7Days?: Array<Record<string, unknown>>; last30Days?: Array<Record<string, unknown>> };
  distributions: Record<string, unknown>;
  map: Record<string, unknown>;
  niceToKnow: Record<string, unknown>;
};

export type DashboardDriverLocationsResponse = DashboardDriverLocationsMeta & {
  ok: boolean;
  locations?: unknown;
  pendingGeocodeTotal?: number;
  geocodeAttemptedTotal?: number;
  geocodeResolvedTotal?: number;
  autoRefreshTriggered?: boolean;
  hasPendingGeocoding?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toStringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeSeverity(value: unknown): DashboardSeverity {
  return value === "critical" || value === "warning" ? value : "ok";
}

function normalizeWarningBundle(value: unknown): DashboardWarningBundle {
  const record = isRecord(value) ? value : {};
  const summary = isRecord(record.summary) ? record.summary : {};
  const checks = Array.isArray(record.checks) ? record.checks : [];
  return {
    checkedAt: toStringValue(record.checkedAt),
    summary: {
      severity: normalizeSeverity(summary.severity),
      activeCheckTotal: toNumber(summary.activeCheckTotal),
      criticalTotal: toNumber(summary.criticalTotal),
      warningTotal: toNumber(summary.warningTotal),
      issueTotal: toNumber(summary.issueTotal)
    },
    checks: checks
      .map((item) => {
        if (!isRecord(item)) return null;
        const code = toStringValue(item.code);
        const title = toStringValue(item.title);
        if (!code || !title) return null;
        const count = toNumber(item.count);
        return {
          code,
          title,
          count,
          severity: normalizeSeverity(item.severity),
          description: toStringValue(item.description),
          status: item.status === "active" || count > 0 ? "active" : "ok",
          actionHint: toStringValue(item.actionHint) || null,
          samples: Array.isArray(item.samples) ? item.samples.filter(isRecord) : []
        } satisfies DashboardWarningCheck;
      })
      .filter((item): item is DashboardWarningCheck => Boolean(item))
  };
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function normalizeRows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function numberValue(record: Record<string, unknown> | undefined, key: string): number {
  return toNumber(record?.[key]);
}

export function textValue(record: Record<string, unknown> | undefined, key: string, fallback = ""): string {
  return toStringValue(record?.[key], fallback);
}

export function rowsValue(record: Record<string, unknown> | undefined, key: string): Array<Record<string, unknown>> {
  return normalizeRows(record?.[key]);
}

export function formatMoney(cents: unknown): string {
  const value = toNumber(cents) / 100;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

export function formatDateTime(value: unknown): string {
  const text = toStringValue(value);
  if (!text) return "-";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleString("de-DE");
}

function normalizeOverview(value: unknown): DashboardOverview {
  const record = normalizeRecord(value);
  const event = normalizeRecord(record.event);
  const health = normalizeRecord(record.health);
  const warnings = normalizeRecord(record.warnings);
  return {
    generatedAt: toStringValue(record.generatedAt),
    event: {
      id: toStringValue(event.id),
      name: toStringValue(event.name, "Aktuelles Event"),
      startsAt: toStringValue(event.startsAt),
      endsAt: toStringValue(event.endsAt),
      status: toStringValue(event.status),
      isCurrent: Boolean(event.isCurrent),
      registrationOpenAt: toStringValue(event.registrationOpenAt) || null,
      registrationCloseAt: toStringValue(event.registrationCloseAt) || null
    },
    health: {
      severity: normalizeSeverity(health.severity),
      globalCriticalTotal: toNumber(health.globalCriticalTotal),
      eventWarningTotal: toNumber(health.eventWarningTotal),
      issueTotal: toNumber(health.issueTotal),
      checkedAt: toStringValue(health.checkedAt)
    },
    kpis: normalizeRecord(record.kpis) as Record<string, number>,
    warnings: {
      global: normalizeWarningBundle(warnings.global),
      event: normalizeWarningBundle(warnings.event)
    },
    registrations: normalizeRecord(record.registrations),
    finance: normalizeRecord(record.finance),
    communication: normalizeRecord(record.communication),
    drivers: normalizeRecord(record.drivers),
    vehicles: normalizeRecord(record.vehicles),
    classes: normalizeRows(record.classes),
    operations: normalizeRecord(record.operations),
    documents: normalizeRecord(record.documents),
    activity: normalizeRecord(record.activity) as DashboardOverview["activity"],
    distributions: normalizeRecord(record.distributions),
    map: normalizeRecord(record.map),
    niceToKnow: normalizeRecord(record.niceToKnow)
  };
}

function normalizeDriverLocations(payload: unknown): DashboardDriverLocationItem[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item) => {
      if (!isRecord(item)) return null;
      const drivers = Array.isArray(item.drivers)
        ? item.drivers
            .filter(isRecord)
            .map((driver) => ({
              entryId: toStringValue(driver.entryId),
              driverName: toStringValue(driver.driverName, "Fahrer"),
              className: toStringValue(driver.className, "-"),
              startNumber: toStringValue(driver.startNumber, "-"),
              vehicleLabel: toStringValue(driver.vehicleLabel, "Fahrzeug"),
              acceptanceStatus: toStringValue(driver.acceptanceStatus, "pending") as DashboardDriverLocationItem["drivers"][number]["acceptanceStatus"],
              registrationStatus: toStringValue(driver.registrationStatus, "submitted_verified") as DashboardDriverLocationItem["drivers"][number]["registrationStatus"]
            }))
        : [];
      const lat = toNumber(item.lat);
      const lng = toNumber(item.lng);
      if (!toStringValue(item.locationKey) || !lat || !lng) return null;
      return {
        locationKey: toStringValue(item.locationKey),
        country: toStringValue(item.country),
        zip: toStringValue(item.zip),
        city: toStringValue(item.city),
        lat,
        lng,
        driverCount: toNumber(item.driverCount),
        entryCount: toNumber(item.entryCount),
        drivers
      } satisfies DashboardDriverLocationItem;
    })
    .filter((item): item is DashboardDriverLocationItem => Boolean(item));
}

export const adminDashboardService = {
  async getOverview(eventId: string, sampleLimit = 8) {
    const response = await requestJson<unknown>("/admin/dashboard/overview", { query: { eventId, sampleLimit } });
    return normalizeOverview(response);
  },

  async getDriverLocations(eventId: string, options: { refresh?: boolean; refreshLimit?: number } = {}) {
    const response = await requestJson<DashboardDriverLocationsResponse>("/admin/dashboard/driver-locations", {
      query: { eventId, refresh: options.refresh ? true : undefined, refreshLimit: options.refreshLimit }
    });
    return {
      locations: normalizeDriverLocations(response.locations),
      meta: {
        totalLocations: toNumber(response.totalLocations),
        totalDrivers: toNumber(response.totalDrivers),
        missingLocationsTotal: toNumber(response.missingLocationsTotal),
        missingEntriesTotal: toNumber(response.missingEntriesTotal),
        pendingGeocodeTotal: toNumber(response.pendingGeocodeTotal),
        geocodeAttemptedTotal: toNumber(response.geocodeAttemptedTotal),
        geocodeResolvedTotal: toNumber(response.geocodeResolvedTotal),
        autoRefreshTriggered: Boolean(response.autoRefreshTriggered),
        hasPendingGeocoding: Boolean(response.hasPendingGeocoding),
        maxPoints: toNumber(response.maxPoints)
      }
    };
  },

  async queueMissingLifecycleMails(input: { eventId?: string; limit?: number; dryRun?: boolean }) {
    return requestJson<{ ok: boolean; affected: number; queued: number; skipped: number; dryRun: boolean; errors?: Array<Record<string, unknown>> }>(
      "/admin/dashboard/actions/queue-missing-lifecycle-mails",
      { method: "POST", body: input }
    );
  }
};