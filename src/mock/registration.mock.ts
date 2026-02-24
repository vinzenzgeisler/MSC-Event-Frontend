import type { PublicEventOverview } from "@/types/registration";

export const mockPublicEvent: PublicEventOverview = {
  id: "evt-2026-oberlausitz",
  name: "12. Oberlausitzer Dreieck",
  startsAt: "2026-09-12",
  endsAt: "2026-09-13",
  location: "Seifhennersdorf",
  registrationOpen: true,
  registrationOpenAt: "2026-05-01T08:00:00.000Z",
  registrationCloseAt: "2026-08-31T22:00:00.000Z",
  pricingRules: {
    earlyDeadline: "2026-07-31T22:00:00.000Z",
    lateFeeCents: 2500,
    secondVehicleDiscountCents: 2000,
    currency: "EUR",
    classRules: [
      { classId: "cls-auto-elite", className: "Auto Elite", baseFeeCents: 18000 },
      { classId: "cls-auto-pro", className: "Auto Pro", baseFeeCents: 18000 },
      { classId: "cls-moto-open", className: "Moto Open", baseFeeCents: 15000 },
      { classId: "cls-moto-legend", className: "Moto Legend", baseFeeCents: 15000 }
    ]
  },
  classes: [
    { id: "cls-auto-elite", name: "Auto Elite", vehicleType: "auto" },
    { id: "cls-auto-pro", name: "Auto Pro", vehicleType: "auto" },
    { id: "cls-moto-open", name: "Moto Open", vehicleType: "moto" },
    { id: "cls-moto-legend", name: "Moto Legend", vehicleType: "moto" }
  ]
};

export const mockReservedStartNumbers: Array<{ classId: string; startNumber: string; entryId: string }> = [
  { classId: "cls-auto-elite", startNumber: "21A", entryId: "ent-2041" },
  { classId: "cls-auto-pro", startNumber: "8B", entryId: "ent-2043" },
  { classId: "cls-moto-open", startNumber: "77", entryId: "ent-2042" }
];
