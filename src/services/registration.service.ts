import { getPublicCurrentEvent, getPublicEventId } from "@/services/api/event-context";
import { ApiError } from "@/services/api/http-client";
import { requestJson } from "@/services/api/http-client";
import { resolveCountryCode } from "@/lib/countries";
import type {
  PublicCreateEntriesBatchRequestDto,
  PublicCreateEntryRequestDto,
  PublicEventOverview,
  PublicPricingRules,
  PublicLegalConsentMeta,
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

function buildSpecialNotes(notes: string): string | undefined {
  const noteValue = notes.trim();
  return noteValue || undefined;
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
  if (!form.consent.termsAccepted || !form.consent.privacyAccepted || !form.consent.waiverAccepted) {
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
  const consentVersion = form.consent.consentVersion.trim();
  if (!consentVersion) {
    throw new Error("CONSENT_VERSION_MISSING");
  }
  return {
    termsAccepted: true,
    privacyAccepted: true,
    waiverAccepted: true,
    mediaAccepted: Boolean(form.consent.mediaAccepted),
    clubInfoAccepted: Boolean(form.consent.clubInfoAccepted),
    consentVersion,
    consentTextHash,
    locale: consentLocale,
    consentSource: "public_form",
    consentCapturedAt
  };
}

function mapVehicle(vehicleType: PublicCreateEntryRequestDto["vehicle"]["vehicleType"], value: RegistrationWizardForm["starts"][number]["vehicle"]) {
  const imageUploadId = value.imageUploadId.trim();
  const imageUploadToken = value.imageUploadToken.trim();
  return {
    vehicleType,
    make: value.make,
    model: value.model,
    year: value.year ? Number(value.year) : undefined,
    displacementCcm: Number(value.displacementCcm),
    cylinders: parseCylinders(value.cylinders),
    vehicleHistory: value.vehicleHistory,
    ownerName: value.ownerName,
    imageUploadId: imageUploadId && imageUploadToken ? imageUploadId : undefined,
    imageUploadToken: imageUploadId && imageUploadToken ? imageUploadToken : undefined
  };
}

function toCreateEntryRequestDto(form: RegistrationWizardForm, startIndex: number, consentCapturedAt: string): PublicCreateEntryRequestDto {
  const start = form.starts[startIndex];
  const isMinorDriver = isMinorBirthdate(form.driver.birthdate);
  const specialNotes = buildSpecialNotes(form.driver.specialNotes);
  return {
    classId: start.classId,
    driver: {
      email: normalizeEmail(form.driver.email),
      firstName: form.driver.firstName,
      lastName: form.driver.lastName,
      birthdate: toIsoBirthdate(form.driver.birthdate),
      country: resolveCountryCode(form.driver.country) ?? form.driver.country.trim(),
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
          country: resolveCountryCode(start.codriver.country) ?? start.codriver.country.trim(),
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

type PublicLegalCurrentResponse = {
  ok: boolean;
  consent: PublicLegalConsentMeta;
  availableLocales: string[];
};

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
  uploadToken: string;
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

type PublicVerifyResendResponse = {
  ok: boolean;
  queued: boolean;
};

async function submitWizardFallbackSingle(
  eventId: string,
  normalizedForm: RegistrationWizardForm
): Promise<RegistrationSubmitResult> {
  const attemptedEntries = normalizedForm.starts.length;
  const createdEntryIds: string[] = [];
  let lastStatus: RegistrationSubmitResult["status"] = "submitted_unverified";

  for (let index = 0; index < attemptedEntries; index += 1) {
    const consentCapturedAt = new Date().toISOString();
    const entryPayload = toCreateEntryRequestDto(normalizedForm, index, consentCapturedAt);

    try {
      const entryResponse = await requestJson<PublicCreateEntryResponse>(`/public/events/${eventId}/entries`, {
        method: "POST",
        auth: false,
        body: entryPayload
      });
      createdEntryIds.push(entryResponse.entryId);
      lastStatus = entryResponse.registrationStatus;
    } catch (error) {
      if (createdEntryIds.length > 0) {
        return {
          ok: false,
          createdEntries: createdEntryIds.length,
          attemptedEntries,
          status: lastStatus,
          entryIds: createdEntryIds,
          entryCount: createdEntryIds.length
        };
      }
      throw error;
    }
  }

  return {
    ok: true,
    createdEntries: createdEntryIds.length,
    attemptedEntries,
    status: lastStatus,
    entryIds: createdEntryIds,
    entryCount: createdEntryIds.length
  };
}

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

  async getPublicLegalConsent(locale: string): Promise<PublicLegalConsentMeta> {
    const response = await requestJson<PublicLegalCurrentResponse>("/public/legal/current", {
      method: "GET",
      auth: false,
      query: { locale }
    });
    return response.consent;
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
        consentVersion: form.consent.consentVersion.trim(),
        locale: form.consent.locale.trim()
      }
    };

    const eventId = await getPublicEventId();
    const clientSubmissionKey = options?.clientSubmissionKey?.trim() || buildClientSubmissionKey();
    const batchPayload = toBatchRequestDto(normalizedForm, clientSubmissionKey);
    let batchResponse: PublicCreateEntriesBatchResponse;
    try {
      batchResponse = await requestJson<PublicCreateEntriesBatchResponse>(`/public/events/${eventId}/entries/batch`, {
        method: "POST",
        auth: false,
        body: batchPayload
      });
    } catch (error) {
      // Backward compatibility for deployments where batch route is not yet available.
      if (error instanceof ApiError) {
        const status = Number(error.status);
        if (status === 404 || status === 405 || status === 501) {
          return submitWizardFallbackSingle(eventId, normalizedForm);
        }
      }
      throw error;
    }

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
        uploadId: initResponse.uploadId,
        uploadToken: initResponse.uploadToken
      }
    });

    return {
      imageUploadId: finalizeResponse.uploadId.trim(),
      imageUploadToken: initResponse.uploadToken.trim(),
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
  },

  async resendVerification(entryId: string) {
    return requestJson<PublicVerifyResendResponse>(`/public/entries/${entryId}/verification-resend`, {
      method: "POST",
      auth: false,
      body: {}
    });
  }
};
