import { mockAdminEntries, mockAdminEntryDetail, mockAdminEntryHistory } from "@/mock/admin-entries.mock";
import type {
  AdminEntriesFilter,
  AdminEntryDetailDto,
  AdminEntryDetailViewModel,
  AdminEntryListItem,
  AdminEntryListItemDto
} from "@/types/admin";

const entriesStore: AdminEntryListItemDto[] = mockAdminEntries.map((item) => ({ ...item }));
const detailStore: Record<string, AdminEntryDetailDto> = Object.fromEntries(
  Object.entries(mockAdminEntryDetail).map(([key, value]) => [key, JSON.parse(JSON.stringify(value)) as AdminEntryDetailDto])
);

function fromAdminEntryListDto(dto: AdminEntryListItemDto): AdminEntryListItem {
  return {
    id: dto.id,
    name: dto.name,
    classLabel: dto.className,
    startNumber: dto.startNumber ?? "-",
    vehicleLabel: dto.vehicleLabel,
    vehicleThumbUrl: dto.vehicleThumbUrl,
    status: dto.acceptanceStatus,
    payment: dto.paymentStatus,
    checkin: dto.checkinIdVerified ? "bestätigt" : "offen",
    confirmationMailSent: dto.confirmationMailSent,
    createdAt: new Date(dto.createdAt).toLocaleString("de-DE")
  };
}

function fromAdminEntryDetailDto(dto: AdminEntryDetailDto): AdminEntryDetailViewModel {
  const enriched = dto as AdminEntryDetailDto & {
    motorsportHistory?: string;
    confirmationMailSent?: boolean;
    codriverName?: string;
  };
  const codriver = dto.person.codriver;
  const codriverName =
    [codriver?.firstName, codriver?.lastName].filter(Boolean).join(" ") ||
    (dto.ids.codriverPersonId ? (enriched.codriverName ?? `Person-ID ${dto.ids.codriverPersonId}`) : "Nicht angegeben");
  const driverName = [dto.person.driver.firstName, dto.person.driver.lastName].filter(Boolean).join(" ") || "Unbekannt";
  return {
    id: dto.ids.entryId,
    headline: `Nennung ${dto.ids.entryId}`,
    classLabel: dto.className,
    startNumber: dto.startNumberNorm ?? "-",
    status: dto.acceptanceStatus,
    paymentStatus: dto.payment.paymentStatus,
    registrationStatus: dto.registrationStatus,
    checkinVerified: dto.checkin.checkinIdVerified,
    driver: {
      name: driverName,
      email: dto.person.driver.email ?? "-",
      birthdate: dto.person.driver.birthdate ?? "-",
      phone: dto.person.driver.phone ?? "-",
      street: dto.person.driver.street ?? "-",
      zip: dto.person.driver.zip ?? "-",
      city: dto.person.driver.city ?? "-",
      addressLine: [dto.person.driver.street, dto.person.driver.zip, dto.person.driver.city].filter(Boolean).join(", ") || "-",
      emergencyContactName: dto.person.driver.emergencyContactName ?? "-",
      emergencyContactPhone: dto.person.driver.emergencyContactPhone ?? "-",
      motorsportHistory: enriched.motorsportHistory ?? "Keine Angabe"
    },
    codriver: {
      assigned: Boolean(dto.ids.codriverPersonId),
      label: codriverName,
      firstName: codriver?.firstName ?? "-",
      lastName: codriver?.lastName ?? "-",
      email: codriver?.email ?? "-",
      birthdate: codriver?.birthdate ?? "-",
      phone: codriver?.phone ?? "-",
      street: codriver?.street ?? "-",
      zip: codriver?.zip ?? "-",
      city: codriver?.city ?? "-",
      addressLine: [codriver?.street, codriver?.zip, codriver?.city].filter(Boolean).join(", ") || "-"
    },
    vehicle: {
      label: [dto.vehicle.make, dto.vehicle.model].filter(Boolean).join(" ") || "Fahrzeug",
      thumbUrl: dto.vehicle.imageS3Key,
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
    consent: dto.consent,
    documents: dto.documents.map((doc) => ({ id: doc.id, type: doc.type, status: doc.status })),
    relatedEntryIds: dto.relatedEntryIds,
    notes: dto.specialNotes ?? "Keine Hinweise",
    confirmationMailSent: Boolean(enriched.confirmationMailSent),
    internalNote: (dto as AdminEntryDetailDto & { internalNote?: string }).internalNote ?? "",
    driverNote: (dto as AdminEntryDetailDto & { driverNote?: string }).driverNote ?? "",
    history: mockAdminEntryHistory[dto.ids.entryId] ?? []
  };
}

function matchesFilter(item: AdminEntryListItemDto, filter: AdminEntriesFilter): boolean {
  if (filter.classId !== "all" && filter.classId !== item.className) {
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
    item.name.toLowerCase().includes(query) ||
    (item.startNumber ?? "").toLowerCase().includes(query) ||
    item.vehicleLabel.toLowerCase().includes(query)
  );
}

export const adminEntriesService = {
  async listEntries(filter: AdminEntriesFilter): Promise<AdminEntryListItem[]> {
    return entriesStore.filter((item) => matchesFilter(item, filter)).map(fromAdminEntryListDto);
  },

  async getEntryDetail(entryId: string): Promise<AdminEntryDetailViewModel | null> {
    const detail = detailStore[entryId];
    if (!detail) {
      return null;
    }
    return fromAdminEntryDetailDto(detail);
  },

  async setEntryStatus(entryId: string, transition: "to_shortlist" | "to_accepted" | "to_rejected") {
    const nextStatus =
      transition === "to_shortlist" ? "shortlist" : transition === "to_accepted" ? "accepted" : "rejected";
    const row = entriesStore.find((item) => item.id === entryId);
    if (row) {
      row.acceptanceStatus = nextStatus;
    }
    const detail = detailStore[entryId];
    if (detail) {
      detail.acceptanceStatus = nextStatus;
    }
    return { ok: true };
  },

  async setEntryPaymentStatus(entryId: string, paymentStatus: "due" | "paid") {
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
  },

  async setEntryPaymentAmounts(entryId: string, payload: { totalCents: number; paidAmountCents: number }) {
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
  },

  async setEntryCheckinVerified(entryId: string) {
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
  },

  async saveEntryNotes(entryId: string, payload: { internalNote: string; driverNote: string }) {
    const detail = detailStore[entryId] as (AdminEntryDetailDto & { internalNote?: string; driverNote?: string }) | undefined;
    if (detail) {
      detail.internalNote = payload.internalNote;
      detail.driverNote = payload.driverNote;
    }
    return { ok: true };
  },

  async markConfirmationMailSent(entryId: string) {
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
};
