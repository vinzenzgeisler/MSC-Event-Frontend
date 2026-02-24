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
- `VITE_PUBLIC_EVENT_ID` optional feste Event-ID (überschreibt `/events/current`)
- `VITE_PUBLIC_PRICE_EARLY_EUR` optionaler Frühphasen-Preis für Header/Anmeldung (z. B. `180`)
- `VITE_PUBLIC_PRICE_LATE_EUR` optionaler Spätphasen-Preis für Header/Anmeldung (z. B. `220`)
- `VITE_PUBLIC_PRICE_PHASE_SWITCH_AT` optionales ISO-Datum für Wechsel Früh- auf Spätphase
- `VITE_PUBLIC_PRICE_SECOND_VEHICLE_EUR` optionaler Preis für zweites Fahrzeug (Anzeige in Anmeldung)
- `VITE_COGNITO_ENABLED` `true|false`
- `VITE_COGNITO_DOMAIN` z. B. `https://<domain>.auth.<region>.amazoncognito.com`
- `VITE_COGNITO_CLIENT_ID` Cognito App Client ID (ohne Secret)
- `VITE_COGNITO_REDIRECT_URI` OAuth Redirect (typisch `/admin/login`)
- `VITE_COGNITO_LOGOUT_URI` Logout Redirect
- `VITE_COGNITO_SCOPES` typischerweise `openid email profile`
- `VITE_PUBLIC_VERIFY_RESEND_URL` optionaler Link für CTA „Neue Verifizierungs-Mail anfordern“ auf `/anmeldung/verify`
- `VITE_AUTH_IDLE_TIMEOUT_MINUTES` optional (Default: `45`, nur außerhalb Dev aktiv)
- `VITE_AUTH_MAX_SESSION_HOURS` optional (Default: `12`, nur außerhalb Dev aktiv)
- `VITE_AUTH_REQUIRE_ADMIN_MFA` optional `true|false` (Default: `false`, nur außerhalb Dev ausgewertet)
- `VITE_ADMIN_ENABLE_TOKEN_LOGIN` optionaler Dev-Fallback für manuellen JWT-Login
- `VITE_ADMIN_ENABLE_ROLE_PREVIEW` optionaler Dev-Fallback für Rollen-UI-Test ohne Token

## Notes

- API-Verträge liegen in `api/openapi.json` und werden über `src/types/*` + `src/services/*` vorbereitet.
- Mock-/UI-Only Daten liegen zentral unter `src/mock/*`.
- IAM/Rollen im Frontend: `admin`, `editor`, `viewer` (Legacy-Claim `checkin` wird auf `editor` gemappt).
