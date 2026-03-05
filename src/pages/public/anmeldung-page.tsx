import { useEffect, useMemo, useRef, useState } from "react";
import { useAnmeldungI18n } from "@/app/i18n/anmeldung-i18n";
import { CONSENT_VERSION, computeConsentTextHash, mapUiLocaleToConsentLocale } from "@/config/legal-texts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DriverStep } from "@/components/features/registration/driver-step";
import { StartEntriesStep } from "@/components/features/registration/start-entries-step";
import { SummaryStep } from "@/components/features/registration/summary-step";
import { WizardStepper } from "@/components/features/registration/wizard-stepper";
import { ApiError } from "@/services/api/http-client";
import { formatPriceRange, resolvePublicPricing } from "@/lib/public-pricing";
import { isCountryOption, resolveCountryCode } from "@/lib/countries";
import { registrationService } from "@/services/registration.service";
import type { DriverForm, PublicEventOverview, RegistrationWizardForm, StartRegistrationForm, VehicleForm } from "@/types/registration";

const START_NUMBER_PATTERN = /^[A-Z0-9]{1,6}$/;
const PHONE_ALLOWED_PATTERN = /^\+?[0-9()\/\-\s.]+$/;
const ZIP_PATTERN = /^\d{5}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HUBRAUM_PATTERN = /^\d{2,5}$/;
const CYLINDERS_PATTERN = /^(?:\d{1,2}|V\d{1,2})$/i;
const YEAR_PATTERN = /^\d{4}$/;
const BIRTHDATE_PATTERN = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const REGISTRATION_DRAFT_STORAGE_KEY = "msc_registration_draft_v1";
const CONSENT_HASH_PATTERN = /^[a-f0-9]{64}$/i;

function createEmptyVehicle(): VehicleForm {
  return {
    make: "",
    model: "",
    year: "",
    displacementCcm: "",
    engineType: "",
    cylinders: "",
    brakes: "",
    vehicleHistory: "",
    ownerName: "",
    imageFileName: "",
    imageS3Key: "",
    imageUploadState: "idle",
    imageUploadError: ""
  };
}

function createEmptyStart(): StartRegistrationForm {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    classId: "",
    classLabel: "",
    vehicleType: "auto",
    startNumber: "",
    vehicle: createEmptyVehicle(),
    codriverEnabled: false,
    codriver: {
      firstName: "",
      lastName: "",
      birthdate: "",
      nationality: "",
      street: "",
      zip: "",
      city: "",
      email: "",
      phone: ""
    },
    backupVehicleEnabled: false,
    backupVehicle: createEmptyVehicle()
  };
}

const initialDriver: DriverForm = {
  firstName: "",
  lastName: "",
  birthdate: "",
  nationality: "",
  street: "",
  zip: "",
  city: "",
  phone: "",
  email: "",
  emergencyContactFirstName: "",
  emergencyContactLastName: "",
  emergencyContactPhone: "",
  motorsportHistory: "",
  specialNotes: "",
  guardianFullName: "",
  guardianEmail: "",
  guardianPhone: "",
  guardianConsentAccepted: false
};

function sanitizePhoneInput(value: string) {
  let next = value.replace(/[^\d+\s()/.\-]/g, "");
  const firstPlusIndex = next.indexOf("+");
  if (firstPlusIndex > 0) {
    next = next.replace(/\+/g, "");
  } else if (firstPlusIndex === 0) {
    next = `+${next.slice(1).replace(/\+/g, "")}`;
  }
  next = next.replace(/\s{2,}/g, " ");
  if (next.startsWith("00")) {
    next = `+${next.slice(2)}`;
  }
  return next;
}

function normalizePhone(value: string) {
  return sanitizePhoneInput(value).trim();
}

function normalizeEmailForCompare(value: string) {
  return value.trim().toLowerCase();
}

function isValidPhone(value: string) {
  const normalized = normalizePhone(value);
  if (!normalized || !PHONE_ALLOWED_PATTERN.test(normalized)) {
    return false;
  }
  const digits = normalized.replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 15;
}

function formatBirthdateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

function normalizeStoredBirthdate(value: string) {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;
  }
  return formatBirthdateInput(trimmed);
}

function parseBirthdate(value: string): Date | null {
  const match = value.trim().match(BIRTHDATE_PATTERN);
  if (!match) {
    return null;
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

function isBirthdateInRange(value: string, minAge: number, maxAge: number, now = new Date()) {
  const birthdate = parseBirthdate(value);
  if (!birthdate) {
    return false;
  }
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const birthUtc = Date.UTC(birthdate.getUTCFullYear(), birthdate.getUTCMonth(), birthdate.getUTCDate());
  if (birthUtc > nowUtc) {
    return false;
  }
  let age = now.getUTCFullYear() - birthdate.getUTCFullYear();
  const hasBirthdayPassed =
    now.getUTCMonth() > birthdate.getUTCMonth() || (now.getUTCMonth() === birthdate.getUTCMonth() && now.getUTCDate() >= birthdate.getUTCDate());
  if (!hasBirthdayPassed) {
    age -= 1;
  }
  return age >= minAge && age <= maxAge;
}

function isDriverMinor(value: string, now = new Date()) {
  const birthdate = parseBirthdate(value);
  if (!birthdate) {
    return false;
  }
  let age = now.getUTCFullYear() - birthdate.getUTCFullYear();
  const birthdayReached =
    now.getUTCMonth() > birthdate.getUTCMonth() || (now.getUTCMonth() === birthdate.getUTCMonth() && now.getUTCDate() >= birthdate.getUTCDate());
  if (!birthdayReached) {
    age -= 1;
  }
  return age < 18;
}

function getConsentRequiredError(locale: string) {
  if (locale === "en") {
    return "Please accept participation terms and privacy notice before submitting.";
  }
  if (locale === "cz") {
    return "Pred odeslanim potvrdte podminky ucasti a ochranu osobnich udaju.";
  }
  return "Bitte Teilnahmebedingungen und Datenschutzhinweise vor dem Absenden akzeptieren.";
}

function getConsentMetaError(locale: string) {
  if (locale === "en") {
    return "Consent metadata is incomplete. Please reload this page and try again.";
  }
  if (locale === "cz") {
    return "Metadata souhlasu nejsou uplna. Obnovte stranku a zkuste to znovu.";
  }
  return "Consent-Metadaten sind unvollstaendig. Bitte Seite neu laden und erneut versuchen.";
}

function getGuardianFieldMessages(locale: string) {
  if (locale === "en") {
    return {
      requiredFullName: "Legal guardian full name is required for minors.",
      invalidEmail: "Please enter a valid legal guardian email.",
      invalidPhone: "Please enter a valid legal guardian phone number.",
      requiredConsent: "Legal guardian confirmation is required for minors."
    };
  }
  if (locale === "cz") {
    return {
      requiredFullName: "U nezletilych je povinne cele jmeno zakonneho zastupce.",
      invalidEmail: "Zadejte platny e-mail zakonneho zastupce.",
      invalidPhone: "Zadejte platne telefonni cislo zakonneho zastupce.",
      requiredConsent: "U nezletilych je povinne potvrzeni zakonneho zastupce."
    };
  }
  return {
    requiredFullName: "Bei Minderjaehrigen ist der vollstaendige Name des Sorgeberechtigten erforderlich.",
    invalidEmail: "Bitte gueltige E-Mail des Sorgeberechtigten eingeben.",
    invalidPhone: "Bitte gueltige Telefonnummer des Sorgeberechtigten eingeben.",
    requiredConsent: "Bei Minderjaehrigen ist die Zustimmung des Sorgeberechtigten erforderlich."
  };
}

function isPlausibleVehicleYear(value: string, now = new Date()) {
  if (!YEAR_PATTERN.test(value.trim())) {
    return false;
  }
  const year = Number(value.trim());
  const maxYear = now.getFullYear() + 1;
  return year >= 1900 && year <= maxYear;
}

function isSupportedBrakeType(value: string) {
  return value === "steel" || value === "ceramic";
}

function isEmailAlreadyUsedError(error: unknown) {
  if (!(error instanceof ApiError)) {
    return false;
  }

  const code = (error.code ?? "").trim().toUpperCase();
  if (code === "EMAIL_ALREADY_IN_USE_ACTIVE_ENTRY") {
    return true;
  }

  if (error.status !== 400 && error.status !== 409 && error.status !== 422) {
    return false;
  }

  const hasConflictingEmailFieldError = (error.fieldErrors ?? []).some((fieldError) => {
    const field = (fieldError.field ?? "").toLowerCase();
    if (!field.includes("email")) {
      return false;
    }
    const detail = `${fieldError.code ?? ""} ${fieldError.message ?? ""}`.toLowerCase();
    return /(duplicate|already|exists|taken|conflict|used|unique)/.test(detail);
  });

  if (hasConflictingEmailFieldError) {
    return true;
  }

  const detailsText = error.details ? JSON.stringify(error.details).toLowerCase() : "";
  const haystack = `${(error.code ?? "").toLowerCase()} ${(error.message ?? "").toLowerCase()} ${detailsText}`;
  return (
    /(email).*(duplicate|already|exists|taken|conflict|used|unique)/.test(haystack) ||
    /(duplicate|already|exists|taken|conflict|used|unique).*(email)/.test(haystack)
  );
}

function isStartNumberTakenError(error: unknown) {
  if (!(error instanceof ApiError)) {
    return false;
  }

  const code = (error.code ?? "").trim().toLowerCase();
  if (code.includes("start_number") || code.includes("same_class_taken")) {
    return true;
  }

  if (error.status !== 400 && error.status !== 409 && error.status !== 422) {
    return false;
  }

  const hasStartNumberFieldError = (error.fieldErrors ?? []).some((fieldError) => {
    const field = (fieldError.field ?? "").toLowerCase();
    if (!field.includes("start") || !field.includes("number")) {
      return false;
    }
    const detail = `${fieldError.code ?? ""} ${fieldError.message ?? ""}`.toLowerCase();
    return /(duplicate|already|exists|taken|conflict|used|unique|same_class_taken)/.test(detail);
  });

  if (hasStartNumberFieldError) {
    return true;
  }

  const detailsText = error.details ? JSON.stringify(error.details).toLowerCase() : "";
  const haystack = `${(error.code ?? "").toLowerCase()} ${(error.message ?? "").toLowerCase()} ${detailsText}`;
  return (
    /(start|number).*(duplicate|already|exists|taken|conflict|used|unique|same_class_taken)/.test(haystack) ||
    /(duplicate|already|exists|taken|conflict|used|unique|same_class_taken).*(start|number)/.test(haystack)
  );
}

function buildPartialSubmitErrorMessage(locale: string, createdEntries: number, attemptedEntries: number) {
  if (locale === "en") {
    return `Only ${createdEntries} of ${attemptedEntries} entries were created. Please do not resubmit to avoid duplicates. Contact the event team.`;
  }
  if (locale === "cz") {
    return `Bylo vytvořeno jen ${createdEntries} z ${attemptedEntries} přihlášek. Prosím neposílejte formulář znovu, aby nevznikly duplicity. Kontaktujte pořadatele.`;
  }
  return `Es wurden nur ${createdEntries} von ${attemptedEntries} Nennungen angelegt. Bitte nicht erneut absenden, um Duplikate zu vermeiden. Kontaktiere das Orga-Team.`;
}

function buildSubmissionFingerprint(form: RegistrationWizardForm) {
  return JSON.stringify(form);
}

function buildClientSubmissionKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `submission-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getDriverBirthdateRealtimeError(
  value: string,
  m: ReturnType<typeof useAnmeldungI18n>["m"]
) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 10) {
    return undefined;
  }
  if (!parseBirthdate(trimmed)) {
    return m.errors.invalidBirthdate;
  }
  if (!isBirthdateInRange(trimmed, 6, 100)) {
    return m.errors.invalidBirthdateRange;
  }
  return undefined;
}

function getCodriverBirthdateRealtimeError(
  value: string,
  m: ReturnType<typeof useAnmeldungI18n>["m"]
) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 10) {
    return undefined;
  }
  if (!parseBirthdate(trimmed)) {
    return m.errors.invalidCodriverBirthdate;
  }
  if (!isBirthdateInRange(trimmed, 6, 100)) {
    return m.errors.invalidCodriverBirthdateRange;
  }
  return undefined;
}

function validateDriverForm(value: DriverForm, locale: string, m: ReturnType<typeof useAnmeldungI18n>["m"]): Partial<Record<keyof DriverForm, string>> {
  const errors: Partial<Record<keyof DriverForm, string>> = {};
  if (!value.firstName.trim()) errors.firstName = m.errors.requiredFirstName;
  if (!value.lastName.trim()) errors.lastName = m.errors.requiredLastName;
  if (!value.birthdate.trim()) {
    errors.birthdate = m.errors.requiredBirthdate;
  } else if (!parseBirthdate(value.birthdate.trim())) {
    errors.birthdate = m.errors.invalidBirthdate;
  } else if (!isBirthdateInRange(value.birthdate.trim(), 6, 100)) {
    errors.birthdate = m.errors.invalidBirthdateRange;
  }
  if (!value.nationality.trim()) {
    errors.nationality = m.errors.requiredNationality;
  } else if (!isCountryOption(value.nationality, locale)) {
    errors.nationality = m.errors.invalidNationality;
  }
  if (!value.street.trim()) errors.street = m.errors.requiredStreet;
  if (!value.city.trim()) errors.city = m.errors.requiredCity;
  if (!value.zip.trim()) {
    errors.zip = m.errors.requiredZip;
  } else if (!ZIP_PATTERN.test(value.zip.trim())) {
    errors.zip = m.errors.invalidZip;
  }
  if (!value.phone.trim() || !isValidPhone(value.phone.trim())) errors.phone = m.errors.invalidPhone;
  if (!value.email.trim() || !EMAIL_PATTERN.test(value.email.trim())) errors.email = m.errors.invalidEmail;
  if (!value.emergencyContactFirstName.trim()) errors.emergencyContactFirstName = m.errors.requiredEmergencyFirstName;
  if (!value.emergencyContactLastName.trim()) errors.emergencyContactLastName = m.errors.requiredEmergencyLastName;
  if (!value.emergencyContactPhone.trim() || !isValidPhone(value.emergencyContactPhone.trim())) {
    errors.emergencyContactPhone = m.errors.invalidEmergencyPhone;
  }
  if (!value.motorsportHistory.trim()) errors.motorsportHistory = m.errors.requiredHistory;
  if (isDriverMinor(value.birthdate.trim())) {
    const guardianMessages = getGuardianFieldMessages(locale);
    if (!value.guardianFullName.trim()) {
      errors.guardianFullName = guardianMessages.requiredFullName;
    }
    if (!value.guardianEmail.trim() || !EMAIL_PATTERN.test(value.guardianEmail.trim())) {
      errors.guardianEmail = guardianMessages.invalidEmail;
    }
    if (!value.guardianPhone.trim() || !isValidPhone(value.guardianPhone.trim())) {
      errors.guardianPhone = guardianMessages.invalidPhone;
    }
    if (!value.guardianConsentAccepted) {
      errors.guardianConsentAccepted = guardianMessages.requiredConsent;
    }
  }
  return errors;
}

function splitEmergencyName(fullName: string): { firstName: string; lastName: string } {
  const normalized = fullName.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return { firstName: "", lastName: "" };
  }
  const [firstName, ...rest] = normalized.split(" ");
  return {
    firstName: firstName || "",
    lastName: rest.join(" ")
  };
}

function hydrateDriverForm(value: Partial<DriverForm> | null | undefined): DriverForm {
  const next: DriverForm = {
    ...initialDriver,
    ...(value ?? {})
  };

  const legacyName = typeof (value as { emergencyContactName?: unknown } | null | undefined)?.emergencyContactName === "string"
    ? ((value as { emergencyContactName?: string }).emergencyContactName ?? "")
    : "";

  if (!next.emergencyContactFirstName && !next.emergencyContactLastName && legacyName.trim()) {
    const split = splitEmergencyName(legacyName);
    next.emergencyContactFirstName = split.firstName;
    next.emergencyContactLastName = split.lastName;
  }

  next.birthdate = normalizeStoredBirthdate(next.birthdate);
  next.nationality = resolveCountryCode(next.nationality) ?? "";
  next.guardianConsentAccepted = Boolean(next.guardianConsentAccepted);

  return next;
}

type StartFieldErrors = Partial<
  Record<
    | "classId"
    | "startNumber"
    | "make"
    | "model"
    | "year"
    | "displacementCcm"
    | "engineType"
    | "cylinders"
    | "brakes"
    | "vehicleHistory"
    | "vehicleImage"
    | "codriverFirstName"
    | "codriverLastName"
    | "codriverBirthdate"
    | "codriverNationality"
    | "codriverStreet"
    | "codriverZip"
    | "codriverCity"
    | "codriverEmail"
    | "codriverPhone"
    | "backupMake"
    | "backupModel"
    | "backupYear"
    | "backupDisplacementCcm"
    | "backupEngineType"
    | "backupCylinders"
    | "backupBrakes"
    | "backupVehicleHistory"
    | "backupVehicleImage",
    string
  >
>;

type RegistrationDraftStorage = {
  step: number;
  driver: DriverForm;
  starts: StartRegistrationForm[];
  draftStart: StartRegistrationForm;
  addAnotherStart: boolean;
  editingId: string | null;
  consent: RegistrationWizardForm["consent"];
};

function createInitialConsent(uiLocale: string): RegistrationWizardForm["consent"] {
  return {
    termsAccepted: false,
    privacyAccepted: false,
    mediaAccepted: false,
    consentVersion: CONSENT_VERSION,
    consentTextHash: "",
    locale: mapUiLocaleToConsentLocale(uiLocale),
    consentSource: "public_form"
  };
}

function hydrateVehicleForm(value: Partial<VehicleForm> | undefined): VehicleForm {
  const base = createEmptyVehicle();
  const next = {
    ...base,
    ...(value ?? {})
  };
  if (!next.imageS3Key && next.imageUploadState === "uploaded") {
    next.imageUploadState = "idle";
  }
  if (next.imageS3Key && next.imageUploadState === "idle") {
    next.imageUploadState = "uploaded";
  }
  if (!isSupportedBrakeType(next.brakes.trim())) {
    next.brakes = "";
  }
  return next;
}

function hydrateStartForm(value: Partial<StartRegistrationForm> | undefined): StartRegistrationForm {
  const base = createEmptyStart();
  return {
    ...base,
    ...(value ?? {}),
    classId: typeof value?.classId === "string" ? value.classId : "",
    classLabel: typeof value?.classLabel === "string" ? value.classLabel : "",
    vehicleType: value?.vehicleType === "moto" ? "moto" : "auto",
    startNumber: typeof value?.startNumber === "string" ? value.startNumber : "",
    codriverEnabled: Boolean(value?.codriverEnabled),
    codriver: {
      ...base.codriver,
      ...(value?.codriver ?? {}),
      birthdate: normalizeStoredBirthdate(String(value?.codriver?.birthdate ?? "")),
      nationality: resolveCountryCode(String(value?.codriver?.nationality ?? "")) ?? ""
    },
    backupVehicleEnabled: Boolean(value?.backupVehicleEnabled),
    vehicle: hydrateVehicleForm(value?.vehicle),
    backupVehicle: hydrateVehicleForm(value?.backupVehicle)
  };
}

function hasStartDraftContent(draftStart: StartRegistrationForm) {
  return (
    Boolean(draftStart.classId) ||
    Boolean(draftStart.startNumber.trim()) ||
    Boolean(draftStart.vehicle.make.trim()) ||
    Boolean(draftStart.vehicle.model.trim()) ||
    Boolean(draftStart.vehicle.year.trim()) ||
    Boolean(draftStart.vehicle.displacementCcm.trim()) ||
    Boolean(draftStart.vehicle.engineType.trim()) ||
    Boolean(draftStart.vehicle.cylinders.trim()) ||
    Boolean(draftStart.vehicle.brakes.trim()) ||
    Boolean(draftStart.vehicle.vehicleHistory.trim()) ||
    Boolean(draftStart.vehicle.ownerName.trim()) ||
    Boolean(draftStart.vehicle.imageFileName.trim()) ||
    Boolean(draftStart.vehicle.imageS3Key.trim()) ||
    draftStart.codriverEnabled ||
    Boolean(draftStart.codriver.firstName.trim()) ||
    Boolean(draftStart.codriver.lastName.trim()) ||
    Boolean(draftStart.codriver.birthdate.trim()) ||
    Boolean(draftStart.codriver.nationality.trim()) ||
    Boolean(draftStart.codriver.street.trim()) ||
    Boolean(draftStart.codriver.zip.trim()) ||
    Boolean(draftStart.codriver.city.trim()) ||
    Boolean(draftStart.codriver.email.trim()) ||
    Boolean(draftStart.codriver.phone.trim()) ||
    draftStart.backupVehicleEnabled ||
    Boolean(draftStart.backupVehicle.make.trim()) ||
    Boolean(draftStart.backupVehicle.model.trim()) ||
    Boolean(draftStart.backupVehicle.year.trim()) ||
    Boolean(draftStart.backupVehicle.displacementCcm.trim()) ||
    Boolean(draftStart.backupVehicle.engineType.trim()) ||
    Boolean(draftStart.backupVehicle.cylinders.trim()) ||
    Boolean(draftStart.backupVehicle.brakes.trim()) ||
    Boolean(draftStart.backupVehicle.ownerName.trim()) ||
    Boolean(draftStart.backupVehicle.vehicleHistory.trim()) ||
    Boolean(draftStart.backupVehicle.imageFileName.trim()) ||
    Boolean(draftStart.backupVehicle.imageS3Key.trim())
  );
}

function validateStartFields(
  start: StartRegistrationForm,
  existingStarts: StartRegistrationForm[],
  editingId: string | null,
  locale: string,
  m: ReturnType<typeof useAnmeldungI18n>["m"]
): StartFieldErrors {
  const errors: StartFieldErrors = {};

  if (!start.classId) {
    errors.classId = m.errors.requiredClass;
  } else {
    const classAlreadyUsed = existingStarts.some((entry) => entry.classId === start.classId && entry.id !== editingId);
    if (classAlreadyUsed) {
      errors.classId = m.errors.classAlreadyAdded;
    }
  }

  const normalizedStartNumber = start.startNumber.trim().toUpperCase();
  if (!START_NUMBER_PATTERN.test(normalizedStartNumber)) {
    errors.startNumber = m.errors.invalidStartNumber;
  }

  if (!start.vehicle.make.trim()) {
    errors.make = m.errors.requiredMake;
  }

  if (!start.vehicle.model.trim()) {
    errors.model = m.errors.requiredModel;
  }

  if (!HUBRAUM_PATTERN.test(start.vehicle.displacementCcm.trim())) {
    errors.displacementCcm = m.errors.invalidDisplacement;
  }

  if (start.vehicle.year.trim()) {
    if (!YEAR_PATTERN.test(start.vehicle.year.trim())) {
      errors.year = m.errors.invalidYear;
    } else if (!isPlausibleVehicleYear(start.vehicle.year.trim())) {
      errors.year = m.errors.invalidYearRange;
    }
  }

  if (!start.vehicle.engineType.trim()) {
    errors.engineType = m.errors.requiredEngine;
  }

  if (!CYLINDERS_PATTERN.test(start.vehicle.cylinders.trim())) {
    errors.cylinders = m.errors.invalidCylinders;
  }

  if (!isSupportedBrakeType(start.vehicle.brakes.trim())) {
    errors.brakes = m.errors.requiredBrakes;
  }

  if (!start.vehicle.vehicleHistory.trim()) {
    errors.vehicleHistory = m.errors.requiredVehicleHistory;
  }

  if (!start.vehicle.imageS3Key.trim()) {
    errors.vehicleImage = m.errors.requiredVehicleImage;
  }

  if (start.codriverEnabled) {
    if (!start.codriver.firstName.trim()) {
      errors.codriverFirstName = m.errors.requiredCodriverFirstName;
    }
    if (!start.codriver.lastName.trim()) {
      errors.codriverLastName = m.errors.requiredCodriverLastName;
    }
    if (!start.codriver.birthdate.trim()) {
      errors.codriverBirthdate = m.errors.requiredCodriverBirthdate;
    } else if (!parseBirthdate(start.codriver.birthdate.trim())) {
      errors.codriverBirthdate = m.errors.invalidCodriverBirthdate;
    } else if (!isBirthdateInRange(start.codriver.birthdate.trim(), 6, 100)) {
      errors.codriverBirthdate = m.errors.invalidCodriverBirthdateRange;
    }
    if (!start.codriver.nationality.trim()) {
      errors.codriverNationality = m.errors.requiredCodriverNationality;
    } else if (!isCountryOption(start.codriver.nationality, locale)) {
      errors.codriverNationality = m.errors.invalidNationality;
    }
    if (!start.codriver.street.trim()) {
      errors.codriverStreet = m.errors.requiredCodriverStreet;
    }
    if (!start.codriver.zip.trim()) {
      errors.codriverZip = m.errors.requiredCodriverZip;
    } else if (!ZIP_PATTERN.test(start.codriver.zip.trim())) {
      errors.codriverZip = m.errors.invalidCodriverZip;
    }
    if (!start.codriver.city.trim()) {
      errors.codriverCity = m.errors.requiredCodriverCity;
    }
    if (!EMAIL_PATTERN.test(start.codriver.email.trim())) {
      errors.codriverEmail = m.errors.invalidCodriverEmail;
    }
    if (!start.codriver.phone.trim() || !isValidPhone(start.codriver.phone.trim())) {
      errors.codriverPhone = m.errors.invalidCodriverPhone;
    }
  }

  if (start.backupVehicleEnabled) {
    if (!start.backupVehicle.make.trim()) {
      errors.backupMake = m.errors.requiredBackupMake;
    }
    if (!start.backupVehicle.model.trim()) {
      errors.backupModel = m.errors.requiredBackupModel;
    }
    if (!HUBRAUM_PATTERN.test(start.backupVehicle.displacementCcm.trim())) {
      errors.backupDisplacementCcm = m.errors.invalidBackupDisplacement;
    }
    if (start.backupVehicle.year.trim()) {
      if (!YEAR_PATTERN.test(start.backupVehicle.year.trim())) {
        errors.backupYear = m.errors.invalidBackupYear;
      } else if (!isPlausibleVehicleYear(start.backupVehicle.year.trim())) {
        errors.backupYear = m.errors.invalidBackupYearRange;
      }
    }
    if (!start.backupVehicle.engineType.trim()) {
      errors.backupEngineType = m.errors.requiredBackupEngine;
    }
    if (!CYLINDERS_PATTERN.test(start.backupVehicle.cylinders.trim())) {
      errors.backupCylinders = m.errors.invalidBackupCylinders;
    }
    if (!isSupportedBrakeType(start.backupVehicle.brakes.trim())) {
      errors.backupBrakes = m.errors.requiredBackupBrakes;
    }
    if (!start.backupVehicle.vehicleHistory.trim()) {
      errors.backupVehicleHistory = m.errors.requiredBackupVehicleHistory;
    }
    if (!start.backupVehicle.imageS3Key.trim()) {
      errors.backupVehicleImage = m.errors.requiredBackupVehicleImage;
    }
  }

  return errors;
}

export function AnmeldungPage() {
  const { m, locale } = useAnmeldungI18n();
  const mainVehicleUploadSequence = useRef(0);
  const backupVehicleUploadSequence = useRef(0);
  const [step, setStep] = useState(1);
  const [eventLoadState, setEventLoadState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [eventOverview, setEventOverview] = useState<PublicEventOverview | null>(null);
  const [driver, setDriver] = useState<DriverForm>(initialDriver);
  const [starts, setStarts] = useState<StartRegistrationForm[]>([]);
  const [draftStart, setDraftStart] = useState<StartRegistrationForm>(createEmptyStart());
  const [addAnotherStart, setAddAnotherStart] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [startError, setStartError] = useState("");
  const [startFieldErrors, setStartFieldErrors] = useState<StartFieldErrors>({});
  const [startNumberState, setStartNumberState] = useState<"idle" | "checking" | "available" | "invalid" | "taken">("idle");
  const [startNumberHint, setStartNumberHint] = useState("");
  const [driverErrors, setDriverErrors] = useState<Partial<Record<keyof DriverForm, string>>>({});
  const [knownUsedDriverEmails, setKnownUsedDriverEmails] = useState<string[]>([]);
  const [consent, setConsent] = useState<RegistrationWizardForm["consent"]>(createInitialConsent(locale));
  const [consentError, setConsentError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitLocked, setSubmitLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [submissionComplete, setSubmissionComplete] = useState(false);
  const [submissionKey, setSubmissionKey] = useState("");
  const [submissionFingerprint, setSubmissionFingerprint] = useState("");
  const isMinorDriver = useMemo(() => isDriverMinor(driver.birthdate), [driver.birthdate]);

  useEffect(() => {
    let active = true;
    registrationService
      .getCurrentEvent()
      .then((event) => {
        if (!active) {
          return;
        }
        setEventOverview(event);
        setEventLoadState("ready");
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        if (error instanceof ApiError && error.status === 404) {
          setEventLoadState("missing");
          return;
        }
        setEventLoadState("error");
        setSubmitError(m.page.submitErrorGeneric);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(REGISTRATION_DRAFT_STORAGE_KEY);
    if (!saved) {
      return;
    }
    try {
      const parsed = JSON.parse(saved) as RegistrationDraftStorage;
      if (!parsed || typeof parsed !== "object") {
        return;
      }
      setStep(parsed.step && parsed.step >= 1 && parsed.step <= 3 ? parsed.step : 1);
      setDriver(hydrateDriverForm(parsed.driver));
      const hydratedStarts = Array.isArray(parsed.starts) ? parsed.starts.map((item) => hydrateStartForm(item)) : [];
      setStarts(hydratedStarts);
      setDraftStart(hydrateStartForm(parsed.draftStart));
      setAddAnotherStart(typeof parsed.addAnotherStart === "boolean" ? parsed.addAnotherStart : hydratedStarts.length === 0);
      setEditingId(parsed.editingId ?? null);
      const baseConsent = createInitialConsent(locale);
      const parsedConsent = parsed.consent;
      setConsent({
        ...baseConsent,
        termsAccepted: Boolean(parsedConsent?.termsAccepted),
        privacyAccepted: Boolean(parsedConsent?.privacyAccepted),
        mediaAccepted: Boolean(parsedConsent?.mediaAccepted),
        consentVersion: typeof parsedConsent?.consentVersion === "string" ? parsedConsent.consentVersion : baseConsent.consentVersion,
        consentTextHash: typeof parsedConsent?.consentTextHash === "string" ? parsedConsent.consentTextHash : baseConsent.consentTextHash,
        locale: typeof parsedConsent?.locale === "string" ? parsedConsent.locale : baseConsent.locale,
        consentSource: "public_form"
      });
    } catch {
      // ignore invalid persisted drafts
    }
  }, []);

  useEffect(() => {
    let active = true;
    const consentLocale = mapUiLocaleToConsentLocale(locale);
    computeConsentTextHash(locale)
      .then((consentTextHash) => {
        if (!active) {
          return;
        }
        setConsent((prev) => ({
          ...prev,
          consentVersion: CONSENT_VERSION,
          consentTextHash,
          locale: consentLocale,
          consentSource: "public_form"
        }));
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setConsent((prev) => ({
          ...prev,
          consentVersion: CONSENT_VERSION,
          consentTextHash: "",
          locale: consentLocale,
          consentSource: "public_form"
        }));
      });
    return () => {
      active = false;
    };
  }, [locale]);

  useEffect(() => {
    const payload: RegistrationDraftStorage = { step, driver, starts, draftStart, addAnotherStart, editingId, consent };
    window.localStorage.setItem(REGISTRATION_DRAFT_STORAGE_KEY, JSON.stringify(payload));
  }, [step, driver, starts, draftStart, addAnotherStart, editingId, consent]);

  useEffect(() => {
    if (isMinorDriver) {
      return;
    }
    setDriverErrors((prev) => ({
      ...prev,
      guardianFullName: undefined,
      guardianEmail: undefined,
      guardianPhone: undefined,
      guardianConsentAccepted: undefined
    }));
  }, [isMinorDriver]);

  const form = useMemo<RegistrationWizardForm>(() => ({ driver, starts, consent }), [driver, starts, consent]);
  const showStartDraftForm = starts.length === 0 || Boolean(editingId) || addAnotherStart;

  const secondVehiclePriceHint = useMemo(() => {
    if (!eventOverview) {
      return "";
    }

    const pricing = resolvePublicPricing(eventOverview.pricingRules, eventOverview.registrationCloseAt);
    if (!pricing.secondVehiclePrice || pricing.secondVehiclePrice.maxCents <= 0) {
      return "";
    }

    const amount = formatPriceRange(locale, pricing.secondVehiclePrice);
    if (locale === "en") {
      return `Price for a second vehicle entry: ${amount}.`;
    }
    if (locale === "cz") {
      return `Cena za druhé vozidlo: ${amount}.`;
    }
    return `Preis für ein zweites Fahrzeug: ${amount}.`;
  }, [eventOverview, locale]);

  const handleDriverChange = <K extends keyof DriverForm>(field: K, value: DriverForm[K]) => {
    const normalizedValue =
      field === "phone" || field === "emergencyContactPhone" || field === "guardianPhone"
        ? (sanitizePhoneInput(String(value)) as DriverForm[K])
        : field === "birthdate"
          ? (formatBirthdateInput(String(value)) as DriverForm[K])
          : value;
    setDriver((prev) => {
      const next = { ...prev, [field]: normalizedValue };
      if (field === "birthdate" && !isDriverMinor(String(normalizedValue))) {
        next.guardianConsentAccepted = false;
      }
      return next;
    });
    if (field === "email") {
      const emailRaw = String(normalizedValue).trim();
      const normalizedEmail = normalizeEmailForCompare(emailRaw);
      const emailKnownUsed = Boolean(emailRaw) && EMAIL_PATTERN.test(emailRaw) && knownUsedDriverEmails.includes(normalizedEmail);
      setDriverErrors((prev) => ({
        ...prev,
        email: emailKnownUsed ? m.page.submitErrorEmailInUse : undefined
      }));
      if (submitError === m.page.submitErrorEmailInUse) {
        setSubmitError("");
      }
      return;
    }
    if (field === "birthdate") {
      const message = getDriverBirthdateRealtimeError(String(normalizedValue), m);
      setDriverErrors((prev) => ({
        ...prev,
        birthdate: message,
        guardianFullName: undefined,
        guardianEmail: undefined,
        guardianPhone: undefined,
        guardianConsentAccepted: undefined
      }));
      return;
    }
    if (driverErrors[field]) {
      setDriverErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleDraftChange = <K extends keyof StartRegistrationForm>(field: K, value: StartRegistrationForm[K]) => {
    setDraftStart((prev) => ({ ...prev, [field]: value }));
    setStartError("");
    if (field === "classId") {
      setStartFieldErrors((prev) => ({ ...prev, classId: undefined }));
    }
    if (field === "classId" || field === "startNumber") {
      setStartNumberState("idle");
      setStartNumberHint("");
      setStartFieldErrors((prev) => ({ ...prev, startNumber: undefined }));
    }
    if (field === "codriverEnabled" && !value) {
      setStartFieldErrors((prev) => ({
        ...prev,
        codriverFirstName: undefined,
        codriverLastName: undefined,
        codriverBirthdate: undefined,
        codriverNationality: undefined,
        codriverStreet: undefined,
        codriverZip: undefined,
        codriverCity: undefined,
        codriverEmail: undefined,
        codriverPhone: undefined
      }));
    }
    if (field === "backupVehicleEnabled" && !value) {
      setStartFieldErrors((prev) => ({
        ...prev,
        backupMake: undefined,
        backupModel: undefined,
        backupYear: undefined,
        backupDisplacementCcm: undefined,
        backupEngineType: undefined,
        backupCylinders: undefined,
        backupBrakes: undefined,
        backupVehicleHistory: undefined,
        backupVehicleImage: undefined
      }));
    }
  };

  const handleVehicleImageSelect = async (target: "vehicle" | "backupVehicle", file: File | null) => {
    const sequenceRef = target === "vehicle" ? mainVehicleUploadSequence : backupVehicleUploadSequence;
    const uploadId = sequenceRef.current + 1;
    sequenceRef.current = uploadId;

    if (!file) {
      setDraftStart((prev) => ({
        ...prev,
        [target]: {
          ...prev[target],
          imageFileName: "",
          imageS3Key: "",
          imageUploadState: "idle",
          imageUploadError: ""
        }
      }));
      return;
    }

    setDraftStart((prev) => ({
      ...prev,
      [target]: {
        ...prev[target],
        imageFileName: file.name,
        imageS3Key: "",
        imageUploadState: "uploading",
        imageUploadError: ""
      }
    }));

    try {
      const uploaded = await registrationService.uploadVehicleImage(file);
      if (sequenceRef.current !== uploadId) {
        return;
      }
      setDraftStart((prev) => ({
        ...prev,
        [target]: {
          ...prev[target],
          imageFileName: uploaded.fileName,
          imageS3Key: uploaded.imageS3Key,
          imageUploadState: "uploaded",
          imageUploadError: ""
        }
      }));
    } catch (error) {
      if (sequenceRef.current !== uploadId) {
        return;
      }
      const fallback = "Bild-Upload fehlgeschlagen.";
      const message = error instanceof Error && error.message.trim() ? error.message : fallback;
      setDraftStart((prev) => ({
        ...prev,
        [target]: {
          ...prev[target],
          imageS3Key: "",
          imageUploadState: "error",
          imageUploadError: message
        }
      }));
    }
  };

  const validateStartNumber = async (): Promise<{ ok: boolean; reason: "empty" | "invalid" | "taken" | "error" | "ok" }> => {
    if (!draftStart.classId || !draftStart.startNumber.trim()) {
      return { ok: false, reason: "empty" };
    }

    const normalizedStartNumber = draftStart.startNumber.trim().toUpperCase();
    if (!START_NUMBER_PATTERN.test(normalizedStartNumber)) {
      setStartNumberState("invalid");
      setStartNumberHint("");
      setStartFieldErrors((prev) => ({ ...prev, startNumber: m.errors.invalidStartNumber }));
      return { ok: false, reason: "invalid" };
    }

    setStartNumberState("checking");
    let validation: Awaited<ReturnType<typeof registrationService.validateStartNumber>>;
    try {
      validation = await registrationService.validateStartNumber(draftStart.classId, normalizedStartNumber);
    } catch {
      setStartNumberState("idle");
      setStartNumberHint("");
      return { ok: false, reason: "error" };
    }

    if (!validation.validFormat || validation.conflictType === "invalid_format") {
      setStartNumberState("invalid");
      setStartNumberHint("");
      setStartFieldErrors((prev) => ({ ...prev, startNumber: m.errors.invalidApiStartFormat }));
      return { ok: false, reason: "invalid" };
    }

    if (!validation.available || validation.conflictType === "same_class_taken") {
      setStartNumberState("taken");
      setStartNumberHint("");
      setStartFieldErrors((prev) => ({ ...prev, startNumber: m.errors.startTaken }));
      return { ok: false, reason: "taken" };
    }

    setStartNumberState("available");
    setStartNumberHint(m.start.startAvailable);
    setStartFieldErrors((prev) => ({ ...prev, startNumber: undefined }));
    if (validation.normalizedStartNumber) {
      setDraftStart((prev) => ({ ...prev, startNumber: validation.normalizedStartNumber ?? prev.startNumber }));
    }
    return { ok: true, reason: "ok" };
  };

  const saveDraft = async () => {
    const fieldErrors = validateStartFields(draftStart, starts, editingId, locale, m);
    setStartFieldErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      setStartError("");
      return;
    }

    const startNumberValidation = await validateStartNumber();
    if (!startNumberValidation.ok && startNumberValidation.reason !== "taken") {
      setStartError("");
      return;
    }

    const normalized = draftStart.startNumber.trim().toUpperCase();
    const next = { ...draftStart, startNumber: normalized };

    if (editingId) {
      setStarts((prev) => prev.map((item) => (item.id === editingId ? next : item)));
    } else {
      setStarts((prev) => [...prev, next]);
    }

    setDraftStart(createEmptyStart());
    setAddAnotherStart(false);
    setEditingId(null);
    setStartError("");
    setStartFieldErrors({});
    setStartNumberState("idle");
    setStartNumberHint("");
  };

  const editStart = (id: string) => {
    const item = starts.find((entry) => entry.id === id);
    if (!item) {
      return;
    }
    setDraftStart(item);
    setAddAnotherStart(true);
    setEditingId(id);
    setStartError("");
    setStartFieldErrors({});
    setStartNumberState("idle");
    setStartNumberHint("");
  };

  const removeStart = (id: string) => {
    const nextStarts = starts.filter((item) => item.id !== id);
    setStarts(nextStarts);
    if (editingId === id) {
      setDraftStart(createEmptyStart());
      setEditingId(null);
    }
    if (!nextStarts.length) {
      setAddAnotherStart(true);
    }
  };

  const handleAddAnotherStartChange = (checked: boolean) => {
    setAddAnotherStart(checked);
    setStartError("");
    if (!checked && !editingId) {
      setDraftStart(createEmptyStart());
      setStartFieldErrors({});
      setStartNumberState("idle");
      setStartNumberHint("");
    }
  };

  const goToStep2 = () => {
    if (!eventOverview) {
      return;
    }
    const errors = validateDriverForm(driver, locale, m);
    setDriverErrors(errors);
    if (Object.keys(errors).length) {
      return;
    }
    setStep(2);
  };

  const goToStep3 = () => {
    if (!starts.length) {
      setStartError(m.page.startErrorNeedOne);
      return;
    }

    if (showStartDraftForm && hasStartDraftContent(draftStart)) {
      setStartError(m.start.saveBeforeContinue);
      return;
    }

    setStep(3);
  };

  const submit = async () => {
    if (isSubmitting || submitLocked) {
      return;
    }
    setConsentError("");
    if (!consent.termsAccepted || !consent.privacyAccepted) {
      setConsentError(getConsentRequiredError(locale));
      setSubmitError("");
      return;
    }
    if (!consent.locale.trim() || !CONSENT_HASH_PATTERN.test(consent.consentTextHash.trim())) {
      setConsentError(getConsentMetaError(locale));
      setSubmitError("");
      return;
    }
    const currentDriverErrors = validateDriverForm(driver, locale, m);
    setDriverErrors(currentDriverErrors);
    if (Object.keys(currentDriverErrors).length > 0) {
      setStep(1);
      setSubmitError("");
      return;
    }

    const normalizedConsent: RegistrationWizardForm["consent"] = {
      ...consent,
      consentVersion: CONSENT_VERSION,
      consentTextHash: consent.consentTextHash.trim().toLowerCase(),
      locale: consent.locale.trim(),
      consentSource: "public_form"
    };
    const submitForm: RegistrationWizardForm = {
      ...form,
      consent: normalizedConsent
    };

    setConsent(normalizedConsent);
    setSubmitError("");
    setSubmitLocked(false);
    setIsSubmitting(true);

    let result: Awaited<ReturnType<typeof registrationService.submitWizard>>;
    const nextFingerprint = buildSubmissionFingerprint(submitForm);
    const nextSubmissionKey =
      submissionKey && submissionFingerprint === nextFingerprint ? submissionKey : buildClientSubmissionKey();

    if (nextSubmissionKey !== submissionKey) {
      setSubmissionKey(nextSubmissionKey);
    }
    if (nextFingerprint !== submissionFingerprint) {
      setSubmissionFingerprint(nextFingerprint);
    }

    try {
      result = await registrationService.submitWizard(submitForm, { clientSubmissionKey: nextSubmissionKey });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "CONSENT_REQUIRED_MISSING") {
          setConsentError(getConsentRequiredError(locale));
          setIsSubmitting(false);
          return;
        }
        if (error.message === "CONSENT_TEXT_HASH_INVALID" || error.message === "CONSENT_LOCALE_MISSING") {
          setConsentError(getConsentMetaError(locale));
          setIsSubmitting(false);
          return;
        }
      }
      if (isEmailAlreadyUsedError(error)) {
        const normalizedDriverEmail = normalizeEmailForCompare(submitForm.driver.email);
        if (normalizedDriverEmail) {
          setKnownUsedDriverEmails((prev) => (prev.includes(normalizedDriverEmail) ? prev : [...prev, normalizedDriverEmail]));
        }
        setDriverErrors((prev) => ({ ...prev, email: m.page.submitErrorEmailInUse }));
        setSubmitError(m.page.submitErrorEmailInUse);
        setStep(1);
      } else if (isStartNumberTakenError(error)) {
        setStartError(m.errors.startTaken);
        setSubmitError(m.errors.startTaken);
        setStep(2);
      } else {
        setSubmitError(m.page.submitErrorGeneric);
      }
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);

    if (!result.ok) {
      if (result.createdEntries > 0) {
        setSubmitLocked(true);
        setSubmitError(buildPartialSubmitErrorMessage(locale, result.createdEntries, result.attemptedEntries));
      } else {
        setSubmitError(m.page.submitErrorGeneric);
      }
      return;
    }
    setSubmitError("");
    setConsentError("");
    setSubmissionKey("");
    setSubmissionFingerprint("");
    setSuccessMessage(m.page.submitSuccess);
    setSubmissionComplete(true);
    window.localStorage.removeItem(REGISTRATION_DRAFT_STORAGE_KEY);
  };

  const handleNext = () => {
    if (step === 1) {
      goToStep2();
      return;
    }
    if (step === 2) {
      goToStep3();
    }
  };
  const step2BlockedReason = m.page.step2BlockedReason;

  if (eventLoadState === "loading") {
    return (
      <div className="space-y-6 pb-8">
        <div className="rounded-2xl bg-primary px-4 py-6 text-primary-foreground sm:px-5 sm:py-7 md:px-8">
          <div className="inline-flex rounded bg-yellow-400 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-900">
            {m.page.openBadge}
          </div>
          <h2 className="mt-4 text-2xl font-semibold md:text-3xl">{m.page.title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-primary-foreground/85 md:text-base">{m.page.subtitle}</p>
        </div>
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5 text-sm text-slate-600 md:p-8">Eventdaten werden geladen…</CardContent>
        </Card>
      </div>
    );
  }

  if (eventLoadState === "missing") {
    return (
      <div className="space-y-6 pb-8">
        <div className="rounded-2xl bg-primary px-4 py-6 text-primary-foreground sm:px-5 sm:py-7 md:px-8">
          <h2 className="mt-1 text-2xl font-semibold md:text-3xl">{m.page.title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-primary-foreground/85 md:text-base">{m.page.subtitle}</p>
        </div>
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-2 p-5 md:p-8">
            <h3 className="text-lg font-semibold text-slate-900">{m.page.noCurrentEventTitle}</h3>
            <p className="text-sm text-slate-600">{m.page.noCurrentEventBody}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (eventLoadState === "error") {
    return (
      <div className="space-y-6 pb-8">
        <div className="rounded-2xl bg-primary px-4 py-6 text-primary-foreground sm:px-5 sm:py-7 md:px-8">
          <h2 className="mt-1 text-2xl font-semibold md:text-3xl">{m.page.title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-primary-foreground/85 md:text-base">{m.page.subtitle}</p>
        </div>
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-2 p-5 md:p-8">
            <h3 className="text-lg font-semibold text-slate-900">{m.page.submitErrorGeneric}</h3>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submissionComplete) {
    const successBadge =
      locale === "en" ? "Registration complete" : locale === "cz" ? "Registrace uspesna" : "Anmeldung erfolgreich";
    const successTitle =
      locale === "en"
        ? "Thank you. Your registration has been received."
        : locale === "cz"
          ? "Dekujeme. Vase registrace byla prijata."
          : "Vielen Dank, deine Anmeldung ist eingegangen.";
    const successBody =
      locale === "en"
        ? "We sent the confirmation to"
        : locale === "cz"
          ? "Potvrzeni jsme odeslali na"
          : "Wir haben die Unterlagen an";
    const successTail =
      locale === "en"
        ? ". Please verify the email to complete the registration process."
        : locale === "cz"
          ? ". Pro dokonceni registrace prosim potvrdte e-mail."
          : " gesendet. Bitte bestaetige die E-Mail-Verifizierung, damit die Anmeldung final verarbeitet werden kann.";
    return (
      <div className="space-y-6 pb-8 md:pb-0">
        <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 shadow-sm md:p-8">
          <div className="inline-flex animate-pulse rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
            {successBadge}
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-slate-900 md:text-3xl">{successTitle}</h2>
          <p className="mt-3 max-w-3xl text-sm text-slate-700 md:text-base">
            {successBody} <span className="font-semibold">{driver.email || "-"}</span>
            {successTail}
          </p>
          <p className="mt-2 text-sm text-slate-600">{successMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="rounded-2xl bg-primary px-4 py-6 text-primary-foreground sm:px-5 sm:py-7 md:px-8">
        <div className="inline-flex rounded bg-yellow-400 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-900">
          {m.page.openBadge}
        </div>
        <h2 className="mt-4 text-2xl font-semibold md:text-3xl">{m.page.title}</h2>
        <p className="mt-2 max-w-3xl text-sm text-primary-foreground/85 md:text-base">{m.page.subtitle}</p>
      </div>

      <WizardStepper currentStep={step} />

      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardContent className="space-y-6 p-5 md:p-8">
          {step === 1 && <DriverStep value={driver} errors={driverErrors} showGuardianFields={isMinorDriver} onChange={handleDriverChange} />}

          {step === 2 && eventOverview && (
            <StartEntriesStep
              classes={eventOverview.classes}
              starts={starts}
              secondVehiclePriceHint={secondVehiclePriceHint}
              draft={draftStart}
              editingId={editingId}
              error={startError}
              fieldErrors={startFieldErrors}
              startNumberState={startNumberState}
              startNumberHint={startNumberHint}
              showDraftForm={showStartDraftForm}
              addAnotherStart={addAnotherStart}
              onDraftChange={handleDraftChange}
              onAddAnotherStartChange={handleAddAnotherStartChange}
              onStartNumberBlur={() => {
                void validateStartNumber();
              }}
              onVehicleFieldChange={(field, value) => {
                setStartError("");
                setDraftStart((prev) => ({ ...prev, vehicle: { ...prev.vehicle, [field]: value } }));
                const errorKeyMap: Partial<Record<keyof VehicleForm, keyof StartFieldErrors>> = {
                  make: "make",
                  model: "model",
                  year: "year",
                  displacementCcm: "displacementCcm",
                  engineType: "engineType",
                  cylinders: "cylinders",
                  brakes: "brakes",
                  vehicleHistory: "vehicleHistory"
                };
                const errorKey = errorKeyMap[field];
                if (errorKey) {
                  setStartFieldErrors((prev) => ({ ...prev, [errorKey]: undefined }));
                }
              }}
              onVehicleImageSelect={(file) => {
                setStartFieldErrors((prev) => ({ ...prev, vehicleImage: undefined }));
                void handleVehicleImageSelect("vehicle", file);
              }}
              onBackupVehicleImageSelect={(file) => {
                setStartFieldErrors((prev) => ({ ...prev, backupVehicleImage: undefined }));
                void handleVehicleImageSelect("backupVehicle", file);
              }}
              onCodriverFieldChange={(field, value) => {
                setStartError("");
                const normalized =
                  field === "phone" ? sanitizePhoneInput(value) : field === "birthdate" ? formatBirthdateInput(value) : value;
                setDraftStart((prev) => ({
                  ...prev,
                  codriver: {
                    ...prev.codriver,
                    [field]: normalized
                  }
                }));
                const errorKeyMap: Partial<Record<keyof StartRegistrationForm["codriver"], keyof StartFieldErrors>> = {
                  firstName: "codriverFirstName",
                  lastName: "codriverLastName",
                  birthdate: "codriverBirthdate",
                  nationality: "codriverNationality",
                  street: "codriverStreet",
                  zip: "codriverZip",
                  city: "codriverCity",
                  email: "codriverEmail",
                  phone: "codriverPhone"
                };
                const errorKey = errorKeyMap[field];
                if (errorKey) {
                  setStartFieldErrors((prev) => ({ ...prev, [errorKey]: undefined }));
                }
              }}
              onBackupFieldChange={(field, value) => {
                setStartError("");
                setDraftStart((prev) => ({ ...prev, backupVehicle: { ...prev.backupVehicle, [field]: value } }));
                const errorKeyMap: Partial<Record<keyof VehicleForm, keyof StartFieldErrors>> = {
                  make: "backupMake",
                  model: "backupModel",
                  year: "backupYear",
                  displacementCcm: "backupDisplacementCcm",
                  engineType: "backupEngineType",
                  cylinders: "backupCylinders",
                  brakes: "backupBrakes",
                  vehicleHistory: "backupVehicleHistory"
                };
                const errorKey = errorKeyMap[field];
                if (errorKey) {
                  setStartFieldErrors((prev) => ({ ...prev, [errorKey]: undefined }));
                }
              }}
              onSave={() => {
                void saveDraft();
              }}
              onEdit={editStart}
              onRemove={removeStart}
            />
          )}

          {step === 3 && (
            <SummaryStep
              form={form}
              submitError={submitError}
              consentError={consentError}
              successMessage={successMessage}
              isSubmitting={isSubmitting || submitLocked}
              onConsentChange={(field, value) => {
                setConsent((prev) => ({ ...prev, [field]: value }));
                setConsentError("");
              }}
              onSubmit={() => {
                void submit();
              }}
            />
          )}

          <div className="hidden flex-wrap justify-between gap-3 border-t pt-5 md:flex">
            <Button type="button" variant="outline" disabled={step === 1} onClick={() => setStep((prev) => Math.max(1, prev - 1))}>
              {m.page.back}
            </Button>
            {step === 1 && (
              <Button type="button" onClick={goToStep2}>
                {m.page.nextToStarts}
              </Button>
            )}
            {step === 2 && (
              <span title={!starts.length ? step2BlockedReason : undefined} className="inline-flex">
                <Button type="button" disabled={!starts.length} onClick={goToStep3}>
                  {m.page.nextToSummary}
                </Button>
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-20 -mx-3 border-t bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur sm:-mx-4 md:hidden">
        <div className="mx-auto max-w-6xl space-y-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" className="flex-1" disabled={step === 1} onClick={() => setStep((prev) => Math.max(1, prev - 1))}>
              {m.page.back}
            </Button>
            {step < 3 && (
              <span title={step === 2 && !starts.length ? step2BlockedReason : undefined} className="flex-1">
                <Button type="button" className="w-full" disabled={step === 2 && !starts.length} onClick={handleNext}>
                  {m.page.next}
                </Button>
              </span>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
