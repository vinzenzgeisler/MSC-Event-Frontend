import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2">
        <h3 className="md:col-span-2 text-lg font-semibold text-slate-900">Fahrerdaten</h3>
        <div className="space-y-2">
          <Label htmlFor="driver-firstName">Vorname</Label>
          <Input id="driver-firstName" value={value.firstName} onChange={(event) => onChange("firstName", event.target.value)} />
          <FieldError message={errors.firstName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-lastName">Nachname</Label>
          <Input id="driver-lastName" value={value.lastName} onChange={(event) => onChange("lastName", event.target.value)} />
          <FieldError message={errors.lastName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-birthdate">Geburtsdatum</Label>
          <Input id="driver-birthdate" type="date" value={value.birthdate} onChange={(event) => onChange("birthdate", event.target.value)} />
          <FieldError message={errors.birthdate} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-phone">Telefon</Label>
          <Input id="driver-phone" value={value.phone} onChange={(event) => onChange("phone", event.target.value)} />
          <FieldError message={errors.phone} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="driver-email">E-Mail</Label>
          <Input id="driver-email" type="email" value={value.email} onChange={(event) => onChange("email", event.target.value)} />
          <FieldError message={errors.email} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <h3 className="md:col-span-3 text-lg font-semibold text-slate-900">Adresse</h3>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="driver-street">Straße / Hausnummer</Label>
          <Input id="driver-street" value={value.street} onChange={(event) => onChange("street", event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-zip">PLZ</Label>
          <Input id="driver-zip" value={value.zip} onChange={(event) => onChange("zip", event.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="driver-city">Ort</Label>
          <Input id="driver-city" value={value.city} onChange={(event) => onChange("city", event.target.value)} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <h3 className="md:col-span-2 text-lg font-semibold text-slate-900">Notfallkontakt</h3>
        <div className="space-y-2">
          <Label htmlFor="driver-emergency-name">Name</Label>
          <Input
            id="driver-emergency-name"
            value={value.emergencyContactName}
            onChange={(event) => onChange("emergencyContactName", event.target.value)}
          />
          <FieldError message={errors.emergencyContactName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-emergency-phone">Telefon</Label>
          <Input
            id="driver-emergency-phone"
            value={value.emergencyContactPhone}
            onChange={(event) => onChange("emergencyContactPhone", event.target.value)}
          />
          <FieldError message={errors.emergencyContactPhone} />
        </div>
      </section>

      <section className="space-y-2">
        <Label htmlFor="driver-history">Sportlicher Werdegang / Besonderheiten</Label>
        <textarea
          id="driver-history"
          className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={value.motorsportHistory}
          onChange={(event) => onChange("motorsportHistory", event.target.value)}
          placeholder="Kurz zu bisherigen Rennen, Erfolgen oder Besonderheiten"
        />
        <FieldError message={errors.motorsportHistory} />
      </section>

      <section className="space-y-2">
        <Label htmlFor="driver-notes">Spezielle Hinweise für Veranstalter</Label>
        <textarea
          id="driver-notes"
          className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={value.specialNotes}
          onChange={(event) => onChange("specialNotes", event.target.value)}
          placeholder="z. B. Teamlogistik, besondere Anforderungen"
        />
        <FieldError message={errors.specialNotes} />
      </section>
    </div>
  );
}
