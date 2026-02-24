import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAnmeldungI18n } from "@/app/i18n/anmeldung-i18n";
import { getCountryOptions } from "@/lib/countries";
import type { DriverForm } from "@/types/registration";

type DriverStepProps = {
  value: DriverForm;
  errors: Partial<Record<keyof DriverForm, string>>;
  onChange: <K extends keyof DriverForm>(field: K, nextValue: DriverForm[K]) => void;
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <p className="text-xs text-destructive">{message}</p>;
}

export function DriverStep({ value, errors, onChange }: DriverStepProps) {
  const { m, locale } = useAnmeldungI18n();
  const countryOptions = useMemo(() => getCountryOptions(locale), [locale]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2">
        <h3 className="md:col-span-2 text-lg font-semibold text-slate-900">{m.driver.title}</h3>
        <div className="space-y-2">
          <Label htmlFor="driver-firstName">{m.driver.firstName}</Label>
          <Input id="driver-firstName" value={value.firstName} onChange={(event) => onChange("firstName", event.target.value)} placeholder="z. B. Max" />
          <FieldError message={errors.firstName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-lastName">{m.driver.lastName}</Label>
          <Input id="driver-lastName" value={value.lastName} onChange={(event) => onChange("lastName", event.target.value)} placeholder="z. B. Mustermann" />
          <FieldError message={errors.lastName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-birthdate">{m.driver.birthdate}</Label>
          <Input id="driver-birthdate" type="date" value={value.birthdate} onChange={(event) => onChange("birthdate", event.target.value)} />
          <FieldError message={errors.birthdate} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-phone">{m.driver.phone}</Label>
          <Input
            id="driver-phone"
            value={value.phone}
            onChange={(event) => onChange("phone", event.target.value)}
            inputMode="tel"
            placeholder={m.driver.phonePlaceholder}
          />
          <FieldError message={errors.phone} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-nationality">{m.driver.nationality}</Label>
          <Input
            id="driver-nationality"
            list="driver-nationality-options"
            value={value.nationality}
            onChange={(event) => onChange("nationality", event.target.value)}
            placeholder={m.driver.nationalityPlaceholder}
            autoComplete="country-name"
          />
          <datalist id="driver-nationality-options">
            {countryOptions.map((country) => (
              <option key={country} value={country} />
            ))}
          </datalist>
          <FieldError message={errors.nationality} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="driver-email">{m.driver.email}</Label>
          <Input
            id="driver-email"
            type="email"
            value={value.email}
            onChange={(event) => onChange("email", event.target.value)}
            placeholder="z. B. max.mustermann@example.com"
          />
          <FieldError message={errors.email} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <h3 className="md:col-span-3 text-lg font-semibold text-slate-900">{m.driver.addressTitle}</h3>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="driver-street">{m.driver.street}</Label>
          <Input id="driver-street" value={value.street} onChange={(event) => onChange("street", event.target.value)} placeholder="z. B. Musterstraße 12" />
          <FieldError message={errors.street} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-zip">{m.driver.zip}</Label>
          <Input id="driver-zip" value={value.zip} onChange={(event) => onChange("zip", event.target.value)} placeholder="z. B. 02763" />
          <FieldError message={errors.zip} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="driver-city">{m.driver.city}</Label>
          <Input id="driver-city" value={value.city} onChange={(event) => onChange("city", event.target.value)} placeholder="z. B. Zittau" />
          <FieldError message={errors.city} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <h3 className="md:col-span-2 text-lg font-semibold text-slate-900">{m.driver.emergencyTitle}</h3>
        <div className="space-y-2">
          <Label htmlFor="driver-emergency-name">{m.driver.emergencyName}</Label>
          <Input
            id="driver-emergency-name"
            value={value.emergencyContactName}
            onChange={(event) => onChange("emergencyContactName", event.target.value)}
            placeholder="z. B. Erika Mustermann"
          />
          <FieldError message={errors.emergencyContactName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-emergency-phone">{m.driver.emergencyPhone}</Label>
          <Input
            id="driver-emergency-phone"
            value={value.emergencyContactPhone}
            onChange={(event) => onChange("emergencyContactPhone", event.target.value)}
            inputMode="tel"
            placeholder={m.driver.emergencyPhonePlaceholder}
          />
          <FieldError message={errors.emergencyContactPhone} />
        </div>
      </section>

      <section className="space-y-2">
        <Label htmlFor="driver-history">{m.driver.history}</Label>
        <textarea
          id="driver-history"
          className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={value.motorsportHistory}
          onChange={(event) => onChange("motorsportHistory", event.target.value)}
          placeholder={m.driver.historyPlaceholder}
        />
        <p className="text-xs text-slate-500">{m.driver.historyHint}</p>
        <FieldError message={errors.motorsportHistory} />
      </section>

      <section className="space-y-2">
        <Label htmlFor="driver-notes">{m.driver.notes}</Label>
        <textarea
          id="driver-notes"
          className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={value.specialNotes}
          onChange={(event) => onChange("specialNotes", event.target.value)}
          placeholder={m.driver.notesPlaceholder}
        />
        <FieldError message={errors.specialNotes} />
      </section>
    </div>
  );
}
