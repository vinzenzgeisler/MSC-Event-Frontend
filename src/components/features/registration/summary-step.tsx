import { Button } from "@/components/ui/button";
import type { RegistrationWizardForm } from "@/types/registration";

type SummaryStepProps = {
  form: RegistrationWizardForm;
  submitError: string;
  successMessage: string;
  onConsentChange: (field: keyof RegistrationWizardForm["consent"], value: boolean) => void;
  onSubmit: () => void;
};

export function SummaryStep({ form, submitError, successMessage, onConsentChange, onSubmit }: SummaryStepProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-slate-50 p-4">
        <h3 className="font-semibold text-slate-900">Fahrer</h3>
        <p className="mt-1 text-sm text-slate-700">
          {form.driver.firstName} {form.driver.lastName} · {form.driver.email}
        </p>
        <p className="text-sm text-slate-600">Notfallkontakt: {form.driver.emergencyContactName} ({form.driver.emergencyContactPhone})</p>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-slate-900">Startmeldungen ({form.starts.length})</h3>
        {form.starts.map((start, index) => (
          <div key={start.id} className="rounded-xl border p-4">
            <div className="font-medium text-slate-900">
              #{index + 1} {start.classLabel} · {start.startNumber}
            </div>
            <div className="text-sm text-slate-600">
              {start.vehicle.make} {start.vehicle.model} · {start.vehicle.displacementCcm} ccm · {start.vehicle.engineType}
            </div>
            {start.codriverEnabled && (
              <div className="text-sm text-slate-600">
                Beifahrer: {start.codriver.firstName} {start.codriver.lastName}
              </div>
            )}
            {start.backupVehicleEnabled && <div className="text-sm text-slate-600">Ersatzfahrzeug erfasst</div>}
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-xl border p-4">
        <h3 className="font-semibold text-slate-900">Einwilligungen</h3>
        <label className="flex items-start gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={form.consent.termsAccepted}
            onChange={(event) => onConsentChange("termsAccepted", event.target.checked)}
          />
          Haftungshinweise akzeptieren
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={form.consent.privacyAccepted}
            onChange={(event) => onConsentChange("privacyAccepted", event.target.checked)}
          />
          Datenschutzhinweise akzeptieren
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={form.consent.mediaAccepted}
            onChange={(event) => onConsentChange("mediaAccepted", event.target.checked)}
          />
          Einwilligung zur Mediennutzung akzeptieren
        </label>
      </div>

      {submitError && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{submitError}</div>}
      {successMessage && <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">{successMessage}</div>}

      <Button type="button" className="w-full md:w-auto" onClick={onSubmit}>
        Anmeldung absenden
      </Button>
    </div>
  );
}
