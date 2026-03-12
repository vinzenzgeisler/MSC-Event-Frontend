# Backend Mail Requirements (Trackline v2)

## Scope
Diese Spezifikation beschreibt den finalen Mailvertrag zwischen Frontend und Backend für:
- Campaign-Mails
- Prozessmails
- i18n
- Anhänge
- Automationen
- Renderer-Regeln

## Template-Sets
### Campaign
- `newsletter`
- `event_update`
- `free_form`
- `payment_reminder_followup`

### Prozess
- `registration_received`
- `email_confirmation_reminder`
- `preselection`
- `accepted_open_payment`
- `accepted_paid_completed`
- `rejected`

## Render Contract
### Gemeinsame Felder
- `templateKey: string`
- `subjectOverride?: string`
- `preheader?: string`
- `headerTitle?: string` (nur Prozessmails)
- `bodyOverride?: string`
- `templateData?: Record<string,string>`
- `renderOptions?: { showBadge?: boolean; mailLabel?: string | null; includeEntryContext?: boolean }`

### Regeln
- Preview und Send nutzen dieselbe Renderpipeline.
- Prozessmails:
  - `includeEntryContext` default `true`
  - Header zeigt `headerTitle` statt Badge
- Campaign:
  - `includeEntryContext` nur bei vorhandenen Referenzdaten

## i18n
- Unterstützte Locale: `de`, `cs`, `pl`, `en`
- Default: `de`
- Fallback: `en` für alle anderen internationalen Fahrer
- Inhalte pro Template vollständig übersetzt (siehe Mail-Lab JSON und HTML-Drafts)

## Anhänge
### Prozessmail `accepted_open_payment`
- Pflichtanhang: `Nennbestätigung.pdf` (immer)

### Campaign
- optionale PDF-Anhänge erlaubt
- Limits:
  - max 3 Dateien
  - max 5 MB je Datei
  - max 15 MB gesamt

## Automationen
### `email_confirmation_reminder`
- Automatisch senden, wenn:
  - `confirmationMailVerified=false`
  - `registration_received` bereits versendet
  - letzte Verifizierungs-Mail mindestens 3 Tage alt

### `accepted_paid_completed`
- Automatisch senden, wenn:
  - `acceptanceStatus=accepted`
  - `paymentStatus=paid`
  - Zulassungs-/Zahlungskontext vollständig

## Footer
Pflicht in allen Mails:
- Eventzeile (`{{eventName}} · {{eventDate}}`)
- „Bei Fragen antworte einfach auf diese E-Mail.“
- Link Impressum
- Link Datenschutz

## HTML Design
- Table-basiert, Outlook-sicher
- Inline-CSS
- Vereinsnahes Blau als Headergrundlage
- Gelber CTA
- Dezente Mailtyp-Akzente (Linie/Karten)

Referenz:
- `docs/BACKEND_MAIL_HTML_DRAFTS_TRACKLINE_V2.md`

## Backend-Umsetzungsergebnis (Abnahme)
- OpenAPI aktualisiert (neue Felder/Beispiele)
- `GET /admin/mail/templates` mit finalem Contract
- Preview/Send parity nachweisbar
- Automationstests für 3-Tage-Reminder
- Attachment-Regeln serverseitig validiert
