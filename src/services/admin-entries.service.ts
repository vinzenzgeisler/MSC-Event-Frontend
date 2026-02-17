import { mockAdminEntries, mockAdminEntryDetail, mockAdminEntryHistory } from "@/mock/admin-entries.mock";
import type {
  AdminEntriesFilter,
  AdminEntryDetailDto,
  AdminEntryDetailViewModel,
  AdminEntryListItem,
  AdminEntryListItemDto
} from "@/types/admin";

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
      email: dto.person.driver.email ?? "-"
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
  return item.name.toLowerCase().includes(query) || (item.startNumber ?? "").toLowerCase().includes(query);
}

export const adminEntriesService = {
  async listEntries(filter: AdminEntriesFilter): Promise<AdminEntryListItem[]> {
    return mockAdminEntries.filter((item) => matchesFilter(item, filter)).map(fromAdminEntryListDto);
  },

  async getEntryDetail(entryId: string): Promise<AdminEntryDetailViewModel | null> {
    const detail = mockAdminEntryDetail[entryId];
    if (!detail) {
      return null;
    }
    return fromAdminEntryDetailDto(detail);
  }
};
