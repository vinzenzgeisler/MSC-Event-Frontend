import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useAnmeldungI18n, type AnmeldungLocale } from "@/app/i18n/anmeldung-i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/services/api/http-client";
import {
  publicCodriverInvitationService,
  type CodriverParticipantInput,
  type PublicCodriverInvitation
} from "@/services/public-codriver-invitation.service";

const copy = {
  de: {
    title: "Beifahrer-Anmeldung", intro: "Dieser persönliche Link ordnet dich als regulären Beifahrer den ausgewählten Starts zu.",
    onsite: "Wichtig: Der Haftverzicht wird erst vor Ort am Veranstaltungstag unterschrieben.", event: "Veranstaltung und Starts", driver: "Fahrer",
    personal: "Persönliche Daten", address: "Adresse und Kontakt", emergency: "Notfallkontakt", guardian: "Sorgeberechtigte Person",
    firstName: "Vorname", lastName: "Nachname", birthdate: "Geburtsdatum", country: "Land", street: "Straße und Hausnummer", zip: "PLZ", city: "Ort",
    email: "E-Mail", phone: "Telefon", history: "Bisherige motorsportliche Laufbahn (optional)", guardianName: "Vor- und Nachname", relationship: "Verhältnis zur Person",
    privacy: "Ich habe die Datenschutzerklärung gelesen und stimme der Verarbeitung meiner Angaben für die Veranstaltung zu.", submit: "Beifahrer verbindlich zuordnen",
    done: "Deine Daten wurden gespeichert.", doneText: "Du bist den ausgewählten Starts als regulärer Beifahrer zugeordnet. Bitte unterschreibe den Haftverzicht vor Ort.",
    unavailable: "Dieser Link ist ungültig, abgelaufen, bereits verwendet oder wurde widerrufen.", error: "Die Anmeldung konnte nicht gespeichert werden. Bitte prüfe deine Angaben oder wende dich an den Veranstalter."
  },
  en: {
    title: "Co-driver registration", intro: "This personal link assigns you as the regular co-driver to the selected starts.",
    onsite: "Important: The liability waiver must be signed onsite on the event day.", event: "Event and starts", driver: "Driver",
    personal: "Personal data", address: "Address and contact", emergency: "Emergency contact", guardian: "Parent or legal guardian",
    firstName: "First name", lastName: "Last name", birthdate: "Date of birth", country: "Country", street: "Street and house number", zip: "Postcode", city: "City",
    email: "Email", phone: "Phone", history: "Motorsport experience (optional)", guardianName: "Full name", relationship: "Relationship",
    privacy: "I have read the privacy policy and agree to the processing of my data for the event.", submit: "Assign me as co-driver",
    done: "Your data has been saved.", doneText: "You are assigned as the regular co-driver. Please sign the liability waiver onsite.",
    unavailable: "This link is invalid, expired, already used or revoked.", error: "Registration could not be saved. Please check your details or contact the organiser."
  },
  cz: {
    title: "Registrace spolujezdce", intro: "Tento osobní odkaz vás přiřadí jako běžného spolujezdce k vybraným startům.",
    onsite: "Důležité: Prohlášení o zřeknutí se odpovědnosti se podepisuje až na místě v den akce.", event: "Akce a starty", driver: "Jezdec",
    personal: "Osobní údaje", address: "Adresa a kontakt", emergency: "Nouzový kontakt", guardian: "Zákonný zástupce",
    firstName: "Jméno", lastName: "Příjmení", birthdate: "Datum narození", country: "Země", street: "Ulice a číslo", zip: "PSČ", city: "Město",
    email: "E-mail", phone: "Telefon", history: "Zkušenosti v motorsportu (volitelné)", guardianName: "Jméno a příjmení", relationship: "Vztah k osobě",
    privacy: "Přečetl/a jsem si zásady ochrany osobních údajů a souhlasím se zpracováním údajů pro tuto akci.", submit: "Přiřadit jako spolujezdce",
    done: "Vaše údaje byly uloženy.", doneText: "Jste přiřazen/a jako běžný spolujezdec. Prohlášení podepište na místě.",
    unavailable: "Tento odkaz je neplatný, vypršel, byl již použit nebo zrušen.", error: "Registraci se nepodařilo uložit. Zkontrolujte údaje nebo kontaktujte pořadatele."
  },
  pl: {
    title: "Rejestracja pilota", intro: "Ten osobisty link przypisuje Cię jako zwykłego pilota do wybranych startów.",
    onsite: "Ważne: Zrzeczenie odpowiedzialności podpisuje się dopiero na miejscu w dniu imprezy.", event: "Impreza i starty", driver: "Kierowca",
    personal: "Dane osobowe", address: "Adres i kontakt", emergency: "Kontakt alarmowy", guardian: "Opiekun prawny",
    firstName: "Imię", lastName: "Nazwisko", birthdate: "Data urodzenia", country: "Kraj", street: "Ulica i numer", zip: "Kod pocztowy", city: "Miejscowość",
    email: "E-mail", phone: "Telefon", history: "Doświadczenie w motorsporcie (opcjonalne)", guardianName: "Imię i nazwisko", relationship: "Relacja",
    privacy: "Zapoznałem/am się z polityką prywatności i zgadzam się na przetwarzanie danych na potrzeby imprezy.", submit: "Przypisz jako pilota",
    done: "Twoje dane zostały zapisane.", doneText: "Jesteś przypisany/a jako zwykły pilot. Podpisz zrzeczenie odpowiedzialności na miejscu.",
    unavailable: "Ten link jest nieprawidłowy, wygasł, został już użyty lub cofnięty.", error: "Nie udało się zapisać rejestracji. Sprawdź dane lub skontaktuj się z organizatorem."
  }
} as const;

const apiLocale: Record<AnmeldungLocale, CodriverParticipantInput["locale"]> = { de: "de-DE", en: "en-GB", cz: "cs-CZ", pl: "pl-PL" };

const emptyForm: CodriverParticipantInput = {
  locale: "de-DE", firstName: "", lastName: "", birthdate: "", country: "", street: "", zip: "", city: "", email: "", phone: "",
  emergencyContactFirstName: "", emergencyContactLastName: "", emergencyContactPhone: "", motorsportHistory: null,
  guardianFullName: null, guardianEmail: null, guardianPhone: null, guardianRelationship: null
};

function ageAtEvent(birthdate: string, startsAt?: string) {
  if (!birthdate || !startsAt) return null;
  const birth = new Date(`${birthdate}T12:00:00Z`);
  const event = new Date(startsAt);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(event.getTime())) return null;
  let age = event.getUTCFullYear() - birth.getUTCFullYear();
  if (event.getUTCMonth() < birth.getUTCMonth() || (event.getUTCMonth() === birth.getUTCMonth() && event.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

export function CodriverInvitationPage() {
  const { token = "" } = useParams();
  const { locale } = useAnmeldungI18n();
  const text = copy[locale];
  const [invitation, setInvitation] = useState<PublicCodriverInvitation | null>(null);
  const [form, setForm] = useState<CodriverParticipantInput>(emptyForm);
  const [privacy, setPrivacy] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "submitting" | "done" | "unavailable">("loading");
  const [error, setError] = useState("");
  const isMinor = (ageAtEvent(form.birthdate, invitation?.event.startsAt) ?? 18) < 18;

  useEffect(() => {
    let active = true;
    setState("loading");
    publicCodriverInvitationService.get(token).then((result) => {
      if (!active) return;
      setInvitation(result);
      setForm((current) => ({ ...current, email: result.invitation.recipientEmail ?? current.email }));
      setState("ready");
    }).catch(() => active && setState("unavailable"));
    return () => { active = false; };
  }, [token]);

  const set = (field: keyof CodriverParticipantInput, value: string | null) => setForm((current) => ({ ...current, [field]: value }));
  const eventDate = useMemo(() => invitation ? new Intl.DateTimeFormat(locale === "de" ? "de-DE" : locale === "cz" ? "cs-CZ" : locale === "pl" ? "pl-PL" : "en-GB", { dateStyle: "long" }).format(new Date(invitation.event.startsAt)) : "", [invitation, locale]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!privacy || state === "submitting") return;
    setState("submitting");
    setError("");
    try {
      await publicCodriverInvitationService.complete(token, {
        ...form,
        locale: apiLocale[locale],
        motorsportHistory: form.motorsportHistory?.trim() || null,
        guardianFullName: isMinor ? form.guardianFullName : null,
        guardianEmail: isMinor ? form.guardianEmail : null,
        guardianPhone: isMinor ? form.guardianPhone : null,
        guardianRelationship: isMinor ? form.guardianRelationship : null
      });
      setState("done");
    } catch (cause) {
      if (cause instanceof ApiError && [404, 409].includes(cause.status) && cause.code?.startsWith("CODRIVER_INVITATION_")) setState("unavailable");
      else { setError(text.error); setState("ready"); }
    }
  };

  if (state === "loading") return <Card className="mx-auto max-w-3xl"><CardContent className="flex items-center justify-center p-10"><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Link wird geprüft…</CardContent></Card>;
  if (state === "unavailable") return <Card className="mx-auto max-w-2xl"><CardContent className="flex gap-3 p-6 text-amber-900"><CircleAlert className="h-6 w-6 shrink-0" /><p>{text.unavailable}</p></CardContent></Card>;
  if (state === "done") return <Card className="mx-auto max-w-2xl border-emerald-200"><CardContent className="p-7 text-emerald-950"><CheckCircle2 className="mb-3 h-9 w-9" /><h1 className="text-xl font-semibold">{text.done}</h1><p className="mt-2">{text.doneText}</p></CardContent></Card>;
  if (!invitation) return null;

  const field = (name: keyof CodriverParticipantInput, label: string, options?: { type?: string; required?: boolean; readOnly?: boolean }) => (
    <div className="space-y-1.5"><Label htmlFor={name}>{label}</Label><Input id={name} type={options?.type} required={options?.required !== false} readOnly={options?.readOnly} value={String(form[name] ?? "")} onChange={(event) => set(name, event.target.value)} /></div>
  );

  return (
    <Card className="mx-auto max-w-3xl rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardHeader><CardTitle>{text.title}</CardTitle><p className="text-sm text-slate-600">{text.intro}</p></CardHeader>
      <CardContent>
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-950">{text.onsite}</div>
        <section className="mb-6 rounded-lg border bg-slate-50 p-4 text-sm">
          <h2 className="font-semibold text-slate-900">{text.event}</h2><p className="mt-1">{invitation.event.name} · {eventDate}</p>
          <p className="mt-1"><span className="text-slate-500">{text.driver}:</span> {invitation.driver.firstName} {invitation.driver.lastName}</p>
          <ul className="mt-2 list-inside list-disc">{invitation.entries.map((entry) => <li key={entry.id}>{entry.className} · Startnummer {entry.startNumber ?? "–"}</li>)}</ul>
        </section>
        <form onSubmit={submit} className="space-y-6">
          <section><h2 className="mb-3 font-semibold">{text.personal}</h2><div className="grid gap-4 sm:grid-cols-2">{field("firstName", text.firstName)}{field("lastName", text.lastName)}{field("birthdate", text.birthdate, { type: "date" })}{field("country", text.country)}</div></section>
          <section><h2 className="mb-3 font-semibold">{text.address}</h2><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2">{field("street", text.street)}</div>{field("zip", text.zip)}{field("city", text.city)}{field("email", text.email, { type: "email", readOnly: Boolean(invitation.invitation.recipientEmail) })}{field("phone", text.phone, { type: "tel" })}</div></section>
          <section><h2 className="mb-3 font-semibold">{text.emergency}</h2><div className="grid gap-4 sm:grid-cols-2">{field("emergencyContactFirstName", text.firstName)}{field("emergencyContactLastName", text.lastName)}<div className="sm:col-span-2">{field("emergencyContactPhone", text.phone, { type: "tel" })}</div></div></section>
          <div className="space-y-1.5"><Label htmlFor="history">{text.history}</Label><textarea id="history" className="min-h-24 w-full rounded-md border bg-white px-3 py-2 text-sm" maxLength={4000} value={form.motorsportHistory ?? ""} onChange={(event) => set("motorsportHistory", event.target.value)} /></div>
          {isMinor ? <section className="rounded-lg border border-amber-200 bg-amber-50 p-4"><h2 className="mb-3 font-semibold">{text.guardian}</h2><div className="grid gap-4 sm:grid-cols-2">{field("guardianFullName", text.guardianName)}{field("guardianRelationship", text.relationship)}{field("guardianEmail", text.email, { type: "email" })}{field("guardianPhone", text.phone, { type: "tel" })}</div></section> : null}
          <label className="flex items-start gap-3 rounded-lg border p-4 text-sm"><input type="checkbox" className="mt-1" required checked={privacy} onChange={(event) => setPrivacy(event.target.checked)} /><span>{text.privacy} <Link className="underline" to="/anmeldung/rechtliches/datenschutz" target="_blank">Datenschutz</Link></span></label>
          {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
          <Button type="submit" className="h-12 w-full" disabled={!privacy || state === "submitting"}>{state === "submitting" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}{text.submit}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
