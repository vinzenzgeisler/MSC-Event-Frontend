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
    createdAt: new Date(dto.createdAt).toLocaleString("de-DE")
  };
}

function fromAdminEntryDetailDto(dto: AdminEntryDetailDto): AdminEntryDetailViewModel {
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
      address: [dto.person.driver.street, dto.person.driver.zip, dto.person.driver.city].filter(Boolean).join(", ") || "-",
      emergencyContact:
        [dto.person.driver.emergencyContactName, dto.person.driver.emergencyContactPhone].filter(Boolean).join(" · ") || "-"
    },
    vehicle: {
      label: [dto.vehicle.make, dto.vehicle.model].filter(Boolean).join(" ") || "Fahrzeug",
      thumbUrl: dto.vehicle.imageS3Key,
      facts: [
        `Typ: ${dto.vehicle.vehicleType}`,
        `Hubraum: ${dto.vehicle.displacementCcm ?? "-"} ccm`,
        `Motor: ${dto.vehicle.engineType ?? "-"}`,
        `Zylinder: ${dto.vehicle.cylinders ?? "-"}`,
        `Bremsen: ${dto.vehicle.brakes ?? "-"}`
      ]
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

  async setEntryStatus(entryId: string, transition: "to_shortlist" | "to_accepted") {
    const nextStatus = transition === "to_shortlist" ? "shortlist" : "accepted";
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
  }
};
