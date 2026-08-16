import { demoEntryConfirmationConfig, demoLegalTexts, DEMO_EVENT_ID, createDemoState } from "@/demo/fixtures";
import { demoIdentity } from "@/demo/config";
import type { DemoEntry, DemoRequestOptions } from "@/demo/types";
import type { AdminEntryDetailDto, AdminEntryListItemDto, MailTemplate } from "@/types/admin";
import type { AdminSettingsClass, AdminSettingsEvent } from "@/types/admin-settings";
import type { TechStatus } from "@/types/common";

const state = createDemoState();

function bodyRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

function nextId(prefix: string) {
  state.counter += 1;
  return `${prefix}-demo-${state.counter}`;
}

function now() {
  return new Date().toISOString();
}

function pathInfo(path: string) {
  const parsed = new URL(path, "http://demo.local");
  return { pathname: parsed.pathname, searchParams: parsed.searchParams };
}

function getQuery(options: DemoRequestOptions, searchParams: URLSearchParams, key: string) {
  const value = options.query?.[key];
  return value === undefined || value === null ? searchParams.get(key) ?? undefined : String(value);
}

function currentEvent() {
  return state.events.find((event) => event.isCurrent) ?? state.events[0];
}

function findEntry(entryId: string) {
  const entry = state.entries.find((item) => item.detail.ids.entryId === entryId);
  if (!entry) throw new Error(`DEMO_API_NOT_FOUND: Nennung ${entryId} existiert in den Demo-Daten nicht.`);
  return entry;
}

function entryListDto(entry: DemoEntry): AdminEntryListItemDto {
  const detail = entry.detail;
  return {
    id: detail.ids.entryId,
    eventId: detail.ids.eventId,
    classId: detail.ids.classId,
    groupId: null,
    groupSize: 1,
    vehicleId: detail.ids.vehicleId,
    name: [detail.person.driver.firstName, detail.person.driver.lastName].filter(Boolean).join(" "),
    className: detail.className,
    startNumber: detail.startNumberNorm,
    startNumberNorm: detail.startNumberNorm,
    driverPersonId: detail.ids.driverPersonId,
    driverFirstName: detail.person.driver.firstName,
    driverLastName: detail.person.driver.lastName,
    driverEmail: detail.person.driver.email,
    orgaCode: detail.orgaCode,
    vehicleLabel: detail.vehicleLabel ?? [detail.vehicle.make, detail.vehicle.model].filter(Boolean).join(" "),
    vehicleThumbUrl: detail.vehicleThumbUrl ?? null,
    registrationStatus: detail.registrationStatus,
    acceptanceStatus: detail.acceptanceStatus,
    withdrawnReason: detail.withdrawnReason ?? null,
    withdrawnAt: detail.withdrawnAt ?? null,
    withdrawnBy: detail.withdrawnBy ?? null,
    paymentStatus: detail.payment.paymentStatus,
    checkinIdVerified: detail.checkin.checkinIdVerified,
    techStatus: detail.checkin.techStatus,
    techCheckedAt: detail.checkin.techCheckedAt,
    techCheckedBy: detail.checkin.techCheckedBy,
    confirmationMailVerified: detail.confirmationMailVerified,
    confirmationMailSent: Boolean(detail.confirmationMailSent),
    waiverSigned: detail.waiverSigned,
    internalNote: detail.internalNote ?? null,
    driverNote: detail.driverNote ?? null,
    inspectionNote: detail.inspectionNote ?? null,
    deletedAt: entry.deletedAt ?? null,
    deletedByDisplay: entry.deletedByDisplay ?? null,
    deleteReason: entry.deleteReason ?? null,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt
  };
}

function filteredEntries(options: DemoRequestOptions, searchParams: URLSearchParams, deleted: boolean) {
  const q = (getQuery(options, searchParams, "q") ?? "").toLowerCase();
  const classId = getQuery(options, searchParams, "classId");
  const acceptanceStatus = getQuery(options, searchParams, "acceptanceStatus");
  const registrationStatus = getQuery(options, searchParams, "registrationStatus");
  const paymentStatus = getQuery(options, searchParams, "paymentStatus");
  const checked = getQuery(options, searchParams, "checkinIdVerified");
  return state.entries.filter((entry) => {
    const detail = entry.detail;
    const haystack = [detail.person.driver.firstName, detail.person.driver.lastName, detail.person.driver.email, detail.orgaCode, detail.startNumberNorm, detail.className, detail.vehicleLabel].join(" ").toLowerCase();
    return Boolean(entry.deletedAt) === deleted && (!q || haystack.includes(q)) && (!classId || detail.ids.classId === classId) && (!acceptanceStatus || detail.acceptanceStatus === acceptanceStatus) && (!registrationStatus || detail.registrationStatus === registrationStatus) && (!paymentStatus || detail.payment.paymentStatus === paymentStatus) && (checked === undefined || String(detail.checkin.checkinIdVerified) === checked);
  });
}

function listResponse(entries: DemoEntry[]) {
  return { ok: true, entries: entries.map(entryListDto), meta: { page: 1, pageSize: 25, total: entries.length, hasMore: false, nextCursor: null } };
}

function publicEventResponse() {
  const event = currentEvent();
  return {
    ok: true,
    event: { id: event.id, name: event.name, startsAt: event.startsAt, endsAt: event.endsAt, status: event.status, isCurrent: event.isCurrent, registrationOpenAt: event.registrationOpenAt, registrationCloseAt: event.registrationCloseAt, contactEmail: event.contactEmail, websiteUrl: event.websiteUrl },
    classes: state.classes.filter((item) => item.eventId === event.id).map((item) => ({ ...item, selectionGroupKey: item.runGroupId ?? item.id })),
    registration: { isOpen: event.status === "open", reason: null },
    invitation: null,
    pricingRules: pricingRules(event.id)
  };
}

function pricingRules(eventId: string) {
  const stored = state.pricingRules[eventId];
  if (stored) return stored;
  const classes = state.classes.filter((item) => item.eventId === eventId);
  return { eventId, earlyDeadline: "2026-08-15T21:59:00.000Z", lateFeeCents: 2000, secondVehicleDiscountCents: 2500, currency: "EUR", classRules: classes.map((item) => ({ classId: item.id, className: item.name, baseFeeCents: item.vehicleType === "moto" ? 9500 : 12500 })) };
}

function inspectionEntry(detail: AdminEntryDetailDto) {
  return {
    id: detail.ids.entryId, eventId: detail.ids.eventId, startNumber: detail.startNumberNorm, orgaCode: detail.orgaCode ?? null, acceptanceStatus: detail.acceptanceStatus,
    driverFirstName: detail.person.driver.firstName ?? "", driverLastName: detail.person.driver.lastName ?? "", codriverPersonId: detail.ids.codriverPersonId,
    codriver: detail.person.codriver ? { firstName: detail.person.codriver.firstName ?? "", lastName: detail.person.codriver.lastName ?? "", birthdate: detail.person.codriver.birthdate, country: detail.person.codriver.country ?? null } : null,
    className: detail.className, vehicleType: detail.vehicle.vehicleType, vehicleMake: detail.vehicle.make, vehicleModel: detail.vehicle.model, vehicleYear: detail.vehicle.year,
    displacementCcm: detail.vehicle.displacementCcm, engineType: detail.vehicle.engineType, cylinders: detail.vehicle.cylinders, brakes: detail.vehicle.brakes, vehicleHistory: detail.vehicle.vehicleHistory,
    vehicleImageUrl: detail.vehicleThumbUrl ?? null, inspectionNote: detail.inspectionNote ?? null, backupInspectionNote: null, backupVehicleId: detail.ids.backupVehicleId ?? null,
    backupVehicle: detail.backupVehicle ? { vehicleType: detail.backupVehicle.vehicleType, make: detail.backupVehicle.make, model: detail.backupVehicle.model, year: detail.backupVehicle.year, displacementCcm: detail.backupVehicle.displacementCcm, engineType: detail.backupVehicle.engineType, cylinders: detail.backupVehicle.cylinders, vehicleHistory: detail.backupVehicle.vehicleHistory, imageUrl: detail.backupVehicleThumbUrl ?? null } : null,
    techStatus: detail.checkin.techStatus, techCheckedAt: detail.checkin.techCheckedAt, techCheckedBy: detail.checkin.techCheckedBy,
    backupTechStatus: "pending" as TechStatus, backupTechCheckedAt: null, backupTechCheckedBy: null
  };
}

function dashboardOverview() {
  const entries = state.entries.filter((entry) => !entry.deletedAt);
  const accepted = entries.filter((entry) => entry.detail.acceptanceStatus === "accepted").length;
  const due = entries.filter((entry) => entry.detail.payment.paymentStatus === "due");
  const openCents = due.reduce((sum, entry) => sum + (entry.detail.payment.amountOpenCents ?? 0), 0);
  const checks = [{ code: "open_payments", severity: "warning", title: "Offene Zahlungen", description: "Einige fiktive Zahlungen sind noch offen.", count: due.length, status: "active", actionHint: "Details in der Nennungsliste", samples: due.slice(0, 2).map((entry) => ({ driverName: `${entry.detail.person.driver.firstName} ${entry.detail.person.driver.lastName}`, startNumber: entry.detail.startNumberNorm })) }];
  const warningBundle = { checkedAt: now(), summary: { severity: "warning", activeCheckTotal: 1, criticalTotal: 0, warningTotal: 1, issueTotal: due.length }, checks };
  return {
    generatedAt: now(), event: currentEvent(), health: { severity: "warning", globalCriticalTotal: 0, eventWarningTotal: 1, issueTotal: due.length, checkedAt: now() },
    kpis: { entriesTotal: entries.length, acceptedTotal: accepted, paymentsDueTotal: due.length, mailFailedTotal: 0, new7DaysTotal: 2 }, warnings: { global: { ...warningBundle, summary: { ...warningBundle.summary, severity: "ok", activeCheckTotal: 0, warningTotal: 0, issueTotal: 0 }, checks: [] }, event: warningBundle },
    registrations: { acceptanceRatePercent: Math.round((accepted / entries.length) * 100), byStatus: ["pending", "shortlist", "accepted", "rejected", "withdrawn"].map((status) => ({ status, count: entries.filter((entry) => entry.detail.acceptanceStatus === status).length })) },
    finance: { openCents, paidCents: entries.reduce((sum, entry) => sum + (entry.detail.payment.paidAmountCents ?? 0), 0), byStatus: [{ status: "Offen", count: due.length }, { status: "Bezahlt", count: entries.filter((entry) => entry.detail.payment.paymentStatus === "paid").length }] },
    communication: { outboxTotal: state.outbox.length, sentTotal: state.outbox.filter((item) => item.status === "sent").length, queuedTotal: state.outbox.filter((item) => item.status === "queued").length, failedTotal: 0, templates: state.templates.map((item) => ({ templateId: item.key, label: item.label, count: 1 })) },
    drivers: { internationalTotal: 1, countries: [{ country: "Deutschland", count: entries.length - 1 }, { country: "Österreich", count: 1 }], cities: [{ city: "Beispielstadt", count: 2 }, { city: "Musterdorf", count: 1 }] },
    vehicles: { brands: ["Opel", "Volkswagen", "Honda", "BMW", "Yamaha", "Ford"].map((brand) => ({ brand, count: 1 })), byType: [{ vehicleType: "Automobil", count: 4 }, { vehicleType: "Motorrad", count: 2 }] },
    classes: state.classes.map((item) => ({ classId: item.id, className: item.name, count: entries.filter((entry) => entry.detail.ids.classId === item.id).length })),
    operations: { checkinPendingTotal: entries.filter((entry) => !entry.detail.checkin.checkinIdVerified).length, techPendingTotal: entries.filter((entry) => entry.detail.checkin.techStatus === "pending").length, exportsQueuedTotal: 0, exportsProcessingTotal: 0 },
    documents: { generatedTotal: 3, failedTotal: 0, jobsFailedTotal: 0, byType: [{ type: "Haftverzicht", count: 2 }, { type: "Technik", count: 1 }] },
    activity: { last7Days: [], last30Days: Array.from({ length: 30 }, (_, index) => ({ day: `2026-07-${String(index + 1).padStart(2, "0")}`, count: (index * 3) % 5 })) },
    distributions: {}, map: { resolvedLocationTotal: 5 }, niceToKnow: { driverAgeStats: { medianDriverAge: 38 } }
  };
}

function mutateEntry(entry: DemoEntry, body: Record<string, unknown>) {
  const detail = entry.detail;
  if (typeof body.acceptanceStatus === "string") detail.acceptanceStatus = body.acceptanceStatus as AdminEntryDetailDto["acceptanceStatus"];
  if (typeof body.withdrawalReason === "string") detail.withdrawnReason = body.withdrawalReason;
  if (typeof body.internalNote === "string") detail.internalNote = body.internalNote;
  if (typeof body.driverNote === "string") detail.driverNote = body.driverNote;
  if (typeof body.inspectionNote === "string") detail.inspectionNote = body.inspectionNote;
  detail.updatedAt = now();
}

function createTemplate(body: Record<string, unknown>): MailTemplate {
  return {
    key: String(body.key ?? nextId("template")), label: String(body.label ?? "Neue Demo-Vorlage"), subject: String(body.subject ?? "Demo-Betreff"), bodyText: String(body.bodyText ?? "Demo-Inhalt"), bodyHtml: typeof body.bodyHtml === "string" ? body.bodyHtml : null,
    version: 1, status: body.status === "published" ? "published" : "draft", updatedAt: now(), updatedBy: demoIdentity.email, isActive: body.isActive !== false, scope: "campaign", channels: ["campaign"], composer: { enabled: true, fields: [], allowedPlaceholders: ["driver.firstName", "event.name"], requiredPlaceholders: [] }, renderOptions: { showBadgeDefault: true, defaultMailLabel: "Demo" }
  };
}

export async function handleDemoRequest(path: string, options: DemoRequestOptions = {}): Promise<unknown> {
  const method = options.method ?? "GET";
  const { pathname, searchParams } = pathInfo(path);
  const body = bodyRecord(options.body);

  if (method === "GET" && pathname === "/public/events/current") return publicEventResponse();
  if (method === "GET" && pathname === "/public/legal/current") return { ok: true, consent: { consentLocale: getQuery(options, searchParams, "locale") || "de-DE", consentVersion: "demo-2026-01", publishedAt: "2026-04-01T10:00:00.000Z" }, texts: demoLegalTexts, availableLocales: ["de", "en", "cz", "pl"] };
  if (method === "POST" && /^\/public\/events\/[^/]+\/start-number\/validate$/.test(pathname)) {
    const startNumber = String(body.startNumber ?? "").toUpperCase();
    const conflict = state.entries.find((entry) => entry.detail.ids.classId === body.classId && entry.detail.startNumberNorm === startNumber);
    return { ok: true, normalizedStartNumber: startNumber, validFormat: /^[A-Z0-9]{1,6}$/.test(startNumber), available: !conflict, conflictEntryId: conflict?.detail.ids.entryId ?? null, conflictType: conflict ? "same_class_taken" : "none" };
  }
  if (method === "POST" && /^\/public\/events\/[^/]+\/entries\/batch$/.test(pathname)) {
    const rawEntries = Array.isArray(body.entries) ? body.entries : [];
    const entryIds = rawEntries.map(() => nextId("registration"));
    return { ok: true, groupId: nextId("group"), entryIds, entryCount: entryIds.length, registrationStatus: "submitted_unverified", verificationToken: "demo-verification-token", confirmationMailSent: true };
  }
  if (method === "POST" && /^\/public\/events\/[^/]+\/entries$/.test(pathname)) return { ok: true, entryId: nextId("registration"), registrationStatus: "submitted_unverified", verificationToken: "demo-verification-token", confirmationMailSent: true };
  if (method === "POST" && pathname === "/public/uploads/vehicle-image/init") return { ok: true, uploadId: nextId("upload"), uploadToken: "demo-upload-token", key: "demo/local-image", uploadUrl: "demo://vehicle-image", requiredHeaders: {}, expiresAt: new Date(Date.now() + 900_000).toISOString() };
  if (method === "POST" && pathname === "/public/uploads/vehicle-image/finalize") return { ok: true, uploadId: String(body.uploadId ?? "demo-upload"), imageS3Key: "demo/local-image", finalizedAt: now() };
  if (method === "POST" && /^\/public\/entries\/[^/]+\/verify-email$/.test(pathname)) return { ok: true, verified: true };
  if (method === "POST" && /^\/public\/entries\/[^/]+\/verification-resend$/.test(pathname)) return { ok: true, queued: true };

  if (method === "GET" && pathname === "/admin/auth/me") return { ok: true, sub: "demo-admin", email: demoIdentity.email, roles: [...demoIdentity.roles] };
  if (method === "GET" && pathname === "/admin/events/current") return { ok: true, event: currentEvent() };
  if (method === "GET" && pathname === "/admin/events") return { ok: true, events: state.events };
  if (method === "POST" && pathname === "/admin/events") {
    const event: AdminSettingsEvent = { ...currentEvent(), id: nextId("event"), name: String(body.name ?? "Neues Demo-Event"), startsAt: String(body.startsAt ?? now()), endsAt: String(body.endsAt ?? now()), status: "draft", isCurrent: false, registrationOpenAt: typeof body.registrationOpenAt === "string" ? body.registrationOpenAt : null, registrationCloseAt: typeof body.registrationCloseAt === "string" ? body.registrationCloseAt : null, paymentDueAt: typeof body.paymentDueAt === "string" ? body.paymentDueAt : null, openedAt: null, closedAt: null, archivedAt: null, createdAt: now(), updatedAt: now(), entryConfirmationConfig: demoEntryConfirmationConfig };
    state.events.push(event); return { ok: true, event };
  }
  const eventRoute = pathname.match(/^\/admin\/events\/([^/]+)$/);
  if (eventRoute && method === "GET") return { ok: true, event: state.events.find((item) => item.id === eventRoute[1]) ?? currentEvent() };
  if (eventRoute && method === "PATCH") {
    const event = state.events.find((item) => item.id === eventRoute[1]); if (!event) throw new Error(`DEMO_API_NOT_FOUND: Event ${eventRoute[1]}`);
    Object.assign(event, body, { updatedAt: now() }); return { ok: true, event };
  }
  const eventAction = pathname.match(/^\/admin\/events\/([^/]+)\/(activate|close|archive)$/);
  if (eventAction && method === "POST") {
    const event = state.events.find((item) => item.id === eventAction[1]); if (!event) throw new Error(`DEMO_API_NOT_FOUND: Event ${eventAction[1]}`);
    const status = eventAction[2] === "activate" ? "open" : eventAction[2] === "close" ? "closed" : "archived";
    event.status = status; if (status === "open") { state.events.forEach((item) => { item.isCurrent = false; }); event.isCurrent = true; } return { ok: true, event };
  }
  if (method === "GET" && pathname === "/admin/config/entry-confirmation-defaults") return { ok: true, config: state.entryConfirmationConfig };
  if (method === "PATCH" && pathname === "/admin/config/entry-confirmation-defaults") { if (body.config && typeof body.config === "object") state.entryConfirmationConfig = body.config as typeof state.entryConfirmationConfig; return { ok: true, config: state.entryConfirmationConfig }; }

  const eventClasses = pathname.match(/^\/admin\/events\/([^/]+)\/classes$/);
  if (eventClasses && method === "GET") return { ok: true, classes: state.classes.filter((item) => item.eventId === eventClasses[1]) };
  if (eventClasses && method === "POST") {
    const item: AdminSettingsClass = { id: nextId("class"), eventId: eventClasses[1], name: String(body.name ?? "Demo-Klasse"), vehicleType: body.vehicleType === "moto" ? "moto" : "auto", allowsCodriver: Boolean(body.allowsCodriver), registrationClosed: Boolean(body.registrationClosed), runGroupId: null, createdAt: now(), updatedAt: now() };
    state.classes.push(item); return { ok: true, class: item };
  }
  const classRoute = pathname.match(/^\/admin\/classes\/([^/]+)$/);
  if (classRoute && method === "PATCH") { const item = state.classes.find((row) => row.id === classRoute[1]); if (!item) throw new Error(`DEMO_API_NOT_FOUND: Klasse ${classRoute[1]}`); Object.assign(item, body, { updatedAt: now() }); return { ok: true, class: item }; }
  if (classRoute && method === "DELETE") { const index = state.classes.findIndex((row) => row.id === classRoute[1]); if (index < 0) throw new Error(`DEMO_API_NOT_FOUND: Klasse ${classRoute[1]}`); const [item] = state.classes.splice(index, 1); return { ok: true, classId: item.id, eventId: item.eventId }; }
  const runGroups = pathname.match(/^\/admin\/events\/([^/]+)\/run-groups$/);
  if (runGroups && method === "GET") return { ok: true, runGroups: state.runGroups.filter((item) => item.eventId === runGroups[1]) };
  if (runGroups && method === "POST") { const runGroup = { id: nextId("run-group"), eventId: runGroups[1], name: String(body.name ?? "Demo-Laufgruppe"), classIds: Array.isArray(body.classIds) ? body.classIds.filter((id): id is string => typeof id === "string") : [] }; state.runGroups.push(runGroup); return { ok: true, runGroup }; }
  const runGroupRoute = pathname.match(/^\/admin\/run-groups\/([^/]+)$/);
  if (runGroupRoute && method === "PATCH") { const item = state.runGroups.find((row) => row.id === runGroupRoute[1]); if (!item) throw new Error(`DEMO_API_NOT_FOUND: Laufgruppe ${runGroupRoute[1]}`); Object.assign(item, body); return { ok: true, runGroup: item }; }
  if (runGroupRoute && method === "DELETE") { state.runGroups = state.runGroups.filter((row) => row.id !== runGroupRoute[1]); return { ok: true }; }
  const pricingRoute = pathname.match(/^\/admin\/events\/([^/]+)\/pricing-rules$/);
  if (pricingRoute && method === "GET") return { ok: true, pricingRules: pricingRules(pricingRoute[1]) };
  if (pricingRoute && method === "PUT") {
    const rules = Array.isArray(body.classRules) ? body.classRules : [];
    state.pricingRules[pricingRoute[1]] = {
      eventId: pricingRoute[1],
      earlyDeadline: String(body.earlyDeadline ?? now()),
      lateFeeCents: Number(body.lateFeeCents ?? 0),
      secondVehicleDiscountCents: Number(body.secondVehicleDiscountCents ?? 0),
      currency: "EUR",
      classRules: rules.map((rule) => {
        const item = bodyRecord(rule);
        const classId = String(item.classId ?? "");
        return { classId, className: state.classes.find((row) => row.id === classId)?.name ?? classId, baseFeeCents: Number(item.baseFeeCents ?? 0) };
      })
    };
    return { ok: true };
  }
  if (method === "POST" && /^\/admin\/events\/[^/]+\/invoices\/recalculate$/.test(pathname)) return { ok: true, recalculated: state.entries.length };
  if (/^\/admin\/events\/[^/]+\/registration-invitations$/.test(pathname) && method === "GET") return { ok: true, invitations: [] };
  if (/^\/admin\/events\/[^/]+\/registration-invitations$/.test(pathname) && method === "POST") return { ok: true, invitation: { id: nextId("invite"), eventId: DEMO_EVENT_ID, recipientName: body.recipientName ?? null, recipientEmail: body.recipientEmail ?? null, allowedClassIds: body.allowedClassIds ?? [], expiresAt: body.expiresAt, revokedAt: null, consumedAt: null, consumedRegistrationGroupId: null, createdAt: now() }, token: "demo-invitation-token" };
  if (method === "POST" && /^\/admin\/registration-invitations\/[^/]+\/revoke$/.test(pathname)) return { ok: true };

  if (method === "GET" && pathname === "/admin/dashboard/overview") return dashboardOverview();
  if (method === "GET" && pathname === "/admin/dashboard/driver-locations") {
    const active = state.entries.filter((entry) => !entry.deletedAt && entry.detail.acceptanceStatus !== "withdrawn");
    const locations = [
      { locationKey: "DE|00000|Beispielstadt", country: "DE", zip: "00000", city: "Beispielstadt", lat: 50.98, lng: 11.03, drivers: active.filter((entry) => entry.detail.person.driver.city === "Beispielstadt") },
      { locationKey: "DE|00001|Musterdorf", country: "DE", zip: "00001", city: "Musterdorf", lat: 50.72, lng: 10.78, drivers: active.filter((entry) => entry.detail.person.driver.city === "Musterdorf") },
      { locationKey: "DE|00002|Testhausen", country: "DE", zip: "00002", city: "Testhausen", lat: 51.15, lng: 10.32, drivers: active.filter((entry) => entry.detail.person.driver.city === "Testhausen") }
    ].filter((location) => location.drivers.length).map((location) => ({ ...location, driverCount: location.drivers.length, entryCount: location.drivers.length, drivers: location.drivers.map((entry) => ({ entryId: entry.detail.ids.entryId, driverName: `${entry.detail.person.driver.firstName} ${entry.detail.person.driver.lastName}`, className: entry.detail.className, startNumber: entry.detail.startNumberNorm ?? "-", vehicleLabel: entry.detail.vehicleLabel ?? "Fahrzeug", acceptanceStatus: entry.detail.acceptanceStatus, registrationStatus: entry.detail.registrationStatus })) }));
    return { ok: true, locations, totalLocations: locations.length, totalDrivers: locations.reduce((sum, item) => sum + item.driverCount, 0), missingLocationsTotal: 1, missingEntriesTotal: 1, pendingGeocodeTotal: 0, geocodeAttemptedTotal: 0, geocodeResolvedTotal: 0, autoRefreshTriggered: false, hasPendingGeocoding: false, maxPoints: 2000 };
  }
  if (method === "POST" && pathname === "/admin/dashboard/actions/queue-missing-lifecycle-mails") return { ok: true, affected: 1, queued: 1, skipped: 0, dryRun: Boolean(body.dryRun) };

  if (method === "GET" && pathname === "/admin/entries") return listResponse(filteredEntries(options, searchParams, false));
  if (method === "GET" && pathname === "/admin/entries/deleted") return listResponse(filteredEntries(options, searchParams, true));
  const entryRoute = pathname.match(/^\/admin\/entries\/([^/]+)$/);
  if (entryRoute && method === "GET") { const entry = findEntry(entryRoute[1]); return { ok: true, entry: entry.detail, history: entry.history }; }
  if (entryRoute && method === "PATCH") { const entry = findEntry(entryRoute[1]); mutateEntry(entry, body); return { ok: true, entry: entry.detail }; }
  if (entryRoute && method === "DELETE") { const entry = findEntry(entryRoute[1]); entry.deletedAt = now(); entry.deletedByDisplay = demoIdentity.displayName; entry.deleteReason = typeof body.deleteReason === "string" ? body.deleteReason : "In der Demo gelöscht"; return { ok: true, deletedEntryId: entryRoute[1], deletedReason: entry.deleteReason, deletedByDisplay: entry.deletedByDisplay }; }
  const entryAction = pathname.match(/^\/admin\/entries\/([^/]+)\/(status|payment-status|payment-amounts|checkin\/id-verify|tech-status|notes|class|backup-class|restore)$/);
  if (entryAction) {
    const entry = findEntry(entryAction[1]); const action = entryAction[2];
    if (action === "status") mutateEntry(entry, body);
    if (action === "payment-status") { entry.detail.payment.paymentStatus = "paid"; entry.detail.payment.paidAmountCents = entry.detail.payment.totalCents; entry.detail.payment.amountOpenCents = 0; }
    if (action === "payment-amounts") { const total = Number(body.totalCents ?? 0); const paid = Number(body.paidAmountCents ?? 0); entry.detail.payment.totalCents = total; entry.detail.payment.paidAmountCents = paid; entry.detail.payment.amountOpenCents = Math.max(0, total - paid); entry.detail.payment.paymentStatus = paid >= total ? "paid" : "due"; }
    if (action === "checkin/id-verify") { entry.detail.checkin.checkinIdVerified = true; entry.detail.checkin.checkinIdVerifiedAt = now(); entry.detail.checkin.checkinIdVerifiedBy = demoIdentity.displayName; }
    if (action === "tech-status") { entry.detail.checkin.techStatus = body.techStatus as TechStatus; entry.detail.checkin.techCheckedAt = now(); entry.detail.checkin.techCheckedBy = demoIdentity.displayName; }
    if (action === "notes") mutateEntry(entry, body);
    if (action === "class") { const item = state.classes.find((row) => row.id === body.classId); if (!item) throw new Error(`DEMO_API_NOT_FOUND: Klasse ${String(body.classId)}`); entry.detail.ids.classId = item.id; entry.detail.className = item.name; return { ok: true, entryId: entryAction[1], classId: item.id }; }
    if (action === "backup-class") { entry.detail.ids.backupClassId = String(body.backupClassId); return { ok: true, id: entryAction[1], backupClassId: body.backupClassId, backupVehicleType: entry.detail.backupVehicle?.vehicleType ?? entry.detail.vehicle.vehicleType }; }
    if (action === "restore") { entry.deletedAt = null; entry.deletedByDisplay = null; entry.deleteReason = null; return { ok: true, restoredEntryId: entryAction[1] }; }
    return { ok: true, entryId: entryAction[1], paymentStatus: entry.detail.payment.paymentStatus, totalCents: entry.detail.payment.totalCents, paidAmountCents: entry.detail.payment.paidAmountCents, amountOpenCents: entry.detail.payment.amountOpenCents };
  }
  if (method === "GET" && /^\/admin\/entries\/[^/]+\/inspection-qr$/.test(pathname)) return { ok: true, filename: "demo-inspection-qr.svg", mimeType: "image/svg+xml", dataBase64: btoa('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="white"/><text x="20" y="105">DEMO QR</text></svg>') };
  if (method === "POST" && /^\/admin\/events\/[^/]+\/inspection-qr-export$/.test(pathname)) return { ok: true, filename: "demo-qr-bogen.svg", mimeType: "image/svg+xml", dataBase64: btoa('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><text x="20" y="55">DEMO QR BOGEN</text></svg>') };
  if (method === "GET" && /^\/admin\/documents\/(entry\/[^/]+|[^/]+)\/download$/.test(pathname)) return { ok: true, url: "data:text/plain;charset=utf-8,Demo-Dokument%20-%20nicht%20rechtsverbindlich" };

  if (method === "GET" && pathname === "/inspection/context") return { ok: true, event: currentEvent() };
  if (method === "GET" && pathname === "/inspection/entries") {
    const q = (getQuery(options, searchParams, "q") ?? "").toLowerCase();
    const entries = state.entries.filter((entry) => !entry.deletedAt && entry.detail.acceptanceStatus === "accepted").filter((entry) => !q || `${entry.detail.startNumberNorm} ${entry.detail.person.driver.firstName} ${entry.detail.person.driver.lastName} ${entry.detail.vehicleLabel}`.toLowerCase().includes(q)).map((entry) => ({ id: entry.detail.ids.entryId, startNumber: entry.detail.startNumberNorm, driverFirstName: entry.detail.person.driver.firstName ?? "", driverLastName: entry.detail.person.driver.lastName ?? "", className: entry.detail.className, vehicleMake: entry.detail.vehicle.make, vehicleModel: entry.detail.vehicle.model, techStatus: entry.detail.checkin.techStatus, backupVehicleId: entry.detail.ids.backupVehicleId ?? null, backupTechStatus: "pending", techCheckedAt: entry.detail.checkin.techCheckedAt }));
    return { ok: true, entries };
  }
  const inspectionRoute = pathname.match(/^\/inspection\/entries\/([^/]+)$/);
  if (inspectionRoute && method === "GET") return { ok: true, entry: inspectionEntry(findEntry(inspectionRoute[1]).detail) };
  if (inspectionRoute && method === "PATCH") { const entry = findEntry(inspectionRoute[1]); const target = body.target === "backup" ? "backup" : "primary"; if (target === "primary") { entry.detail.checkin.techStatus = body.techStatus as TechStatus; entry.detail.checkin.techCheckedAt = now(); entry.detail.checkin.techCheckedBy = demoIdentity.displayName; entry.detail.inspectionNote = typeof body.note === "string" ? body.note : null; } state.inspectionHistory[inspectionRoute[1]].unshift({ id: nextId("inspection"), status: body.techStatus as TechStatus, target, note: typeof body.note === "string" ? body.note : null, inspectorUserId: "demo-admin", inspectorEmail: demoIdentity.email, inspectorDisplay: demoIdentity.displayName, createdAt: now() }); return { ok: true }; }
  const inspectionHistoryRoute = pathname.match(/^\/inspection\/entries\/([^/]+)\/history$/);
  if (inspectionHistoryRoute && method === "GET") return { ok: true, history: state.inspectionHistory[inspectionHistoryRoute[1]] ?? [] };
  const inspectionNoteRoute = pathname.match(/^\/inspection\/entries\/([^/]+)\/note$/);
  if (inspectionNoteRoute && method === "PATCH") { const entry = findEntry(inspectionNoteRoute[1]); entry.detail.inspectionNote = typeof body.note === "string" ? body.note : null; return { ok: true }; }

  if (method === "GET" && pathname === "/admin/iam/roles") return { ok: true, roles: [{ key: "admin", description: "Vollzugriff" }, { key: "editor", description: "Nennungen bearbeiten" }, { key: "viewer", description: "Lesender Zugriff" }, { key: "technical_inspector", description: "Technische Abnahme" }, { key: "marshal_manager", description: "Streckenposten verwalten" }] };
  if (method === "GET" && pathname === "/admin/iam/users") return { ok: true, users: state.iamUsers, meta: { nextCursor: null, limit: 60 } };
  if (method === "POST" && pathname === "/admin/iam/users") { const user = { id: nextId("user"), username: String(body.email), email: String(body.email), firstName: String(body.firstName ?? ""), lastName: String(body.lastName ?? ""), enabled: true, status: "FORCE_CHANGE_PASSWORD", emailVerified: false, roles: Array.isArray(body.roles) ? body.roles : [], createdAt: now(), updatedAt: now() } as typeof state.iamUsers[number]; state.iamUsers.push(user); return { ok: true, user }; }
  const iamMutation = pathname.match(/^\/admin\/iam\/users\/([^/]+)\/(roles|status|profile)$/);
  if (iamMutation && method === "PATCH") { const user = state.iamUsers.find((item) => item.id === iamMutation[1]); if (!user) throw new Error(`DEMO_API_NOT_FOUND: IAM-Benutzer ${iamMutation[1]}`); if (iamMutation[2] === "roles" && Array.isArray(body.roles)) user.roles = body.roles as typeof user.roles; if (iamMutation[2] === "status") user.enabled = Boolean(body.enabled); if (iamMutation[2] === "profile") { user.firstName = String(body.firstName ?? ""); user.lastName = String(body.lastName ?? ""); } user.updatedAt = now(); return { ok: true, user }; }
  if (method === "PUT" && /^\/admin\/iam\/users\/[^/]+\/technical-inspector-assignment$/.test(pathname)) return { ok: true };

  if (method === "GET" && pathname === "/admin/marshals/events") return { ok: true, events: state.events.map(({ id, name, startsAt, endsAt, status, isCurrent }) => ({ id, name, startsAt, endsAt, status, isCurrent })) };
  if (method === "GET" && pathname === "/admin/marshals/workspace") return { ok: true, ...state.marshalWorkspace };
  const marshalAssignment = pathname.match(/^\/admin\/marshals\/assignments\/([^/]+)$/);
  if (marshalAssignment && method === "PUT") {
    const person = state.marshalWorkspace.people.find((item) => item.id === marshalAssignment[1]);
    if (!person) throw new Error(`DEMO_API_NOT_FOUND: Streckenposten ${marshalAssignment[1]}`);
    person.participation.contactOwner = typeof body.contactOwner === "string" ? body.contactOwner : null;
    person.participation.wish = typeof body.wish === "string" ? body.wish : null;
    person.participation.note = typeof body.note === "string" ? body.note : null;
    if (Array.isArray(body.days)) {
      person.assignments = body.days.map((rawDay) => {
        const day = bodyRecord(rawDay);
        return {
          id: nextId("assignment"), participationId: person.participation.id, dayId: String(day.dayId),
          commitmentStatus: (typeof day.commitmentStatus === "string" ? day.commitmentStatus : "not_asked") as typeof person.assignments[number]["commitmentStatus"],
          role: (typeof day.role === "string" ? day.role : null) as typeof person.assignments[number]["role"], sectionId: typeof day.sectionId === "string" ? day.sectionId : null,
          postId: typeof day.postId === "string" ? day.postId : null, functionCode: typeof day.functionCode === "string" ? day.functionCode : null, note: null
        };
      });
    }
    return { ok: true };
  }
  if (method === "POST" && pathname === "/admin/marshals/persons") {
    const personId = nextId("marshal");
    const participationId = nextId("participation");
    state.marshalWorkspace.people.push({ id: personId, helperNumber: Number(body.helperNumber ?? state.counter), firstName: String(body.firstName ?? "Neue"), lastName: String(body.lastName ?? "Demoperson"), street: typeof body.street === "string" ? body.street : null, zip: typeof body.zip === "string" ? body.zip : null, city: typeof body.city === "string" ? body.city : null, birthdate: typeof body.birthdate === "string" ? body.birthdate : null, phone: typeof body.phone === "string" ? body.phone : null, email: typeof body.email === "string" ? body.email : null, shirtSize: typeof body.shirtSize === "string" ? body.shirtSize : null, clubMember: Boolean(body.clubMember), licenseNumber: null, vehicleRegistration: null, activityAreas: [], note: null, isActive: true, participation: { id: participationId, eventId: String(body.eventId ?? DEMO_EVENT_ID), personId, contactOwner: null, wish: null, note: null, shirtSizeSnapshot: null }, assignments: [] });
    return { ok: true };
  }
  const marshalPerson = pathname.match(/^\/admin\/marshals\/persons\/([^/]+)$/);
  if (marshalPerson && method === "PATCH") { const person = state.marshalWorkspace.people.find((item) => item.id === marshalPerson[1]); if (!person) throw new Error(`DEMO_API_NOT_FOUND: Streckenposten ${marshalPerson[1]}`); Object.assign(person, body); return { ok: true }; }
  if (method === "POST" && pathname === "/admin/marshals/trainings") { state.marshalWorkspace.trainings.push({ id: nextId("training"), eventId: String(body.eventId ?? DEMO_EVENT_ID), sessionType: body.sessionType === "training" ? "training" : "briefing", title: String(body.title ?? "Demo-Termin"), sessionDate: String(body.sessionDate ?? now()), location: typeof body.location === "string" ? body.location : null, note: null }); return { ok: true }; }
  const trainingParticipant = pathname.match(/^\/admin\/marshals\/trainings\/([^/]+)\/participants\/([^/]+)$/);
  if (trainingParticipant && method === "PUT") { const existing = state.marshalWorkspace.trainingParticipants.find((item) => item.sessionId === trainingParticipant[1] && item.personId === trainingParticipant[2]); if (existing) existing.attendanceStatus = body.attendanceStatus as typeof existing.attendanceStatus; else state.marshalWorkspace.trainingParticipants.push({ id: nextId("training-participant"), sessionId: trainingParticipant[1], personId: trainingParticipant[2], attendanceStatus: body.attendanceStatus as "registered" | "attended" | "absent" | "excused", note: null }); return { ok: true }; }
  if (["POST", "PATCH", "PUT"].includes(method) && pathname.startsWith("/admin/marshals/")) return { ok: true };

  if (method === "GET" && pathname === "/admin/mail/outbox") return { ok: true, outbox: state.outbox, meta: { page: 1, pageSize: 100, total: state.outbox.length, hasMore: false, nextCursor: null } };
  if (method === "GET" && pathname === "/admin/mail/templates") return { ok: true, templates: state.templates };
  if (method === "POST" && pathname === "/admin/mail/templates") { const template = createTemplate(body); state.templates.push(template); return { ok: true, template }; }
  const templateRoute = pathname.match(/^\/admin\/mail\/templates\/([^/]+)$/);
  if (templateRoute && method === "PATCH") { const template = state.templates.find((item) => item.key === templateRoute[1]); if (!template) throw new Error(`DEMO_API_NOT_FOUND: Mailvorlage ${templateRoute[1]}`); Object.assign(template, body, { updatedAt: now(), updatedBy: demoIdentity.email }); return { ok: true, template }; }
  const versionsRoute = pathname.match(/^\/admin\/mail\/templates\/([^/]+)\/versions$/);
  if (versionsRoute && method === "GET") { const template = state.templates.find((item) => item.key === versionsRoute[1]); return { ok: true, key: versionsRoute[1], versions: template ? [template] : [] }; }
  if (versionsRoute && method === "POST") { const template = state.templates.find((item) => item.key === versionsRoute[1]); if (template) { template.version += 1; Object.assign(template, body); } return { ok: true, key: versionsRoute[1], version: template?.version ?? 1, status: template?.status ?? "draft", createdAt: now() }; }
  if (method === "GET" && /^\/admin\/mail\/templates\/[^/]+\/placeholders$/.test(pathname)) return { ok: true, templateKey: pathname.split("/")[4], placeholders: [{ name: "driver.firstName", required: false, description: "Vorname der fahrenden Person", example: "Mara" }, { name: "event.name", required: false, description: "Name der Veranstaltung", example: currentEvent().name }] };
  if (method === "POST" && pathname === "/admin/mail/templates/preview") { const subject = String(body.subjectOverride ?? "Demo-Vorschau für {{driver.firstName}}").replace("{{driver.firstName}}", "Mara"); const text = String(body.bodyOverride ?? "Hallo Mara, dies ist eine lokale Demo-Vorschau."); return { ok: true, templateKey: String(body.templateKey ?? "demo"), subjectRendered: subject, bodyTextRendered: text, bodyHtmlRendered: `<p>${text}</p>`, htmlDocument: `<!doctype html><html><body><p>${text}</p></body></html>`, usedPlaceholders: ["driver.firstName"], missingPlaceholders: [], unknownPlaceholders: [], warnings: [], attachments: [] }; }
  if (method === "GET" && pathname === "/admin/mail/recipients/search") { const q = (getQuery(options, searchParams, "q") ?? "").toLowerCase(); return { ok: true, recipients: state.entries.filter((entry) => !entry.deletedAt).filter((entry) => !q || `${entry.detail.person.driver.firstName} ${entry.detail.person.driver.lastName} ${entry.detail.person.driver.email}`.toLowerCase().includes(q)).map((entry) => ({ driverPersonId: entry.detail.ids.driverPersonId, driverName: `${entry.detail.person.driver.firstName} ${entry.detail.person.driver.lastName}`, driverEmail: entry.detail.person.driver.email ?? "", entryId: entry.detail.ids.entryId, className: entry.detail.className, startNumber: entry.detail.startNumberNorm ?? "" })) }; }
  if (method === "POST" && pathname === "/admin/mail/broadcast/resolve-recipients") { const additional = Array.isArray(body.additionalEmails) ? body.additionalEmails.filter((item): item is string => typeof item === "string") : []; const resolved = body.allEntries ? state.entries.map((entry) => entry.detail.person.driver.email).filter((email): email is string => Boolean(email)) : additional; return { ok: true, resolvedRecipients: [...new Set(resolved)], invalidEmails: [], duplicatesRemoved: resolved.length - new Set(resolved).size, finalCount: new Set(resolved).size }; }
  if (method === "POST" && pathname === "/admin/mail/send") { state.outbox.unshift({ id: nextId("outbox"), eventId: DEMO_EVENT_ID, toEmail: "lokal@demo.invalid", subject: String(body.subjectOverride ?? "Lokale Demo-Nachricht"), status: "queued", errorLast: null, createdAt: now() }); return { ok: true, queued: 1 }; }
  if (method === "POST" && pathname === "/admin/mail/attachments/init") return { ok: true, uploadId: nextId("attachment"), eventId: DEMO_EVENT_ID, fileName: String(body.fileName ?? "demo.pdf"), contentType: "application/pdf", fileSizeBytes: Number(body.fileSizeBytes ?? 0), uploadUrl: "demo://mail-attachment", requiredHeaders: {}, expiresAt: new Date(Date.now() + 900_000).toISOString() };
  if (method === "POST" && pathname === "/admin/mail/attachments/finalize") return { ok: true, uploadId: String(body.uploadId), eventId: String(body.eventId), fileName: "demo-anlage.pdf", contentType: "application/pdf", fileSizeBytes: 0, status: "finalized" };
  if (method === "POST" && (/^\/admin\/mail\/outbox\/[^/]+\/retry$/.test(pathname) || pathname === "/admin/payment/reminders/queue" || pathname === "/admin/mail/lifecycle/queue")) return pathname.includes("outbox") ? { ok: true } : { ok: true, queued: 1, skipped: 0, outboxIds: [nextId("outbox")] };

  if (method === "GET" && pathname === "/admin/exports") return { ok: true, exports: state.exports };
  if (method === "POST" && pathname === "/admin/exports/entries") { const id = nextId("export"); state.exports.unshift({ id, eventId: DEMO_EVENT_ID, type: String(body.type ?? "entries_csv") as typeof state.exports[number]["type"], status: "succeeded", createdAt: now(), completedAt: now() }); return { ok: true, exportJobId: id }; }
  if (method === "GET" && /^\/admin\/exports\/[^/]+\/download$/.test(pathname)) return { ok: true, url: "data:text/csv;charset=utf-8,Startnummer%3BFahrer%3BKlasse%0A17%3BMara%20Muster%3BAutomobile%20historisch" };

  if (method === "GET" && pathname === "/admin/signing/devices") return { ok: true, devices: [] };
  if (method === "POST" && pathname === "/admin/signing/devices/pairing-code") return { ok: true, pairingCode: "DEMO-123", expiresAt: new Date(Date.now() + 600_000).toISOString(), deviceSession: { id: nextId("device"), deviceName: "Lokales Demo-Tablet", status: "pairing", pairedAt: null, lastSeenAt: null, expiresAt: new Date(Date.now() + 600_000).toISOString() } };
  if (method === "DELETE" && /^\/admin\/signing\/devices\/[^/]+$/.test(pathname)) return { ok: true, device: { id: pathname.split("/").pop(), deviceName: "Demo-Gerät", status: "revoked", pairedAt: null, lastSeenAt: null, expiresAt: now() } };
  if (method === "GET" && /^\/admin\/signing\/entries\/[^/]+\/requirements$/.test(pathname)) { const entry = findEntry(pathname.split("/")[4]).detail; return { ok: true, requirements: { entryId: entry.ids.entryId, caseId: `case-${entry.ids.entryId}`, driverName: `${entry.person.driver.firstName} ${entry.person.driver.lastName}`, isMinor: false, requiresMedicalCertificate: false, signerType: "driver", entryCount: 1, vehicleCount: entry.backupVehicle ? 2 : 1, contract: { locale: "de-DE", version: "demo-1", textHash: "local-demo-no-contract" }, signers: [], entries: [] } }; }
  if (method === "GET" && pathname === "/admin/signing/sessions") return { sessions: [], total: 0 };
  if (method === "POST" && pathname === "/admin/signing/sessions") { const session = { id: nextId("signing"), status: "pending", deviceSessionId: String(body.deviceSessionId), sourceEntryId: String(body.entryId), displayedAt: null, signedAt: null, documentId: null, evidenceAuditS3Key: null, expiresAt: new Date(Date.now() + 600_000).toISOString() }; return { ok: true, session }; }
  if (/^\/admin\/signing\/sessions\/[^/]+(\/cancel)?$/.test(pathname)) return { ok: true, session: { id: pathname.split("/")[4], status: pathname.endsWith("/cancel") ? "cancelled" : "pending", deviceSessionId: "demo-device", sourceEntryId: null, displayedAt: null, signedAt: null, documentId: null, evidenceAuditS3Key: null, expiresAt: new Date(Date.now() + 600_000).toISOString() } };

  throw new Error(`DEMO_API_ROUTE_UNHANDLED: ${method} ${pathname}. Für diesen Aufruf existiert bewusst kein Demo-Handler; es wurde keine Netzwerkverbindung hergestellt.`);
}
