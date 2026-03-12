Du bist Backend-Agent für den Mail-Renderer des Projekts `msc-event`.

Ziel:
- Implementiere den Mail-Renderer gemäß Trackline-v2-Design.
- Nutze die bereitgestellten HTML-Entwürfe als verbindliche Struktur.
- Sorge für identische Renderpipeline in Preview und Send.
- Liefere i18n-Fallback-Logik sowie automatisierte Verifizierungs-Erinnerung nach 3 Tagen.

Technische Kernanforderungen:
1. Einheitliche Pipeline:
- Preview und Send müssen exakt denselben Renderer verwenden.
- Keine separaten Template-Engines für Preview vs. Send.

2. Layout:
- Table-basiert, Outlook-sicher, keine externen CSS-Dateien.
- Nur Inline-Styles.
- Header immer in Vereins-Blau.
- CTA standardmäßig gelb (`#facc15`) mit dunkler Schrift.

3. Template-Arten:
- Campaign:
  - `newsletter`
  - `event_update`
  - `free_form`
  - `payment_reminder_followup`
- Prozess:
  - `registration_received`
  - `email_confirmation_reminder`
  - `preselection`
  - `accepted_open_payment`
  - `accepted_paid_completed`
  - `rejected`

4. Sprachlogik:
- Standard: `de`
- Explizit unterstützt: `cs`, `pl`, `en`
- Alle anderen Sprachen -> Fallback `en`
- Sprache pro Empfänger deterministisch auswählen (z. B. `preferredLanguage` oder Country-Mapping).

5. Verifizierungs-Erinnerung:
- `email_confirmation_reminder` ist Prozessmail, nicht Campaign.
- Automatische Queue-Regel:
  - nur wenn `confirmationMailVerified=false`
  - und `registration_received` bereits versendet
  - und letzte Verifizierungs-Mail mindestens 3 Tage alt
- Dedupe/Idempotency sauber behandeln.

6. Anhänge:
- `accepted_open_payment` muss immer `Nennbestätigung.pdf` anhängen.
- Campaign-Mails dürfen optionale Anhänge erhalten:
  - nur PDF
  - max 3 Dateien
  - max 5 MB pro Datei
  - max 15 MB gesamt

7. Entry-Kontext:
- Prozessmails: Entry-Kontext immer einblenden.
- Campaign-Mails: nur einblenden, wenn Referenzdaten vorhanden und `includeEntryContext=true`.

8. Footer:
- Immer:
  - Eventzeile
  - „Bei Fragen antworte einfach auf diese E-Mail.“
  - Impressum-Link
  - Datenschutz-Link

Lieferobjekte:
- Renderer-Implementierung inkl. tokenisiertem HTML-Layout.
- Aktualisierte OpenAPI-Schemas (Render-Optionen, Prozessmail-Felder, i18n-Felder).
- Template-Contract (`GET /admin/mail/templates`) aktualisiert.
- Tests:
  - Preview/Send parity
  - i18n fallback
  - 3-Tage-Automation `email_confirmation_reminder`
  - Pflichtanhang bei `accepted_open_payment`

Nutze als Design-/HTML-Grundlage:
- `docs/BACKEND_MAIL_HTML_DRAFTS_TRACKLINE_V2.md`
