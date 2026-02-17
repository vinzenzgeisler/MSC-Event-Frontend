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
    confirmationMailSent: false,
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
    confirmationMailSent: true,
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
    confirmationMailSent: true,
    createdAt: "2026-02-16T10:03:00.000Z"
  }
];

export const mockAdminEntryDetail: Record<
  string,
  AdminEntryDetailDto & { motorsportHistory?: string; confirmationMailSent?: boolean; codriverName?: string }
> = {
  "ent-2041": {
    ids: {
      entryId: "ent-2041",
      eventId: "evt-2026-oberlausitz",
      classId: "cls-auto-elite",
      driverPersonId: "per-2041",
      codriverPersonId: "per-2041-co",
      vehicleId: "veh-2041",
      backupOfEntryId: null
    },
    className: "Auto Elite",
    registrationStatus: "submitted_verified",
    acceptanceStatus: "pending",
    startNumberNorm: "21A",
    isBackupVehicle: false,
    relatedEntryIds: ["ent-2041"],
    person: {
      driver: {
        firstName: "Lena",
        lastName: "Berger",
        email: "lena.berger@example.com",
        birthdate: "1989-03-14",
        phone: "+49 171 1234567",
        street: "Musterweg 8",
        zip: "02763",
        city: "Zittau",
        emergencyContactName: "Nico Berger",
        emergencyContactPhone: "+49 171 7654321"
      },
      codriver: {
        firstName: "Tom",
        lastName: "Berger",
        email: "tom.berger@example.com",
        birthdate: "1991-06-22",
        phone: "+49 171 4445566",
        street: "Musterweg 8",
        zip: "02763",
        city: "Zittau"
      }
    },
    vehicle: {
      vehicleType: "auto",
      make: "Porsche",
      model: "911",
      year: 1979,
      displacementCcm: 2994,
      engineType: "Boxer",
      cylinders: 6,
      brakes: "Scheibe vorne/hinten",
      ownerName: "Lena Berger",
      vehicleHistory: "Langjähriges Clubfahrzeug",
      imageS3Key: autoThumb
    },
    payment: {
      totalCents: 10500,
      paidAmountCents: 0,
      amountOpenCents: 10500,
      paymentStatus: "due"
    },
    checkin: {
      checkinIdVerified: false,
      checkinIdVerifiedAt: null,
      checkinIdVerifiedBy: null,
      techStatus: "pending",
      techCheckedAt: null,
      techCheckedBy: null
    },
    documents: [
      { id: "doc-waiver-2041", type: "waiver", status: "missing", createdAt: "2026-02-15T08:20:00.000Z" },
      { id: "doc-tech-2041", type: "tech-check", status: "open", createdAt: "2026-02-15T08:20:00.000Z" }
    ],
    specialNotes: "Anreise mit Servicefahrzeug am Vorabend.",
    motorsportHistory: "Mehrere regionale Bergrennen seit 2016, Fokus auf historische Tourenwagen.",
    confirmationMailSent: false,
    codriverName: "Tom Berger",
    consent: {
      termsAccepted: true,
      privacyAccepted: true,
      mediaAccepted: true,
      consentVersion: "2026-01",
      consentCapturedAt: "2026-02-15T08:12:00.000Z"
    },
    createdAt: "2026-02-15T08:12:00.000Z",
    updatedAt: "2026-02-15T08:20:00.000Z"
  },
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
    motorsportHistory: "2x Klassensieg Moto Open, regelmäßig bei Demo-Läufen in Sachsen vertreten.",
    confirmationMailSent: true,
    consent: {
      termsAccepted: true,
      privacyAccepted: true,
      mediaAccepted: true,
      consentVersion: "2026-01",
      consentCapturedAt: "2026-02-15T09:31:00.000Z"
    },
    createdAt: "2026-02-15T09:31:00.000Z",
    updatedAt: "2026-02-16T11:15:00.000Z"
  },
  "ent-2043": {
    ids: {
      entryId: "ent-2043",
      eventId: "evt-2026-oberlausitz",
      classId: "cls-auto-pro",
      driverPersonId: "per-2043",
      codriverPersonId: null,
      vehicleId: "veh-2043",
      backupOfEntryId: null
    },
    className: "Auto Pro",
    registrationStatus: "submitted_verified",
    acceptanceStatus: "shortlist",
    startNumberNorm: "8B",
    isBackupVehicle: false,
    relatedEntryIds: ["ent-2043"],
    person: {
      driver: {
        firstName: "Mila",
        lastName: "Hoffmann",
        email: "mila.hoffmann@example.com",
        birthdate: "1995-11-08",
        phone: "+49 160 2223344",
        street: "Bergstraße 21",
        zip: "02785",
        city: "Olbersdorf",
        emergencyContactName: "Tina Hoffmann",
        emergencyContactPhone: "+49 160 1122334"
      }
    },
    vehicle: {
      vehicleType: "auto",
      make: "BMW",
      model: "M3 E30",
      year: 1990,
      displacementCcm: 2302,
      engineType: "Reihe",
      cylinders: 4,
      brakes: "Scheibenbremse",
      ownerName: "Mila Hoffmann",
      vehicleHistory: "Bergcup Fahrzeug",
      imageS3Key: autoThumb
    },
    payment: {
      totalCents: 9900,
      paidAmountCents: 0,
      amountOpenCents: 9900,
      paymentStatus: "due"
    },
    checkin: {
      checkinIdVerified: false,
      checkinIdVerifiedAt: null,
      checkinIdVerifiedBy: null,
      techStatus: "pending",
      techCheckedAt: null,
      techCheckedBy: null
    },
    documents: [
      { id: "doc-waiver-2043", type: "waiver", status: "open", createdAt: "2026-02-16T10:04:00.000Z" },
      { id: "doc-tech-2043", type: "tech-check", status: "open", createdAt: "2026-02-16T10:04:00.000Z" }
    ],
    specialNotes: null,
    motorsportHistory: "Seit 2022 aktiver Einstieg in Bergrennen, Schwerpunkt Fahrzeugbeherrschung bei Nässe.",
    confirmationMailSent: true,
    consent: {
      termsAccepted: true,
      privacyAccepted: true,
      mediaAccepted: true,
      consentVersion: "2026-01",
      consentCapturedAt: "2026-02-16T10:03:00.000Z"
    },
    createdAt: "2026-02-16T10:03:00.000Z",
    updatedAt: "2026-02-16T10:04:00.000Z"
  }
};

export const mockAdminEntryHistory: Record<string, AdminEntryHistoryItem[]> = {
  "ent-2041": [
    {
      id: "h-2041-1",
      timestamp: "2026-02-15T08:12:00.000Z",
      actor: "system",
      action: "Nennung eingegangen",
      details: "Anmeldung im Portal erstellt"
    }
  ],
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
  ],
  "ent-2043": [
    {
      id: "h-2043-1",
      timestamp: "2026-02-16T10:03:00.000Z",
      actor: "system",
      action: "Nennung eingegangen",
      details: "Anmeldung im Portal erstellt"
    },
    {
      id: "h-2043-2",
      timestamp: "2026-02-16T10:20:00.000Z",
      actor: "admin",
      action: "Status gesetzt",
      details: "shortlist"
    }
  ]
};
