import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAnmeldungI18n } from "@/app/i18n/anmeldung-i18n";
import { usePublicLegal } from "@/app/legal/public-legal-context";
import { getCountryLabel } from "@/lib/countries";
import { getVehicleTypeLabel } from "@/lib/vehicle-type";
import { Button } from "@/components/ui/button";
import type { RegistrationWizardForm } from "@/types/registration";

type ConsentToggleField = "termsAccepted" | "privacyAccepted" | "waiverAccepted" | "mediaAccepted" | "clubInfoAccepted";

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
  const { texts: legalTexts } = usePublicLegal();
  const errorRef = useRef<HTMLDivElement | HTMLParagraphElement | null>(null);
  const emergencyName = `${form.driver.emergencyContactFirstName} ${form.driver.emergencyContactLastName}`.replace(/\s+/g, " ").trim();
  const driverCountryLabel = getCountryLabel(form.driver.country, locale) ?? form.driver.country;
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
          {m.driver.country}: {driverCountryLabel}
        </p>
        <p className="text-sm text-slate-600">
          {m.driver.emergencyTitle}: {emergencyName} ({form.driver.emergencyContactPhone})
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-slate-900">
          {m.summary.startsTitle} ({form.starts.length})
        </h3>
        {form.starts.map((start) => (
          <div key={start.id} className="rounded-xl border p-4">
            <div className="font-medium text-slate-900">
              {start.classLabel} · {start.startNumber}
            </div>
            <div className="text-sm text-slate-600">
              {start.vehicle.make} {start.vehicle.model} · {getVehicleTypeLabel(start.vehicleType)} · {start.vehicle.displacementCcm} ccm
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

      <div className="space-y-5 rounded-xl border p-4 md:p-5">
        <div className="space-y-2">
          <h3 className="font-semibold text-slate-900">{legalTexts?.summary.title ?? m.summary.consentTitle}</h3>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">{legalTexts?.summary.introTitle ?? m.summary.consentTitle}</p>
            <div className="mt-2 space-y-3 text-sm leading-6 text-slate-700">
              {(legalTexts?.summary.introBody ?? []).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-700">
            {(["datenschutz", "teilnahmebedingungen", "haftverzicht", "impressum"] as const).map((docId) => (
              <Link key={docId} className="font-medium text-primary hover:underline" to={`/anmeldung/rechtliches/${docId}`} target="_blank" rel="noreferrer">
                {legalTexts?.docs[docId].summaryLinkLabel ?? docId}
              </Link>
            ))}
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-950">{legalTexts?.summary.waiverNoticeTitle ?? ""}</p>
            <p className="mt-1 text-sm leading-6 text-amber-900">{legalTexts?.summary.waiverNoticeBody ?? ""}</p>
          </div>
        </div>

        <fieldset className="space-y-4" aria-describedby={hasConsentError ? "summary-consent-error" : undefined}>
          <legend className="sr-only">{m.summary.consentTitle}</legend>
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">{legalTexts?.summary.requiredTitle ?? m.summary.consentTitle}</p>
            <ConsentCheckbox
              id="summary-consent-terms"
              checked={form.consent.termsAccepted}
              invalid={hasConsentError}
              onChange={(value) => onConsentChange("termsAccepted", value)}
              label={legalTexts?.summary.termsAcceptanceLabel ?? ""}
            />
            <ConsentCheckbox
              id="summary-consent-privacy"
              checked={form.consent.privacyAccepted}
              invalid={hasConsentError}
              onChange={(value) => onConsentChange("privacyAccepted", value)}
              label={legalTexts?.summary.privacyAcceptanceLabel ?? ""}
            />
            <ConsentCheckbox
              id="summary-consent-waiver"
              checked={form.consent.waiverAccepted}
              invalid={hasConsentError}
              onChange={(value) => onConsentChange("waiverAccepted", value)}
              label={legalTexts?.summary.waiverAcceptanceLabel ?? ""}
            />
          </div>

          <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-slate-900">{legalTexts?.summary.optionalTitle ?? ""}</p>
            <p className="text-sm leading-6 text-slate-700">{legalTexts?.summary.voluntaryBody ?? ""}</p>
            <ConsentCheckbox
              id="summary-consent-media"
              checked={form.consent.mediaAccepted}
              onChange={(value) => onConsentChange("mediaAccepted", value)}
              label={legalTexts?.summary.mediaAcceptanceLabel ?? ""}
            />
            <ConsentCheckbox
              id="summary-consent-club-info"
              checked={form.consent.clubInfoAccepted}
              onChange={(value) => onConsentChange("clubInfoAccepted", value)}
              label={legalTexts?.summary.clubInfoAcceptanceLabel ?? ""}
            />
          </div>

          <p className="text-xs leading-5 text-slate-600">{legalTexts?.summary.minorNotice ?? ""}</p>
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

type ConsentCheckboxProps = {
  id: string;
  checked: boolean;
  label: string;
  invalid?: boolean;
  onChange: (value: boolean) => void;
};

function ConsentCheckbox({ id, checked, label, invalid = false, onChange }: ConsentCheckboxProps) {
  return (
    <label className="flex items-start gap-3 text-sm text-slate-800">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0"
        aria-invalid={invalid ? "true" : "false"}
      />
      <span className="min-w-0 leading-6">{label}</span>
    </label>
  );
}
