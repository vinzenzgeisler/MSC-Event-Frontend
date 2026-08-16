import type { LegalTexts } from "@/config/legal-texts";
import type { InspectionHistoryItem } from "@/services/technical-inspection.service";
import type { AdminEntryDetailDto, MailTemplate } from "@/types/admin";
import type { MarshalWorkspace } from "@/types/admin-marshals";
import type { AdminSettingsEntryConfirmationConfig, AdminSettingsEvent } from "@/types/admin-settings";
import type { AcceptanceStatus, PaymentStatus, TechStatus, VehicleType } from "@/types/common";
import type { DemoEntry, DemoState } from "@/demo/types";

export const DEMO_EVENT_ID = "event-demo-2026";

const entryConfirmationConfig: AdminSettingsEntryConfirmationConfig = {
  orgaCodePrefix: "DEMO",
  organizerName: "MSC Beispielstadt e. V. (fiktiv)",
  organizerAddressLine: "Musterweg 1, 00000 Beispielstadt",
  organizerContactEmail: "orga@demo.invalid",
  organizerContactPhone: "+49 000 000000",
  websiteUrl: "https://demo.invalid",
  gateHeadline: "Willkommen beim Demo-Bergslalom",
  venueName: "Fiktives Fahrerlager Nord",
  venueStreet: "Teststrecke 7",
  venueZip: "00000",
  venueCity: "Beispielstadt",
  paddockInfo: "Bitte den markierten Demo-Flächen folgen.",
  arrivalNotes: "Anreise am Samstag ab 07:00 Uhr.",
  accessNotes: "Zufahrt nur mit ausgedruckter Nennbestätigung.",
  importantNotes: ["Alle Angaben sind erfunden.", "Vor Ort gilt die Demo-Ausschreibung."],
  scheduleItems: [
    { label: "Dokumentenabnahme", startsAt: "2026-09-12T06:00:00.000Z", endsAt: "2026-09-12T08:00:00.000Z", note: "Im Rennbüro" },
    { label: "Trainingsläufe", startsAt: "2026-09-12T08:30:00.000Z", endsAt: "2026-09-12T10:30:00.000Z", note: "Zwei Läufe" }
  ],
  paymentRecipient: "MSC Beispielstadt e. V. (fiktiv)",
  paymentIban: "DE00000000000000000000",
  paymentBic: "DEMODE00XXX",
  paymentBankName: "Demobank",
  paymentReferencePrefix: "DEMO-2026"
};

const currentEvent: AdminSettingsEvent = {
  id: DEMO_EVENT_ID,
  name: "Demo-Bergslalom Beispielstadt 2026",
  startsAt: "2026-09-12T07:00:00.000Z",
  endsAt: "2026-09-13T17:00:00.000Z",
  contactEmail: "orga@demo.invalid",
  websiteUrl: "https://demo.invalid",
  status: "open",
  isCurrent: true,
  registrationOpenAt: "2026-06-01T08:00:00.000Z",
  registrationCloseAt: "2026-09-01T21:59:00.000Z",
  paymentDueAt: "2026-09-05T21:59:00.000Z",
  openedAt: "2026-06-01T08:00:00.000Z",
  closedAt: null,
  archivedAt: null,
  createdAt: "2026-04-12T10:00:00.000Z",
  updatedAt: "2026-08-14T15:30:00.000Z",
  entryConfirmationConfig
};

const archivedEvent: AdminSettingsEvent = {
  ...currentEvent,
  id: "event-demo-2025",
  name: "Demo-Herbstslalom 2025 (Archiv)",
  startsAt: "2025-09-13T07:00:00.000Z",
  endsAt: "2025-09-14T17:00:00.000Z",
  status: "archived",
  isCurrent: false,
  archivedAt: "2025-10-01T10:00:00.000Z"
};

type EntrySeed = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  city: string;
  classId: string;
  className: string;
  vehicleType: VehicleType;
  make: string;
  model: string;
  year: number;
  startNumber: string;
  acceptanceStatus: AcceptanceStatus;
  paymentStatus: PaymentStatus | null;
  paidAmountCents: number;
  checkin: boolean;
  techStatus: TechStatus;
  codriver?: { firstName: string; lastName: string };
  withdrawnReason?: string;
  withBackup?: boolean;
};

function makeEntry(seed: EntrySeed, index: number): DemoEntry {
  const createdAt = `2026-07-${String(10 + index).padStart(2, "0")}T${String(8 + index).padStart(2, "0")}:15:00.000Z`;
  const totalCents = seed.vehicleType === "moto" ? 9500 : 12500;
  const driverId = `person-${seed.id}`;
  const backupVehicle = seed.withBackup
    ? {
        vehicleType: seed.vehicleType,
        make: "Ersatz-Marke",
        model: "Reserve 2",
        year: 1988,
        displacementCcm: 1598,
        engineType: "Benzin",
        cylinders: 4,
        brakes: "Scheibenbremse",
        ownerName: `${seed.firstName} ${seed.lastName}`,
        vehicleHistory: "Fiktives Reservefahrzeug für die Demo.",
        imageS3Key: null
      }
    : null;

  const detail: AdminEntryDetailDto = {
    ids: {
      entryId: seed.id,
      eventId: DEMO_EVENT_ID,
      classId: seed.classId,
      driverPersonId: driverId,
      codriverPersonId: seed.codriver ? `codriver-${seed.id}` : null,
      vehicleId: `vehicle-${seed.id}`,
      backupVehicleId: backupVehicle ? `backup-${seed.id}` : null,
      backupClassId: backupVehicle ? seed.classId : null
    },
    className: seed.className,
    backupClassName: backupVehicle ? seed.className : null,
    registrationStatus: index === 4 ? "submitted_unverified" : "submitted_verified",
    acceptanceStatus: seed.acceptanceStatus,
    withdrawnReason: seed.withdrawnReason ?? null,
    withdrawnAt: seed.acceptanceStatus === "withdrawn" ? "2026-08-02T13:00:00.000Z" : null,
    withdrawnBy: seed.acceptanceStatus === "withdrawn" ? "Fahrer (Demo)" : null,
    orgaCode: `DEMO-${String(index + 1).padStart(3, "0")}`,
    startNumberNorm: seed.startNumber,
    isBackupVehicle: false,
    relatedEntryIds: [],
    vehicleLabel: `${seed.make} ${seed.model}`,
    vehicleThumbUrl: null,
    confirmationMailSent: index !== 4,
    confirmationMailVerified: index !== 4,
    waiverSigned: {
      signed: seed.acceptanceStatus === "accepted" && index % 2 === 0,
      signedAt: seed.acceptanceStatus === "accepted" && index % 2 === 0 ? "2026-08-10T09:00:00.000Z" : null,
      documentId: seed.acceptanceStatus === "accepted" && index % 2 === 0 ? `waiver-${seed.id}` : null
    },
    person: {
      driver: {
        firstName: seed.firstName,
        lastName: seed.lastName,
        email: seed.email,
        birthdate: `19${80 + index}-0${(index % 8) + 1}-15`,
        country: index === 3 ? "AT" : "DE",
        phone: `+49 000 1000${index}`,
        street: `Fiktivweg ${index + 1}`,
        zip: `0000${index}`,
        city: seed.city,
        emergencyContactName: "Erika Beispiel",
        emergencyContactPhone: "+49 000 999999",
        motorsportHistory: index % 2 ? "Erste Demo-Saison" : "Mehrere fiktive Clubslaloms"
      },
      codriver: seed.codriver
        ? {
            firstName: seed.codriver.firstName,
            lastName: seed.codriver.lastName,
            email: `${seed.codriver.firstName.toLowerCase()}.${seed.codriver.lastName.toLowerCase()}@demo.invalid`,
            birthdate: "1991-03-04",
            country: "DE",
            phone: "+49 000 200000",
            street: "Beispielallee 9",
            zip: "00009",
            city: "Musterdorf",
            emergencyContactName: null,
            emergencyContactPhone: null,
            motorsportHistory: "Fiktive Rallye-Erfahrung"
          }
        : null
    },
    vehicle: {
      vehicleType: seed.vehicleType,
      make: seed.make,
      model: seed.model,
      year: seed.year,
      displacementCcm: seed.vehicleType === "moto" ? 599 : 1998,
      engineType: seed.vehicleType === "moto" ? "Viertakt" : "Benzin",
      cylinders: 4,
      brakes: "Seriennah, geprüft",
      ownerName: `${seed.firstName} ${seed.lastName}`,
      vehicleHistory: "Fiktives Wettbewerbsfahrzeug, ausschließlich für lokale Demo-Daten.",
      imageS3Key: null
    },
    backupVehicle,
    backupVehicleThumbUrl: null,
    payment: {
      totalCents,
      paidAmountCents: seed.paidAmountCents,
      amountOpenCents: Math.max(0, totalCents - seed.paidAmountCents),
      paymentStatus: seed.paymentStatus
    },
    checkin: {
      checkinIdVerified: seed.checkin,
      checkinIdVerifiedAt: seed.checkin ? "2026-09-12T06:45:00.000Z" : null,
      checkinIdVerifiedBy: seed.checkin ? "Demo Administration" : null,
      techStatus: seed.techStatus,
      techCheckedAt: seed.techStatus !== "pending" ? "2026-09-12T07:10:00.000Z" : null,
      techCheckedBy: seed.techStatus !== "pending" ? "Tina Technik (Demo)" : null
    },
    documents: seed.acceptanceStatus === "accepted"
      ? [{ id: `doc-${seed.id}`, type: "waiver", status: "generated", driverPersonId: driverId, createdAt }]
      : [],
    specialNotes: index === 1 ? "Benötigt im Fahrerlager eine ruhige Stellfläche." : null,
    internalNote: index === 0 ? "Stammgast im fiktiven Demo-Club." : "",
    driverNote: index === 2 ? "Bitte Unterlagen am Rennbüro nachreichen." : "",
    inspectionNote: seed.techStatus === "failed" ? "Demo-Mangel: Batteriebefestigung prüfen." : "",
    consent: {
      termsAccepted: true,
      privacyAccepted: true,
      waiverAccepted: true,
      mediaAccepted: index % 2 === 0,
      clubInfoAccepted: false,
      guardian: null,
      consentVersion: "demo-2026-01",
      consentCapturedAt: createdAt
    },
    createdAt,
    updatedAt: "2026-08-14T12:00:00.000Z"
  };

  return {
    detail,
    history: [
      { id: `history-${seed.id}-1`, action: "public_entry_created", actorDisplay: "Öffentliche Anmeldung", createdAt, payload: null },
      ...(seed.techStatus !== "pending"
        ? [{ id: `history-${seed.id}-2`, action: "entry_tech_status_updated", actorDisplay: "Tina Technik (Demo)", createdAt: "2026-09-12T07:10:00.000Z", payload: { techStatus: seed.techStatus, target: "primary" } }]
        : [])
    ]
  };
}

const entrySeeds: EntrySeed[] = [
  { id: "entry-mara", firstName: "Mara", lastName: "Muster", email: "mara.muster@demo.invalid", city: "Beispielstadt", classId: "class-auto-historisch", className: "Automobile historisch", vehicleType: "auto", make: "Opel", model: "Kadett C (Demo)", year: 1978, startNumber: "17", acceptanceStatus: "accepted", paymentStatus: "paid", paidAmountCents: 12500, checkin: true, techStatus: "passed", codriver: { firstName: "Karla", lastName: "Kunstfigur" }, withBackup: true },
  { id: "entry-jonas", firstName: "Jonas", lastName: "Beispiel", email: "jonas.beispiel@demo.invalid", city: "Musterdorf", classId: "class-auto-modern", className: "Automobile modern", vehicleType: "auto", make: "Volkswagen", model: "Polo Demo", year: 2004, startNumber: "24", acceptanceStatus: "pending", paymentStatus: "due", paidAmountCents: 0, checkin: false, techStatus: "pending" },
  { id: "entry-leonie", firstName: "Leonie", lastName: "Fiktiv", email: "leonie.fiktiv@demo.invalid", city: "Testhausen", classId: "class-moto", className: "Motorräder bis 750 ccm", vehicleType: "moto", make: "Honda", model: "CBR Demo", year: 1998, startNumber: "M7", acceptanceStatus: "accepted", paymentStatus: "due", paidAmountCents: 4500, checkin: true, techStatus: "failed" },
  { id: "entry-sven", firstName: "Sven", lastName: "Platzhalter", email: "sven.platzhalter@demo.invalid", city: "Wien-Demo", classId: "class-auto-modern", className: "Automobile modern", vehicleType: "auto", make: "BMW", model: "318is Demo", year: 1992, startNumber: "31", acceptanceStatus: "rejected", paymentStatus: null, paidAmountCents: 0, checkin: false, techStatus: "pending" },
  { id: "entry-nora", firstName: "Nora", lastName: "Niemalsreal", email: "nora.niemalsreal@demo.invalid", city: "Probestadt", classId: "class-moto", className: "Motorräder bis 750 ccm", vehicleType: "moto", make: "Yamaha", model: "Demo 600", year: 2001, startNumber: "M12", acceptanceStatus: "withdrawn", paymentStatus: "due", paidAmountCents: 0, checkin: false, techStatus: "pending", withdrawnReason: "Fiktiver Terminkonflikt" },
  { id: "entry-emil", firstName: "Emil", lastName: "Erfunden", email: "emil.erfunden@demo.invalid", city: "Beispielstadt", classId: "class-auto-historisch", className: "Automobile historisch", vehicleType: "auto", make: "Ford", model: "Escort Demo", year: 1976, startNumber: "42", acceptanceStatus: "shortlist", paymentStatus: "due", paidAmountCents: 0, checkin: false, techStatus: "pending", codriver: { firstName: "Ronja", lastName: "ReinDemo" } }
];

const legalTexts: LegalTexts = {
  footerPrivacyLabel: "Datenschutz (Demo)", footerImprintLabel: "Impressum (Demo)", footerTermsLabel: "Teilnahmebedingungen (Demo)", footerWaiverLabel: "Haftverzicht (Demo)",
  guardianSectionTitle: "Erziehungsberechtigte Person", guardianFullNameLabel: "Vollständiger Name", guardianEmailLabel: "E-Mail", guardianPhoneLabel: "Telefon", guardianConsentLabel: "Einwilligung liegt vor", legalPageBackLabel: "Zurück zur Anmeldung",
  summary: {
    title: "Rechtliches und Einwilligungen", mandatoryHintsTitle: "Hinweise", mandatoryHints: ["Dies ist eine lokale Demo ohne rechtsverbindliche Wirkung."],
    introTitle: "Demo-Hinweis", introBody: ["Die nachfolgenden Texte sind Platzhalter für die lokale Produktdemo."], voluntaryTitle: "Freiwillige Angaben", voluntaryBody: "Optionale Einwilligungen können jederzeit geändert werden.", waiverNoticeTitle: "Haftverzicht", waiverNoticeBody: "Demo-Haftverzicht ohne rechtliche Wirkung.", linksTitle: "Dokumente", requiredTitle: "Erforderlich", optionalTitle: "Optional", termsAcceptanceLabel: "Ich akzeptiere die Demo-Teilnahmebedingungen.", privacyAcceptanceLabel: "Ich habe die Demo-Datenschutzhinweise gelesen.", waiverAcceptanceLabel: "Ich akzeptiere den Demo-Haftverzicht.", mediaAcceptanceLabel: "Ich stimme Demo-Bildaufnahmen zu.", clubInfoAcceptanceLabel: "Ich möchte fiktive Clubinformationen erhalten.", minorNotice: "Bei Minderjährigen sind Angaben einer erziehungsberechtigten Person erforderlich."
  },
  docs: Object.fromEntries(["impressum", "datenschutz", "teilnahmebedingungen", "haftverzicht"].map((id) => [id, { id, title: `${id[0].toUpperCase()}${id.slice(1)} (Demo)`, summaryLinkLabel: `${id} öffnen`, intro: ["Fiktiver Demo-Text."], sections: [{ title: "Lokaler Demo-Modus", paragraphs: ["Diese Inhalte dienen nur der Bedienungsdemo und sind nicht rechtsverbindlich."] }] }])) as LegalTexts["docs"]
};

const mailTemplate: MailTemplate = {
  key: "demo_event_info", label: "Demo: Veranstaltungsinformation", subject: "Informationen zum {{event.name}}", bodyText: "Hallo {{driver.firstName}},\n\ndies ist eine lokale Demo-Nachricht.", bodyHtml: "<p>Hallo {{driver.firstName}},</p><p>dies ist eine lokale Demo-Nachricht.</p>", version: 2, status: "published", updatedAt: "2026-08-10T12:00:00.000Z", updatedBy: "admin@demo.invalid", isActive: true, scope: "campaign", channels: ["campaign", "detail"], composer: { enabled: true, fields: [], allowedPlaceholders: ["driver.firstName", "event.name"], requiredPlaceholders: [] }, renderOptions: { showBadgeDefault: true, defaultMailLabel: "Demo-Information", includeEntryContextDefault: false }
};

const marshalWorkspace: MarshalWorkspace = {
  days: [
    { id: "day-sat", eventId: DEMO_EVENT_ID, dayKey: "saturday", label: "Samstag", eventDate: "2026-09-12" },
    { id: "day-sun", eventId: DEMO_EVENT_ID, dayKey: "sunday", label: "Sonntag", eventDate: "2026-09-13" }
  ],
  sections: [
    { id: "section-a", eventId: DEMO_EVENT_ID, code: "A", name: "Startbereich", leaderCode: "AL", sortOrder: 1 },
    { id: "section-b", eventId: DEMO_EVENT_ID, code: "B", name: "Waldkurve", leaderCode: "BL", sortOrder: 2 }
  ],
  posts: [
    { id: "post-a1", eventId: DEMO_EVENT_ID, sectionId: "section-a", code: "A1", description: "Vorstart", targetStaff: 2, emergencyTargetStaff: 1, mapX: 140, mapY: 730, isActive: true, sortOrder: 1 },
    { id: "post-b1", eventId: DEMO_EVENT_ID, sectionId: "section-b", code: "B1", description: "Waldkurve außen", targetStaff: 3, emergencyTargetStaff: 2, mapX: 610, mapY: 330, isActive: true, sortOrder: 2 }
  ],
  people: [], trainings: [{ id: "training-demo", eventId: DEMO_EVENT_ID, sessionType: "briefing", title: "Streckenposten-Briefing (Demo)", sessionDate: "2026-09-11T17:00:00.000Z", location: "Fiktives Clubheim", note: null }], trainingParticipants: [], qualifications: []
};

for (let index = 0; index < 4; index += 1) {
  const personId = `marshal-${index + 1}`;
  const participationId = `participation-${index + 1}`;
  marshalWorkspace.people.push({
    id: personId, helperNumber: 100 + index, firstName: ["Hanna", "Peer", "Lina", "Tom"][index], lastName: ["Hilfsbereit", "Posten", "Leitfigur", "Testperson"][index], street: "Demohelferweg 1", zip: "00000", city: "Beispielstadt", birthdate: `198${index}-01-01`, phone: `+49 000 30000${index}`, email: `helfer${index + 1}@demo.invalid`, shirtSize: ["M", "L", "S", "XL"][index], clubMember: index % 2 === 0, licenseNumber: null, vehicleRegistration: "DE-MO 123", activityAreas: index === 2 ? ["section_leader"] : ["marshal"], note: null, isActive: true,
    participation: { id: participationId, eventId: DEMO_EVENT_ID, personId, contactOwner: "Demo-Orga", wish: index === 1 ? "Gerne Waldkurve" : null, note: null, shirtSizeSnapshot: ["M", "L", "S", "XL"][index] },
    assignments: marshalWorkspace.days.map((day, dayIndex) => ({ id: `assignment-${index}-${dayIndex}`, participationId, dayId: day.id, commitmentStatus: index === 3 ? "pending" : "accepted", role: index === 2 ? "section_leader" : "marshal", sectionId: index < 2 ? "section-a" : "section-b", postId: index < 2 ? "post-a1" : "post-b1", functionCode: null, note: null }))
  });
}

export function createDemoState(): DemoState {
  const entries = entrySeeds.map(makeEntry);
  const inspectionHistory: Record<string, InspectionHistoryItem[]> = {};
  entries.forEach(({ detail }) => {
    inspectionHistory[detail.ids.entryId] = detail.checkin.techStatus === "pending" ? [] : [{ id: `inspection-${detail.ids.entryId}`, status: detail.checkin.techStatus, target: "primary", note: detail.inspectionNote ?? null, inspectorUserId: "demo-inspector", inspectorEmail: "technik@demo.invalid", inspectorDisplay: "Tina Technik (Demo)", createdAt: detail.checkin.techCheckedAt ?? "2026-09-12T07:10:00.000Z" }];
  });

  return {
    events: [currentEvent, archivedEvent].map((event) => structuredClone(event)),
    classes: [
      { id: "class-auto-historisch", eventId: DEMO_EVENT_ID, name: "Automobile historisch", vehicleType: "auto", allowsCodriver: true, registrationClosed: false, runGroupId: "run-auto", createdAt: "2026-04-12T10:00:00.000Z", updatedAt: "2026-08-01T10:00:00.000Z" },
      { id: "class-auto-modern", eventId: DEMO_EVENT_ID, name: "Automobile modern", vehicleType: "auto", allowsCodriver: false, registrationClosed: false, runGroupId: "run-auto", createdAt: "2026-04-12T10:00:00.000Z", updatedAt: "2026-08-01T10:00:00.000Z" },
      { id: "class-moto", eventId: DEMO_EVENT_ID, name: "Motorräder bis 750 ccm", vehicleType: "moto", allowsCodriver: false, registrationClosed: false, runGroupId: "run-moto", createdAt: "2026-04-12T10:00:00.000Z", updatedAt: "2026-08-01T10:00:00.000Z" }
    ],
    runGroups: [{ id: "run-auto", eventId: DEMO_EVENT_ID, name: "Automobile", classIds: ["class-auto-historisch", "class-auto-modern"] }, { id: "run-moto", eventId: DEMO_EVENT_ID, name: "Motorräder", classIds: ["class-moto"] }],
    entryConfirmationConfig: structuredClone(entryConfirmationConfig),
    pricingRules: {
      [DEMO_EVENT_ID]: {
        eventId: DEMO_EVENT_ID,
        earlyDeadline: "2026-08-15T21:59:00.000Z",
        lateFeeCents: 2000,
        secondVehicleDiscountCents: 2500,
        currency: "EUR",
        classRules: [
          { classId: "class-auto-historisch", className: "Automobile historisch", baseFeeCents: 12500 },
          { classId: "class-auto-modern", className: "Automobile modern", baseFeeCents: 12500 },
          { classId: "class-moto", className: "Motorräder bis 750 ccm", baseFeeCents: 9500 }
        ]
      }
    },
    entries,
    inspectionHistory,
    iamUsers: [
      { id: "user-demo-admin", username: "admin@demo.invalid", email: "admin@demo.invalid", firstName: "Demo", lastName: "Administration", enabled: true, status: "CONFIRMED", emailVerified: true, roles: ["admin", "editor", "viewer", "technical_inspector", "marshal_manager"], createdAt: "2026-04-01T10:00:00.000Z", updatedAt: "2026-08-10T10:00:00.000Z" },
      { id: "user-demo-inspection", username: "technik@demo.invalid", email: "technik@demo.invalid", firstName: "Tina", lastName: "Technik", enabled: true, status: "CONFIRMED", emailVerified: true, roles: ["technical_inspector"], createdAt: "2026-05-01T10:00:00.000Z", updatedAt: "2026-08-10T10:00:00.000Z" }
    ],
    templates: [mailTemplate],
    outbox: [
      { id: "outbox-demo-1", eventId: DEMO_EVENT_ID, batchId: "batch-demo", toEmail: "mara.muster@demo.invalid", subject: "Nennung angenommen (Demo)", status: "sent", templateId: "accepted_open_payment", templateVersion: 1, attemptCount: 1, maxAttempts: 3, errorLast: null, createdAt: "2026-08-12T10:00:00.000Z" },
      { id: "outbox-demo-2", eventId: DEMO_EVENT_ID, batchId: null, toEmail: "jonas.beispiel@demo.invalid", subject: "Zahlungserinnerung (Demo)", status: "queued", templateId: "payment_reminder", templateVersion: 1, attemptCount: 0, maxAttempts: 3, errorLast: null, createdAt: "2026-08-14T09:00:00.000Z" }
    ],
    exports: [{ id: "export-demo-1", eventId: DEMO_EVENT_ID, type: "entries_csv", status: "succeeded", s3Key: null, createdBy: "admin@demo.invalid", createdAt: "2026-08-13T11:00:00.000Z", completedAt: "2026-08-13T11:00:02.000Z" }],
    marshalWorkspace: structuredClone(marshalWorkspace),
    counter: 100
  };
}

export const demoLegalTexts = legalTexts;
export const demoEntryConfirmationConfig = entryConfirmationConfig;
