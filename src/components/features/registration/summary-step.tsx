import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { getLegalTexts } from "@/config/legal-texts";
import { useAnmeldungI18n } from "@/app/i18n/anmeldung-i18n";
import { getCountryLabel } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import type { RegistrationWizardForm } from "@/types/registration";

type ConsentToggleField = "termsAccepted" | "privacyAccepted" | "mediaAccepted";

type SummaryStepProps = {
  form: RegistrationWizardForm;
  submitError: string;
  consentError: string;
  successMessage: string;
  isSubmitting?: boolean;
  onConsentChange: (field: ConsentToggleField, value: boolean) => void;
  onSubmit: () => void;
};

export function SummaryStep({ form, submitError, consentError, successMessage, isSubmitting = false, onConsentChange, onSubmit }: SummaryStepProps) {
  const { m, locale } = useAnmeldungI18n();
  const legalTexts = getLegalTexts(locale);
  const errorRef = useRef<HTMLDivElement | HTMLParagraphElement | null>(null);
  const emergencyName = `${form.driver.emergencyContactFirstName} ${form.driver.emergencyContactLastName}`.replace(/\s+/g, " ").trim();
  const driverNationalityLabel = getCountryLabel(form.driver.nationality, locale) ?? form.driver.nationality;
  const hasConsentError = Boolean(consentError);

  useEffect(() => {
    if (!submitError && !consentError) {
      return;
    }
    errorRef.current?.focus();
  }, [submitError, consentError]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-slate-50 p-4">
        <h3 className="font-semibold text-slate-900">{m.summary.driverTitle}</h3>
        <p className="mt-1 text-sm text-slate-700">
          {form.driver.firstName} {form.driver.lastName} · {form.driver.email}
        </p>
        <p className="text-sm text-slate-600">
          {m.driver.nationality}: {driverNationalityLabel}
        </p>
        <p className="text-sm text-slate-600">
          {m.driver.emergencyTitle}: {emergencyName} ({form.driver.emergencyContactPhone})
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-slate-900">
          {m.summary.startsTitle} ({form.starts.length})
        </h3>
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
                {m.start.codriverBadge}: {start.codriver.firstName} {start.codriver.lastName} · {start.codriver.email}
                {start.codriver.phone ? ` · ${start.codriver.phone}` : ""}
              </div>
            )}
            {start.backupVehicleEnabled && <div className="text-sm text-slate-600">{m.summary.backupVehicle}</div>}
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-xl border p-4">
        <h3 className="font-semibold text-slate-900">{m.summary.consentTitle}</h3>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{legalTexts.shortInfo}</div>
        <div className="text-sm text-slate-700">
          <Link className="text-primary hover:underline" to="/anmeldung/rechtliches/datenschutz" target="_blank" rel="noreferrer">
            {legalTexts.privacyDoc.title}
          </Link>
          {" · "}
          <Link className="text-primary hover:underline" to="/anmeldung/rechtliches/teilnahmebedingungen" target="_blank" rel="noreferrer">
            {legalTexts.termsDoc.title}
          </Link>
          {" · "}
          <Link className="text-primary hover:underline" to="/anmeldung/rechtliches/haftverzicht" target="_blank" rel="noreferrer">
            {legalTexts.waiverDoc.title}
          </Link>
        </div>
        <p className="text-sm leading-6 text-slate-700">{legalTexts.waiverSignNotice}</p>

        <fieldset className="space-y-3" aria-describedby={hasConsentError ? "summary-consent-error" : undefined}>
          <legend className="sr-only">{m.summary.consentTitle}</legend>
          <label className="flex items-start gap-2 text-sm text-slate-800">
            <input
              id="summary-consent-terms"
              type="checkbox"
              checked={form.consent.termsAccepted}
              onChange={(event) => onConsentChange("termsAccepted", event.target.checked)}
              className="mt-0.5 h-4 w-4"
              aria-invalid={hasConsentError ? "true" : "false"}
            />
            <span>{legalTexts.termsAcceptanceLabel}</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-800">
            <input
              id="summary-consent-privacy"
              type="checkbox"
              checked={form.consent.privacyAccepted}
              onChange={(event) => onConsentChange("privacyAccepted", event.target.checked)}
              className="mt-0.5 h-4 w-4"
              aria-invalid={hasConsentError ? "true" : "false"}
            />
            <span>{legalTexts.privacyAcceptanceLabel}</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-800">
            <input
              id="summary-consent-media"
              type="checkbox"
              checked={form.consent.mediaAccepted}
              onChange={(event) => onConsentChange("mediaAccepted", event.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>{legalTexts.mediaAcceptanceLabel}</span>
          </label>
          <p className="text-xs text-slate-600">{legalTexts.minorNotice}</p>
          {consentError && (
            <p ref={errorRef} tabIndex={-1} id="summary-consent-error" className="text-sm text-destructive" role="alert" aria-live="assertive">
              {consentError}
            </p>
          )}
        </fieldset>
      </div>

      {submitError && (
        <div ref={errorRef} tabIndex={-1} className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert" aria-live="assertive">
          {submitError}
        </div>
      )}
      {successMessage && <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">{successMessage}</div>}

      <Button type="button" className="w-full md:w-auto" onClick={onSubmit} disabled={isSubmitting}>
        {m.summary.submit}
      </Button>
    </div>
  );
}
