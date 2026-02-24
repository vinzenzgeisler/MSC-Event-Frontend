import type { Id, RegistrationStatus, StartNumberConflictType, VehicleType } from "@/types/common";

export type DriverForm = {
  firstName: string;
  lastName: string;
  birthdate: string;
  nationality: string;
  street: string;
  zip: string;
  city: string;
  phone: string;
  email: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  motorsportHistory: string;
  specialNotes: string;
};

export type CodriverForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type VehicleForm = {
  make: string;
  model: string;
  year: string;
  displacementCcm: string;
  engineType: string;
  cylinders: string;
  brakes: string;
  vehicleHistory: string;
  ownerName: string;
  imageFileName: string;
  imageS3Key: string;
  imageUploadState: "idle" | "uploading" | "uploaded" | "error";
  imageUploadError: string;
};

export type StartRegistrationForm = {
  id: string;
  classId: Id;
  classLabel: string;
  vehicleType: VehicleType;
  startNumber: string;
  vehicle: VehicleForm;
  codriverEnabled: boolean;
  codriver: CodriverForm;
  backupVehicleEnabled: boolean;
  backupVehicle: VehicleForm;
};

export type ConsentForm = {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  mediaAccepted: boolean;
};

export type RegistrationWizardForm = {
  driver: DriverForm;
  starts: StartRegistrationForm[];
  consent: ConsentForm;
};

export type PublicEventClass = {
  id: Id;
  name: string;
  vehicleType: VehicleType;
};

export type PublicPricingClassRule = {
  classId: Id;
  className: string;
  baseFeeCents: number;
};

export type PublicPricingRules = {
  earlyDeadline: string;
  lateFeeCents: number;
  secondVehicleDiscountCents: number;
  currency: string;
  classRules: PublicPricingClassRule[];
};

export type PublicEventOverview = {
  id: Id;
  name: string;
  startsAt: string;
  endsAt: string;
  location: string;
  registrationOpen: boolean;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
  pricingRules: PublicPricingRules | null;
  classes: PublicEventClass[];
};

export type StartNumberValidationResult = {
  normalizedStartNumber: string | null;
  validFormat: boolean;
  available: boolean;
  conflictEntryId: Id | null;
  conflictType: StartNumberConflictType;
};

export type PublicCreateEntryRequestDto = {
  classId: Id;
  driver: {
    email: string;
    firstName: string;
    lastName: string;
    birthdate: string;
    nationality?: string;
    street: string;
    zip: string;
    city: string;
    phone: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    motorsportHistory: string;
    specialNotes?: string;
  };
  codriver?: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
  codriverEnabled?: boolean;
  vehicle: {
    vehicleType: VehicleType;
    make: string;
    model: string;
    year?: number;
    displacementCcm: number;
    engineType: string;
    cylinders: number;
    brakes: string;
    vehicleHistory: string;
    ownerName: string;
    startNumberRaw?: string;
    imageS3Key?: string;
  };
  startNumber: string;
  isBackupVehicle?: boolean;
  backupOfEntryId?: Id;
  specialNotes?: string;
  consent: {
    termsAccepted: true;
    privacyAccepted: true;
    mediaAccepted: true;
    consentVersion: string;
    consentCapturedAt: string;
  };
};

export type PublicCreateEntryResponseDto = {
  ok: boolean;
  entryId: Id;
  registrationStatus: RegistrationStatus;
  verificationToken: string;
};

export type RegistrationSubmitResult = {
  ok: boolean;
  createdEntries: number;
  status: RegistrationStatus;
};
