import type { VehicleType } from "@/types/common";

export type AdminEventStatus = "draft" | "open" | "closed" | "archived";

export type AdminSettingsEvent = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: AdminEventStatus;
  isCurrent: boolean;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  openedAt: string | null;
  closedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminSettingsEventForm = {
  name: string;
  startsAt: string;
  endsAt: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
};

export type AdminSettingsClass = {
  id: string;
  eventId: string;
  name: string;
  vehicleType: VehicleType;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminSettingsClassDraft = {
  name: string;
  vehicleType: VehicleType;
};

export type AdminSettingsPricingClassRule = {
  classId: string;
  className: string;
  baseFeeCents: string;
};

export type AdminSettingsPricingForm = {
  earlyDeadline: string;
  lateFeeCents: string;
  secondVehicleDiscountCents: string;
  classRules: AdminSettingsPricingClassRule[];
};
