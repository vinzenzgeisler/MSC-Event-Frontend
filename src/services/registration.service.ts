import { mockPublicEvent, mockReservedStartNumbers } from "@/mock/registration.mock";
import { getPublicCurrentEvent, getPublicEventId } from "@/services/api/event-context";
import { isMockApiEnabled, requestJson } from "@/services/api/http-client";
import type {
  PublicCreateEntryRequestDto,
  PublicEventOverview,
  RegistrationSubmitResult,
  RegistrationWizardForm,
  StartNumberValidationResult
} from "@/types/registration";

const START_NUMBER_PATTERN = /^[A-Z0-9]{1,6}$/;

function parseCylinders(value: string): number {
  const digits = value.replace(/\D/g, "");
  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 15);
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

function toCreateEntryRequestDto(form: RegistrationWizardForm, startIndex: number): PublicCreateEntryRequestDto {
  const start = form.starts[startIndex];
  const specialNotes = buildSpecialNotes(form.driver.nationality, form.driver.specialNotes);
  return {
    classId: start.classId,
    driver: {
      email: form.driver.email,
      firstName: form.driver.firstName,
      lastName: form.driver.lastName,
      birthdate: form.driver.birthdate,
      street: form.driver.street,
      zip: form.driver.zip,
      city: form.driver.city,
      phone: normalizePhone(form.driver.phone),
      emergencyContactName: form.driver.emergencyContactName,
      emergencyContactPhone: normalizePhone(form.driver.emergencyContactPhone),
      motorsportHistory: form.driver.motorsportHistory,
      specialNotes
    },
    codriver: start.codriverEnabled
      ? {
          firstName: start.codriver.firstName,
          lastName: start.codriver.lastName,
          email: start.codriver.email,
          phone: start.codriver.phone ? normalizePhone(start.codriver.phone) : undefined
        }
      : undefined,
    codriverEnabled: start.codriverEnabled,
    vehicle: {
      vehicleType: start.vehicleType,
      make: start.vehicle.make,
      model: start.vehicle.model,
      year: start.vehicle.year ? Number(start.vehicle.year) : undefined,
      displacementCcm: Number(start.vehicle.displacementCcm),
      engineType: start.vehicle.engineType,
      cylinders: parseCylinders(start.vehicle.cylinders),
      brakes: start.vehicle.brakes,
      vehicleHistory: start.vehicle.vehicleHistory,
      ownerName: start.vehicle.ownerName || `${form.driver.firstName} ${form.driver.lastName}`.trim(),
      startNumberRaw: start.startNumber.trim().toUpperCase() || undefined,
      imageS3Key: start.vehicle.imageS3Key || undefined
    },
    startNumber: start.startNumber.trim().toUpperCase(),
    specialNotes,
    isBackupVehicle: start.backupVehicleEnabled,
    consent: {
      termsAccepted: true,
      privacyAccepted: true,
      mediaAccepted: true,
      consentVersion: "2026-01",
      consentCapturedAt: new Date().toISOString()
    }
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
  confirmationMailSent?: boolean;
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

export const registrationService = {
  async getCurrentEvent(): Promise<PublicEventOverview> {
    if (isMockApiEnabled()) {
      return mockPublicEvent;
    }

    const response = await getPublicCurrentEvent();
    return {
      id: response.event.id,
      name: response.event.name,
      startsAt: response.event.startsAt,
      location: "",
      registrationOpen: response.registration.isOpen,
      classes: response.classes.map((item) => ({
        id: item.id,
        name: item.name,
        vehicleType: item.vehicleType
      }))
    };
  },

  async validateStartNumber(classId: string, value: string): Promise<StartNumberValidationResult> {
    const normalized = value.trim().toUpperCase();

    if (isMockApiEnabled()) {
      if (!normalized || !START_NUMBER_PATTERN.test(normalized)) {
        return {
          normalizedStartNumber: normalized || null,
          validFormat: false,
          available: false,
          conflictEntryId: null,
          conflictType: "invalid_format"
        };
      }

      const existing = mockReservedStartNumbers.find((item) => item.classId === classId && item.startNumber === normalized);
      return {
        normalizedStartNumber: normalized,
        validFormat: true,
        available: !existing,
        conflictEntryId: existing?.entryId ?? null,
        conflictType: existing ? "same_class_taken" : "none"
      };
    }

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

  async submitWizard(form: RegistrationWizardForm): Promise<RegistrationSubmitResult> {
    if (isMockApiEnabled()) {
      return {
        ok: true,
        createdEntries: form.starts.length,
        status: "submitted_unverified"
      };
    }

    if (!form.starts.length) {
      return {
        ok: false,
        createdEntries: 0,
        status: "submitted_unverified"
      };
    }

    const eventId = await getPublicEventId();
    let createdEntries = 0;
    let latestStatus: RegistrationSubmitResult["status"] = "submitted_unverified";

    for (let index = 0; index < form.starts.length; index += 1) {
      const payload = toCreateEntryRequestDto(form, index);
      const response = await requestJson<PublicCreateEntryResponse>(`/public/events/${eventId}/entries`, {
        method: "POST",
        auth: false,
        body: payload
      });

      if (!response.ok) {
        return {
          ok: false,
          createdEntries,
          status: latestStatus
        };
      }

      createdEntries += 1;
      latestStatus = response.registrationStatus;
    }

    return {
      ok: true,
      createdEntries,
      status: latestStatus
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
