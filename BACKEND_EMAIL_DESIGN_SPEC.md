# Backend Email Design Spec (Responsive, UI-aligned)

## Ziel
Ein einheitliches, responsives E-Mail-Design, das visuell zum Anmeldeformular passt (Farben, Tonalität, Struktur) und **für Prozess-Mails und Kampagnen-Mails denselben Renderer** nutzt.

## Design-System (aus Frontend abgeleitet)

### Farben
- `--mail-bg`: `#F9FAFB` (App-Background)
- `--mail-card`: `#FFFFFF` (Card)
- `--mail-text`: `#0F1729` (Haupttext)
- `--mail-muted`: `#637288` (Sekundärtext)
- `--mail-border`: `#DDE4EE` (Border)
- `--mail-primary`: `#254CA2` (Header/Primary)
- `--mail-primary-contrast`: `#FFFFFF`
- `--mail-accent`: `#F4C406` (Badge/Highlights)
- `--mail-danger`: `#ED3131` (Fehlerhinweis)

### Typografie
- Sans-Stack: `"IBM Plex Sans", "Segoe UI", Arial, sans-serif`
- Heading-Stack: `"Barlow Condensed", "IBM Plex Sans", "Segoe UI", Arial, sans-serif`
- Fallback: wenn Webfonts geblockt werden, nur Systemfont ohne Layout-Bruch.

### Radius / Spacing
- Card Radius: `12px`
- Button Radius: `10px`
- Outer Padding Desktop: `24px`
- Outer Padding Mobile: `16px`
- Content Width: `max-width: 640px`

## Verbindliche Rendering-Regeln
1. **Ein Renderer für Preview + Send**
   - Preview und tatsächlicher Versand müssen exakt dieselbe Render-Pipeline nutzen.
2. **Backend liefert finales HTML-Dokument**
   - Frontend zeigt `htmlDocument` unverändert (`iframe srcdoc`).
3. **CTA nur bei Verifizierungs-Templates**
   - CTA-Button ausschließlich bei `registration_received` (Prozess) und `email_confirmation` (Kampagne/Quick-Action).
4. **Footer-Links serverseitig bauen**
   - `${baseUrl}/anmeldung/rechtliches/impressum`
   - `${baseUrl}/anmeldung/rechtliches/datenschutz`
5. **Keine Frontend-Dekoration nachträglich**
   - Kein zusätzlicher Footer/CTA im Frontend.
6. **Text + HTML synchron**
   - Für jedes Template `subject`, `bodyText`, `bodyHtml` rendern.
7. **Entry-Kontext block (kompakt, optional)**
   - Kampagnen-Mails dürfen einen kompakten Block "Du bist gemeldet mit ..." enthalten (Klasse/Startnummer/Fahrzeug/Nenngeld), aber nie als dominanten grauen Kasten.
   - Gate: `renderOptions.includeEntryContext` (default je Template) UND `hasEntryContext=true` (nur wenn Entry-Kontext verfügbar ist).
8. **Newsletter = spektakulär**
   - `newsletter` nutzt immer ein Hero-Bild (`heroImageUrl`) plus starken Headline-Block in Vereinsfarben (Blau/Gelb) und optional Highlights/CTA.

## Responsives HTML-Grundlayout (Backend)

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{subject}}</title>
    <style>
      :root {
        color-scheme: light;
      }
      body {
        margin: 0;
        padding: 0;
        background: #f9fafb;
        color: #0f1729;
        font-family: "IBM Plex Sans", "Segoe UI", Arial, sans-serif;
      }
      .wrapper {
        width: 100%;
        background: #f9fafb;
        padding: 24px 12px;
      }
      .container {
        max-width: 640px;
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid #dde4ee;
        border-radius: 12px;
        overflow: hidden;
      }
      .topbar {
        padding: 14px 24px;
        background: #ffffff;
        border-bottom: 1px solid #dde4ee;
      }
      .logo {
        height: 28px;
        width: auto;
        display: block;
      }
      .heroImage {
        width: 100%;
        display: block;
        border: 0;
        margin: 0;
        padding: 0;
      }
      .hero {
        background: #254ca2;
        color: #ffffff;
        padding: 20px 24px;
      }
      .badge {
        display: inline-block;
        background: #f4c406;
        color: #0f1729;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        padding: 4px 10px;
        border-radius: 8px;
      }
      .title {
        margin: 14px 0 0;
        font-family: "Barlow Condensed", "IBM Plex Sans", "Segoe UI", Arial, sans-serif;
        font-size: 34px;
        line-height: 1.1;
        font-weight: 600;
      }
      .subtitle {
        margin: 8px 0 0;
        color: rgba(255, 255, 255, 0.9);
        font-size: 15px;
        line-height: 1.5;
      }
      .content {
        padding: 24px;
      }
      .content p {
        margin: 0 0 14px;
        font-size: 15px;
        line-height: 1.6;
      }
      .card {
        border: 1px solid #dde4ee;
        border-radius: 10px;
        padding: 14px;
        background: #ffffff;
        margin: 16px 0;
      }
      .entryContext {
        border: 1px solid #dde4ee;
        border-left: 6px solid #f4c406;
        border-radius: 10px;
        padding: 12px 14px;
        background: #ffffff;
        margin: 16px 0;
      }
      .entryContextTitle {
        font-size: 12px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        font-weight: 700;
        color: #254ca2;
        margin: 0 0 6px;
      }
      .btn {
        display: inline-block;
        background: #f4c406;
        color: #0f1729 !important;
        text-decoration: none;
        font-weight: 700;
        font-size: 14px;
        line-height: 1;
        padding: 12px 16px;
        border-radius: 10px;
      }
      .muted {
        color: #637288;
        font-size: 13px;
      }
      .footer {
        border-top: 1px solid #dde4ee;
        padding: 16px 24px 20px;
        color: #637288;
        font-size: 12px;
        line-height: 1.5;
      }
      .footer a {
        color: #254ca2;
        text-decoration: underline;
      }
      @media only screen and (max-width: 600px) {
        .wrapper {
          padding: 12px 8px;
        }
        .topbar {
          padding: 12px 16px;
        }
        .hero,
        .content,
        .footer {
          padding: 16px;
        }
        .title {
          font-size: 28px;
        }
        .content p {
          font-size: 16px;
        }
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="topbar">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
            <tr>
              <td align="left" valign="middle">
                {{#logoUrl}}
                <img class="logo" src="{{logoUrl}}" alt="{{eventName}}" />
                {{/logoUrl}}
              </td>
              <td align="right" valign="middle">
                {{#showBadge}}
                <span class="badge">{{mailLabel}}</span>
                {{/showBadge}}
              </td>
            </tr>
          </table>
        </div>

        {{#heroImageUrl}}
        <img class="heroImage" src="{{heroImageUrl}}" alt="" />
        {{/heroImageUrl}}

        <div class="hero">
          <h1 class="title">{{eventName}}</h1>
          <p class="subtitle">{{heroSubtitle}}</p>
        </div>

        <div class="content">
          {{#includeEntryContext}}
          {{#hasEntryContext}}
          <div class="entryContext">
            <div class="entryContextTitle">Du bist gemeldet mit</div>
            <div style="font-size: 14px; line-height: 1.45;">
              Klasse: <strong>{{className}}</strong> · Startnummer: <strong>#{{startNumber}}</strong><br />
              Fahrzeug: <strong>{{vehicleLabel}}</strong>
              {{#amountOpen}}<br />Nenngeld offen: <strong>{{amountOpen}}</strong>{{/amountOpen}}
            </div>
          </div>
          {{/hasEntryContext}}
          {{/includeEntryContext}}

          {{{bodyHtmlRendered}}}

          {{#showVerificationCta}}
          <p style="margin-top: 18px;">
            <a class="btn" href="{{verificationUrl}}" target="_blank" rel="noopener noreferrer">Anmeldung bestätigen</a>
          </p>
          <p class="muted">Falls der Button nicht funktioniert: {{verificationUrl}}</p>
          {{/showVerificationCta}}
        </div>

        <div class="footer">
          <div>{{eventName}} · {{eventDateText}}</div>
          <div style="margin-top: 6px;">Kontakt: <a href="mailto:{{contactEmail}}">{{contactEmail}}</a></div>
          <div style="margin-top: 8px;">
            <a href="{{imprintUrl}}" target="_blank" rel="noopener noreferrer">Impressum</a>
            ·
            <a href="{{privacyUrl}}" target="_blank" rel="noopener noreferrer">Datenschutz</a>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
```

## Prozess-Mail Templates (empfohlene Inhalte)

## `registration_received` (Prozess)
- Betreff: `Anmeldung eingegangen - {{eventName}}`
- Hero-Subtitle: `Bitte bestätige deine E-Mail-Adresse, um die Anmeldung abzuschließen.`
- Body (Textidee):
  - Hallo `{{driverName}}`,
  - deine Anmeldung für `{{eventName}}` ist eingegangen.
  - Bitte bestätige jetzt deine E-Mail-Adresse.
  - Danach prüfen wir deine Nennung und informieren dich über den nächsten Schritt.
- CTA: **Ja** (`showVerificationCta = true`)

## `accepted_open_payment` (Prozess)
- Betreff: `Zulassung bestätigt - {{eventName}}`
- Hero-Subtitle: `Dein Startplatz ist bestätigt.`
- Body (Textidee):
  - Hallo `{{driverName}}`,
  - deine Nennung wurde zugelassen.
  - Klasse: `{{className}}`, Startnummer: `{{startNumber}}`.
  - Offener Betrag: `{{amountOpen}}`.
  - Zahlungsdetails findest du in deinem Teilnehmerbereich / in den Eventinfos.
- CTA: **Nein**

## `payment_reminder` (Prozess)
- Betreff: `Zahlungserinnerung - {{eventName}}`
- Hero-Subtitle: `Offener Betrag für deine Nennung.`
- Body (Textidee):
  - Hallo `{{driverName}}`,
  - für deine Nennung ist noch ein Betrag offen: `{{amountOpen}}`.
  - Bitte überweise den Betrag fristgerecht.
  - Danke für deine Unterstützung einer reibungslosen Organisation.
- CTA: **Nein**

## `rejected` (Prozess)
- Betreff: `Status deiner Nennung - {{eventName}}`
- Hero-Subtitle: `Update zu deiner Anmeldung.`
- Body (Textidee):
  - Hallo `{{driverName}}`,
  - leider können wir deine Nennung aktuell nicht berücksichtigen.
  - Bei Rückfragen melde dich bitte unter `{{contactEmail}}`.
- CTA: **Nein**

## Kampagnen-Templates (Admin-Kommunikation)

## `newsletter` (Kampagne)
- Betreff: `Newsletter - {{eventName}}`
- Hero-Subtitle: `Neuigkeiten rund um das Event.`
- Hero-Image: **Pflicht** (`heroImageUrl`)
- Entry-Kontext: **Default AN** (kompakt), abschaltbar via `renderOptions.includeEntryContext=false`
- Body: redaktioneller Inhalt aus Template-Editor, optional ergänzt durch `highlights` + CTA.

## `event_update` (Kampagne)
- Betreff: `Update zu {{eventName}}`
- Hero-Subtitle: `Wichtige organisatorische Infos.`
- Hero-Image: optional
- Entry-Kontext: **Default AN** (kompakt), abschaltbar via `renderOptions.includeEntryContext=false`
- Body: redaktioneller Inhalt aus Template-Editor.

## `free_form` (Kampagne)
- Betreff: frei editierbar
- Hero-Subtitle: `Mitteilung vom Orga-Team.`
- Body: frei editierbar
- Entry-Kontext: Default AUS (nur wenn explizit aktiviert)

## `email_confirmation` (Kampagne / Quick-Action)
- Betreff: `Bitte E-Mail bestätigen - {{eventName}}`
- Hero-Subtitle: `Kurzer Schritt, damit deine Nennung sicher ist.`
- CTA: **Ja** (Bestätigungslink)
- Entry-Kontext: Default AUS

## `payment_reminder_followup` (Kampagne / Quick-Action)
- Betreff: `Erneute Zahlungsaufforderung - {{eventName}}`
- Hero-Subtitle: `Bitte erledige die Zahlung rechtzeitig.`
- Entry-Kontext: Default AN (kompakt, weil Kontext hilft)

## Platzhalter-Konzept
- Placeholder-Syntax: `{{placeholderName}}`
- Backend liefert pro Template:
  - `placeholders[]` mit `name`, `required`, `description`, `example`
- Preview-Response enthält:
  - `usedPlaceholders[]`, `missingPlaceholders[]`, `unknownPlaceholders[]`, `warnings[]`
- Versand-Policy:
  - Bei `missingPlaceholders.length > 0` optional blockieren (empfohlen: blockieren).

## Qualitätskriterien (Akzeptanz)
1. Preview-HTML und versendetes HTML sind byte-identisch bis auf Tracking-/Message-IDs.
2. Mobile Clients (iOS Mail, Gmail App) zeigen keine Layoutsprünge; Text bleibt gut lesbar.
3. CTA erscheint nur bei `registration_received`.
4. Footer enthält immer Impressum/Datenschutz mit serverseitiger Base-URL.
5. Templates bleiben strikt getrennt:
   - Prozess: Detail-/Quick-Action
   - Kampagne: Kommunikationsseite
6. Plain-Text-Fallback enthält denselben Informationsgehalt wie HTML.

## Backend-Implementierung (kurz)
- Shared render function: `renderMail(templateKey, data, overrides, mode)`.
- Diese Funktion wird von:
  - `POST /admin/mail/templates/preview`
  - tatsächlichem Send-Worker
  genutzt.
- Keine zweite HTML-Build-Logik im Worker.
