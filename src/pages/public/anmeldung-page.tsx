import { useEffect, useMemo, useState } from "react";
import { useAnmeldungI18n } from "@/app/i18n/anmeldung-i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DriverStep } from "@/components/features/registration/driver-step";
import { StartEntriesStep } from "@/components/features/registration/start-entries-step";
import { SummaryStep } from "@/components/features/registration/summary-step";
import { WizardStepper } from "@/components/features/registration/wizard-stepper";
import { registrationService } from "@/services/registration.service";
import type { DriverForm, PublicEventOverview, RegistrationWizardForm, StartRegistrationForm, VehicleForm } from "@/types/registration";

const START_NUMBER_PATTERN = /^[A-Z0-9]{1,6}$/;
const PHONE_ALLOWED_PATTERN = /^\+?[0-9()\/\-\s.]+$/;
const ZIP_PATTERN = /^\d{5}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HUBRAUM_PATTERN = /^\d{2,5}$/;
const CYLINDERS_PATTERN = /^(?:\d{1,2}|V\d{1,2})$/i;
const YEAR_PATTERN = /^\d{4}$/;
const REGISTRATION_DRAFT_STORAGE_KEY = "msc_registration_draft_v1";

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
    imageFileName: ""
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
  street: "",
  zip: "",
  city: "",
  phone: "",
  email: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  motorsportHistory: "",
  specialNotes: ""
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

function isValidPhone(value: string) {
  const normalized = normalizePhone(value);
  if (!normalized || !PHONE_ALLOWED_PATTERN.test(normalized)) {
    return false;
  }
  const digits = normalized.replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 15;
}

function validateDriverForm(value: DriverForm, m: ReturnType<typeof useAnmeldungI18n>["m"]): Partial<Record<keyof DriverForm, string>> {
  const errors: Partial<Record<keyof DriverForm, string>> = {};
  if (!value.firstName.trim()) errors.firstName = m.errors.requiredFirstName;
  if (!value.lastName.trim()) errors.lastName = m.errors.requiredLastName;
  if (!value.birthdate.trim()) errors.birthdate = m.errors.requiredBirthdate;
  if (!value.street.trim()) errors.street = m.errors.requiredStreet;
  if (!value.city.trim()) errors.city = m.errors.requiredCity;
  if (!value.zip.trim()) {
    errors.zip = m.errors.requiredZip;
  } else if (!ZIP_PATTERN.test(value.zip.trim())) {
    errors.zip = m.errors.invalidZip;
  }
  if (!value.phone.trim() || !isValidPhone(value.phone.trim())) errors.phone = m.errors.invalidPhone;
  if (!value.email.trim() || !EMAIL_PATTERN.test(value.email.trim())) errors.email = m.errors.invalidEmail;
  if (!value.emergencyContactName.trim()) errors.emergencyContactName = m.errors.requiredEmergencyName;
  if (!value.emergencyContactPhone.trim() || !isValidPhone(value.emergencyContactPhone.trim())) {
    errors.emergencyContactPhone = m.errors.invalidEmergencyPhone;
  }
  if (!value.motorsportHistory.trim()) errors.motorsportHistory = m.errors.requiredHistory;
  return errors;
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
    | "codriverFirstName"
    | "codriverLastName"
    | "codriverEmail",
    string
  >
>;

type RegistrationDraftStorage = {
  step: number;
  driver: DriverForm;
  starts: StartRegistrationForm[];
  draftStart: StartRegistrationForm;
  editingId: string | null;
  consent: RegistrationWizardForm["consent"];
};

function validateStartFields(start: StartRegistrationForm, m: ReturnType<typeof useAnmeldungI18n>["m"]): StartFieldErrors {
  const errors: StartFieldErrors = {};

  if (!start.classId) {
    errors.classId = m.errors.requiredClass;
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

  if (start.vehicle.year.trim() && !YEAR_PATTERN.test(start.vehicle.year.trim())) {
    errors.year = m.errors.invalidYear;
  }

  if (!start.vehicle.engineType.trim()) {
    errors.engineType = m.errors.requiredEngine;
  }

  if (!CYLINDERS_PATTERN.test(start.vehicle.cylinders.trim())) {
    errors.cylinders = m.errors.invalidCylinders;
  }

  if (!start.vehicle.brakes.trim()) {
    errors.brakes = m.errors.requiredBrakes;
  }

  if (!start.vehicle.vehicleHistory.trim()) {
    errors.vehicleHistory = m.errors.requiredVehicleHistory;
  }

  if (start.codriverEnabled) {
    if (!start.codriver.firstName.trim()) {
      errors.codriverFirstName = m.errors.requiredCodriverFirstName;
    }
    if (!start.codriver.lastName.trim()) {
      errors.codriverLastName = m.errors.requiredCodriverLastName;
    }
    if (!EMAIL_PATTERN.test(start.codriver.email.trim())) {
      errors.codriverEmail = m.errors.invalidCodriverEmail;
    }
  }

  return errors;
}

export function AnmeldungPage() {
  const { m } = useAnmeldungI18n();
  const [step, setStep] = useState(1);
  const [eventOverview, setEventOverview] = useState<PublicEventOverview | null>(null);
  const [driver, setDriver] = useState<DriverForm>(initialDriver);
  const [starts, setStarts] = useState<StartRegistrationForm[]>([]);
  const [draftStart, setDraftStart] = useState<StartRegistrationForm>(createEmptyStart());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [startError, setStartError] = useState("");
  const [startFieldErrors, setStartFieldErrors] = useState<StartFieldErrors>({});
  const [startNumberState, setStartNumberState] = useState<"idle" | "checking" | "available" | "invalid" | "taken">("idle");
  const [startNumberHint, setStartNumberHint] = useState("");
  const [driverErrors, setDriverErrors] = useState<Partial<Record<keyof DriverForm, string>>>({});
  const [consent, setConsent] = useState<RegistrationWizardForm["consent"]>({
    termsAccepted: false,
    privacyAccepted: false,
    mediaAccepted: false
  });
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    registrationService.getCurrentEvent().then(setEventOverview);
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
      setDriver(parsed.driver ?? initialDriver);
      setStarts(Array.isArray(parsed.starts) ? parsed.starts : []);
      setDraftStart(parsed.draftStart ?? createEmptyStart());
      setEditingId(parsed.editingId ?? null);
      setConsent(
        parsed.consent ?? {
          termsAccepted: false,
          privacyAccepted: false,
          mediaAccepted: false
        }
      );
    } catch {
      // ignore invalid persisted drafts
    }
  }, []);

  useEffect(() => {
    const payload: RegistrationDraftStorage = { step, driver, starts, draftStart, editingId, consent };
    window.localStorage.setItem(REGISTRATION_DRAFT_STORAGE_KEY, JSON.stringify(payload));
  }, [step, driver, starts, draftStart, editingId, consent]);

  const form = useMemo<RegistrationWizardForm>(() => ({ driver, starts, consent }), [driver, starts, consent]);

  const handleDriverChange = <K extends keyof DriverForm>(field: K, value: DriverForm[K]) => {
    const normalizedValue = field === "phone" || field === "emergencyContactPhone" ? (sanitizePhoneInput(String(value)) as DriverForm[K]) : value;
    setDriver((prev) => ({ ...prev, [field]: normalizedValue }));
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
  };

  const validateStartNumber = async (): Promise<boolean> => {
    if (!draftStart.classId || !draftStart.startNumber.trim()) {
      return false;
    }

    const normalizedStartNumber = draftStart.startNumber.trim().toUpperCase();
    if (!START_NUMBER_PATTERN.test(normalizedStartNumber)) {
      setStartNumberState("invalid");
      setStartNumberHint("");
      setStartFieldErrors((prev) => ({ ...prev, startNumber: m.errors.invalidStartNumber }));
      return false;
    }

    setStartNumberState("checking");
    const validation = await registrationService.validateStartNumber(draftStart.classId, normalizedStartNumber);

    if (!validation.validFormat || validation.conflictType === "invalid_format") {
      setStartNumberState("invalid");
      setStartNumberHint("");
      setStartFieldErrors((prev) => ({ ...prev, startNumber: m.errors.invalidApiStartFormat }));
      return false;
    }

    if (!validation.available || validation.conflictType === "same_class_taken") {
      setStartNumberState("taken");
      setStartNumberHint("");
      setStartFieldErrors((prev) => ({ ...prev, startNumber: m.errors.startTaken }));
      return false;
    }

    setStartNumberState("available");
    setStartNumberHint(m.start.startAvailable);
    setStartFieldErrors((prev) => ({ ...prev, startNumber: undefined }));
    if (validation.normalizedStartNumber) {
      setDraftStart((prev) => ({ ...prev, startNumber: validation.normalizedStartNumber ?? prev.startNumber }));
    }
    return true;
  };

  const saveDraft = async () => {
    const fieldErrors = validateStartFields(draftStart, m);
    setStartFieldErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      setStartError("");
      return;
    }

    const isStartNumberValid = await validateStartNumber();
    if (!isStartNumberValid) {
      setStartError(m.start.startNumberError);
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
    setEditingId(id);
    setStartError("");
    setStartFieldErrors({});
    setStartNumberState("idle");
    setStartNumberHint("");
  };

  const removeStart = (id: string) => {
    setStarts((prev) => prev.filter((item) => item.id !== id));
    if (editingId === id) {
      setDraftStart(createEmptyStart());
      setEditingId(null);
    }
  };

  const goToStep2 = () => {
    const errors = validateDriverForm(driver, m);
    setDriverErrors(errors);
    if (Object.keys(errors).length) {
      return;
    }
    setStep(2);
  };

  const goToStep3 = () => {
    const draftHasContent =
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
      draftStart.codriverEnabled ||
      draftStart.backupVehicleEnabled;

    if (draftHasContent) {
      const draftErrors = validateStartFields(draftStart, m);
      if (Object.keys(draftErrors).length > 0) {
        setStartFieldErrors(draftErrors);
        setStartError("");
        return;
      }
      setStartError(m.start.saveBeforeContinue);
      return;
    }

    if (!starts.length) {
      setStartError(m.page.startErrorNeedOne);
      return;
    }
    setStep(3);
  };

  const submit = async () => {
    if (!consent.termsAccepted || !consent.privacyAccepted || !consent.mediaAccepted) {
      setSubmitError(m.page.submitErrorConsent);
      return;
    }
    const result = await registrationService.submitWizard(form);
    if (!result.ok) {
      setSubmitError(m.page.submitErrorGeneric);
      return;
    }
    setSubmitError("");
    setSuccessMessage(m.page.submitSuccess);
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

  return (
    <div className="space-y-6 pb-28 md:pb-0">
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
          {step === 1 && <DriverStep value={driver} errors={driverErrors} onChange={handleDriverChange} />}

          {step === 2 && eventOverview && (
            <StartEntriesStep
              classes={eventOverview.classes}
              starts={starts}
              draft={draftStart}
              editingId={editingId}
              error={startError}
              fieldErrors={startFieldErrors}
              startNumberState={startNumberState}
              startNumberHint={startNumberHint}
              onDraftChange={handleDraftChange}
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
              onCodriverFieldChange={(field, value) => {
                setStartError("");
                setDraftStart((prev) => ({
                  ...prev,
                  codriver: {
                    ...prev.codriver,
                    [field]: field === "phone" ? sanitizePhoneInput(value) : value
                  }
                }));
                const errorKeyMap: Partial<Record<keyof StartRegistrationForm["codriver"], keyof StartFieldErrors>> = {
                  firstName: "codriverFirstName",
                  lastName: "codriverLastName",
                  email: "codriverEmail"
                };
                const errorKey = errorKeyMap[field];
                if (errorKey) {
                  setStartFieldErrors((prev) => ({ ...prev, [errorKey]: undefined }));
                }
              }}
              onBackupFieldChange={(field, value) =>
                setDraftStart((prev) => ({ ...prev, backupVehicle: { ...prev.backupVehicle, [field]: value } }))
              }
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
              successMessage={successMessage}
              onConsentChange={(field, value) => setConsent((prev) => ({ ...prev, [field]: value }))}
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

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur md:hidden">
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
