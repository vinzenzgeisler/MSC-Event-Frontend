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
  emergencyContactFirstName: string;
  emergencyContactLastName: string;
  emergencyContactPhone: string;
  motorsportHistory: string;
  specialNotes: string;
  guardianFullName: string;
  guardianEmail: string;
  guardianPhone: string;
  guardianConsentAccepted: boolean;
};

export type CodriverForm = {
  firstName: string;
  lastName: string;
  birthdate: string;
  nationality: string;
  street: string;
  zip: string;
  city: string;
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
  imageUploadId: string;
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
  consentVersion: string;
  consentTextHash: string;
  locale: string;
  consentSource: "public_form";
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
    emergencyContactFirstName?: string;
    emergencyContactLastName?: string;
    emergencyContactPhone: string;
    motorsportHistory: string;
    specialNotes?: string;
    guardianFullName?: string;
    guardianEmail?: string;
    guardianPhone?: string;
    guardianConsentAccepted?: boolean;
  };
  codriver?: {
    email: string;
    firstName: string;
    lastName: string;
    birthdate: string;
    nationality: string;
    street: string;
    zip: string;
    city: string;
    phone: string;
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
    imageUploadId?: string;
  };
  backupVehicle?: {
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
    imageUploadId?: string;
  };
  startNumber: string;
  isBackupVehicle?: boolean;
  backupOfEntryId?: Id;
  specialNotes?: string;
  consent: {
    termsAccepted: true;
    privacyAccepted: true;
    mediaAccepted: boolean;
    consentVersion: string;
    consentTextHash: string;
    locale: string;
    consentSource: "public_form";
    consentCapturedAt: string;
  };
};

export type PublicCreateEntriesBatchRequestDto = {
  clientSubmissionKey: string;
  driver: PublicCreateEntryRequestDto["driver"];
  consent: PublicCreateEntryRequestDto["consent"];
  entries: Array<{
    classId: Id;
    codriverEnabled?: boolean;
    codriver?: PublicCreateEntryRequestDto["codriver"];
    vehicle: PublicCreateEntryRequestDto["vehicle"];
    backupVehicle?: PublicCreateEntryRequestDto["backupVehicle"];
    specialNotes?: string;
    backupOfEntryId?: Id;
    startNumber: string;
    isBackupVehicle?: boolean;
  }>;
};

export type PublicCreateEntryResponseDto = {
  ok: boolean;
  entryId: Id;
  registrationStatus: RegistrationStatus;
  verificationToken: string;
  confirmationMailSent: boolean;
};

export type PublicCreateEntriesBatchResponseDto = {
  ok: boolean;
  groupId: Id;
  entryIds: Id[];
  entryCount: number;
  registrationStatus: RegistrationStatus;
  verificationToken: string;
  confirmationMailSent: boolean;
};

export type RegistrationSubmitResult = {
  ok: boolean;
  createdEntries: number;
  attemptedEntries: number;
  status: RegistrationStatus;
  groupId?: Id;
  entryIds?: Id[];
  entryCount?: number;
};
