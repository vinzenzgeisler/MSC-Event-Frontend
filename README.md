# MSC Event Frontend

Frontend für öffentliche Anmeldung (`/anmeldung`) und Admin-Verwaltung (`/admin/*`).

## Dokumentation

- Vollständige Projekt-Dokumentation: `docs/PROJECT-DOKUMENTATION.md`
- OpenAPI-Vertrag: `api/openapi.json`

## Stack

- React + Vite + TypeScript
- TailwindCSS + shadcn-style UI components
- React Router
- Lokaler Service-Layer + typed Models (backend-ready, aktuell UI-only)

## Commands

- `npm install`
- `npm run dev`
- `npm run typecheck`
- `npm run build`

## Environment

- `VITE_API_BASE_URL` API-Basis-URL
- `VITE_COGNITO_ENABLED` `true|false`
- `VITE_COGNITO_DOMAIN` z. B. `https://<domain>.auth.<region>.amazoncognito.com`
- `VITE_COGNITO_CLIENT_ID` Cognito App Client ID (ohne Secret)
- `VITE_COGNITO_REDIRECT_URI` OAuth Redirect (typisch `/admin/login`)
- `VITE_COGNITO_LOGOUT_URI` Logout Redirect
- `VITE_COGNITO_SCOPES` typischerweise `openid email profile`
- Runtime-Override optional über `/runtime-config.js` (`window.__MSC_RUNTIME_CONFIG__`, siehe `docs/DEPLOY_ENV.md`)
- `VITE_PUBLIC_VERIFY_RESEND_URL` optionaler Link für CTA „Neue Verifizierungs-Mail anfordern“ auf `/anmeldung/verify`
- `VITE_PUBLIC_CONTACT_EMAIL` Kontaktadresse im öffentlichen Header (nicht aus Event-Settings)
- `VITE_PUBLIC_WEBSITE_URL` Website-Link im öffentlichen Header/Footer (nicht aus Event-Settings)
- `VITE_AUTH_IDLE_TIMEOUT_MINUTES` optional (Default: `43200` = 30 Tage, nur außerhalb Dev aktiv)
- `VITE_AUTH_MAX_SESSION_HOURS` optional (Default: `720` = 30 Tage, nur außerhalb Dev aktiv)
- `VITE_ADMIN_ENABLE_TOKEN_LOGIN` optionaler Dev-Fallback für manuellen JWT-Login
- `VITE_ADMIN_ENABLE_ROLE_PREVIEW` optionaler Dev-Fallback für Rollen-UI-Test ohne Token

## Notes

- API-Verträge liegen in `api/openapi.json` und werden über `src/types/*` + `src/services/*` vorbereitet.
- IAM/Rollen im Frontend: `admin`, `editor`, `viewer` (Legacy-Claim `checkin` wird auf `editor` gemappt).
- Gelöschte Nennungen: im Nennungen-Filter über „Ansicht“ (nur für Admin) mit Wiederherstellen-Action.
