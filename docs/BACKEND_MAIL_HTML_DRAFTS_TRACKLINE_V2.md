# Backend Mail HTML Drafts (Trackline v2)

Hinweis:
- Alle Entwürfe sind table-basiert und Outlook-sicher.
- CSS ist inline gehalten.
- Links/Platzhalter sind als `{{...}}` markiert.
- Diese Entwürfe sind 1:1 als Renderziel gedacht.

## 1) Campaign `newsletter`
```html
<!doctype html>
<html lang="{{locale}}">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px;max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(90deg,#172554 0%,#1e3a8a 55%,#1e40af 100%);padding:22px 26px;color:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.9;">MSC Oberlausitzer Dreiländereck</td>
                    <td align="right" style="font-size:12px;opacity:.9;">{{eventDate}}</td>
                  </tr>
                </table>
                <div style="margin-top:10px;font-size:28px;line-height:1.15;font-weight:700;">{{eventName}}</div>
                <div style="margin-top:8px;height:4px;width:86px;background:#7dd3fc;border-radius:999px;"></div>
                <div style="margin-top:10px;font-size:14px;line-height:1.55;opacity:.95;">{{preheader}}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 26px;font-size:15px;line-height:1.72;">
                <p style="margin:0 0 14px;">Hallo {{driverName}},</p>
                <p style="margin:0 0 14px;">{{introText}}</p>
                {{#if includeEntryContext}}
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 14px;border:1px solid #bae6fd;background:#f0f9ff;border-radius:10px;">
                  <tr>
                    <td style="padding:10px 12px;">
                      <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:#0369a1;">Deine Anmeldung</div>
                      <div style="margin-top:4px;font-size:14px;color:#0f172a;">{{entryContextLine}}</div>
                    </td>
                  </tr>
                </table>
                {{/if}}
                <p style="margin:0 0 14px;">{{detailsText}}</p>
                {{#if highlights}}
                <p style="margin:0 0 6px;font-weight:700;">Highlights</p>
                <ul style="margin:0 0 14px 18px;padding:0;">
                  {{#each highlights}}<li style="margin:0 0 6px;">{{this}}</li>{{/each}}
                </ul>
                {{/if}}
                <p style="margin:0 0 18px;">{{closingText}}</p>
                <a href="{{ctaUrl}}" style="display:inline-block;background:#facc15;color:#0f172a;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:700;">{{ctaText}}</a>
                <p style="margin:18px 0 0;color:#475569;">Mit freundlichen Grüßen<br>Euer MSC Oberlausitzer Dreiländereck e. V.</p>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e2e8f0;background:#f8fafc;padding:14px 26px;font-size:12px;line-height:1.5;color:#64748b;">
                <div>{{eventName}} · {{eventDate}}</div>
                <div>Bei Fragen antworte einfach auf diese E-Mail.</div>
                <div><a href="{{impressumUrl}}" style="color:#1d4ed8;">Impressum</a> · <a href="{{privacyUrl}}" style="color:#1d4ed8;">Datenschutz</a></div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## 2) Campaign `event_update`
```html
<!doctype html>
<html lang="{{locale}}">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px;max-width:640px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <tr><td style="background:linear-gradient(90deg,#172554,#1e3a8a,#1e40af);padding:22px 26px;color:#fff;">
            <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.9;">MSC Oberlausitzer Dreiländereck</div>
            <div style="margin-top:10px;font-size:28px;font-weight:700;">{{eventName}}</div>
            <div style="margin-top:8px;height:4px;width:86px;background:#93c5fd;border-radius:999px;"></div>
            <div style="margin-top:10px;font-size:14px;line-height:1.55;">{{preheader}}</div>
          </td></tr>
          <tr><td style="padding:24px 26px;font-size:15px;line-height:1.72;">
            <p style="margin:0 0 14px;">Hallo {{driverName}},</p>
            <p style="margin:0 0 14px;">{{introText}}</p>
            {{#if includeEntryContext}}<p style="margin:0 0 14px;padding:10px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;"><strong style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#1d4ed8;">Deine Anmeldung</strong><br>{{entryContextLine}}</p>{{/if}}
            <p style="margin:0 0 14px;">{{detailsText}}</p>
            <a href="{{ctaUrl}}" style="display:inline-block;background:#facc15;color:#0f172a;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:700;">{{ctaText}}</a>
            <p style="margin:18px 0 0;color:#475569;">Mit freundlichen Grüßen<br>Euer MSC Oberlausitzer Dreiländereck e. V.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

## 3) Campaign `free_form`
```html
<!doctype html>
<html lang="{{locale}}">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px;max-width:640px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <tr><td style="background:linear-gradient(90deg,#172554,#1e3a8a,#1e40af);padding:22px 26px;color:#fff;">
            <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.9;">MSC Oberlausitzer Dreiländereck</div>
            <div style="margin-top:10px;font-size:28px;font-weight:700;">{{eventName}}</div>
            <div style="margin-top:8px;height:4px;width:86px;background:#a5b4fc;border-radius:999px;"></div>
            <div style="margin-top:10px;font-size:14px;line-height:1.55;">{{preheader}}</div>
          </td></tr>
          <tr><td style="padding:24px 26px;font-size:15px;line-height:1.72;">
            <p style="margin:0 0 14px;">Hallo {{driverName}},</p>
            <p style="margin:0 0 14px;">{{introText}}</p>
            <p style="margin:0 0 14px;">{{detailsText}}</p>
            {{#if ctaUrl}}<a href="{{ctaUrl}}" style="display:inline-block;background:#facc15;color:#0f172a;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:700;">{{ctaText}}</a>{{/if}}
            <p style="margin:18px 0 0;color:#475569;">Mit freundlichen Grüßen<br>Euer MSC Oberlausitzer Dreiländereck e. V.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

## 4) Campaign `payment_reminder_followup`
```html
<!doctype html>
<html lang="{{locale}}">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px;max-width:640px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <tr><td style="background:linear-gradient(90deg,#172554,#1e3a8a,#1e40af);padding:22px 26px;color:#fff;">
            <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.9;">MSC Oberlausitzer Dreiländereck</div>
            <div style="margin-top:10px;font-size:28px;font-weight:700;">{{eventName}}</div>
            <div style="margin-top:8px;height:4px;width:86px;background:#fcd34d;border-radius:999px;"></div>
            <div style="margin-top:10px;font-size:14px;line-height:1.55;">{{preheader}}</div>
          </td></tr>
          <tr><td style="padding:24px 26px;font-size:15px;line-height:1.72;">
            <p style="margin:0 0 14px;">Hallo {{driverName}},</p>
            <p style="margin:0 0 14px;">{{introText}}</p>
            {{#if includeEntryContext}}<p style="margin:0 0 14px;padding:10px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;"><strong style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#b45309;">Deine Anmeldung</strong><br>{{entryContextLine}}</p>{{/if}}
            <p style="margin:0 0 14px;">{{detailsText}}</p>
            <p style="margin:0 0 16px;font-weight:700;color:#b45309;">Bitte überweise den offenen Betrag bis {{paymentDeadline}}.</p>
            <a href="{{ctaUrl}}" style="display:inline-block;background:#facc15;color:#0f172a;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:700;">Zahlungsinformationen öffnen</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

## 5) Prozess `registration_received`
```html
<!doctype html>
<html lang="{{locale}}">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px;max-width:640px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <tr><td style="background:linear-gradient(90deg,#172554,#1e3a8a,#1e40af);padding:22px 26px;color:#fff;">
            <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.9;">MSC Oberlausitzer Dreiländereck</div>
            <div style="margin-top:10px;font-size:28px;font-weight:700;">{{eventName}}</div>
            <div style="margin-top:8px;height:4px;width:86px;background:#7dd3fc;border-radius:999px;"></div>
            <div style="margin-top:10px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;">{{headerTitle}}</div>
          </td></tr>
          <tr><td style="padding:24px 26px;font-size:15px;line-height:1.72;">
            <p style="margin:0 0 14px;padding:10px 12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;"><strong style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#0369a1;">Deine Anmeldung</strong><br>{{entryContextLine}}</p>
            <p style="margin:0 0 14px;">{{bodyText}}</p>
            <a href="{{verificationUrl}}" style="display:inline-block;background:#facc15;color:#0f172a;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:700;">E-Mail-Adresse bestätigen</a>
            <p style="margin:10px 0 0;font-size:12px;color:#64748b;">Falls der Button nicht funktioniert: <a href="{{verificationUrl}}" style="color:#1d4ed8;">{{verificationUrl}}</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

## 6) Prozess `email_confirmation_reminder` (3 Tage Folgeversand)
```html
<!doctype html>
<html lang="{{locale}}">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px;max-width:640px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <tr><td style="background:linear-gradient(90deg,#172554,#1e3a8a,#1e40af);padding:22px 26px;color:#fff;">
            <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.9;">MSC Oberlausitzer Dreiländereck</div>
            <div style="margin-top:10px;font-size:28px;font-weight:700;">{{eventName}}</div>
            <div style="margin-top:8px;height:4px;width:86px;background:#67e8f9;border-radius:999px;"></div>
            <div style="margin-top:10px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;">{{headerTitle}}</div>
          </td></tr>
          <tr><td style="padding:24px 26px;font-size:15px;line-height:1.72;">
            <p style="margin:0 0 14px;padding:10px 12px;background:#ecfeff;border:1px solid #a5f3fc;border-radius:10px;"><strong style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#0891b2;">Deine Anmeldung</strong><br>{{entryContextLine}}</p>
            <p style="margin:0 0 14px;">{{bodyText}}</p>
            <a href="{{verificationUrl}}" style="display:inline-block;background:#facc15;color:#0f172a;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:700;">{{ctaText}}</a>
            <p style="margin:10px 0 0;font-size:12px;color:#64748b;">Falls der Button nicht funktioniert: <a href="{{verificationUrl}}" style="color:#1d4ed8;">{{verificationUrl}}</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

## 7) Prozess `preselection`
```html
<!doctype html>
<html lang="{{locale}}">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px;max-width:640px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <tr><td style="background:linear-gradient(90deg,#172554,#1e3a8a,#1e40af);padding:22px 26px;color:#fff;">
            <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.9;">MSC Oberlausitzer Dreiländereck</div>
            <div style="margin-top:10px;font-size:28px;font-weight:700;">{{eventName}}</div>
            <div style="margin-top:8px;height:4px;width:86px;background:#93c5fd;border-radius:999px;"></div>
            <div style="margin-top:10px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;">{{headerTitle}}</div>
          </td></tr>
          <tr><td style="padding:24px 26px;font-size:15px;line-height:1.72;">
            <p style="margin:0 0 14px;padding:10px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;"><strong style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#1d4ed8;">Deine Anmeldung</strong><br>{{entryContextLine}}</p>
            <p style="margin:0;">{{bodyText}}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

## 8) Prozess `accepted_open_payment` (mit Pflichtanhang)
```html
<!doctype html>
<html lang="{{locale}}">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px;max-width:640px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <tr><td style="background:linear-gradient(90deg,#172554,#1e3a8a,#1e40af);padding:22px 26px;color:#fff;">
            <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.9;">MSC Oberlausitzer Dreiländereck</div>
            <div style="margin-top:10px;font-size:28px;font-weight:700;">{{eventName}}</div>
            <div style="margin-top:8px;height:4px;width:86px;background:#fcd34d;border-radius:999px;"></div>
            <div style="margin-top:10px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;">{{headerTitle}}</div>
          </td></tr>
          <tr><td style="padding:24px 26px;font-size:15px;line-height:1.72;">
            <p style="margin:0 0 14px;padding:10px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;"><strong style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#b45309;">Deine Anmeldung</strong><br>{{entryContextLine}}</p>
            <p style="margin:0 0 14px;">{{bodyText}}</p>
            <p style="margin:0 0 14px;font-size:13px;color:#92400e;"><strong>Anhang:</strong> Nennbestätigung.pdf (Pflicht)</p>
            <a href="{{ctaUrl}}" style="display:inline-block;background:#facc15;color:#0f172a;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:700;">Zahlungsinformationen öffnen</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

## 9) Prozess `accepted_paid_completed`
```html
<!doctype html>
<html lang="{{locale}}">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px;max-width:640px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <tr><td style="background:linear-gradient(90deg,#172554,#1e3a8a,#1e40af);padding:22px 26px;color:#fff;">
            <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.9;">MSC Oberlausitzer Dreiländereck</div>
            <div style="margin-top:10px;font-size:28px;font-weight:700;">{{eventName}}</div>
            <div style="margin-top:8px;height:4px;width:86px;background:#86efac;border-radius:999px;"></div>
            <div style="margin-top:10px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;">{{headerTitle}}</div>
          </td></tr>
          <tr><td style="padding:24px 26px;font-size:15px;line-height:1.72;">
            <p style="margin:0 0 14px;padding:10px 12px;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;"><strong style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#15803d;">Deine Anmeldung</strong><br>{{entryContextLine}}</p>
            <p style="margin:0;">{{bodyText}}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

## 10) Prozess `rejected`
```html
<!doctype html>
<html lang="{{locale}}">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px;max-width:640px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <tr><td style="background:linear-gradient(90deg,#172554,#1e3a8a,#1e40af);padding:22px 26px;color:#fff;">
            <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.9;">MSC Oberlausitzer Dreiländereck</div>
            <div style="margin-top:10px;font-size:28px;font-weight:700;">{{eventName}}</div>
            <div style="margin-top:8px;height:4px;width:86px;background:#fda4af;border-radius:999px;"></div>
            <div style="margin-top:10px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;">{{headerTitle}}</div>
          </td></tr>
          <tr><td style="padding:24px 26px;font-size:15px;line-height:1.72;">
            <p style="margin:0 0 14px;padding:10px 12px;background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;"><strong style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#be123c;">Deine Anmeldung</strong><br>{{entryContextLine}}</p>
            <p style="margin:0 0 14px;">{{bodyText}}</p>
            {{#if driverNote}}<p style="margin:0;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;"><strong>Hinweis vom Orga-Team:</strong><br>{{driverNote}}</p>{{/if}}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

## Ergänzende Backend-Regeln
- `email_confirmation_reminder` automatisch nach 3 Tagen erneut senden.
- `accepted_open_payment` immer mit `Nennbestätigung.pdf`.
- `preview == send` identischer Renderer.
- Sprache: `de`, `cs`, `pl`, `en`; alle anderen `en`.
