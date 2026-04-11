import { useEffect, useRef, useState } from "react";
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

function getSummaryUiLabels(locale: string) {
  if (locale === "en") {
    return {
      showMore: "Show more",
      showLess: "Show less",
      showAllHints: "Show all notes",
      showLessHints: "Show fewer notes"
    };
  }
  if (locale === "cz") {
    return {
      showMore: "Zobrazit vice",
      showLess: "Zobrazit mene",
      showAllHints: "Zobrazit vsechny pokyny",
      showLessHints: "Zobrazit mene pokynu"
    };
  }
  if (locale === "pl") {
    return {
      showMore: "Pokaz wiecej",
      showLess: "Pokaz mniej",
      showAllHints: "Pokaz wszystkie wskazowki",
      showLessHints: "Pokaz mniej wskazowek"
    };
  }
  return {
    showMore: "Mehr anzeigen",
    showLess: "Weniger anzeigen",
    showAllHints: "Alle Hinweise anzeigen",
    showLessHints: "Weniger Hinweise anzeigen"
  };
}

export function SummaryStep({ form, submitError, consentError, successMessage, isSubmitting = false, onConsentChange, onSubmit }: SummaryStepProps) {
  const { m, locale } = useAnmeldungI18n();
  const { texts: legalTexts, loading: legalLoading, error: legalError } = usePublicLegal();
  const ui = getSummaryUiLabels(locale);
  const [showAllHints, setShowAllHints] = useState(false);
  const [showFullIntro, setShowFullIntro] = useState(false);
  const errorRef = useRef<HTMLDivElement | HTMLParagraphElement | null>(null);
  const emergencyName = `${form.driver.emergencyContactFirstName} ${form.driver.emergencyContactLastName}`.replace(/\s+/g, " ").trim();
  const driverCountryLabel = getCountryLabel(form.driver.country, locale) ?? form.driver.country;
  const hasConsentError = Boolean(consentError);
  const hintPoints = legalTexts?.summary.mandatoryHints ?? [];
  const visibleHints = showAllHints ? hintPoints : hintPoints.slice(0, 3);
  const introParagraphs = legalTexts?.summary.introBody ?? [];
  const visibleIntroParagraphs = showFullIntro ? introParagraphs : introParagraphs.slice(0, 2);
  const legalReady = Boolean(legalTexts?.summary && legalTexts?.docs);
  const legalStatusText =
    locale === "en"
      ? legalError
        ? "Legal texts could not be loaded. Please reload the page."
        : "Legal texts are loading..."
      : locale === "cz"
        ? legalError
          ? "Pravni texty se nepodarilo nacist. Obnovte prosim stranku."
          : "Pravni texty se nacitaji..."
        : locale === "pl"
          ? legalError
            ? "Nie udalo sie zaladowac tekstow prawnych. Odswiez strone."
            : "Ladowanie tekstow prawnych..."
          : legalError
            ? "Rechtstexte konnten nicht geladen werden. Bitte Seite neu laden."
            : "Rechtstexte werden geladen...";

  useEffect(() => {
    if (!submitError && !consentError) {
      return;
    }
    errorRef.current?.focus();
  }, [submitError, consentError]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-slate-50 p-3 md:p-4">
        <h3 className="font-semibold text-slate-900">{m.summary.driverTitle}</h3>
        <p className="mt-1 text-sm text-slate-700">
          {form.driver.firstName} {form.driver.lastName} · {form.driver.email}
        </p>
        <p className="text-xs text-slate-600">
          {form.driver.street}, {form.driver.zip} {form.driver.city}
        </p>
        <p className="text-xs text-slate-600">
          {m.driver.country}: {driverCountryLabel}
        </p>
        <p className="text-xs text-slate-600">
          {m.driver.emergencyTitle}: {emergencyName} ({form.driver.emergencyContactPhone})
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-slate-900">
          {m.summary.startsTitle} ({form.starts.length})
        </h3>
        {form.starts.map((start) => (
          <div key={start.id} className="rounded-xl border p-3 md:p-4">
            <div className="text-sm font-medium text-slate-900">
              {start.classLabel} · {start.startNumber}
            </div>
            <div className="text-xs text-slate-600">
              {start.vehicle.make} {start.vehicle.model} · {getVehicleTypeLabel(start.vehicleType)} · {start.vehicle.displacementCcm} ccm
            </div>
            {start.codriverEnabled && (
              <div className="text-xs text-slate-600">
                {m.start.codriverBadge}: {start.codriver.firstName} {start.codriver.lastName} · {start.codriver.email}
                {start.codriver.phone ? ` · ${start.codriver.phone}` : ""}
              </div>
            )}
            {start.backupVehicleEnabled && <div className="text-xs text-slate-600">{m.summary.backupVehicle}</div>}
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 md:p-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          {legalReady ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{legalTexts?.summary.mandatoryHintsTitle ?? ""}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-700">
                {visibleHints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              {hintPoints.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllHints((prev) => !prev)}
                  className="mt-2 text-xs font-medium text-slate-700 underline underline-offset-2 transition-colors hover:text-slate-900"
                >
                  {showAllHints ? ui.showLessHints : ui.showAllHints}
                </button>
              )}
            </>
          ) : (
            <p className="text-xs leading-5 text-slate-600" aria-live={legalLoading ? "polite" : "assertive"}>
              {legalStatusText}
            </p>
          )}
        </div>

        {legalReady && (
          <>
            <div className="space-y-2">
              {/* <h3 className="text-sm font-semibold text-slate-900">{legalTexts?.summary.title ?? m.summary.consentTitle}</h3> */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{legalTexts?.summary.introTitle ?? m.summary.consentTitle}</p>
                <div className="mt-2 space-y-2 text-xs leading-5 text-slate-700">
                  {visibleIntroParagraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                {introParagraphs.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setShowFullIntro((prev) => !prev)}
                    className="mt-2 text-xs font-medium text-slate-700 underline underline-offset-2 transition-colors hover:text-slate-900"
                  >
                    {showFullIntro ? ui.showLess : ui.showMore}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-700">
                {(["datenschutz", "teilnahmebedingungen", "haftverzicht", "impressum"] as const).map((docId) => (
                  <Link key={docId} className="font-medium text-primary hover:underline" to={`/anmeldung/rechtliches/${docId}`} target="_blank" rel="noreferrer">
                    {legalTexts?.docs[docId].summaryLinkLabel ?? docId}
                  </Link>
                ))}
              </div>
            </div>

            <fieldset className="space-y-4" aria-describedby={hasConsentError ? "summary-consent-error" : undefined}>
              <legend className="sr-only">{m.summary.consentTitle}</legend>
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{legalTexts?.summary.requiredTitle ?? m.summary.consentTitle}</p>
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

              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{legalTexts?.summary.optionalTitle ?? ""}</p>
                <p className="text-xs leading-5 text-slate-700">{legalTexts?.summary.voluntaryBody ?? ""}</p>
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
              {consentError && (
                <p ref={errorRef} tabIndex={-1} id="summary-consent-error" className="text-sm text-destructive" role="alert" aria-live="assertive">
                  {consentError}
                </p>
              )}
            </fieldset>
          </>
        )}
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
