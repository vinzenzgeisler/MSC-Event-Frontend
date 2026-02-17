import type { PublicEventOverview } from "@/types/registration";

export const mockPublicEvent: PublicEventOverview = {
  id: "evt-2026-oberlausitz",
  name: "12. Oberlausitzer Dreieck",
  startsAt: "2026-09-12",
  location: "Seifhennersdorf",
  registrationOpen: true,
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
