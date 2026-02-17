import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DriverStep } from "@/components/features/registration/driver-step";
import { StartEntriesStep } from "@/components/features/registration/start-entries-step";
import { SummaryStep } from "@/components/features/registration/summary-step";
import { WizardStepper } from "@/components/features/registration/wizard-stepper";
import { registrationService } from "@/services/registration.service";
import type { DriverForm, PublicEventOverview, RegistrationWizardForm, StartRegistrationForm, VehicleForm } from "@/types/registration";

const START_NUMBER_PATTERN = /^[A-Z0-9]{1,6}$/;

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

function validateDriverForm(value: DriverForm): Partial<Record<keyof DriverForm, string>> {
  const errors: Partial<Record<keyof DriverForm, string>> = {};
  if (!value.firstName.trim()) errors.firstName = "Vorname ist erforderlich.";
  if (!value.lastName.trim()) errors.lastName = "Nachname ist erforderlich.";
  if (!value.birthdate.trim()) errors.birthdate = "Geburtsdatum ist erforderlich.";
  if (!value.phone.trim()) errors.phone = "Telefon ist erforderlich.";
  if (!value.email.trim() || !value.email.includes("@")) errors.email = "Bitte gültige E-Mail eingeben.";
  if (!value.emergencyContactName.trim()) errors.emergencyContactName = "Notfallkontakt ist erforderlich.";
  if (!value.emergencyContactPhone.trim()) errors.emergencyContactPhone = "Telefon des Notfallkontakts ist erforderlich.";
  if (!value.motorsportHistory.trim()) errors.motorsportHistory = "Bitte kurze Motorsport-Historie erfassen.";
  if (!value.specialNotes.trim()) errors.specialNotes = "Bitte Hinweise ausfüllen (mind. 'keine').";
  return errors;
}

function requiredVehicleFields(vehicle: VehicleForm) {
  return (
    vehicle.displacementCcm.trim() &&
    vehicle.engineType.trim() &&
    vehicle.cylinders.trim() &&
    vehicle.brakes.trim() &&
    vehicle.vehicleHistory.trim() &&
    vehicle.ownerName.trim()
  );
}

export function AnmeldungPage() {
  const [step, setStep] = useState(1);
  const [eventOverview, setEventOverview] = useState<PublicEventOverview | null>(null);
  const [driver, setDriver] = useState<DriverForm>(initialDriver);
  const [starts, setStarts] = useState<StartRegistrationForm[]>([]);
  const [draftStart, setDraftStart] = useState<StartRegistrationForm>(createEmptyStart());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [startError, setStartError] = useState("");
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

  const form = useMemo<RegistrationWizardForm>(() => ({ driver, starts, consent }), [driver, starts, consent]);

  const handleDriverChange = <K extends keyof DriverForm>(field: K, value: DriverForm[K]) => {
    setDriver((prev) => ({ ...prev, [field]: value }));
    if (driverErrors[field]) {
      setDriverErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleDraftChange = <K extends keyof StartRegistrationForm>(field: K, value: StartRegistrationForm[K]) => {
    setDraftStart((prev) => ({ ...prev, [field]: value }));
    setStartError("");
  };

  const saveDraft = async () => {
    if (!draftStart.classId) {
      setStartError("Bitte eine Klasse wählen.");
      return;
    }
    if (!START_NUMBER_PATTERN.test(draftStart.startNumber.trim().toUpperCase())) {
      setStartError("Startnummer muss 1-6 Zeichen A-Z/0-9 enthalten.");
      return;
    }
    if (!requiredVehicleFields(draftStart.vehicle)) {
      setStartError("Bitte alle Pflichtfelder zu Fahrzeugdaten ausfüllen.");
      return;
    }

    const validation = await registrationService.validateStartNumber(draftStart.classId, draftStart.startNumber);
    if (!validation.validFormat || validation.conflictType === "invalid_format") {
      setStartError("Die Startnummer hat ein ungültiges Format.");
      return;
    }
    if (!validation.available || validation.conflictType === "same_class_taken") {
      setStartError("Die Startnummer ist in dieser Klasse bereits vergeben.");
      return;
    }

    const normalized = validation.normalizedStartNumber ?? draftStart.startNumber.trim().toUpperCase();
    const next = { ...draftStart, startNumber: normalized };

    if (editingId) {
      setStarts((prev) => prev.map((item) => (item.id === editingId ? next : item)));
    } else {
      setStarts((prev) => [...prev, next]);
    }

    setDraftStart(createEmptyStart());
    setEditingId(null);
    setStartError("");
  };

  const editStart = (id: string) => {
    const item = starts.find((entry) => entry.id === id);
    if (!item) {
      return;
    }
    setDraftStart(item);
    setEditingId(id);
    setStartError("");
  };

  const removeStart = (id: string) => {
    setStarts((prev) => prev.filter((item) => item.id !== id));
    if (editingId === id) {
      setDraftStart(createEmptyStart());
      setEditingId(null);
    }
  };

  const goToStep2 = () => {
    const errors = validateDriverForm(driver);
    setDriverErrors(errors);
    if (Object.keys(errors).length) {
      return;
    }
    setStep(2);
  };

  const goToStep3 = () => {
    if (!starts.length) {
      setStartError("Bitte mindestens eine Startmeldung erfassen.");
      return;
    }
    setStep(3);
  };

  const submit = async () => {
    if (!consent.termsAccepted || !consent.privacyAccepted || !consent.mediaAccepted) {
      setSubmitError("Bitte alle Einwilligungen bestätigen.");
      return;
    }
    const result = await registrationService.submitWizard(form);
    if (!result.ok) {
      setSubmitError("Anmeldung konnte nicht gespeichert werden.");
      return;
    }
    setSubmitError("");
    setSuccessMessage("Eingang bestätigt. Eine Bestätigung per E-Mail folgt.");
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

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <div className="rounded-2xl bg-blue-700 px-5 py-7 text-white md:px-8">
        <div className="inline-flex rounded bg-yellow-400 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-900">
          Anmeldung geöffnet
        </div>
        <h2 className="mt-4 text-2xl font-semibold md:text-3xl">Teilnehmer-Anmeldung</h2>
        <p className="mt-2 max-w-3xl text-sm text-blue-100 md:text-base">
          Schritt für Schritt zur vollständigen Nennung. Du kannst mehrere Startmeldungen je Fahrer erfassen und am Ende alles prüfen.
        </p>
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
              onDraftChange={handleDraftChange}
              onVehicleFieldChange={(field, value) => setDraftStart((prev) => ({ ...prev, vehicle: { ...prev.vehicle, [field]: value } }))}
              onCodriverFieldChange={(field, value) => setDraftStart((prev) => ({ ...prev, codriver: { ...prev.codriver, [field]: value } }))}
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
              Zurück
            </Button>
            {step === 1 && (
              <Button type="button" onClick={goToStep2}>
                Weiter zu Startmeldungen
              </Button>
            )}
            {step === 2 && (
              <Button type="button" onClick={goToStep3}>
                Weiter zur Zusammenfassung
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white/95 p-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <Button type="button" variant="outline" className="flex-1" disabled={step === 1} onClick={() => setStep((prev) => Math.max(1, prev - 1))}>
            Zurück
          </Button>
          {step < 3 && (
            <Button type="button" className="flex-1" onClick={handleNext}>
              Weiter
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
