import { useMemo } from "react";
import { usePublicLegal } from "@/app/legal/public-legal-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAnmeldungI18n } from "@/app/i18n/anmeldung-i18n";
import { getCountrySelectOptions } from "@/lib/countries";
import type { DriverForm } from "@/types/registration";

type DriverStepProps = {
  value: DriverForm;
  errors: Partial<Record<keyof DriverForm, string>>;
  showGuardianFields: boolean;
  onChange: <K extends keyof DriverForm>(field: K, nextValue: DriverForm[K]) => void;
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p id={id} className="text-xs text-destructive" role="alert" aria-live="polite">
      {message}
    </p>
  );
}

function fieldAria(error?: string, errorId?: string) {
  return {
    "aria-invalid": error ? "true" : "false",
    "aria-describedby": error && errorId ? errorId : undefined
  } as const;
}

export function DriverStep({ value, errors, showGuardianFields, onChange }: DriverStepProps) {
  const { m, locale } = useAnmeldungI18n();
  const countryOptions = useMemo(() => getCountrySelectOptions(locale), [locale]);
  const { texts: legalTexts } = usePublicLegal();
  const streetPlaceholder = locale === "en" ? "Main Street 12" : locale === "cz" ? "Hlavní 12" : locale === "pl" ? "ul. Główna 12" : "Musterstraße 12";
  const cityPlaceholder = locale === "en" ? "Zittau" : locale === "cz" ? "Zittau" : locale === "pl" ? "Zittau" : "Zittau";

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2">
        <h3 className="md:col-span-2 text-lg font-semibold text-slate-900">{m.driver.title}</h3>
        <div className="space-y-2">
          <Label htmlFor="driver-firstName">{m.driver.firstName}</Label>
          <Input id="driver-firstName" data-driver-field="firstName" value={value.firstName} onChange={(event) => onChange("firstName", event.target.value)} {...fieldAria(errors.firstName, "driver-firstName-error")} />
          <FieldError id="driver-firstName-error" message={errors.firstName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-lastName">{m.driver.lastName}</Label>
          <Input id="driver-lastName" data-driver-field="lastName" value={value.lastName} onChange={(event) => onChange("lastName", event.target.value)} {...fieldAria(errors.lastName, "driver-lastName-error")} />
          <FieldError id="driver-lastName-error" message={errors.lastName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-birthdate">{m.driver.birthdate}</Label>
          <Input
            id="driver-birthdate"
            data-driver-field="birthdate"
            value={value.birthdate}
            onChange={(event) => onChange("birthdate", event.target.value)}
            inputMode="numeric"
            maxLength={10}
            placeholder={m.driver.birthdatePlaceholder}
            {...fieldAria(errors.birthdate, "driver-birthdate-error")}
          />
          <FieldError id="driver-birthdate-error" message={errors.birthdate} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-phone">{m.driver.phone}</Label>
          <Input
            id="driver-phone"
            data-driver-field="phone"
            value={value.phone}
            onChange={(event) => onChange("phone", event.target.value)}
            inputMode="tel"
            placeholder={m.driver.phonePlaceholder}
            {...fieldAria(errors.phone, "driver-phone-error")}
          />
          <FieldError id="driver-phone-error" message={errors.phone} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-email">{m.driver.email}</Label>
          <Input
            id="driver-email"
            data-driver-field="email"
            type="email"
            value={value.email}
            onChange={(event) => onChange("email", event.target.value)}
            placeholder="team@example.com"
            {...fieldAria(errors.email, "driver-email-error")}
          />
          <FieldError id="driver-email-error" message={errors.email} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <h3 className="md:col-span-3 text-lg font-semibold text-slate-900">{m.driver.addressTitle}</h3>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="driver-street">{m.driver.street}</Label>
          <Input id="driver-street" data-driver-field="street" value={value.street} onChange={(event) => onChange("street", event.target.value)} placeholder={streetPlaceholder} {...fieldAria(errors.street, "driver-street-error")} />
          <FieldError id="driver-street-error" message={errors.street} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-zip">{m.driver.zip}</Label>
          <Input id="driver-zip" data-driver-field="zip" value={value.zip} onChange={(event) => onChange("zip", event.target.value)} placeholder="02763" {...fieldAria(errors.zip, "driver-zip-error")} />
          <FieldError id="driver-zip-error" message={errors.zip} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="driver-city">{m.driver.city}</Label>
          <Input id="driver-city" data-driver-field="city" value={value.city} onChange={(event) => onChange("city", event.target.value)} placeholder={cityPlaceholder} {...fieldAria(errors.city, "driver-city-error")} />
          <FieldError id="driver-city-error" message={errors.city} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-country">{m.driver.country}</Label>
          <Select value={value.country || "__placeholder__"} onValueChange={(next) => onChange("country", next === "__placeholder__" ? "" : next)}>
            <SelectTrigger
              id="driver-country"
              data-driver-field="country"
              {...fieldAria(errors.country, "driver-country-error")}
              className="text-base md:text-sm"
            >
              <SelectValue placeholder={m.driver.countryPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__placeholder__">{m.driver.countryPlaceholder}</SelectItem>
              {countryOptions.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {country.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id="driver-country-error" message={errors.country} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <h3 className="md:col-span-3 text-lg font-semibold text-slate-900">{m.driver.emergencyTitle}</h3>
        <div className="space-y-2">
          <Label htmlFor="driver-emergency-firstName">{m.driver.emergencyFirstName}</Label>
          <Input
            id="driver-emergency-firstName"
            data-driver-field="emergencyContactFirstName"
            value={value.emergencyContactFirstName}
            onChange={(event) => onChange("emergencyContactFirstName", event.target.value)}
            {...fieldAria(errors.emergencyContactFirstName, "driver-emergency-firstName-error")}
          />
          <FieldError id="driver-emergency-firstName-error" message={errors.emergencyContactFirstName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-emergency-lastName">{m.driver.emergencyLastName}</Label>
          <Input
            id="driver-emergency-lastName"
            data-driver-field="emergencyContactLastName"
            value={value.emergencyContactLastName}
            onChange={(event) => onChange("emergencyContactLastName", event.target.value)}
            {...fieldAria(errors.emergencyContactLastName, "driver-emergency-lastName-error")}
          />
          <FieldError id="driver-emergency-lastName-error" message={errors.emergencyContactLastName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-emergency-phone">{m.driver.emergencyPhone}</Label>
          <Input
            id="driver-emergency-phone"
            data-driver-field="emergencyContactPhone"
            value={value.emergencyContactPhone}
            onChange={(event) => onChange("emergencyContactPhone", event.target.value)}
            inputMode="tel"
            placeholder={m.driver.phonePlaceholder}
            {...fieldAria(errors.emergencyContactPhone, "driver-emergency-phone-error")}
          />
          <FieldError id="driver-emergency-phone-error" message={errors.emergencyContactPhone} />
        </div>
      </section>

      {showGuardianFields && (
        <section className="grid gap-4 md:grid-cols-2">
          <h3 className="md:col-span-2 text-lg font-semibold text-slate-900">{legalTexts?.guardianSectionTitle ?? "Guardian"}</h3>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="driver-guardian-fullName">{legalTexts?.guardianFullNameLabel ?? "Guardian full name"}</Label>
            <Input
              id="driver-guardian-fullName"
              data-driver-field="guardianFullName"
              value={value.guardianFullName}
              onChange={(event) => onChange("guardianFullName", event.target.value)}
              {...fieldAria(errors.guardianFullName, "driver-guardian-fullName-error")}
            />
            <FieldError id="driver-guardian-fullName-error" message={errors.guardianFullName} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="driver-guardian-email">{legalTexts?.guardianEmailLabel ?? "Guardian email"}</Label>
            <Input
              id="driver-guardian-email"
              data-driver-field="guardianEmail"
              type="email"
              value={value.guardianEmail}
              onChange={(event) => onChange("guardianEmail", event.target.value)}
              {...fieldAria(errors.guardianEmail, "driver-guardian-email-error")}
            />
            <FieldError id="driver-guardian-email-error" message={errors.guardianEmail} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="driver-guardian-phone">{legalTexts?.guardianPhoneLabel ?? "Guardian phone"}</Label>
            <Input
              id="driver-guardian-phone"
              data-driver-field="guardianPhone"
              value={value.guardianPhone}
              onChange={(event) => onChange("guardianPhone", event.target.value)}
              inputMode="tel"
              {...fieldAria(errors.guardianPhone, "driver-guardian-phone-error")}
            />
            <FieldError id="driver-guardian-phone-error" message={errors.guardianPhone} />
          </div>
          <label className="md:col-span-2 flex items-start gap-2 text-sm text-slate-800">
            <input
              id="driver-guardian-consent"
              data-driver-field="guardianConsentAccepted"
              type="checkbox"
              checked={value.guardianConsentAccepted}
              onChange={(event) => onChange("guardianConsentAccepted", event.target.checked)}
              className="mt-0.5 h-4 w-4"
              {...fieldAria(errors.guardianConsentAccepted, "driver-guardian-consent-error")}
            />
            <span>{legalTexts?.guardianConsentLabel ?? "Guardian consent required."}</span>
          </label>
          <FieldError id="driver-guardian-consent-error" message={errors.guardianConsentAccepted} />
        </section>
      )}

      <section className="space-y-2">
        <Label htmlFor="driver-history">{m.driver.history}</Label>
        <textarea
         id="driver-history"
          data-driver-field="motorsportHistory"
          className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={value.motorsportHistory}
          onChange={(event) => onChange("motorsportHistory", event.target.value)}
          placeholder={m.driver.historyPlaceholder}
          {...fieldAria(errors.motorsportHistory, "driver-history-error")}
        />
        <p className="text-xs text-slate-500">{m.driver.historyHint}</p>
        <FieldError id="driver-history-error" message={errors.motorsportHistory} />
      </section>

      <section className="space-y-2">
        <Label htmlFor="driver-notes">{m.driver.notes}</Label>
        <textarea
          id="driver-notes"
          className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={value.specialNotes}
          onChange={(event) => onChange("specialNotes", event.target.value)}
          placeholder={m.driver.notesPlaceholder}
          {...fieldAria(errors.specialNotes, "driver-notes-error")}
        />
        <FieldError id="driver-notes-error" message={errors.specialNotes} />
      </section>
    </div>
  );
}
