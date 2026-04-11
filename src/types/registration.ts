import type { Id, RegistrationStatus, StartNumberConflictType, VehicleType } from "@/types/common";
import type { LegalTexts } from "@/config/legal-texts";

export type DriverForm = {
  firstName: string;
  lastName: string;
  birthdate: string;
  country: string;
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
  country: string;
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
  cylinders: string;
  vehicleHistory: string;
  ownerName: string;
  imageFileName: string;
  imageUploadId: string;
  imageUploadToken: string;
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
  waiverAccepted: boolean;
  mediaAccepted: boolean;
  clubInfoAccepted: boolean;
  consentVersion: string;
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
  allowsCodriver: boolean;
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

export type PublicLegalConsentMeta = {
  consentLocale: string;
  consentVersion: string;
  publishedAt: string;
};

export type PublicLegalBundle = {
  consent: PublicLegalConsentMeta;
  texts: LegalTexts;
  availableLocales: string[];
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
    country: string;
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
    country: string;
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
    cylinders: number;
    vehicleHistory: string;
    ownerName: string;
    startNumberRaw?: string;
    imageUploadId?: string;
    imageUploadToken?: string;
  };
  backupVehicle?: {
    vehicleType: VehicleType;
    make: string;
    model: string;
    year?: number;
    displacementCcm: number;
    cylinders: number;
    vehicleHistory: string;
    ownerName: string;
    imageUploadId?: string;
    imageUploadToken?: string;
  };
  startNumber: string;
  isBackupVehicle?: boolean;
  backupOfEntryId?: Id;
  specialNotes?: string;
  consent: {
    termsAccepted: true;
    privacyAccepted: true;
    waiverAccepted: true;
    mediaAccepted: boolean;
    clubInfoAccepted: boolean;
    consentVersion: string;
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
