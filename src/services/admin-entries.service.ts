import { getAdminEventId } from "@/services/api/event-context";
import { ApiError, requestJson } from "@/services/api/http-client";
import type {
  AdminDeletedEntriesPageResult,
  AdminDeletedEntryListItem,
  AdminEntriesPageResult,
  AdminEntriesFilter,
  AdminEntryDetailDto,
  AdminEntryDetailViewModel,
  AdminEntryListItem,
  AdminEntryListItemDto,
  ListMeta
} from "@/types/admin";
import type { AcceptanceStatus, PaymentStatus } from "@/types/common";

type EntryContext = {
  eventId: string;
  driverPersonId: string;
};

const entryContextStore = new Map<string, EntryContext>();
const DEFAULT_ENTRIES_PAGE_SIZE = 25;
const MAX_ENTRIES_PAGE_SIZE = 100;

function asDateTime(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("de-DE");
}

function asDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const raw = value.trim();
  if (!raw) {
    return "-";
  }

  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }).format(parsed);
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(parsed);
  }

  return value;
}

function formatPhoneForDisplay(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) {
    return "-";
  }

  if (raw.startsWith("+")) {
    return raw;
  }

  if (raw.startsWith("00")) {
    return `+${raw.slice(2)}`;
  }

  const digitsOnly = raw.replace(/\D/g, "");
  if (!digitsOnly) {
    return raw;
  }

  if (raw.startsWith("0")) {
    return raw;
  }

  return `+${digitsOnly}`;
}

function parseName(first: string | null | undefined, last: string | null | undefined, fallback = "Unbekannt") {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || fallback;
}

function normalizeAcceptanceStatus(value: unknown): AcceptanceStatus {
  return value === "shortlist" || value === "accepted" || value === "rejected" || value === "pending" ? value : "pending";
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  return value === "paid" ? "paid" : "due";
}

function isTransitionNotAllowedError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  const message = (error.message || "").toLowerCase();
  const code = (error.code || "").toLowerCase();
  return message.includes("transition is not allowed") || code.includes("transition");
}

function lifecycleEventTypeForStatus(status: AcceptanceStatus): "preselection" | "accepted_open_payment" | "rejected" {
  if (status === "accepted") {
    return "accepted_open_payment";
  }
  if (status === "rejected") {
    return "rejected";
  }
  return "preselection";
}

function payloadToText(payload: Record<string, unknown> | null | undefined) {
  if (!payload) {
    return "-";
  }
  const knownText = payload.message;
  if (typeof knownText === "string" && knownText.trim()) {
    return knownText;
  }
  return JSON.stringify(payload);
}

function splitNationalityFromNotes(value: string | null | undefined) {
  const source = (value ?? "").trim();
  if (!source) {
    return { nationality: null as string | null, notes: "" };
  }

  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let nationality: string | null = null;
  const remaining: string[] = [];

  for (const line of lines) {
    const match = line.match(/^(?:nationalit[aä]t|nationality)\s*:\s*(.+)$/i);
    if (match && !nationality) {
      nationality = match[1].trim() || null;
      continue;
    }
    remaining.push(line);
  }

  return {
    nationality,
    notes: remaining.join("\n").trim()
  };
}

function fromAdminEntryListDto(dto: AdminEntryListItemDto): AdminEntryListItem {
  return {
    id: dto.id,
    classId: dto.classId,
    name: dto.name || parseName(dto.driverFirstName, dto.driverLastName, dto.driverEmail ?? `Eintrag ${dto.id}`),
    classLabel: dto.className || dto.classId || "-",
    startNumber: dto.startNumber ?? dto.startNumberNorm ?? "-",
    vehicleLabel: dto.vehicleLabel,
    vehicleThumbUrl: dto.vehicleThumbUrl,
    status: normalizeAcceptanceStatus(dto.acceptanceStatus),
    payment: normalizePaymentStatus(dto.paymentStatus),
    checkin: dto.checkinIdVerified ? "bestätigt" : "offen",
    confirmationMailSent: Boolean(dto.confirmationMailSent),
    confirmationMailVerified: Boolean(dto.confirmationMailVerified),
    createdAt: asDateTime(dto.createdAt)
  };
}

function fromAdminDeletedEntryDto(dto: AdminEntryListItemDto): AdminDeletedEntryListItem {
  return {
    id: dto.id,
    classId: dto.classId,
    name: dto.name || parseName(dto.driverFirstName, dto.driverLastName, dto.driverEmail ?? `Eintrag ${dto.id}`),
    classLabel: dto.className || dto.classId || "-",
    startNumber: dto.startNumber ?? dto.startNumberNorm ?? "-",
    vehicleLabel: dto.vehicleLabel || "-",
    status: normalizeAcceptanceStatus(dto.acceptanceStatus),
    payment: normalizePaymentStatus(dto.paymentStatus),
    deletedAt: asDateTime(dto.deletedAt),
    deletedBy: (dto.deletedBy ?? "").trim() || "-",
    deleteReason: (dto.deleteReason ?? "").trim() || "-"
  };
}

function fromAdminEntryDetailDto(
  dto: AdminEntryDetailDto,
  history: Array<{
    id: string;
    action: string;
    actorUserId?: string | null;
    createdAt: string;
    payload?: Record<string, unknown> | null;
  }>
): AdminEntryDetailViewModel {
  const codriver = dto.person.codriver ?? null;
  const driverName = parseName(dto.person.driver.firstName, dto.person.driver.lastName, `Fahrer ${dto.ids.entryId.slice(0, 8)}`);
  const vehicleLabel = dto.vehicleLabel ?? ([dto.vehicle.make, dto.vehicle.model].filter(Boolean).join(" ") || "Fahrzeug");
  const notesSplit = splitNationalityFromNotes(dto.specialNotes);
  const driverNationality = (dto.person.driver.nationality ?? "").trim() || notesSplit.nationality || "-";

  return {
    id: dto.ids.entryId,
    eventId: dto.ids.eventId,
    classId: dto.ids.classId,
    headline: `${driverName} · ${vehicleLabel}`,
    classLabel: dto.className,
    startNumber: dto.startNumberNorm ?? "-",
    status: dto.acceptanceStatus,
    paymentStatus: dto.payment.paymentStatus,
    registrationStatus: dto.registrationStatus,
    createdAt: dto.createdAt,
    isBackupVehicle: dto.isBackupVehicle,
    checkinVerified: dto.checkin.checkinIdVerified,
    driver: {
      name: parseName(dto.person.driver.firstName, dto.person.driver.lastName),
      email: dto.person.driver.email ?? "-",
      birthdate: asDate(dto.person.driver.birthdate),
      nationality: driverNationality,
      phone: formatPhoneForDisplay(dto.person.driver.phone),
      street: dto.person.driver.street ?? "-",
      zip: dto.person.driver.zip ?? "-",
      city: dto.person.driver.city ?? "-",
      addressLine: [dto.person.driver.street, dto.person.driver.zip, dto.person.driver.city].filter(Boolean).join(", ") || "-",
      emergencyContactName: dto.person.driver.emergencyContactName ?? "-",
      emergencyContactPhone: formatPhoneForDisplay(dto.person.driver.emergencyContactPhone),
      motorsportHistory: dto.person.driver.motorsportHistory ?? "Keine Angabe"
    },
    codriver: {
      assigned: Boolean(codriver),
      label: codriver ? parseName(codriver.firstName, codriver.lastName) : "Nicht angegeben",
      firstName: codriver?.firstName ?? "-",
      lastName: codriver?.lastName ?? "-",
      email: codriver?.email ?? "-",
      birthdate: asDate(codriver?.birthdate),
      phone: formatPhoneForDisplay(codriver?.phone),
      street: codriver?.street ?? "-",
      zip: codriver?.zip ?? "-",
      city: codriver?.city ?? "-",
      addressLine: [codriver?.street, codriver?.zip, codriver?.city].filter(Boolean).join(", ") || "-"
    },
    vehicle: {
      label: dto.vehicleLabel ?? ([dto.vehicle.make, dto.vehicle.model].filter(Boolean).join(" ") || "Fahrzeug"),
      thumbUrl: dto.vehicleThumbUrl ?? dto.vehicle.imageS3Key,
      type: dto.vehicle.vehicleType,
      make: dto.vehicle.make ?? "-",
      model: dto.vehicle.model ?? "-",
      year: dto.vehicle.year ? String(dto.vehicle.year) : "-",
      displacementCcm: dto.vehicle.displacementCcm ? `${dto.vehicle.displacementCcm} ccm` : "-",
      engineType: dto.vehicle.engineType ?? "-",
      cylinders: dto.vehicle.cylinders ? String(dto.vehicle.cylinders) : "-",
      brakes: dto.vehicle.brakes ?? "-",
      ownerName: dto.vehicle.ownerName ?? "-",
      vehicleHistory: dto.vehicle.vehicleHistory ?? "Keine Angabe"
    },
    payment: {
      totalCents: dto.payment.totalCents,
      paidAmountCents: dto.payment.paidAmountCents,
      amountOpenCents: dto.payment.amountOpenCents,
      status: dto.payment.paymentStatus
    },
    consent: {
      termsAccepted: dto.consent.termsAccepted,
      privacyAccepted: dto.consent.privacyAccepted,
      mediaAccepted: dto.consent.mediaAccepted,
      consentVersion: dto.consent.consentVersion,
      consentCapturedAt: dto.consent.consentCapturedAt
    },
    documents: dto.documents.map((doc) => ({
      id: doc.id,
      type: doc.type,
      status: doc.status
    })),
    relatedEntryIds: dto.relatedEntryIds,
    notes: notesSplit.notes || "Keine Hinweise",
    confirmationMailSent: Boolean(dto.confirmationMailSent),
    confirmationMailVerified: Boolean(dto.confirmationMailVerified),
    internalNote: dto.internalNote ?? "",
    driverNote: dto.driverNote ?? "",
    history: history.map((item) => ({
      id: item.id,
      timestamp: item.createdAt,
      actor: item.actorUserId ?? "system",
      action: item.action,
      details: payloadToText(item.payload)
    }))
  };
}

type AdminEntriesListResponse = {
  ok: boolean;
  entries: AdminEntryListItemDto[];
  meta?: ListMeta;
};

type AdminDeletedEntriesListResponse = {
  ok: boolean;
  entries: AdminEntryListItemDto[];
  meta?: ListMeta;
};

type AdminEntryDetailResponse = {
  ok: boolean;
  entry: AdminEntryDetailDto;
  history: Array<{
    id: string;
    action: string;
    actorUserId?: string | null;
    createdAt: string;
    payload?: Record<string, unknown> | null;
  }>;
};

type AdminEntryDeleteResponse = {
  ok: boolean;
  deletedEntryId: string;
};

type AdminEntryRestoreResponse = {
  ok: boolean;
  restoredEntryId: string;
};

type AdminEntryPaymentStatusResponse = {
  ok: boolean;
  entryId: string;
  paymentStatus: PaymentStatus;
  paidAmountCents: number;
  amountOpenCents: number;
};

type AdminEntryPaymentAmountsResponse = {
  ok: boolean;
  entryId: string;
  paymentStatus: PaymentStatus;
  totalCents: number;
  paidAmountCents: number;
  amountOpenCents: number;
};

async function resolveEntryContext(entryId: string): Promise<EntryContext> {
  const existing = entryContextStore.get(entryId);
  if (existing) {
    return existing;
  }

  const detail = await adminEntriesService.getEntryDetail(entryId);
  if (!detail) {
    throw new Error("Nennung nicht gefunden.");
  }

  const resolved = entryContextStore.get(entryId);
  if (!resolved) {
    throw new Error("Kontext für Nennung konnte nicht aufgelöst werden.");
  }
  return resolved;
}

function clampPageSize(limit?: number) {
  const normalized = typeof limit === "number" && Number.isFinite(limit) ? Math.floor(limit) : DEFAULT_ENTRIES_PAGE_SIZE;
  return Math.min(MAX_ENTRIES_PAGE_SIZE, Math.max(1, normalized));
}

function fallbackListMeta(rowCount: number, pageSize: number): ListMeta {
  return {
    page: 1,
    pageSize,
    total: rowCount,
    hasMore: false,
    nextCursor: null
  };
}

function normalizeListMeta(meta: ListMeta | undefined, rowCount: number, pageSize: number): ListMeta {
  if (!meta) {
    return fallbackListMeta(rowCount, pageSize);
  }

  return {
    page: typeof meta.page === "number" ? meta.page : 1,
    pageSize: typeof meta.pageSize === "number" ? meta.pageSize : pageSize,
    total: typeof meta.total === "number" ? meta.total : rowCount,
    hasMore: Boolean(meta.hasMore),
    nextCursor: typeof meta.nextCursor === "string" && meta.nextCursor.trim() ? meta.nextCursor : null
  };
}

export const adminEntriesService = {
  async listEntriesPage(
    filter: AdminEntriesFilter,
    options?: {
      cursor?: string;
      limit?: number;
    }
  ): Promise<AdminEntriesPageResult> {
    const pageSize = clampPageSize(options?.limit);

    const eventId = await getAdminEventId();
    const response = await requestJson<AdminEntriesListResponse>("/admin/entries", {
      query: {
        eventId,
        q: filter.query.trim() || undefined,
        classId: filter.classId !== "all" ? filter.classId : undefined,
        acceptanceStatus: filter.acceptanceStatus !== "all" ? filter.acceptanceStatus : undefined,
        paymentStatus: filter.paymentStatus !== "all" ? filter.paymentStatus : undefined,
        checkinIdVerified: filter.checkinIdVerified !== "all" ? filter.checkinIdVerified === "true" : undefined,
        cursor: options?.cursor || undefined,
        limit: pageSize,
        sortBy: "createdAt",
        sortDir: "desc"
      }
    });

    response.entries.forEach((entry) => {
      if (entry.eventId && entry.driverPersonId) {
        entryContextStore.set(entry.id, {
          eventId: entry.eventId,
          driverPersonId: entry.driverPersonId
        });
      }
    });

    return {
      entries: response.entries.map(fromAdminEntryListDto),
      meta: normalizeListMeta(response.meta, response.entries.length, pageSize)
    };
  },

  async listEntries(filter: AdminEntriesFilter): Promise<AdminEntryListItem[]> {
    const response = await adminEntriesService.listEntriesPage(filter, {
      limit: DEFAULT_ENTRIES_PAGE_SIZE
    });
    return response.entries;
  },

  async listDeletedEntriesPage(
    filter: AdminEntriesFilter,
    options?: {
      cursor?: string;
      limit?: number;
    }
  ): Promise<AdminDeletedEntriesPageResult> {
    const pageSize = clampPageSize(options?.limit);

    const eventId = await getAdminEventId();
    const response = await requestJson<AdminDeletedEntriesListResponse>("/admin/entries/deleted", {
      query: {
        eventId,
        q: filter.query.trim() || undefined,
        classId: filter.classId !== "all" ? filter.classId : undefined,
        acceptanceStatus: filter.acceptanceStatus !== "all" ? filter.acceptanceStatus : undefined,
        paymentStatus: filter.paymentStatus !== "all" ? filter.paymentStatus : undefined,
        checkinIdVerified: filter.checkinIdVerified !== "all" ? filter.checkinIdVerified === "true" : undefined,
        cursor: options?.cursor || undefined,
        limit: pageSize,
        sortBy: "createdAt",
        sortDir: "desc"
      }
    });

    return {
      entries: response.entries.map(fromAdminDeletedEntryDto),
      meta: normalizeListMeta(response.meta, response.entries.length, pageSize)
    };
  },

  async getEntryDetail(entryId: string): Promise<AdminEntryDetailViewModel | null> {
    const response = await requestJson<AdminEntryDetailResponse>(`/admin/entries/${entryId}`);
    if (!response.ok) {
      return null;
    }

    entryContextStore.set(entryId, {
      eventId: response.entry.ids.eventId,
      driverPersonId: response.entry.ids.driverPersonId
    });

    return fromAdminEntryDetailDto(response.entry, response.history);
  },

  async setEntryStatus(
    entryId: string,
    transition: "to_shortlist" | "to_accepted" | "to_rejected",
    options?: { includeDriverNoteInLifecycleMail?: boolean }
  ) {
    const statusMap: Record<typeof transition, { status: AcceptanceStatus; lifecycleEventType: string; sendLifecycleMail: boolean }> = {
      to_shortlist: { status: "shortlist", lifecycleEventType: "preselection", sendLifecycleMail: false },
      to_accepted: { status: "accepted", lifecycleEventType: "accepted_open_payment", sendLifecycleMail: true },
      to_rejected: { status: "rejected", lifecycleEventType: "rejected", sendLifecycleMail: true }
    };

    const mapped = statusMap[transition];
    const enqueueLifecycleMailIfNeeded = async () => {
      if (!mapped.sendLifecycleMail) {
        return;
      }
      if (mapped.lifecycleEventType !== "accepted_open_payment" && mapped.lifecycleEventType !== "rejected") {
        return;
      }
      await adminEntriesService.queueLifecycleMail(entryId, mapped.lifecycleEventType, {
        includeDriverNote: options?.includeDriverNoteInLifecycleMail
      });
    };
    const waitForTargetStatus = async () => {
      const attempts = 8;
      const delayMs = 350;

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const current = await adminEntriesService.getEntryDetail(entryId).catch(() => null);
        if (current?.status === mapped.status) {
          return true;
        }
        if (attempt < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      return false;
    };

    const statusPayload = {
      acceptanceStatus: mapped.status,
      sendLifecycleMail: mapped.sendLifecycleMail,
      lifecycleEventType: mapped.lifecycleEventType,
      includeDriverNoteInLifecycleMail:
        mapped.sendLifecycleMail && typeof options?.includeDriverNoteInLifecycleMail === "boolean"
          ? options.includeDriverNoteInLifecycleMail
          : undefined
    };

    try {
      await requestJson(`/admin/entries/${entryId}/status`, {
        method: "PATCH",
        body: statusPayload
      });
      return { ok: true };
    } catch (error) {
      if (!isTransitionNotAllowedError(error)) {
        if (await waitForTargetStatus()) {
          await enqueueLifecycleMailIfNeeded();
          return { ok: true, eventuallyConsistent: true };
        }
        throw error;
      }
    }

    if (await waitForTargetStatus()) {
      await enqueueLifecycleMailIfNeeded();
      return { ok: true, alreadyInTargetStatus: true };
    }

    if (transition === "to_shortlist") {
      throw new Error("Statuswechsel auf Vorauswahl ist derzeit nicht erlaubt.");
    }

    try {
      await requestJson(`/admin/entries/${entryId}/status`, {
        method: "PATCH",
        body: {
          acceptanceStatus: "shortlist",
          sendLifecycleMail: false,
          lifecycleEventType: "preselection"
        }
      });

      await requestJson(`/admin/entries/${entryId}/status`, {
        method: "PATCH",
        body: statusPayload
      });

      return { ok: true, viaShortlist: true };
    } catch (error) {
      if (await waitForTargetStatus()) {
        await enqueueLifecycleMailIfNeeded();
        return { ok: true, alreadyInTargetStatus: true };
      }
      throw error;
    }
  },

  async setEntryPaymentStatus(entryId: string, paymentStatus: "due" | "paid") {
    if (paymentStatus !== "paid") {
      throw new Error("Manuelles Zurücksetzen auf offen ist im Ledger-Flow nicht möglich.");
    }

    await requestJson<AdminEntryPaymentStatusResponse>(`/admin/entries/${entryId}/payment-status`, {
      method: "PATCH",
      body: {
        paymentStatus: "paid",
        paidAt: new Date().toISOString(),
        note: "Als vollständig bezahlt markiert (Admin UI)"
      }
    });

    return { ok: true };
  },

  async setEntryPaymentAmounts(entryId: string, payload: { totalCents: number; paidAmountCents: number }) {
    await requestJson<AdminEntryPaymentAmountsResponse>(`/admin/entries/${entryId}/payment-amounts`, {
      method: "PATCH",
      body: {
        totalCents: Math.max(0, Math.floor(payload.totalCents)),
        paidAmountCents: Math.max(0, Math.floor(payload.paidAmountCents)),
        note: "Zahlungsdaten manuell angepasst (Admin UI)"
      }
    });

    return { ok: true };
  },

  async setEntryCheckinVerified(entryId: string) {
    await requestJson(`/admin/entries/${entryId}/checkin/id-verify`, {
      method: "PATCH",
      body: {
        checkinIdVerified: true
      }
    });

    return { ok: true };
  },

  async saveEntryNotes(entryId: string, payload: { internalNote: string; driverNote: string; status?: AcceptanceStatus }) {
    const body = {
      internalNote: payload.internalNote,
      driverNote: payload.driverNote
    };

    try {
      return await requestJson(`/admin/entries/${entryId}/notes`, {
        method: "PATCH",
        body
      });
    } catch (error) {
      if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 405)) {
        throw error;
      }
    }

    try {
      return await requestJson(`/admin/entries/${entryId}`, {
        method: "PATCH",
        body
      });
    } catch (error) {
      if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 405)) {
        throw error;
      }
    }

    if (!payload.status) {
      throw new Error("Notizen konnten nicht gespeichert werden: Notiz-Endpoint im Backend nicht verfügbar.");
    }

    return requestJson(`/admin/entries/${entryId}/status`, {
      method: "PATCH",
      body: {
        acceptanceStatus: payload.status,
        sendLifecycleMail: false,
        lifecycleEventType: lifecycleEventTypeForStatus(payload.status),
        internalNote: payload.internalNote,
        driverNote: payload.driverNote
      }
    });
  },

  async markConfirmationMailSent(entryId: string) {
    const context = await resolveEntryContext(entryId);
    await requestJson("/admin/mail/lifecycle/queue", {
      method: "POST",
      body: {
        eventId: context.eventId,
        entryId,
        eventType: "accepted_open_payment"
      }
    });

    return { ok: true };
  },

  async queueLifecycleMail(
    entryId: string,
    eventType: "accepted_open_payment" | "rejected",
    options?: { includeDriverNote?: boolean; allowDuplicate?: boolean }
  ) {
    const context = await resolveEntryContext(entryId);
    await requestJson("/admin/mail/lifecycle/queue", {
      method: "POST",
      body: {
        eventId: context.eventId,
        entryId,
        eventType,
        includeDriverNote: options?.includeDriverNote === true ? true : undefined,
        allowDuplicate: options?.allowDuplicate === true ? true : undefined
      }
    });

    return { ok: true };
  },

  async getEntryDocumentDownloadUrl(entryId: string, type: "waiver" | "tech_check") {
    const context = await resolveEntryContext(entryId);
    const response = await requestJson<{ ok: boolean; url: string }>(`/admin/documents/entry/${entryId}/download`, {
      query: {
        eventId: context.eventId,
        type
      }
    });

    return response.url;
  },

  async deleteEntry(entryId: string) {
    return requestJson<AdminEntryDeleteResponse>(`/admin/entries/${entryId}`, {
      method: "DELETE"
    });
  },

  async restoreEntry(entryId: string) {
    return requestJson<AdminEntryRestoreResponse>(`/admin/entries/${entryId}/restore`, {
      method: "POST"
    });
  }
};
