import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import mscLogoUrl from "../../../msc-logo.png";

type LabTemplateKey = "newsletter" | "event_update" | "free_form" | "payment_reminder_followup";
type ProcessTemplateKey =
  | "registration_received"
  | "email_confirmation_reminder"
  | "preselection"
  | "accepted_open_payment"
  | "accepted_paid_completed"
  | "rejected";
type MailDraftKey = LabTemplateKey | ProcessTemplateKey;

type TemplateSpec = {
  label: string;
  description: string;
  accent: string;
};

type SubtleAccentTone = {
  contextCard: string;
  contextTitle: string;
  panel: string;
  headerLine: string;
};

const templateSpecs: Record<LabTemplateKey, TemplateSpec> = {
  newsletter: {
    label: "Newsletter",
    description: "Emotional, aktivierend, mit klarem Event-Hype.",
    accent: "from-blue-950 via-blue-900 to-blue-800",
  },
  event_update: {
    label: "Event Update",
    description: "Sachlich, klar und relevant für den konkreten Start.",
    accent: "from-blue-950 via-blue-900 to-blue-800",
  },
  free_form: {
    label: "Freies Mailing",
    description: "Flexible Mitteilung mit vereinskonformer Tonalität.",
    accent: "from-blue-950 via-blue-900 to-blue-800",
  },
  payment_reminder_followup: {
    label: "Zahlungserinnerung",
    description: "Verbindlich, freundlich, mit klarer Frist.",
    accent: "from-blue-950 via-blue-900 to-blue-800",
  },
};

const processTemplateSpecs: Record<ProcessTemplateKey, TemplateSpec> = {
  registration_received: {
    label: "Prozess: Anmeldung eingegangen",
    description: "Automatische Erstmail nach Eingang der Anmeldung inklusive Verifizierungsaufruf.",
    accent: "from-blue-950 via-blue-900 to-blue-800",
  },
  email_confirmation_reminder: {
    label: "Prozess: Verifizierung erinnern",
    description: "Automatische Erinnerung an noch nicht verifizierte Nennungen.",
    accent: "from-blue-950 via-blue-900 to-blue-800",
  },
  preselection: {
    label: "Prozess: Vorauswahl",
    description: "Zwischenstatus bei noch nicht finaler Startlistenentscheidung.",
    accent: "from-blue-950 via-blue-900 to-blue-800",
  },
  accepted_open_payment: {
    label: "Prozess: Zulassung, Zahlung offen",
    description: "Zulassung mit Pflichtanhang Nennbestätigung und Zahlungsaufforderung.",
    accent: "from-blue-950 via-blue-900 to-blue-800",
  },
  accepted_paid_completed: {
    label: "Prozess: Zahlung bestätigt",
    description: "Automatische Bestätigung, sobald Zulassung vorliegt und Zahlung vollständig ist.",
    accent: "from-blue-950 via-blue-900 to-blue-800",
  },
  rejected: {
    label: "Prozess: Ablehnung",
    description: "Absage mit optionaler individueller Notiz vom Orga-Team.",
    accent: "from-blue-950 via-blue-900 to-blue-800",
  },
};

type DraftState = {
  eventName: string;
  eventDate: string;
  recipientName: string;
  vehicleContext: string;
  preheader: string;
  heroEyebrow: string;
  heroSubtitle: string;
  intro: string;
  story: string;
  highlights: string;
  ctaText: string;
  ctaUrl: string;
  paymentDeadline: string;
  outro: string;
};

const initialDraft: DraftState = {
  eventName: "12. Oberlausitzer Dreieck",
  eventDate: "12./13. September 2026",
  recipientName: "Patrick Schmidt",
  vehicleContext: "Startnummer #47 · Klasse A100 · Škoda 130 RS",
  preheader: "Alle wichtigen Neuerungen zu deinem Start, kompakt und verlässlich zusammengefasst.",
  heroEyebrow: "MSC Oberlausitzer Dreiländereck",
  heroSubtitle: "Aktuelle Informationen für dein Rennwochenende in Zittau",
  intro:
    "dein Startplatz ist bestätigt und die Vorbereitungen laufen auf Hochtouren. Wir haben die wichtigsten organisatorischen Punkte aktualisiert, damit dein Wochenende vor Ort strukturiert und entspannt startet.",
  story:
    "Die Zufahrt und das Fahrerlager wurden neu organisiert, das Fahrerbriefing ist präziser getaktet und die technische Abnahme ist klarer strukturiert. So kommst du schneller durch den Orga-Teil und kannst dich auf das konzentrieren, was zählt: ein starkes Wochenende auf der Strecke.",
  highlights:
    "Fahrerbriefing am Samstag um 08:30 Uhr\nTechnische Abnahme in zwei Zeitfenstern\nAnreise ins Fahrerlager ab Freitag 18:00 Uhr\nAktualisierte Besucherführung entlang der Strecke",
  ctaText: "Alle Event-Infos ansehen",
  ctaUrl: "https://event.msc-oberlausitzer-dreilaendereck.de/anmeldung",
  paymentDeadline: "31.08.2026",
  outro:
    "Wenn du Rückfragen hast, antworte direkt auf diese E-Mail. Wir freuen uns auf dich, dein Team und dein Fahrzeug.",
};

const imprintUrl = "https://event.msc-oberlausitzer-dreilaendereck.de/anmeldung/rechtliches/impressum";
const privacyUrl = "https://event.msc-oberlausitzer-dreilaendereck.de/anmeldung/rechtliches/datenschutz";

const defaultSubjects: Record<LabTemplateKey, string> = {
  newsletter: "Neuigkeiten rund um das 12. Oberlausitzer Dreieck",
  event_update: "Wichtiges Update zu deinem Start beim 12. Oberlausitzer Dreieck",
  free_form: "Wichtige Mitteilung zum 12. Oberlausitzer Dreieck",
  payment_reminder_followup: "Erinnerung: offenes Nenngeld für das 12. Oberlausitzer Dreieck",
};

const defaultProcessSubjects: Record<ProcessTemplateKey, string> = {
  registration_received: "Anmeldung eingegangen – 12. Oberlausitzer Dreieck",
  email_confirmation_reminder: "Erinnerung: Bitte E-Mail-Adresse bestätigen – 12. Oberlausitzer Dreieck",
  preselection: "Statusupdate zu deiner Nennung – 12. Oberlausitzer Dreieck",
  accepted_open_payment: "Zulassung bestätigt – Nenngeld offen (12. Oberlausitzer Dreieck)",
  accepted_paid_completed: "Zahlung bestätigt – Start vollständig (12. Oberlausitzer Dreieck)",
  rejected: "Rückmeldung zu deiner Nennung – 12. Oberlausitzer Dreieck",
};

const defaultProcessPreheaders: Record<ProcessTemplateKey, string> = {
  registration_received: "Bitte bestätige jetzt kurz deine E-Mail-Adresse, damit wir deine Nennung prüfen können.",
  email_confirmation_reminder: "Deine E-Mail-Adresse ist noch nicht bestätigt. Bitte hole die Verifizierung jetzt kurz nach.",
  preselection: "Deine Nennung ist in der Vorauswahl, die finale Startliste wird aktuell erstellt.",
  accepted_open_payment: "Deine Zulassung ist bestätigt. Nennbestätigung im Anhang, Nenngeld bitte fristgerecht überweisen.",
  accepted_paid_completed: "Zahlung eingegangen und Start vollständig bestätigt. Alle Basisinfos wurden bereits bereitgestellt.",
  rejected: "Vielen Dank für deine Anmeldung. Für dieses Jahr ist eine Teilnahme leider nicht möglich.",
};

const defaultProcessHeaderTitles: Record<ProcessTemplateKey, string> = {
  registration_received: "Anmeldung eingegangen",
  email_confirmation_reminder: "Verifizierung ausstehend",
  preselection: "Status Vorauswahl",
  accepted_open_payment: "Zulassung bestätigt",
  accepted_paid_completed: "Zahlung bestätigt",
  rejected: "Rückmeldung zur Nennung",
};

const campaignMailSuggestions: Array<{
  key: LabTemplateKey;
  title: string;
  subject: string;
  text: string;
  attachmentNote: string;
}> = [
  {
    key: "newsletter",
    title: "Newsletter",
    subject: "Neuigkeiten zum {{eventName}}",
    text:
      "Hallo {{driverName}}, du bist mit deinem Fahrzeug bereits gemeldet. Wir halten dich hier gezielt über Neuigkeiten auf dem Laufenden: Zeitplan, Ablauf vor Ort, organisatorische Updates und sportliche Highlights rund um das Event.",
    attachmentNote: "Optional in Kommunikationsseite: PDF-Anhänge erlaubt.",
  },
  {
    key: "event_update",
    title: "Event Update",
    subject: "Wichtiges Update zu deiner Nennung – {{eventName}}",
    text:
      "Hallo {{driverName}}, hier ist ein aktuelles Update zu deinem Start. Bitte beachte die Änderungen im Ablauf (Briefing, Zufahrt, Abnahme). Du bist mit Klasse {{className}} und Startnummer #{{startNumber}} eingeplant.",
    attachmentNote: "Optional in Kommunikationsseite: PDF-Anhänge erlaubt.",
  },
  {
    key: "free_form",
    title: "Freies Mailing",
    subject: "Mitteilung zu {{eventName}}",
    text:
      "Hallo {{driverName}}, dies ist eine gezielte Mitteilung des Orga-Teams mit relevanten Informationen zu deiner Teilnahme. Bei Fragen antworte einfach auf diese E-Mail.",
    attachmentNote: "Optional in Kommunikationsseite: PDF-Anhänge erlaubt.",
  },
  {
    key: "payment_reminder_followup",
    title: "Erneute Zahlungsaufforderung",
    subject: "Erinnerung zum offenen Nenngeld – {{eventName}}",
    text:
      "Hallo {{driverName}}, wir erinnern dich freundlich daran, dass dein Nenngeld aktuell noch offen ist ({{amountOpen}}). Bitte überweise den Betrag bis {{paymentDeadline}}. Die Zahlungsinformationen findest du in deiner Nennbestätigung.",
    attachmentNote: "Optional in Kommunikationsseite: PDF-Anhänge erlaubt.",
  },
];

const processMailSuggestions: Array<{
  key: ProcessTemplateKey;
  title: string;
  eventType?:
    | "registration_received"
    | "email_confirmation_reminder"
    | "preselection"
    | "accepted_open_payment"
    | "accepted_paid_completed"
    | "rejected";
  subject: string;
  bodyText: string;
}> = [
  {
    key: "registration_received",
    title: "Anmeldung eingegangen",
    eventType: "registration_received",
    subject: "Anmeldung eingegangen – {{eventName}}",
    bodyText:
      "Hallo {{driverName}},\n\nvielen Dank für deine Anmeldung. Bitte bestätige als nächsten Schritt deine E-Mail-Adresse über den Link in dieser Mail.\n\nNach der Verifizierung prüfen wir deine Nennung und melden uns mit dem nächsten Status. Optional kann das ausgefüllte Nennformular als PDF für deine Unterlagen beigefügt sein. Das ist noch keine Nennbestätigung.\n\nBitte überweise noch kein Nenngeld vor der Zulassung.",
  },
  {
    key: "email_confirmation_reminder",
    title: "Erneute Verifizierungsaufforderung",
    eventType: "email_confirmation_reminder",
    subject: "Erinnerung: Bitte E-Mail-Adresse bestätigen – {{eventName}}",
    bodyText:
      "Hallo {{driverName}},\n\ndeine E-Mail-Adresse ist noch nicht bestätigt. Bitte hole die Verifizierung jetzt kurz nach.\n\nErst danach können wir deine Nennung final prüfen und den nächsten Status senden.",
  },
  {
    key: "preselection",
    title: "Vorauswahl",
    eventType: "preselection",
    subject: "Statusupdate zu deiner Nennung – {{eventName}}",
    bodyText:
      "Hallo {{driverName}},\n\ndeine Nennung wurde in die Vorauswahl übernommen. Aktuell prüfen wir die finale Startliste.\n\nWir melden uns mit dem nächsten Statusupdate bei dir.",
  },
  {
    key: "accepted_open_payment",
    title: "Zugelassen, Zahlung offen",
    eventType: "accepted_open_payment",
    subject: "Zulassung bestätigt – Nenngeld noch offen ({{eventName}})",
    bodyText:
      "Hallo {{driverName}},\n\ndeine Nennung ist zugelassen. Im Anhang findest du deine Nennbestätigung als PDF (wichtig für die Einfahrt ins Fahrerlager).\n\nBitte überweise das offene Nenngeld fristgerecht. Die Zahlungsinformationen stehen in der Nennbestätigung.\n\n[Optionaler Hinweis vom Orga-Team wird bei Bedarf ergänzt.]",
  },
  {
    key: "accepted_paid_completed",
    title: "Zahlung bestätigt",
    eventType: "accepted_paid_completed",
    subject: "Zahlung bestätigt – Start vollständig ({{eventName}})",
    bodyText:
      "Hallo {{driverName}},\n\ndeine Zulassung und Zahlung sind vollständig bestätigt. Damit ist dein Start formal abgeschlossen.\n\nAlle organisatorischen Basisinformationen hast du bereits mit der Zulassung und der Nennbestätigung erhalten. Weitere Event-Updates senden wir dir rechtzeitig vor dem Wochenende zu.",
  },
  {
    key: "rejected",
    title: "Ablehnung",
    eventType: "rejected",
    subject: "Rückmeldung zu deiner Nennung – {{eventName}}",
    bodyText:
      "Hallo {{driverName}},\n\nnach Prüfung können wir deine Nennung in diesem Jahr leider nicht berücksichtigen.\n\nVielen Dank für dein Interesse und deine Anmeldung.\n\n[Optionaler Hinweis vom Orga-Team wird bei Bedarf ergänzt.]",
  },
];

const processAccentByKey: Record<ProcessTemplateKey, string> = {
  registration_received: "from-blue-950 via-blue-900 to-blue-800",
  email_confirmation_reminder: "from-blue-950 via-blue-900 to-blue-800",
  preselection: "from-blue-950 via-blue-900 to-blue-800",
  accepted_open_payment: "from-blue-950 via-blue-900 to-blue-800",
  accepted_paid_completed: "from-blue-950 via-blue-900 to-blue-800",
  rejected: "from-blue-950 via-blue-900 to-blue-800",
};

const sampleVerificationUrl =
  "https://event.msc-oberlausitzer-dreilaendereck.de/anmeldung/verify?entryId=ENTRY_ID&token=TOKEN";

const verificationReminderI18n = {
  de: {
    subject: "Erinnerung: Bitte E-Mail-Adresse bestätigen – {{eventName}}",
    preheader: "Deine E-Mail-Adresse ist noch nicht bestätigt. Bitte hole die Verifizierung jetzt kurz nach.",
    body:
      "Hallo {{driverName}},\n\ndeine E-Mail-Adresse ist noch nicht bestätigt. Bitte hole die Verifizierung jetzt kurz nach.\n\nErst danach können wir deine Nennung final prüfen und den nächsten Status senden.",
    ctaText: "E-Mail-Adresse bestätigen",
  },
  cs: {
    subject: "Připomenutí: Potvrď prosím svou e-mailovou adresu – {{eventName}}",
    preheader: "Tvá e-mailová adresa ještě není potvrzená. Dokonči prosím ověření.",
    body:
      "Ahoj {{driverName}},\n\ntvá e-mailová adresa ještě není potvrzená. Dokonči prosím nyní krátké ověření.\n\nTeprve poté můžeme tvoji přihlášku finálně zkontrolovat a poslat další stav.",
    ctaText: "Potvrdit e-mail",
  },
  pl: {
    subject: "Przypomnienie: potwierdź adres e-mail – {{eventName}}",
    preheader: "Twój adres e-mail nie został jeszcze potwierdzony. Dokończ proszę weryfikację.",
    body:
      "Cześć {{driverName}},\n\ntwój adres e-mail nie został jeszcze potwierdzony. Dokończ teraz krótką weryfikację.\n\nDopiero potem możemy ostatecznie sprawdzić Twoje zgłoszenie i wysłać kolejny status.",
    ctaText: "Potwierdź e-mail",
  },
  en: {
    subject: "Reminder: Please verify your email address – {{eventName}}",
    preheader: "Your email address is still unverified. Please complete verification now.",
    body:
      "Hello {{driverName}},\n\nyour email address is still unverified. Please complete verification now.\n\nOnly then can we finalize the review of your entry and send the next status update.",
    ctaText: "Verify email address",
  },
} as const;

const allMailTextsI18n = {
  localeStrategy: {
    default: "de",
    explicit: ["cs", "pl", "en"],
    fallback: "en",
    rule: "Für Fahrer mit locale=cs -> cs, locale=pl -> pl, locale in [de,en] direkt, alle anderen -> en."
  },
  campaignTemplates: {
    newsletter: {
      de: {
        subject: "Neuigkeiten zum {{eventName}}",
        preheader: "Alle wichtigen Neuigkeiten zu deinem Start kompakt zusammengefasst.",
        intro: "Hallo {{driverName}}, wir halten dich über alle Neuigkeiten rund um {{eventName}} auf dem Laufenden.",
        body: "Zeitplan, Ablauf vor Ort und sportliche Highlights werden hier laufend aktualisiert.",
        ctaText: "Alle Event-Infos ansehen"
      },
      cs: {
        subject: "Novinky k {{eventName}}",
        preheader: "Důležité novinky k tvému startu stručně a přehledně.",
        intro: "Ahoj {{driverName}}, průběžně tě informujeme o všech novinkách k {{eventName}}.",
        body: "Aktualizujeme harmonogram, organizaci na místě a sportovní novinky.",
        ctaText: "Zobrazit informace o akci"
      },
      pl: {
        subject: "Aktualności dotyczące {{eventName}}",
        preheader: "Najważniejsze informacje o Twoim starcie w skrócie.",
        intro: "Cześć {{driverName}}, będziemy na bieżąco informować o nowościach związanych z {{eventName}}.",
        body: "Aktualizujemy harmonogram, organizację na miejscu i najważniejsze informacje sportowe.",
        ctaText: "Zobacz informacje o wydarzeniu"
      },
      en: {
        subject: "Updates about {{eventName}}",
        preheader: "All important updates about your start in one short summary.",
        intro: "Hello {{driverName}}, we keep you updated on all news around {{eventName}}.",
        body: "Schedule, on-site organization, and sporting highlights are updated continuously.",
        ctaText: "View event information"
      }
    },
    event_update: {
      de: {
        subject: "Wichtiges Update zu deiner Nennung – {{eventName}}",
        preheader: "Bitte beachte die aktuellen Änderungen für deinen Start.",
        intro: "Hallo {{driverName}}, hier ist ein aktuelles Update zu deinem Start.",
        body: "Bitte beachte Änderungen bei Briefing, Zufahrt und Abnahme.",
        ctaText: "Update im Detail ansehen"
      },
      cs: {
        subject: "Důležitá aktualizace k tvé přihlášce – {{eventName}}",
        preheader: "Prosím zkontroluj aktuální změny pro svůj start.",
        intro: "Ahoj {{driverName}}, posíláme aktuální informace k tvému startu.",
        body: "Zkontroluj prosím změny v briefingu, příjezdu a přejímce.",
        ctaText: "Zobrazit detail aktualizace"
      },
      pl: {
        subject: "Ważna aktualizacja Twojego zgłoszenia – {{eventName}}",
        preheader: "Sprawdź aktualne zmiany dotyczące Twojego startu.",
        intro: "Cześć {{driverName}}, przesyłamy aktualne informacje dotyczące Twojego startu.",
        body: "Sprawdź zmiany dotyczące briefingu, dojazdu i odbioru technicznego.",
        ctaText: "Zobacz szczegóły aktualizacji"
      },
      en: {
        subject: "Important update for your entry – {{eventName}}",
        preheader: "Please review the latest changes for your start.",
        intro: "Hello {{driverName}}, here is an important update for your start.",
        body: "Please review changes regarding briefing, access, and scrutineering.",
        ctaText: "View update details"
      }
    },
    free_form: {
      de: {
        subject: "Mitteilung zu {{eventName}}",
        preheader: "Wichtige Information des Orga-Teams.",
        intro: "Hallo {{driverName}}, diese Nachricht enthält eine gezielte Mitteilung des Orga-Teams.",
        body: "Bitte beachte die folgenden Hinweise für deine Teilnahme.",
        ctaText: "Mitteilung ansehen"
      },
      cs: {
        subject: "Informace k {{eventName}}",
        preheader: "Důležitá informace od organizačního týmu.",
        intro: "Ahoj {{driverName}}, tato zpráva obsahuje důležitou informaci od pořadatele.",
        body: "Prosím věnuj pozornost následujícím pokynům pro účast.",
        ctaText: "Zobrazit informaci"
      },
      pl: {
        subject: "Informacja dotycząca {{eventName}}",
        preheader: "Ważna informacja od zespołu organizacyjnego.",
        intro: "Cześć {{driverName}}, ta wiadomość zawiera ważną informację od organizatorów.",
        body: "Zapoznaj się z poniższymi wskazówkami dotyczącymi udziału.",
        ctaText: "Zobacz informację"
      },
      en: {
        subject: "Message regarding {{eventName}}",
        preheader: "Important information from the organizing team.",
        intro: "Hello {{driverName}}, this message contains important information from the organizing team.",
        body: "Please review the following notes for your participation.",
        ctaText: "View message"
      }
    },
    payment_reminder_followup: {
      de: {
        subject: "Erinnerung zum offenen Nenngeld – {{eventName}}",
        preheader: "Bitte überweise das offene Nenngeld fristgerecht.",
        intro: "Hallo {{driverName}}, dein Nenngeld ist aktuell noch offen ({{amountOpen}}).",
        body: "Bitte überweise den Betrag bis {{paymentDeadline}}. Zahlungsinformationen stehen in der Nennbestätigung.",
        ctaText: "Zahlungsinformationen öffnen"
      },
      cs: {
        subject: "Připomenutí k neuhrazenému startovnému – {{eventName}}",
        preheader: "Prosím uhraď neuhrazené startovné včas.",
        intro: "Ahoj {{driverName}}, tvé startovné je stále neuhrazené ({{amountOpen}}).",
        body: "Prosím uhraď částku do {{paymentDeadline}}. Platební údaje jsou v potvrzení přihlášky.",
        ctaText: "Otevřít platební informace"
      },
      pl: {
        subject: "Przypomnienie o nieopłaconym wpisowym – {{eventName}}",
        preheader: "Opłać proszę zaległe wpisowe w terminie.",
        intro: "Cześć {{driverName}}, Twoje wpisowe jest nadal nieopłacone ({{amountOpen}}).",
        body: "Opłać kwotę do {{paymentDeadline}}. Dane do płatności znajdziesz w potwierdzeniu zgłoszenia.",
        ctaText: "Otwórz informacje o płatności"
      },
      en: {
        subject: "Reminder for outstanding entry fee – {{eventName}}",
        preheader: "Please transfer the outstanding entry fee by the deadline.",
        intro: "Hello {{driverName}}, your entry fee is still outstanding ({{amountOpen}}).",
        body: "Please transfer the amount by {{paymentDeadline}}. Payment details are in your entry confirmation.",
        ctaText: "Open payment information"
      }
    }
  },
  processTemplates: {
    registration_received: {
      de: {
        subject: "Anmeldung eingegangen – {{eventName}}",
        preheader: "Bitte bestätige deine E-Mail-Adresse, damit wir deine Nennung prüfen können.",
        body:
          "Hallo {{driverName}},\n\nvielen Dank für deine Anmeldung. Bitte bestätige als nächsten Schritt deine E-Mail-Adresse.\n\nNach der Verifizierung prüfen wir deine Nennung und melden uns mit dem nächsten Status.",
        ctaText: "E-Mail-Adresse bestätigen"
      },
      cs: {
        subject: "Registrace přijata – {{eventName}}",
        preheader: "Potvrď prosím e-mailovou adresu, abychom mohli přihlášku zpracovat.",
        body:
          "Ahoj {{driverName}},\n\nděkujeme za registraci. Jako další krok prosím potvrď svou e-mailovou adresu.\n\nPo ověření přihlášku zkontrolujeme a pošleme další stav.",
        ctaText: "Potvrdit e-mail"
      },
      pl: {
        subject: "Zgłoszenie przyjęte – {{eventName}}",
        preheader: "Potwierdź adres e-mail, abyśmy mogli zweryfikować zgłoszenie.",
        body:
          "Cześć {{driverName}},\n\ndziękujemy za zgłoszenie. W kolejnym kroku potwierdź proszę adres e-mail.\n\nPo weryfikacji sprawdzimy zgłoszenie i wyślemy kolejny status.",
        ctaText: "Potwierdź e-mail"
      },
      en: {
        subject: "Registration received – {{eventName}}",
        preheader: "Please verify your email address so we can review your entry.",
        body:
          "Hello {{driverName}},\n\nthank you for your registration. As the next step, please verify your email address.\n\nAfter verification, we will review your entry and send the next status update.",
        ctaText: "Verify email address"
      }
    },
    email_confirmation_reminder: verificationReminderI18n,
    preselection: {
      de: {
        subject: "Statusupdate zu deiner Nennung – {{eventName}}",
        preheader: "Deine Nennung ist in der Vorauswahl.",
        body:
          "Hallo {{driverName}},\n\ndeine Nennung wurde in die Vorauswahl übernommen. Die finale Startliste wird aktuell erstellt.\n\nWir melden uns mit dem nächsten Statusupdate.",
        ctaText: ""
      },
      cs: {
        subject: "Aktualizace stavu přihlášky – {{eventName}}",
        preheader: "Tvoje přihláška je ve výběru.",
        body:
          "Ahoj {{driverName}},\n\ntvá přihláška byla zařazena do předvýběru. Finální startovní listina se nyní připravuje.\n\nBrzy pošleme další stav.",
        ctaText: ""
      },
      pl: {
        subject: "Aktualizacja statusu zgłoszenia – {{eventName}}",
        preheader: "Twoje zgłoszenie jest na liście wstępnej.",
        body:
          "Cześć {{driverName}},\n\nTwoje zgłoszenie zostało zakwalifikowane do wstępnej listy. Trwa przygotowanie ostatecznej listy startowej.\n\nWkrótce wyślemy kolejną aktualizację.",
        ctaText: ""
      },
      en: {
        subject: "Entry status update – {{eventName}}",
        preheader: "Your entry is currently in preselection.",
        body:
          "Hello {{driverName}},\n\nyour entry is currently in preselection. The final start list is being prepared.\n\nWe will send the next status update soon.",
        ctaText: ""
      }
    },
    accepted_open_payment: {
      de: {
        subject: "Zulassung bestätigt – Nenngeld offen ({{eventName}})",
        preheader: "Nennbestätigung im Anhang, Nenngeld bitte fristgerecht überweisen.",
        body:
          "Hallo {{driverName}},\n\ndeine Nennung ist zugelassen. Im Anhang findest du deine Nennbestätigung als PDF.\n\nBitte überweise das offene Nenngeld fristgerecht. Die Zahlungsinformationen stehen in der Nennbestätigung.",
        ctaText: "Zahlungsinformationen öffnen"
      },
      cs: {
        subject: "Přijetí potvrzeno – startovné je otevřené ({{eventName}})",
        preheader: "Potvrzení přihlášky je v příloze, uhraď prosím startovné včas.",
        body:
          "Ahoj {{driverName}},\n\ntvoje přihláška byla přijata. V příloze najdeš potvrzení přihlášky v PDF.\n\nProsím uhraď otevřené startovné v termínu. Platební údaje jsou v potvrzení.",
        ctaText: "Otevřít platební informace"
      },
      pl: {
        subject: "Dopuszczenie potwierdzone – wpisowe nieopłacone ({{eventName}})",
        preheader: "Potwierdzenie zgłoszenia w załączniku, opłać wpisowe w terminie.",
        body:
          "Cześć {{driverName}},\n\nTwoje zgłoszenie zostało dopuszczone. W załączniku znajdziesz potwierdzenie zgłoszenia w PDF.\n\nOpłać proszę zaległe wpisowe w terminie. Dane płatności są w potwierdzeniu.",
        ctaText: "Otwórz informacje o płatności"
      },
      en: {
        subject: "Accepted – entry fee still open ({{eventName}})",
        preheader: "Entry confirmation attached, please transfer the entry fee by the deadline.",
        body:
          "Hello {{driverName}},\n\nyour entry has been accepted. Please find your entry confirmation PDF attached.\n\nPlease transfer the outstanding entry fee by the deadline. Payment details are included in the confirmation.",
        ctaText: "Open payment information"
      }
    },
    accepted_paid_completed: {
      de: {
        subject: "Zahlung bestätigt – Start vollständig ({{eventName}})",
        preheader: "Zulassung und Zahlung sind vollständig bestätigt.",
        body:
          "Hallo {{driverName}},\n\ndeine Zulassung und Zahlung sind vollständig bestätigt. Damit ist dein Start formal abgeschlossen.\n\nWeitere Event-Updates senden wir dir rechtzeitig vor dem Wochenende.",
        ctaText: ""
      },
      cs: {
        subject: "Platba potvrzena – start je kompletní ({{eventName}})",
        preheader: "Přijetí i platba jsou kompletně potvrzeny.",
        body:
          "Ahoj {{driverName}},\n\npřijetí i platba jsou kompletně potvrzeny. Tvůj start je tím formálně uzavřen.\n\nDalší informace pošleme včas před víkendem akce.",
        ctaText: ""
      },
      pl: {
        subject: "Płatność potwierdzona – start kompletny ({{eventName}})",
        preheader: "Dopuszczenie i płatność są w pełni potwierdzone.",
        body:
          "Cześć {{driverName}},\n\ndopuszczenie i płatność są w pełni potwierdzone. Twój start jest formalnie zakończony.\n\nKolejne informacje wyślemy odpowiednio wcześniej przed weekendem wydarzenia.",
        ctaText: ""
      },
      en: {
        subject: "Payment confirmed – start completed ({{eventName}})",
        preheader: "Acceptance and payment are fully confirmed.",
        body:
          "Hello {{driverName}},\n\nyour acceptance and payment are fully confirmed. Your start is now formally completed.\n\nWe will send further event updates before the event weekend.",
        ctaText: ""
      }
    },
    rejected: {
      de: {
        subject: "Rückmeldung zu deiner Nennung – {{eventName}}",
        preheader: "Deine Nennung kann in diesem Jahr leider nicht berücksichtigt werden.",
        body:
          "Hallo {{driverName}},\n\nnach Prüfung können wir deine Nennung in diesem Jahr leider nicht berücksichtigen.\n\nVielen Dank für dein Interesse und deine Anmeldung.",
        ctaText: ""
      },
      cs: {
        subject: "Vyjádření k přihlášce – {{eventName}}",
        preheader: "Přihlášku letos bohužel nemůžeme zohlednit.",
        body:
          "Ahoj {{driverName}},\n\npo kontrole bohužel letos nemůžeme tvoji přihlášku zohlednit.\n\nDěkujeme za zájem a registraci.",
        ctaText: ""
      },
      pl: {
        subject: "Informacja o zgłoszeniu – {{eventName}}",
        preheader: "Niestety w tym roku nie możemy uwzględnić Twojego zgłoszenia.",
        body:
          "Cześć {{driverName}},\n\npo weryfikacji niestety nie możemy w tym roku uwzględnić Twojego zgłoszenia.\n\nDziękujemy za zainteresowanie i zgłoszenie.",
        ctaText: ""
      },
      en: {
        subject: "Update regarding your entry – {{eventName}}",
        preheader: "Unfortunately, your entry cannot be accepted this year.",
        body:
          "Hello {{driverName}},\n\nafter review, we are unfortunately unable to accept your entry this year.\n\nThank you for your interest and registration.",
        ctaText: ""
      }
    }
  }
} as const;

const initialProcessBodies: Record<ProcessTemplateKey, string> = processMailSuggestions.reduce(
  (acc, item) => {
    acc[item.key] = item.bodyText;
    return acc;
  },
  {} as Record<ProcessTemplateKey, string>
);

function isCampaignDraftKey(value: MailDraftKey): value is LabTemplateKey {
  return Object.prototype.hasOwnProperty.call(templateSpecs, value);
}

const subtleAccentByTemplate: Record<MailDraftKey, SubtleAccentTone> = {
  newsletter: {
    contextCard: "border-sky-200 bg-sky-50/60",
    contextTitle: "text-sky-700",
    panel: "border-l-4 border-l-sky-300",
    headerLine: "bg-sky-300/60"
  },
  event_update: {
    contextCard: "border-blue-200 bg-blue-50/60",
    contextTitle: "text-blue-700",
    panel: "border-l-4 border-l-blue-300",
    headerLine: "bg-blue-300/60"
  },
  free_form: {
    contextCard: "border-indigo-200 bg-indigo-50/60",
    contextTitle: "text-indigo-700",
    panel: "border-l-4 border-l-indigo-300",
    headerLine: "bg-indigo-300/60"
  },
  payment_reminder_followup: {
    contextCard: "border-amber-200 bg-amber-50/70",
    contextTitle: "text-amber-700",
    panel: "border-l-4 border-l-amber-300",
    headerLine: "bg-amber-300/60"
  },
  registration_received: {
    contextCard: "border-sky-200 bg-sky-50/60",
    contextTitle: "text-sky-700",
    panel: "border-l-4 border-l-sky-300",
    headerLine: "bg-sky-300/60"
  },
  email_confirmation_reminder: {
    contextCard: "border-cyan-200 bg-cyan-50/60",
    contextTitle: "text-cyan-700",
    panel: "border-l-4 border-l-cyan-300",
    headerLine: "bg-cyan-300/60"
  },
  preselection: {
    contextCard: "border-blue-200 bg-blue-50/60",
    contextTitle: "text-blue-700",
    panel: "border-l-4 border-l-blue-300",
    headerLine: "bg-blue-300/60"
  },
  accepted_open_payment: {
    contextCard: "border-amber-200 bg-amber-50/70",
    contextTitle: "text-amber-700",
    panel: "border-l-4 border-l-amber-300",
    headerLine: "bg-amber-300/60"
  },
  accepted_paid_completed: {
    contextCard: "border-emerald-200 bg-emerald-50/60",
    contextTitle: "text-emerald-700",
    panel: "border-l-4 border-l-emerald-300",
    headerLine: "bg-emerald-300/60"
  },
  rejected: {
    contextCard: "border-rose-200 bg-rose-50/60",
    contextTitle: "text-rose-700",
    panel: "border-l-4 border-l-rose-300",
    headerLine: "bg-rose-300/60"
  }
};

function splitParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildTemplateData(templateKey: LabTemplateKey, draft: DraftState) {
  const introText = `Hallo ${draft.recipientName}, ${draft.intro}`;
  const detailsText = `${draft.vehicleContext}\n\n${draft.story}`;
  const closingText = draft.outro;

  if (templateKey === "newsletter") {
    return {
      heroEyebrow: draft.heroEyebrow,
      heroSubtitle: draft.heroSubtitle,
      highlights: draft.highlights,
      introText,
      detailsText,
      closingText,
      ctaText: draft.ctaText,
      ctaUrl: draft.ctaUrl,
    };
  }

  if (templateKey === "event_update") {
    return {
      heroSubtitle: draft.heroSubtitle,
      highlights: draft.highlights,
      introText,
      detailsText,
      closingText,
      ctaText: draft.ctaText,
      ctaUrl: draft.ctaUrl,
    };
  }

  if (templateKey === "free_form") {
    return {
      introText,
      detailsText,
      closingText,
      ctaText: draft.ctaText,
      ctaUrl: draft.ctaUrl,
    };
  }

  if (templateKey === "payment_reminder_followup") {
    return {
      introText: `Hallo ${draft.recipientName}, wir möchten dich freundlich daran erinnern, dass dein Nenngeld aktuell noch offen ist.`,
      detailsText: `${draft.vehicleContext}\n\nBitte überweise den offenen Betrag fristgerecht. Die Zahlungsinformationen findest du in deiner Nennbestätigung.`,
      closingText,
      paymentDeadline: draft.paymentDeadline,
      ctaText: "Zahlungsinformationen öffnen",
      ctaUrl: draft.ctaUrl,
    };
  }

  return {
    introText,
    detailsText,
    closingText,
  };
}

function splitHighlights(value: string) {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function renderProcessText(template: string, draft: DraftState) {
  return template
    .replace(/\{\{\s*eventName\s*\}\}/g, draft.eventName)
    .replace(/\{\{\s*driverName\s*\}\}/g, draft.recipientName);
}

export function AdminMailDesignLabPage() {
  const [activeTemplate, setActiveTemplate] = useState<MailDraftKey>("event_update");
  const [subjects, setSubjects] = useState<Record<MailDraftKey, string>>({
    ...defaultSubjects,
    ...defaultProcessSubjects,
  });
  const [processPreheaders, setProcessPreheaders] = useState<Record<ProcessTemplateKey, string>>(defaultProcessPreheaders);
  const [processHeaderTitles, setProcessHeaderTitles] = useState<Record<ProcessTemplateKey, string>>(defaultProcessHeaderTitles);
  const [processBodies, setProcessBodies] = useState<Record<ProcessTemplateKey, string>>(initialProcessBodies);
  const [includeCampaignEntryContext, setIncludeCampaignEntryContext] = useState(true);
  const [draft, setDraft] = useState<DraftState>(initialDraft);
  const activeSpec = isCampaignDraftKey(activeTemplate) ? templateSpecs[activeTemplate] : processTemplateSpecs[activeTemplate];
  const activeAccent = subtleAccentByTemplate[activeTemplate];
  const templateData = useMemo(
    () => (isCampaignDraftKey(activeTemplate) ? buildTemplateData(activeTemplate, draft) : null),
    [activeTemplate, draft]
  );
  const highlights = useMemo(() => splitHighlights(draft.highlights), [draft.highlights]);
  const activeSubject = subjects[activeTemplate];
  const activeProcessTemplate = useMemo(
    () => processMailSuggestions.find((item) => item.key === activeTemplate),
    [activeTemplate]
  );
  const activeProcessBody = useMemo(
    () => (activeProcessTemplate ? processBodies[activeProcessTemplate.key] : ""),
    [activeProcessTemplate, processBodies]
  );
  const activePreheader = useMemo(
    () => (isCampaignDraftKey(activeTemplate) ? draft.preheader : processPreheaders[activeTemplate]),
    [activeTemplate, draft.preheader, processPreheaders]
  );
  const activeProcessHeaderTitle = useMemo(
    () => (!isCampaignDraftKey(activeTemplate) ? processHeaderTitles[activeTemplate] : ""),
    [activeTemplate, processHeaderTitles]
  );
  const activeHeroSubtitle = useMemo(() => {
    if (!isCampaignDraftKey(activeTemplate)) {
      return "";
    }
    if (activeTemplate !== "newsletter" && activeTemplate !== "event_update") {
      return "";
    }
    return draft.heroSubtitle.trim();
  }, [activeTemplate, draft.heroSubtitle]);
  const hasEntryReference = useMemo(() => draft.vehicleContext.trim().length > 0, [draft.vehicleContext]);
  const showCampaignEntryContext = useMemo(
    () => isCampaignDraftKey(activeTemplate) && includeCampaignEntryContext && hasEntryReference,
    [activeTemplate, hasEntryReference, includeCampaignEntryContext]
  );
  const headerShowHeroSubtitle = useMemo(() => {
    if (!activeHeroSubtitle) {
      return false;
    }
    const preheaderLength = activePreheader.trim().length;
    const subtitleLength = activeHeroSubtitle.length;
    if (!activePreheader.trim()) {
      return true;
    }
    return subtitleLength + preheaderLength <= 125;
  }, [activeHeroSubtitle, activePreheader]);
  const headerShowPreheader = useMemo(() => {
    if (!activePreheader.trim()) {
      return false;
    }
    if (!headerShowHeroSubtitle) {
      return true;
    }
    return activePreheader.trim().length <= 72;
  }, [activePreheader, headerShowHeroSubtitle]);

  const payloadPreview = useMemo(() => {
    const basePayload: Record<string, unknown> = {
      templateKey: activeTemplate,
      subjectOverride: activeSubject,
      renderOptions: {
        showBadge: false,
        includeEntryContext: isCampaignDraftKey(activeTemplate) ? showCampaignEntryContext : true,
      },
    };
    if (isCampaignDraftKey(activeTemplate) && templateData) {
      basePayload.templateData = templateData;
    }
    if (!isCampaignDraftKey(activeTemplate) && activeProcessTemplate) {
      basePayload.headerTitle = processHeaderTitles[activeTemplate];
      basePayload.preheader = processPreheaders[activeTemplate];
      basePayload.bodyOverride = activeProcessBody;
      basePayload.previewMode = "draft";
      basePayload.sampleData = {
        eventName: draft.eventName,
        driverName: draft.recipientName,
        firstName: draft.recipientName.split(" ")[0] || draft.recipientName,
        verificationUrl: sampleVerificationUrl,
        amountOpen: "120,00 EUR",
      };
    }
    return JSON.stringify(
      basePayload,
      null,
      2
    );
  }, [
    activeProcessBody,
    activeProcessTemplate,
    activeSubject,
    activeTemplate,
    draft.eventName,
    draft.recipientName,
    showCampaignEntryContext,
    processPreheaders,
    processHeaderTitles,
    templateData,
  ]);

  const allPayloadsForBackend = useMemo(() => {
    const campaignPayloads: Record<string, unknown> = {};
    (Object.keys(templateSpecs) as LabTemplateKey[]).forEach((key) => {
      campaignPayloads[key] = {
        templateKey: key,
        subjectOverride: subjects[key],
        templateData: buildTemplateData(key, draft),
        renderOptions: {
          showBadge: false,
          includeEntryContext: includeCampaignEntryContext,
        },
      };
    });
    const processPayloads: Record<string, unknown> = {};
    processMailSuggestions.forEach((item) => {
      processPayloads[item.key] = {
        templateKey: item.key,
        preheader: processPreheaders[item.key],
        headerTitle: processHeaderTitles[item.key],
        subjectOverride: subjects[item.key],
        bodyOverride: processBodies[item.key],
        previewMode: "draft",
      };
    });
    return JSON.stringify(
      {
        designTheme: {
          primary: "#1e3a8a",
          accent: "#1d4ed8",
          warmHighlight: "#facc15",
          neutralBg: "#f8fafc",
          reason:
            "Angelehnt an die Vereinswebsite: klares Blau als Basis mit gelbem Akzent für CTA und wichtige Hervorhebungen.",
        },
        defaultFooter: {
          eventInfoLine: `${draft.eventName} · ${draft.eventDate}`,
          supportHint: "Bei Fragen antworte einfach auf diese E-Mail.",
          links: {
            impressum: imprintUrl,
            datenschutz: privacyUrl,
          },
        },
        campaignTemplates: campaignPayloads,
        processTemplates: processPayloads,
      },
      null,
      2
    );
  }, [draft, includeCampaignEntryContext, processBodies, processHeaderTitles, processPreheaders, subjects]);

  const allProcessSuggestionsForBackend = useMemo(() => {
    const suggestions = processMailSuggestions.map((item) => ({
      key: item.key,
      title: item.title,
      constraints: item.key === "preselection" ? "Aktueller Backend-Stand: process endpoint blockiert preselection." : null,
      attachmentRules:
        item.key === "accepted_open_payment"
          ? {
              mandatory: ["Nennbestätigung.pdf"],
              optional: [],
            }
          : {
              mandatory: [],
              optional: [],
            },
      optionalFields:
        item.key === "accepted_open_payment" || item.key === "rejected"
          ? ["driverNote (optional, Freitext Orga-Team)"]
          : [],
      previewPayload: {
        templateKey: item.key,
        sampleData: {
          eventName: draft.eventName,
          driverName: draft.recipientName,
          firstName: draft.recipientName.split(" ")[0] || draft.recipientName,
          amountOpen: "120,00 EUR",
          verificationUrl: sampleVerificationUrl,
        },
        preheader: processPreheaders[item.key],
        headerTitle: processHeaderTitles[item.key],
        subjectOverride: subjects[item.key],
        bodyOverride: processBodies[item.key],
        previewMode: "draft",
      },
      localeVariants:
        item.key === "email_confirmation_reminder"
          ? {
              strategy: "de Standard, cs/pl eigene Übersetzung, alle weiteren Sprachen fallback en.",
              templatesByLocale: verificationReminderI18n,
            }
          : null,
      lifecycleQueueExample:
        item.eventType === undefined
          ? null
          : {
              endpoint: "/admin/mail/lifecycle/queue",
              payload: {
                eventId: "EVENT_ID",
                entryId: "ENTRY_ID",
                eventType: item.eventType,
                includeDriverNote: item.key === "accepted_open_payment" || item.key === "rejected" ? true : undefined,
                allowDuplicate: true,
              },
            },
      automationRule:
        item.key === "accepted_paid_completed"
          ? "Automatisch senden, wenn acceptanceStatus=accepted und paymentStatus=paid."
          : item.key === "email_confirmation_reminder"
            ? "Automatisch nach 3 Tagen erneut senden, wenn confirmationMailVerified weiterhin false ist."
            : null,
      preconditions:
        item.key === "accepted_paid_completed"
          ? ["accepted_open_payment wurde zuvor versendet", "Nennbestätigung PDF bereits zugestellt"]
          : item.key === "email_confirmation_reminder"
            ? ["registration_received wurde bereits versendet", "confirmationMailVerified=false", "lastVerificationMailAt >= 3 Tage zurückliegend"]
          : [],
    }));
    return JSON.stringify({ processTemplates: suggestions }, null, 2);
  }, [draft.eventName, draft.recipientName, processBodies, processHeaderTitles, processPreheaders, subjects]);
  const allMailTextsI18nJson = useMemo(() => JSON.stringify(allMailTextsI18n, null, 2), []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Mail-Design-Lab · Trackline v2</h1>
          <p className="text-sm text-slate-600">
            Einheitlicher Entwurf für Mail und Anmeldung: gleicher Header-Charakter, gleiche Kartenlogik, gleiche Tonalität.
          </p>
        </div>
      </div>

      <Card className="border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50">
        <CardContent className="grid gap-3 p-4 text-sm text-slate-700 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Header</p>
            <p className="mt-1">Vereinsnaher Verlauf (Blau), Logo links, klare Statuszeile.</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Info-Karte</p>
            <p className="mt-1">Kompakte Karte „Deine Anmeldung“ als wiederkehrendes UI-Muster.</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Textstil</p>
            <p className="mt-1">Kurze Absätze, klare Handlungsaufforderung, gelbe CTA-Akzente.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Template auswählen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(templateSpecs) as LabTemplateKey[]).map((key) => {
              const isActive = activeTemplate === key;
              return (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => setActiveTemplate(key)}
                >
                  {templateSpecs[key].label}
                </Button>
              );
            })}
            {(Object.keys(processTemplateSpecs) as ProcessTemplateKey[]).map((key) => {
              const isActive = activeTemplate === key;
              return (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => setActiveTemplate(key)}
                >
                  {processTemplateSpecs[key].label}
                </Button>
              );
            })}
          </div>
          <p className="text-sm text-slate-600">{activeSpec.description}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Inhalte bearbeiten ({activeSpec.label})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Eventname</Label>
              <Input value={draft.eventName} onChange={(event) => setDraft((prev) => ({ ...prev, eventName: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Eventdatum</Label>
              <Input value={draft.eventDate} onChange={(event) => setDraft((prev) => ({ ...prev, eventDate: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Empfängername</Label>
              <Input value={draft.recipientName} onChange={(event) => setDraft((prev) => ({ ...prev, recipientName: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Fahrzeug-Kontext</Label>
              <Input value={draft.vehicleContext} onChange={(event) => setDraft((prev) => ({ ...prev, vehicleContext: event.target.value }))} />
            </div>
            {isCampaignDraftKey(activeTemplate) && (
              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <input
                  id="campaign-entry-context"
                  type="checkbox"
                  checked={includeCampaignEntryContext}
                  onChange={(event) => setIncludeCampaignEntryContext(event.target.checked)}
                />
                <Label htmlFor="campaign-entry-context" className="text-sm font-normal">
                  Nennungsinfo bei Campaign-Mails anzeigen (nur wenn Referenzdaten vorhanden)
                </Label>
              </div>
            )}
            <div className="space-y-1">
              <Label>Betreff</Label>
              <Input
                value={activeSubject}
                onChange={(event) =>
                  setSubjects((prev) => ({
                    ...prev,
                    [activeTemplate]: event.target.value,
                  }))
                }
              />
            </div>
            {isCampaignDraftKey(activeTemplate) ? (
              <div className="space-y-1">
                <Label>Preheader</Label>
                <Input value={activePreheader} onChange={(event) => setDraft((prev) => ({ ...prev, preheader: event.target.value }))} />
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Header-Status</Label>
                <Input
                  value={activeProcessHeaderTitle}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (isCampaignDraftKey(activeTemplate)) return;
                    setProcessHeaderTitles((prev) => ({ ...prev, [activeTemplate]: next }));
                  }}
                />
              </div>
            )}
            {isCampaignDraftKey(activeTemplate) && (activeTemplate === "newsletter" || activeTemplate === "event_update") && (
              <>
                <div className="space-y-1">
                  <Label>Hero-Zeile</Label>
                  <Input value={draft.heroEyebrow} onChange={(event) => setDraft((prev) => ({ ...prev, heroEyebrow: event.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Hero-Untertitel</Label>
                  <Input value={draft.heroSubtitle} onChange={(event) => setDraft((prev) => ({ ...prev, heroSubtitle: event.target.value }))} />
                </div>
              </>
            )}
            {isCampaignDraftKey(activeTemplate) ? (
              <>
                <div className="space-y-1">
                  <Label>Einleitung</Label>
                  <textarea
                    className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={draft.intro}
                    onChange={(event) => setDraft((prev) => ({ ...prev, intro: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Haupttext</Label>
                  <textarea
                    className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={draft.story}
                    onChange={(event) => setDraft((prev) => ({ ...prev, story: event.target.value }))}
                  />
                </div>
                {(activeTemplate === "newsletter" || activeTemplate === "event_update") && (
                  <div className="space-y-1">
                    <Label>Highlights (eine Zeile pro Punkt)</Label>
                    <textarea
                      className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={draft.highlights}
                      onChange={(event) => setDraft((prev) => ({ ...prev, highlights: event.target.value }))}
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label>CTA Text</Label>
                  <Input value={draft.ctaText} onChange={(event) => setDraft((prev) => ({ ...prev, ctaText: event.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>CTA URL</Label>
                  <Input value={draft.ctaUrl} onChange={(event) => setDraft((prev) => ({ ...prev, ctaUrl: event.target.value }))} />
                </div>
                {activeTemplate === "payment_reminder_followup" && (
                  <div className="space-y-1">
                    <Label>Zahlungsfrist</Label>
                    <Input value={draft.paymentDeadline} onChange={(event) => setDraft((prev) => ({ ...prev, paymentDeadline: event.target.value }))} />
                  </div>
                )}
                <div className="space-y-1">
                  <Label>Abschluss</Label>
                  <textarea
                    className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={draft.outro}
                    onChange={(event) => setDraft((prev) => ({ ...prev, outro: event.target.value }))}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Preheader (optional)</Label>
                  <Input
                    value={activePreheader}
                    onChange={(event) => {
                      const next = event.target.value;
                      if (isCampaignDraftKey(activeTemplate)) return;
                      setProcessPreheaders((prev) => ({ ...prev, [activeTemplate]: next }));
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Prozessmail-Text</Label>
                  <textarea
                    className="min-h-48 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-6"
                    value={activeProcessTemplate ? processBodies[activeProcessTemplate.key] : ""}
                    onChange={(event) => {
                      if (!activeProcessTemplate) return;
                      const key = activeProcessTemplate.key;
                      setProcessBodies((prev) => ({ ...prev, [key]: event.target.value }));
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vorschau ({activeSpec.label})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mx-auto max-w-[720px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className={`bg-gradient-to-r ${activeSpec.accent} px-5 py-5 text-white sm:px-7 sm:py-6`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <img src={mscLogoUrl} alt="MSC Logo" className="h-10 w-10 rounded-md bg-white/95 object-contain p-1.5" />
                      <div className="text-xs uppercase tracking-[0.16em] text-white/90">{draft.heroEyebrow}</div>
                    </div>
                    <div className="text-xs font-medium text-white/90">{draft.eventDate}</div>
                  </div>
                  <div className="mt-3 pr-2 text-xl font-semibold leading-tight sm:text-2xl">{draft.eventName}</div>
                  <div className={`mt-3 h-1 w-24 rounded-full ${activeAccent.headerLine}`} />
                  {isCampaignDraftKey(activeTemplate) ? (
                    <>
                      {headerShowHeroSubtitle && <div className="mt-2 text-sm leading-6 text-white/90">{activeHeroSubtitle}</div>}
                      {headerShowPreheader && <div className="mt-2 text-sm leading-6 text-white/95">{activePreheader}</div>}
                    </>
                  ) : (
                    <div className="mt-2 text-sm font-semibold uppercase tracking-[0.14em] text-white/95">{activeProcessHeaderTitle}</div>
                  )}
                </div>

                <div className="space-y-4 px-5 py-6 text-[15px] leading-7 text-slate-800 sm:px-6">
                  {isCampaignDraftKey(activeTemplate) ? (
                    <>
                      <p>Hallo {draft.recipientName},</p>
                      <p>{draft.intro}</p>
                          {showCampaignEntryContext && (
                            <div className={`rounded-md border px-4 py-3 ${activeAccent.contextCard}`}>
                              <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${activeAccent.contextTitle}`}>Deine Anmeldung</p>
                              <p className="mt-1 text-sm font-medium leading-6 text-slate-900">{draft.vehicleContext}</p>
                            </div>
                          )}
                      <p>{draft.story}</p>
                      {(activeTemplate === "newsletter" || activeTemplate === "event_update") && highlights.length > 0 && (
                        <div className="space-y-1">
                          {highlights.map((line) => (
                            <p key={line} className="font-medium text-slate-900">
                              • {line}
                            </p>
                          ))}
                        </div>
                      )}
                      {activeTemplate === "payment_reminder_followup" && (
                        <p className="font-semibold text-amber-700">Bitte überweise das Nenngeld bis spätestens {draft.paymentDeadline}.</p>
                      )}
                      <p>{draft.outro}</p>
                      <div className="pt-1">
                        <a
                          href={draft.ctaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-md bg-yellow-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-yellow-300"
                        >
                          {activeTemplate === "payment_reminder_followup" ? "Zahlungsinformationen ansehen" : draft.ctaText}
                        </a>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`rounded-md border px-4 py-3 ${activeAccent.contextCard}`}>
                        <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${activeAccent.contextTitle}`}>Deine Anmeldung</p>
                        <p className="mt-1 text-sm font-medium leading-6 text-slate-900">{draft.vehicleContext || "Keine Nennungsdaten verfügbar"}</p>
                      </div>
                      {splitParagraphs(renderProcessText(activeProcessBody, draft)).map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                      {(activeTemplate === "registration_received" || activeTemplate === "email_confirmation_reminder") && (
                        <>
                          <a
                            href={sampleVerificationUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex rounded-md bg-yellow-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-yellow-300"
                          >
                            E-Mail-Adresse bestätigen
                          </a>
                          <p className="text-xs leading-5 text-slate-600">
                            Falls der Button nicht funktioniert:{" "}
                            <a href={sampleVerificationUrl} target="_blank" rel="noreferrer" className="underline">
                              {sampleVerificationUrl}
                            </a>
                          </p>
                        </>
                      )}
                      {activeTemplate === "accepted_open_payment" && (
                        <a
                          href={draft.ctaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-md bg-yellow-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-yellow-300"
                        >
                          Zahlungsinformationen öffnen
                        </a>
                      )}
                    </>
                  )}
                  <p className="pt-2 text-sm text-slate-600">
                    Mit freundlichen Grüßen
                    <br />
                    Euer MSC Oberlausitzer Dreiländereck e. V.
                  </p>
                </div>
                <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-[12px] leading-5 text-slate-600 sm:px-6">
                  <p>
                    {draft.eventName} · {draft.eventDate}
                  </p>
                  <p>Bei Fragen antworte einfach auf diese E-Mail.</p>
                  <p className="mt-1">
                    <a className="underline hover:text-slate-900" href={imprintUrl} target="_blank" rel="noreferrer">
                      Impressum
                    </a>
                    {" · "}
                    <a className="underline hover:text-slate-900" href={privacyUrl} target="_blank" rel="noreferrer">
                      Datenschutz
                    </a>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Backend-Payload ({activeSpec.label})</CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void navigator.clipboard.writeText(payloadPreview)}
              >
                JSON kopieren
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="max-h-80 overflow-auto rounded-md border bg-slate-50 p-3 text-xs text-slate-800">{payloadPreview}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Backend-Übergabe komplett</CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(allPayloadsForBackend)}>
                Alles kopieren
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="max-h-80 overflow-auto rounded-md border bg-slate-50 p-3 text-xs text-slate-800">{allPayloadsForBackend}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Campaign-Mails: Volltext-Vorschläge</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">
                Optionaler Dokumentversand in der Kommunikationsseite: nur PDF, maximal 3 Dateien, maximal 5 MB je Datei, maximal 15 MB gesamt.
              </div>
              {campaignMailSuggestions.map((item) => (
                <div key={item.key} className={`rounded-md border border-slate-200 bg-slate-50 p-3 ${subtleAccentByTemplate[item.key].panel}`}>
                  <div className="text-sm font-semibold text-slate-900">
                    {item.title} <span className="font-mono text-xs text-slate-500">({item.key})</span>
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-wide text-slate-500">Betreff</div>
                  <div className="text-sm text-slate-800">{item.subject.replace(/\{\{\s*eventName\s*\}\}/g, draft.eventName)}</div>
                  <div className="mt-2 text-xs uppercase tracking-wide text-slate-500">Volltext</div>
                  <div className="text-sm text-slate-800">
                    {item.text
                      .replace(/\{\{\s*eventName\s*\}\}/g, draft.eventName)
                      .replace(/\{\{\s*driverName\s*\}\}/g, draft.recipientName)
                      .replace(/\{\{\s*className\s*\}\}/g, "A100")
                      .replace(/\{\{\s*startNumber\s*\}\}/g, "47")
                      .replace(/\{\{\s*amountOpen\s*\}\}/g, "150,00 EUR")
                      .replace(/\{\{\s*paymentDeadline\s*\}\}/g, draft.paymentDeadline)}
                  </div>
                  <div className="mt-2 text-xs text-slate-600">{item.attachmentNote}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Prozessmails: Vorschläge</CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(allProcessSuggestionsForBackend)}>
                Prozess-JSON kopieren
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {processMailSuggestions.map((item) => (
                <div key={item.key} className={`space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 ${subtleAccentByTemplate[item.key].panel}`}>
                  <div className="text-sm font-semibold text-slate-900">
                    {item.title} <span className="font-mono text-xs text-slate-500">({item.key})</span>
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-wide text-slate-500">Betreff</div>
                  <div className="text-sm text-slate-800">{renderProcessText(subjects[item.key], draft)}</div>
                  <div className="mt-2 text-xs uppercase tracking-wide text-slate-500">Textvorschlag</div>
                  <div className="space-y-2 text-sm text-slate-800">
                    {splitParagraphs(renderProcessText(processBodies[item.key], draft)).map((paragraph) => (
                      <p key={`${item.key}-${paragraph}`}>{paragraph}</p>
                    ))}
                  </div>
                  {item.key === "accepted_open_payment" && (
                    <div className="text-xs text-slate-600">Pflichtanhang: Nennbestätigung (PDF) ist immer beizufügen.</div>
                  )}
                  {item.key === "preselection" && (
                    <div className="text-xs text-amber-700">Hinweis: Aktueller Backend-Stand blockiert preselection im Process-Endpoint.</div>
                  )}
                  {(item.key === "accepted_open_payment" || item.key === "rejected") && (
                    <div className="text-xs text-slate-600">Optional: Kurze individuelle Notiz vom Orga-Team kann ergänzt werden.</div>
                  )}

                  <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className={`bg-gradient-to-r ${processAccentByKey[item.key]} px-4 py-3 text-white`}>
                      <div className="flex items-center gap-2">
                        <img src={mscLogoUrl} alt="MSC Logo" className="h-8 w-8 rounded bg-white/95 object-contain p-1" />
                        <div className="text-xs uppercase tracking-[0.15em] text-white/90">MSC Oberlausitzer Dreiländereck</div>
                      </div>
                      <div className="mt-2 text-sm font-semibold">{draft.eventName}</div>
                    </div>
                    <div className="space-y-3 px-4 py-4 text-sm leading-6 text-slate-800">
                      {splitParagraphs(renderProcessText(processBodies[item.key], draft)).map((paragraph) => (
                        <p key={`preview-${item.key}-${paragraph}`}>{paragraph}</p>
                      ))}
                      {(item.key === "registration_received" || item.key === "email_confirmation_reminder") && (
                        <>
                          <a
                            href={sampleVerificationUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex rounded-md bg-yellow-400 px-3 py-1.5 text-xs font-semibold text-slate-900"
                          >
                            E-Mail jetzt bestätigen
                          </a>
                          <p className="text-xs text-slate-600">
                            Falls der Button nicht funktioniert:{" "}
                            <a href={sampleVerificationUrl} target="_blank" rel="noreferrer" className="underline">
                              {sampleVerificationUrl}
                            </a>
                          </p>
                        </>
                      )}
                      {item.key === "accepted_open_payment" && (
                        <a
                          href={draft.ctaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-md bg-yellow-400 px-3 py-1.5 text-xs font-semibold text-slate-900"
                        >
                          Zahlungsinformationen öffnen
                        </a>
                      )}
                    </div>
                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-600">
                      <p>
                        {draft.eventName} · {draft.eventDate}
                      </p>
                      <p>Bei Fragen antworte einfach auf diese E-Mail.</p>
                      <p>
                        <a className="underline" href={imprintUrl} target="_blank" rel="noreferrer">
                          Impressum
                        </a>
                        {" · "}
                        <a className="underline" href={privacyUrl} target="_blank" rel="noreferrer">
                          Datenschutz
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <pre className="max-h-72 overflow-auto rounded-md border bg-white p-3 text-xs text-slate-800">{allProcessSuggestionsForBackend}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Internationalisierung Verifizierungs-Erinnerung</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                Backend-Regel: `de` als Standard, `cs` und `pl` mit eigenen Vorlagen, alle weiteren internationalen Empfänger erhalten `en`.
              </div>
              <pre className="max-h-72 overflow-auto rounded-md border bg-white p-3 text-xs text-slate-800">
                {JSON.stringify(verificationReminderI18n, null, 2)}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Alle Mailtexte + Übersetzungen (de/cs/pl/en)</CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(allMailTextsI18nJson)}>
                Texte-JSON kopieren
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="max-h-80 overflow-auto rounded-md border bg-white p-3 text-xs text-slate-800">{allMailTextsI18nJson}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Nennbestätigung PDF: Vorschlag (offen zur Freigabe)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <p>
                Ziel: kompaktes, modernes A4-Dokument mit allen Pflichtinformationen für Fahrerlager-Einfahrt und Zahlung, ohne die E-Mail zu überladen.
              </p>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">Empfohlene Kapitelreihenfolge</p>
                <p>1. Kopf mit Event, Datum, Fahrerdaten, Klasse, Startnummer, Fahrzeug.</p>
                <p>2. Statusblock: Zulassung bestätigt, Dokument-ID, Ausstellungsdatum.</p>
                <p>3. Zahlungsblock: Betrag, Frist, IBAN/BIC, Verwendungszweck.</p>
                <p>4. Hinweise Fahrerlager/Orga in Kurzform.</p>
                <p>5. Rechtlicher Kurzblock + Vereinskontakt.</p>
              </div>
              <p className="text-xs text-slate-600">
                Offener Punkt zur Entscheidung: Soll zusätzlich eine QR-Zeile für schnelle Vor-Ort-Prüfung (Dokument-ID) in die PDF?
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
