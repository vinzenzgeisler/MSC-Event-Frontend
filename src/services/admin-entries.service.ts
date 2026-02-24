import { mockAdminEntries, mockAdminEntryDetail, mockAdminEntryHistory } from "@/mock/admin-entries.mock";
import { getAdminEventId } from "@/services/api/event-context";
import { isMockApiEnabled, requestJson } from "@/services/api/http-client";
import type {
  AdminEntriesFilter,
  AdminEntryDetailDto,
  AdminEntryDetailViewModel,
  AdminEntryHistoryItem,
  AdminEntryListItem,
  AdminEntryListItemDto
} from "@/types/admin";
import type { AcceptanceStatus, PaymentStatus } from "@/types/common";

const entriesStore: AdminEntryListItemDto[] = mockAdminEntries.map((item) => ({ ...item }));
const detailStore: Record<string, AdminEntryDetailDto> = Object.fromEntries(
  Object.entries(mockAdminEntryDetail).map(([key, value]) => [key, JSON.parse(JSON.stringify(value)) as AdminEntryDetailDto])
);

type EntryContext = {
  eventId: string;
  driverPersonId: string;
};

const entryContextStore = new Map<string, EntryContext>();

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
  return value;
}

function parseName(first: string | null | undefined, last: string | null | undefined, fallback = "Unbekannt") {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || fallback;
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

function fromAdminEntryListDto(dto: AdminEntryListItemDto): AdminEntryListItem {
  return {
    id: dto.id,
    name: dto.name || parseName(dto.driverFirstName, dto.driverLastName, dto.driverEmail ?? `Eintrag ${dto.id}`),
    classLabel: dto.className,
    startNumber: dto.startNumber ?? dto.startNumberNorm ?? "-",
    vehicleLabel: dto.vehicleLabel,
    vehicleThumbUrl: dto.vehicleThumbUrl,
    status: dto.acceptanceStatus,
    payment: dto.paymentStatus ?? "due",
    checkin: dto.checkinIdVerified ? "bestätigt" : "offen",
    confirmationMailSent: Boolean(dto.confirmationMailSent),
    confirmationMailVerified: Boolean(dto.confirmationMailVerified),
    createdAt: asDateTime(dto.createdAt)
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

  return {
    id: dto.ids.entryId,
    headline: `${driverName} · ${vehicleLabel}`,
    classLabel: dto.className,
    startNumber: dto.startNumberNorm ?? "-",
    status: dto.acceptanceStatus,
    paymentStatus: dto.payment.paymentStatus,
    registrationStatus: dto.registrationStatus,
    checkinVerified: dto.checkin.checkinIdVerified,
    driver: {
      name: parseName(dto.person.driver.firstName, dto.person.driver.lastName),
      email: dto.person.driver.email ?? "-",
      birthdate: asDate(dto.person.driver.birthdate),
      phone: dto.person.driver.phone ?? "-",
      street: dto.person.driver.street ?? "-",
      zip: dto.person.driver.zip ?? "-",
      city: dto.person.driver.city ?? "-",
      addressLine: [dto.person.driver.street, dto.person.driver.zip, dto.person.driver.city].filter(Boolean).join(", ") || "-",
      emergencyContactName: dto.person.driver.emergencyContactName ?? "-",
      emergencyContactPhone: dto.person.driver.emergencyContactPhone ?? "-",
      motorsportHistory: dto.person.driver.motorsportHistory ?? "Keine Angabe"
    },
    codriver: {
      assigned: Boolean(codriver),
      label: codriver ? parseName(codriver.firstName, codriver.lastName) : "Nicht angegeben",
      firstName: codriver?.firstName ?? "-",
      lastName: codriver?.lastName ?? "-",
      email: codriver?.email ?? "-",
      birthdate: asDate(codriver?.birthdate),
      phone: codriver?.phone ?? "-",
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
    notes: dto.specialNotes ?? "Keine Hinweise",
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

function matchesFilter(item: AdminEntryListItemDto, filter: AdminEntriesFilter): boolean {
  if (filter.classId !== "all" && filter.classId !== item.classId && filter.classId !== item.className) {
    return false;
  }
  if (filter.acceptanceStatus !== "all" && filter.acceptanceStatus !== item.acceptanceStatus) {
    return false;
  }
  if (filter.paymentStatus !== "all" && filter.paymentStatus !== item.paymentStatus) {
    return false;
  }
  if (filter.checkinIdVerified !== "all" && String(item.checkinIdVerified) !== filter.checkinIdVerified) {
    return false;
  }
  if (!filter.query.trim()) {
    return true;
  }
  const query = filter.query.toLowerCase();
  return (
    (item.name ?? "").toLowerCase().includes(query) ||
    (item.startNumber ?? item.startNumberNorm ?? "").toLowerCase().includes(query) ||
    (item.vehicleLabel ?? "").toLowerCase().includes(query)
  );
}

type AdminEntriesListResponse = {
  ok: boolean;
  entries: AdminEntryListItemDto[];
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

type AdminInvoicesListResponse = {
  ok: boolean;
  invoices: Array<{
    id: string;
    eventId: string;
    driverPersonId: string;
    totalCents: number;
    paymentStatus: PaymentStatus;
    paidAmountCents: number | null;
    amountOpenCents: number | null;
  }>;
};

type AdminInvoicePaymentMutationResponse = {
  ok: boolean;
  invoice: {
    id: string;
    totalCents: number;
    paidAmountCents: number | null;
    amountOpenCents: number | null;
    paymentStatus: PaymentStatus;
  };
};

type AdminEntryDeleteResponse = {
  ok: boolean;
  deletedEntryId: string;
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

async function findInvoiceForEntry(entryId: string) {
  const context = await resolveEntryContext(entryId);
  const response = await requestJson<AdminInvoicesListResponse>("/admin/invoices", {
    query: {
      eventId: context.eventId,
      driverPersonId: context.driverPersonId
    }
  });

  const invoice = response.invoices?.[0];
  if (!invoice) {
    throw new Error("Keine Rechnung für diese Nennung gefunden.");
  }
  return invoice;
}

async function recordPayment(invoiceId: string, amountCents: number, note: string) {
  if (amountCents <= 0) {
    return;
  }

  await requestJson<AdminInvoicePaymentMutationResponse>(`/admin/invoices/${invoiceId}/payments`, {
    method: "POST",
    body: {
      amountCents,
      paidAt: new Date().toISOString(),
      method: "other",
      note
    }
  });
}

export const adminEntriesService = {
  async listEntries(filter: AdminEntriesFilter): Promise<AdminEntryListItem[]> {
    if (isMockApiEnabled()) {
      return entriesStore.filter((item) => matchesFilter(item, filter)).map(fromAdminEntryListDto);
    }

    const eventId = await getAdminEventId();
    const response = await requestJson<AdminEntriesListResponse>("/admin/entries", {
      query: {
        eventId,
        q: filter.query.trim() || undefined,
        classId: filter.classId !== "all" ? filter.classId : undefined,
        acceptanceStatus: filter.acceptanceStatus !== "all" ? filter.acceptanceStatus : undefined,
        paymentStatus: filter.paymentStatus !== "all" ? filter.paymentStatus : undefined,
        checkinIdVerified: filter.checkinIdVerified !== "all" ? filter.checkinIdVerified === "true" : undefined,
        limit: 100,
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

    return response.entries.map((item) => ({
      id: item.id,
      name: parseName(item.driverFirstName, item.driverLastName, item.driverEmail ?? `Eintrag ${item.id}`),
      classLabel: item.className,
      startNumber: item.startNumberNorm ?? "-",
      vehicleLabel: item.vehicleLabel,
      vehicleThumbUrl: item.vehicleThumbUrl,
      status: item.acceptanceStatus,
      payment: item.paymentStatus ?? "due",
      checkin: item.checkinIdVerified ? "bestätigt" : "offen",
      confirmationMailSent: Boolean(item.confirmationMailSent),
      confirmationMailVerified: Boolean(item.confirmationMailVerified),
      createdAt: asDateTime(item.createdAt)
    }));
  },

  async getEntryDetail(entryId: string): Promise<AdminEntryDetailViewModel | null> {
    if (isMockApiEnabled()) {
      const detail = detailStore[entryId];
      if (!detail) {
        return null;
      }
      return fromAdminEntryDetailDto(
        detail,
        (mockAdminEntryHistory[entryId] ?? []).map((item) => ({
          id: item.id,
          action: item.action,
          actorUserId: item.actor,
          createdAt: item.timestamp,
          payload: { details: item.details }
        }))
      );
    }

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

  async setEntryStatus(entryId: string, transition: "to_shortlist" | "to_accepted" | "to_rejected") {
    if (isMockApiEnabled()) {
      const nextStatus = transition === "to_shortlist" ? "shortlist" : transition === "to_accepted" ? "accepted" : "rejected";
      const row = entriesStore.find((item) => item.id === entryId);
      if (row) {
        row.acceptanceStatus = nextStatus;
      }
      const detail = detailStore[entryId];
      if (detail) {
        detail.acceptanceStatus = nextStatus;
      }
      return { ok: true };
    }

    const statusMap: Record<typeof transition, { status: AcceptanceStatus; lifecycleEventType: string }> = {
      to_shortlist: { status: "shortlist", lifecycleEventType: "preselection" },
      to_accepted: { status: "accepted", lifecycleEventType: "accepted_open_payment" },
      to_rejected: { status: "rejected", lifecycleEventType: "rejected" }
    };

    const mapped = statusMap[transition];

    await requestJson(`/admin/entries/${entryId}/status`, {
      method: "PATCH",
      body: {
        acceptanceStatus: mapped.status,
        sendLifecycleMail: true,
        lifecycleEventType: mapped.lifecycleEventType
      }
    });

    return { ok: true };
  },

  async setEntryPaymentStatus(entryId: string, paymentStatus: "due" | "paid") {
    if (isMockApiEnabled()) {
      const row = entriesStore.find((item) => item.id === entryId);
      if (row) {
        row.paymentStatus = paymentStatus;
      }
      const detail = detailStore[entryId];
      if (detail) {
        detail.payment.paymentStatus = paymentStatus;
        if (paymentStatus === "paid") {
          detail.payment.paidAmountCents = detail.payment.totalCents;
          detail.payment.amountOpenCents = 0;
        } else {
          detail.payment.paidAmountCents = 0;
          detail.payment.amountOpenCents = detail.payment.totalCents;
        }
      }
      return { ok: true };
    }

    if (paymentStatus !== "paid") {
      throw new Error("Manuelles Zurücksetzen auf offen ist im Ledger-Flow nicht möglich.");
    }

    const invoice = await findInvoiceForEntry(entryId);
    const openAmount = invoice.amountOpenCents ?? Math.max(0, invoice.totalCents - (invoice.paidAmountCents ?? 0));
    await recordPayment(invoice.id, openAmount, "Als vollständig bezahlt markiert (Admin UI)");

    return { ok: true };
  },

  async setEntryPaymentAmounts(entryId: string, payload: { totalCents: number; paidAmountCents: number }) {
    if (isMockApiEnabled()) {
      const row = entriesStore.find((item) => item.id === entryId);
      const detail = detailStore[entryId];
      if (!detail) {
        return { ok: false };
      }

      const total = Math.max(0, Math.floor(payload.totalCents));
      const paid = Math.max(0, Math.min(total, Math.floor(payload.paidAmountCents)));
      const open = Math.max(0, total - paid);
      const status = open === 0 ? "paid" : "due";

      detail.payment.totalCents = total;
      detail.payment.paidAmountCents = paid;
      detail.payment.amountOpenCents = open;
      detail.payment.paymentStatus = status;

      if (row) {
        row.paymentStatus = status;
      }

      return { ok: true };
    }

    const invoice = await findInvoiceForEntry(entryId);
    const currentPaid = invoice.paidAmountCents ?? 0;
    const targetPaid = Math.max(0, Math.floor(payload.paidAmountCents));
    const delta = targetPaid - currentPaid;

    if (delta <= 0) {
      return { ok: true };
    }

    await recordPayment(invoice.id, delta, "Zusätzliche Zahlung verbucht (Admin UI)");
    return { ok: true };
  },

  async setEntryCheckinVerified(entryId: string) {
    if (isMockApiEnabled()) {
      const row = entriesStore.find((item) => item.id === entryId);
      if (row) {
        row.checkinIdVerified = true;
      }
      const detail = detailStore[entryId];
      if (detail) {
        detail.checkin.checkinIdVerified = true;
        detail.checkin.checkinIdVerifiedAt = new Date().toISOString();
      }
      return { ok: true };
    }

    await requestJson(`/admin/entries/${entryId}/checkin/id-verify`, {
      method: "PATCH",
      body: {
        checkinIdVerified: true
      }
    });

    return { ok: true };
  },

  async saveEntryNotes(entryId: string, payload: { internalNote: string; driverNote: string }) {
    if (isMockApiEnabled()) {
      const detail = detailStore[entryId] as (AdminEntryDetailDto & { internalNote?: string; driverNote?: string }) | undefined;
      if (detail) {
        detail.internalNote = payload.internalNote;
        detail.driverNote = payload.driverNote;
      }
      return { ok: true };
    }

    return requestJson(`/admin/entries/${entryId}/notes`, {
      method: "PATCH",
      body: {
        internalNote: payload.internalNote,
        driverNote: payload.driverNote
      }
    });
  },

  async markConfirmationMailSent(entryId: string) {
    if (isMockApiEnabled()) {
      const row = entriesStore.find((item) => item.id === entryId);
      if (row) {
        row.confirmationMailSent = true;
      }
      const detail = detailStore[entryId] as (AdminEntryDetailDto & { confirmationMailSent?: boolean }) | undefined;
      if (detail) {
        detail.confirmationMailSent = true;
      }
      return { ok: true };
    }

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

  async getEntryDocumentDownloadUrl(entryId: string, type: "waiver" | "tech_check") {
    if (isMockApiEnabled()) {
      return null;
    }

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
    if (isMockApiEnabled()) {
      const rowIndex = entriesStore.findIndex((item) => item.id === entryId);
      if (rowIndex >= 0) {
        entriesStore.splice(rowIndex, 1);
      }
      delete detailStore[entryId];
      entryContextStore.delete(entryId);
      return { ok: true };
    }

    return requestJson<AdminEntryDeleteResponse>(`/admin/entries/${entryId}`, {
      method: "DELETE"
    });
  }
};
