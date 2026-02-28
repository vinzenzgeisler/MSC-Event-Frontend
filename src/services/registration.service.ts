import { getPublicCurrentEvent, getPublicEventId } from "@/services/api/event-context";
import { requestJson } from "@/services/api/http-client";
import { CONSENT_VERSION } from "@/config/legal-texts";
import { resolveCountryCode, resolveCountryToCanonical } from "@/lib/countries";
import type {
  PublicCreateEntriesBatchRequestDto,
  PublicCreateEntryRequestDto,
  PublicEventOverview,
  PublicPricingRules,
  RegistrationSubmitResult,
  RegistrationWizardForm,
  StartNumberValidationResult
} from "@/types/registration";

const START_NUMBER_PATTERN = /^[A-Z0-9]{1,6}$/;
const CONSENT_HASH_PATTERN = /^[a-f0-9]{64}$/i;

function parseCylinders(value: string): number {
  const digits = value.replace(/\D/g, "");
  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 15);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function buildSpecialNotes(nationality: string, notes: string): string | undefined {
  const nationalityValue = nationality.trim();
  const noteValue = notes.trim();
  const nationalityLine = nationalityValue ? `Nationalität: ${nationalityValue}` : "";

  if (!nationalityLine && !noteValue) {
    return undefined;
  }
  if (!nationalityLine) {
    return noteValue;
  }
  if (!noteValue) {
    return nationalityLine;
  }
  if (/nationalit[aä]t:/i.test(noteValue)) {
    return noteValue;
  }
  return `${nationalityLine}\n${noteValue}`;
}

function buildEmergencyContactName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();
}

function toIsoBirthdate(value: string): string {
  const match = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) {
    return value;
  }
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function parseIsoBirthdate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

function isMinorBirthdate(value: string): boolean {
  const isoBirthdate = toIsoBirthdate(value.trim());
  const birthdate = parseIsoBirthdate(isoBirthdate);
  if (!birthdate) {
    return false;
  }
  const now = new Date();
  let age = now.getUTCFullYear() - birthdate.getUTCFullYear();
  const birthdayReached =
    now.getUTCMonth() > birthdate.getUTCMonth() || (now.getUTCMonth() === birthdate.getUTCMonth() && now.getUTCDate() >= birthdate.getUTCDate());
  if (!birthdayReached) {
    age -= 1;
  }
  return age < 18;
}

function buildConsentPayload(form: RegistrationWizardForm, consentCapturedAt: string): PublicCreateEntryRequestDto["consent"] {
  if (!form.consent.termsAccepted || !form.consent.privacyAccepted) {
    throw new Error("CONSENT_REQUIRED_MISSING");
  }
  const consentTextHash = form.consent.consentTextHash.trim().toLowerCase();
  if (!CONSENT_HASH_PATTERN.test(consentTextHash)) {
    throw new Error("CONSENT_TEXT_HASH_INVALID");
  }
  const consentLocale = form.consent.locale.trim();
  if (!consentLocale) {
    throw new Error("CONSENT_LOCALE_MISSING");
  }
  return {
    termsAccepted: true,
    privacyAccepted: true,
    mediaAccepted: Boolean(form.consent.mediaAccepted),
    consentVersion: form.consent.consentVersion.trim() || CONSENT_VERSION,
    consentTextHash,
    locale: consentLocale,
    consentSource: "public_form",
    consentCapturedAt
  };
}

function mapVehicle(vehicleType: PublicCreateEntryRequestDto["vehicle"]["vehicleType"], value: RegistrationWizardForm["starts"][number]["vehicle"]) {
  return {
    vehicleType,
    make: value.make,
    model: value.model,
    year: value.year ? Number(value.year) : undefined,
    displacementCcm: Number(value.displacementCcm),
    engineType: value.engineType,
    cylinders: parseCylinders(value.cylinders),
    brakes: value.brakes,
    vehicleHistory: value.vehicleHistory,
    ownerName: value.ownerName,
    imageS3Key: value.imageS3Key || undefined
  };
}

function toCreateEntryRequestDto(form: RegistrationWizardForm, startIndex: number, consentCapturedAt: string): PublicCreateEntryRequestDto {
  const start = form.starts[startIndex];
  const isMinorDriver = isMinorBirthdate(form.driver.birthdate);
  const driverNationalityCode = resolveCountryCode(form.driver.nationality) ?? form.driver.nationality.trim();
  const driverNationality = driverNationalityCode || undefined;
  const driverNationalityForNotes = driverNationality ? resolveCountryToCanonical(driverNationality) ?? driverNationality : "";
  const codriverNationality =
    start.codriverEnabled && start.codriver.nationality
      ? resolveCountryCode(start.codriver.nationality) ?? start.codriver.nationality.trim()
      : undefined;
  const specialNotes = buildSpecialNotes(driverNationalityForNotes, form.driver.specialNotes);
  return {
    classId: start.classId,
    driver: {
      email: normalizeEmail(form.driver.email),
      firstName: form.driver.firstName,
      lastName: form.driver.lastName,
      birthdate: toIsoBirthdate(form.driver.birthdate),
      nationality: driverNationality,
      street: form.driver.street,
      zip: form.driver.zip,
      city: form.driver.city,
      phone: normalizePhone(form.driver.phone),
      emergencyContactName: buildEmergencyContactName(form.driver.emergencyContactFirstName, form.driver.emergencyContactLastName),
      emergencyContactFirstName: form.driver.emergencyContactFirstName.trim() || undefined,
      emergencyContactLastName: form.driver.emergencyContactLastName.trim() || undefined,
      emergencyContactPhone: normalizePhone(form.driver.emergencyContactPhone),
      motorsportHistory: form.driver.motorsportHistory,
      specialNotes,
      guardianFullName: isMinorDriver ? form.driver.guardianFullName.trim() || undefined : undefined,
      guardianEmail: isMinorDriver ? normalizeEmail(form.driver.guardianEmail) || undefined : undefined,
      guardianPhone: isMinorDriver ? normalizePhone(form.driver.guardianPhone) || undefined : undefined,
      guardianConsentAccepted: isMinorDriver ? form.driver.guardianConsentAccepted : undefined
    },
    codriver: start.codriverEnabled
      ? {
          firstName: start.codriver.firstName,
          lastName: start.codriver.lastName,
          birthdate: toIsoBirthdate(start.codriver.birthdate),
          nationality: codriverNationality || "",
          street: start.codriver.street,
          zip: start.codriver.zip,
          city: start.codriver.city,
          email: normalizeEmail(start.codriver.email),
          phone: normalizePhone(start.codriver.phone)
        }
      : undefined,
    codriverEnabled: start.codriverEnabled,
    vehicle: {
      ...mapVehicle(start.vehicleType, start.vehicle),
      ownerName: start.vehicle.ownerName || `${form.driver.firstName} ${form.driver.lastName}`.trim(),
      startNumberRaw: start.startNumber.trim().toUpperCase() || undefined,
    },
    backupVehicle: start.backupVehicleEnabled
      ? {
          ...mapVehicle(start.vehicleType, start.backupVehicle),
          ownerName: start.backupVehicle.ownerName || `${form.driver.firstName} ${form.driver.lastName}`.trim()
        }
      : undefined,
    startNumber: start.startNumber.trim().toUpperCase(),
    specialNotes,
    consent: {
      ...buildConsentPayload(form, consentCapturedAt)
    },
  };
}

type PublicStartNumberValidateResponse = {
  ok: boolean;
  normalizedStartNumber: string | null;
  validFormat: boolean;
  available: boolean;
  conflictEntryId: string | null;
  conflictType: "none" | "same_class_taken" | "invalid_format";
};

type PublicCreateEntryResponse = {
  ok: boolean;
  entryId: string;
  registrationStatus: RegistrationSubmitResult["status"];
  verificationToken: string;
  confirmationMailSent: boolean;
};

type PublicCreateEntriesBatchResponse = {
  ok: boolean;
  groupId: string;
  entryIds: string[];
  entryCount: number;
  registrationStatus: RegistrationSubmitResult["status"];
  verificationToken: string;
  confirmationMailSent: boolean;
};

type PublicVehicleImageUploadInitResponse = {
  ok: boolean;
  uploadId: string;
  key: string;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
};

type PublicVehicleImageUploadFinalizeResponse = {
  ok: boolean;
  uploadId: string;
  imageS3Key: string;
  finalizedAt: string | null;
};

type PublicVerifyEmailResponse = {
  ok: boolean;
  verified?: boolean;
  alreadyVerified?: boolean;
};

function asNonNegativeNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

function normalizePricingRules(value: unknown): PublicPricingRules | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const earlyDeadline = typeof source.earlyDeadline === "string" ? source.earlyDeadline : null;
  const lateFeeCents = asNonNegativeNumber(source.lateFeeCents);
  const secondVehicleDiscountCents = asNonNegativeNumber(source.secondVehicleDiscountCents) ?? 0;
  const currency = typeof source.currency === "string" && source.currency.trim() ? source.currency : "EUR";
  const classRulesSource = Array.isArray(source.classRules) ? source.classRules : [];

  if (!earlyDeadline || lateFeeCents === null || classRulesSource.length === 0) {
    return null;
  }

  const classRules = classRulesSource
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const row = item as Record<string, unknown>;
      const classId =
        typeof row.classId === "string" ? row.classId : typeof row.eventClassId === "string" ? row.eventClassId : null;
      const baseFeeCents = asNonNegativeNumber(row.baseFeeCents);
      if (!classId || baseFeeCents === null) {
        return null;
      }
      return {
        classId,
        className: typeof row.className === "string" && row.className.trim() ? row.className : classId,
        baseFeeCents
      };
    })
    .filter(Boolean) as PublicPricingRules["classRules"];

  if (!classRules.length) {
    return null;
  }

  return {
    earlyDeadline,
    lateFeeCents,
    secondVehicleDiscountCents,
    currency,
    classRules
  };
}

function extractPublicPricingRules(response: unknown): PublicPricingRules | null {
  if (!response || typeof response !== "object") {
    return null;
  }

  const root = response as Record<string, unknown>;
  const rootPricingRules = normalizePricingRules(root.pricingRules);
  if (rootPricingRules) {
    return rootPricingRules;
  }
  const rootPricing = normalizePricingRules(root.pricing);
  if (rootPricing) {
    return rootPricing;
  }

  const eventNode = root.event;
  if (!eventNode || typeof eventNode !== "object") {
    return null;
  }
  const eventRecord = eventNode as Record<string, unknown>;
  const eventPricingRules = normalizePricingRules(eventRecord.pricingRules);
  if (eventPricingRules) {
    return eventPricingRules;
  }
  return normalizePricingRules(eventRecord.pricing);
}

function buildClientSubmissionKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `submission-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toBatchRequestDto(form: RegistrationWizardForm, clientSubmissionKey: string): PublicCreateEntriesBatchRequestDto {
  const consentCapturedAt = new Date().toISOString();
  const entryPayloads = form.starts.map((_, index) => toCreateEntryRequestDto(form, index, consentCapturedAt));
  const first = entryPayloads[0];
  return {
    clientSubmissionKey,
    driver: first.driver,
    consent: first.consent,
    entries: entryPayloads.map((entry) => ({
      classId: entry.classId,
      codriverEnabled: entry.codriverEnabled,
      codriver: entry.codriver,
      vehicle: entry.vehicle,
      backupVehicle: entry.backupVehicle,
      specialNotes: entry.specialNotes,
      startNumber: entry.startNumber,
    }))
  };
}

export const registrationService = {
  async getCurrentEvent(): Promise<PublicEventOverview> {
    const response = await getPublicCurrentEvent();
    return {
      id: response.event.id,
      name: response.event.name,
      startsAt: response.event.startsAt,
      endsAt: response.event.endsAt,
      location: "",
      registrationOpen: response.registration.isOpen,
      registrationOpenAt: response.event.registrationOpenAt,
      registrationCloseAt: response.event.registrationCloseAt,
      pricingRules: extractPublicPricingRules(response),
      classes: response.classes.map((item) => ({
        id: item.id,
        name: item.name,
        vehicleType: item.vehicleType
      }))
    };
  },

  async validateStartNumber(classId: string, value: string): Promise<StartNumberValidationResult> {
    const normalized = value.trim().toUpperCase();

    if (!normalized || !START_NUMBER_PATTERN.test(normalized)) {
      return {
        normalizedStartNumber: normalized || null,
        validFormat: false,
        available: false,
        conflictEntryId: null,
        conflictType: "invalid_format"
      };
    }

    const eventId = await getPublicEventId();
    const response = await requestJson<PublicStartNumberValidateResponse>(`/public/events/${eventId}/start-number/validate`, {
      method: "POST",
      auth: false,
      body: {
        classId,
        startNumber: normalized
      }
    });

    return {
      normalizedStartNumber: response.normalizedStartNumber,
      validFormat: response.validFormat,
      available: response.available,
      conflictEntryId: response.conflictEntryId,
      conflictType: response.conflictType
    };
  },

  async submitWizard(form: RegistrationWizardForm, options?: { clientSubmissionKey?: string }): Promise<RegistrationSubmitResult> {
    if (!form.starts.length) {
      return {
        ok: false,
        createdEntries: 0,
        attemptedEntries: 0,
        status: "submitted_unverified"
      };
    }

    const normalizedForm: RegistrationWizardForm = {
      ...form,
      consent: {
        ...form.consent,
        consentSource: "public_form",
        consentVersion: form.consent.consentVersion.trim() || CONSENT_VERSION,
        locale: form.consent.locale.trim()
      }
    };

    const eventId = await getPublicEventId();
    const clientSubmissionKey = options?.clientSubmissionKey?.trim() || buildClientSubmissionKey();
    const batchPayload = toBatchRequestDto(normalizedForm, clientSubmissionKey);
    const batchResponse = await requestJson<PublicCreateEntriesBatchResponse>(`/public/events/${eventId}/entries/batch`, {
      method: "POST",
      auth: false,
      body: batchPayload
    });

    return {
      ok: true,
      createdEntries: batchResponse.entryCount,
      attemptedEntries: normalizedForm.starts.length,
      status: batchResponse.registrationStatus,
      groupId: batchResponse.groupId,
      entryIds: batchResponse.entryIds,
      entryCount: batchResponse.entryCount
    };
  },

  async uploadVehicleImage(file: File) {
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      throw new Error("Dateityp nicht unterstützt (nur JPG, PNG, WEBP).");
    }

    const eventId = await getPublicEventId();
    const initResponse = await requestJson<PublicVehicleImageUploadInitResponse>("/public/uploads/vehicle-image/init", {
      method: "POST",
      auth: false,
      body: {
        eventId,
        contentType: file.type,
        fileName: file.name,
        fileSizeBytes: file.size
      }
    });

    const uploadHeaders: Record<string, string> = { ...(initResponse.requiredHeaders ?? {}) };
    if (!Object.keys(uploadHeaders).some((key) => key.toLowerCase() === "content-type")) {
      uploadHeaders["Content-Type"] = file.type;
    }

    const uploadResult = await fetch(initResponse.uploadUrl, {
      method: "PUT",
      headers: uploadHeaders,
      body: file
    });

    if (!uploadResult.ok) {
      throw new Error("Bild-Upload fehlgeschlagen.");
    }

    const finalizeResponse = await requestJson<PublicVehicleImageUploadFinalizeResponse>("/public/uploads/vehicle-image/finalize", {
      method: "POST",
      auth: false,
      body: {
        uploadId: initResponse.uploadId
      }
    });

    return {
      imageS3Key: finalizeResponse.imageS3Key,
      fileName: file.name
    };
  },

  async verifyEmail(entryId: string, token: string) {
    return requestJson<PublicVerifyEmailResponse>(`/public/entries/${entryId}/verify-email`, {
      method: "POST",
      auth: false,
      body: {
        token
      }
    });
  }
};
