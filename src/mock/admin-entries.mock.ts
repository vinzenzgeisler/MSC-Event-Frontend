import type { AdminEntryDetailDto, AdminEntryHistoryItem, AdminEntryListItemDto } from "@/types/admin";
import autoThumb from "@/assets/vehicle-auto.svg";
import motoThumb from "@/assets/vehicle-moto.svg";

export const mockAdminEntries: AdminEntryListItemDto[] = [
  {
    id: "ent-2041",
    name: "Lena Berger",
    className: "Auto Elite",
    startNumber: "21A",
    vehicleLabel: "Porsche 911",
    vehicleThumbUrl: autoThumb,
    acceptanceStatus: "pending",
    paymentStatus: "due",
    checkinIdVerified: false,
    createdAt: "2026-02-15T08:12:00.000Z"
  },
  {
    id: "ent-2042",
    name: "Rashid Khan",
    className: "Moto Open",
    startNumber: "77",
    vehicleLabel: "Yamaha YZF",
    vehicleThumbUrl: motoThumb,
    acceptanceStatus: "accepted",
    paymentStatus: "paid",
    checkinIdVerified: true,
    createdAt: "2026-02-15T09:31:00.000Z"
  },
  {
    id: "ent-2043",
    name: "Mila Hoffmann",
    className: "Auto Pro",
    startNumber: "8B",
    vehicleLabel: "BMW M3 E30",
    vehicleThumbUrl: autoThumb,
    acceptanceStatus: "shortlist",
    paymentStatus: "due",
    checkinIdVerified: false,
    createdAt: "2026-02-16T10:03:00.000Z"
  }
];

export const mockAdminEntryDetail: Record<string, AdminEntryDetailDto> = {
  "ent-2042": {
    ids: {
      entryId: "ent-2042",
      eventId: "evt-2026-oberlausitz",
      classId: "cls-moto-open",
      driverPersonId: "per-2042",
      codriverPersonId: null,
      vehicleId: "veh-2042",
      backupOfEntryId: null
    },
    className: "Moto Open",
    registrationStatus: "submitted_verified",
    acceptanceStatus: "accepted",
    startNumberNorm: "77",
    isBackupVehicle: false,
    relatedEntryIds: ["ent-2042"],
    person: {
      driver: {
        firstName: "Rashid",
        lastName: "Khan",
        email: "rashid@example.com",
        birthdate: "1992-05-11",
        phone: "+49 176 44112233",
        street: "Hauptstraße 12",
        zip: "02763",
        city: "Zittau",
        emergencyContactName: "Samir Khan",
        emergencyContactPhone: "+49 176 99887766"
      }
    },
    vehicle: {
      vehicleType: "moto",
      make: "Yamaha",
      model: "YZF",
      year: 2018,
      displacementCcm: 599,
      engineType: "4-Takt",
      cylinders: 4,
      brakes: "Scheibenbremse",
      ownerName: "Rashid Khan",
      vehicleHistory: "2x Klassensieger Regional",
      imageS3Key: motoThumb
    },
    payment: {
      totalCents: 8900,
      paidAmountCents: 8900,
      amountOpenCents: 0,
      paymentStatus: "paid"
    },
    checkin: {
      checkinIdVerified: true,
      checkinIdVerifiedAt: "2026-09-12T08:21:00.000Z",
      checkinIdVerifiedBy: "admin",
      techStatus: "passed",
      techCheckedAt: "2026-09-12T08:33:00.000Z",
      techCheckedBy: "tech-1"
    },
    documents: [
      { id: "doc-waiver-1", type: "waiver", status: "ready", createdAt: "2026-09-11T16:00:00.000Z" },
      { id: "doc-tech-1", type: "tech-check", status: "ready", createdAt: "2026-09-11T16:05:00.000Z" }
    ],
    specialNotes: "Bitte Fahrerlagerplatz nahe Werkstatt.",
    consent: {
      termsAccepted: true,
      privacyAccepted: true,
      mediaAccepted: true,
      consentVersion: "2026-01",
      consentCapturedAt: "2026-02-15T09:31:00.000Z"
    },
    createdAt: "2026-02-15T09:31:00.000Z",
    updatedAt: "2026-02-16T11:15:00.000Z"
  }
};

export const mockAdminEntryHistory: Record<string, AdminEntryHistoryItem[]> = {
  "ent-2042": [
    {
      id: "h-1",
      timestamp: "2026-02-15T09:31:00.000Z",
      actor: "system",
      action: "Nennung eingegangen",
      details: "Anmeldung im Portal erstellt"
    },
    {
      id: "h-2",
      timestamp: "2026-02-15T10:00:00.000Z",
      actor: "admin",
      action: "Status gesetzt",
      details: "accepted"
    },
    {
      id: "h-3",
      timestamp: "2026-09-12T08:21:00.000Z",
      actor: "checkin",
      action: "Check-in bestätigt",
      details: "Ausweis geprüft"
    }
  ]
};
