import { mockPublicEvent, mockReservedStartNumbers } from "@/mock/registration.mock";
import type {
  PublicCreateEntryRequestDto,
  RegistrationSubmitResult,
  RegistrationWizardForm,
  StartNumberValidationResult
} from "@/types/registration";

const START_NUMBER_PATTERN = /^[A-Z0-9]{1,6}$/;

function toCreateEntryRequestDto(form: RegistrationWizardForm, startIndex: number): PublicCreateEntryRequestDto {
  const start = form.starts[startIndex];
  return {
    classId: start.classId,
    driver: {
      email: form.driver.email,
      firstName: form.driver.firstName,
      lastName: form.driver.lastName,
      birthdate: form.driver.birthdate || undefined,
      street: form.driver.street || undefined,
      zip: form.driver.zip || undefined,
      city: form.driver.city || undefined,
      phone: form.driver.phone || undefined,
      emergencyContactName: form.driver.emergencyContactName,
      emergencyContactPhone: form.driver.emergencyContactPhone,
      motorsportHistory: form.driver.motorsportHistory
    },
    codriver: start.codriverEnabled
      ? {
          firstName: start.codriver.firstName,
          lastName: start.codriver.lastName,
          email: start.codriver.email,
          phone: start.codriver.phone || undefined
        }
      : undefined,
    vehicle: {
      vehicleType: start.vehicleType,
      make: start.vehicle.make || undefined,
      model: start.vehicle.model || undefined,
      year: start.vehicle.year ? Number(start.vehicle.year) : undefined,
      displacementCcm: Number(start.vehicle.displacementCcm),
      engineType: start.vehicle.engineType,
      cylinders: Number(start.vehicle.cylinders),
      brakes: start.vehicle.brakes,
      vehicleHistory: start.vehicle.vehicleHistory,
      ownerName: start.vehicle.ownerName,
      startNumberRaw: start.startNumber || undefined,
      imageS3Key: undefined
    },
    startNumber: start.startNumber || undefined,
    specialNotes: form.driver.specialNotes,
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

export const registrationService = {
  async getCurrentEvent() {
    return mockPublicEvent;
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

    const existing = mockReservedStartNumbers.find((item) => item.classId === classId && item.startNumber === normalized);

    return {
      normalizedStartNumber: normalized,
      validFormat: true,
      available: !existing,
      conflictEntryId: existing?.entryId ?? null,
      conflictType: existing ? "same_class_taken" : "none"
    };
  },

  async submitWizard(form: RegistrationWizardForm): Promise<RegistrationSubmitResult> {
    form.starts.forEach((_, index) => {
      toCreateEntryRequestDto(form, index);
    });

    return {
      ok: true,
      createdEntries: form.starts.length,
      status: "submitted_unverified"
    };
  }
};
