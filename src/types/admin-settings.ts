import type { VehicleType } from "@/types/common";

export type AdminEventStatus = "draft" | "open" | "closed" | "archived";

export type AdminSettingsEntryConfirmationScheduleItem = {
  label: string;
  startsAt: string;
  endsAt: string;
  note: string;
};

export type AdminSettingsEntryConfirmationConfig = {
  orgaCodePrefix: string;
  organizerName: string;
  organizerAddressLine: string;
  organizerContactEmail: string;
  organizerContactPhone: string;
  websiteUrl: string;
  gateHeadline: string;
  venueName: string;
  venueStreet: string;
  venueZip: string;
  venueCity: string;
  paddockInfo: string;
  arrivalNotes: string;
  accessNotes: string;
  importantNotes: string[];
  scheduleItems: AdminSettingsEntryConfirmationScheduleItem[];
  paymentRecipient: string;
  paymentIban: string;
  paymentBic: string;
  paymentBankName: string;
  paymentReferencePrefix: string;
};

export type AdminSettingsEvent = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  contactEmail: string | null;
  websiteUrl: string | null;
  status: AdminEventStatus;
  isCurrent: boolean;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  openedAt: string | null;
  closedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  entryConfirmationConfig: AdminSettingsEntryConfirmationConfig;
};

export type AdminSettingsEventForm = {
  name: string;
  startsAt: string;
  endsAt: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
  entryConfirmationConfig: AdminSettingsEntryConfirmationConfig;
};

export type AdminSettingsClass = {
  id: string;
  eventId: string;
  name: string;
  vehicleType: VehicleType;
  allowsCodriver: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminSettingsClassDraft = {
  name: string;
  vehicleType: VehicleType;
  allowsCodriver: boolean;
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
