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
- `npm run dev:demo`
- `npm run typecheck`
- `npm run build`

## Environment

- `VITE_API_BASE_URL` API-Basis-URL
- `VITE_COGNITO_ENABLED` `true|false`
- `VITE_COGNITO_DOMAIN` z. B. `https://<cognito-hosted-ui-domain>`
- `VITE_COGNITO_CLIENT_ID` Cognito App Client ID (ohne Secret)
- `VITE_COGNITO_REDIRECT_URI` OAuth Redirect (typisch `/admin/login`)
- `VITE_COGNITO_LOGOUT_URI` Logout Redirect
- `VITE_COGNITO_SCOPES` typischerweise `openid email profile`
- Runtime-Override optional über `/runtime-config.js` (`window.__MSC_RUNTIME_CONFIG__`, siehe `docs/DEPLOY_ENV.md`)
- Runtime-Override optional für `apiBaseUrl` über `/runtime-config.js`
- `VITE_AUTH_IDLE_TIMEOUT_MINUTES` optional (Default: `43200` = 30 Tage, nur außerhalb Dev aktiv)
- `VITE_AUTH_MAX_SESSION_HOURS` optional (Default: `720` = 30 Tage, nur außerhalb Dev aktiv)
- `VITE_ADMIN_ENABLE_TOKEN_LOGIN` optionaler Dev-Fallback für manuellen JWT-Login
- `VITE_ADMIN_ENABLE_ROLE_PREVIEW` optionaler Dev-Fallback für Rollen-UI-Test ohne Token

## Notes

- API-Verträge liegen in `api/openapi.json` und werden über `src/types/*` + `src/services/*` vorbereitet.

## Lokaler Demo-Modus

Die Oberfläche kann ohne AWS, Cognito, API oder lokale Environment-Datei mit realistischen, vollständig fiktiven Beispieldaten gestartet werden:

```bash
npm ci --include=dev
npm run dev:demo
```

Danach sind unter anderem `/anmeldung`, `/admin/dashboard`, `/admin/entries`, `/admin/settings`, `/inspection`, `/admin/marshals`, Kommunikation, Exporte und Signierung direkt erreichbar. Der Demo-Modus meldet automatisch ein lokales Administrationskonto mit allen Rollen an. Ein dauerhaft sichtbarer Hinweis kennzeichnet die lokalen Daten.

Der Modus ist strikt opt-in: Nur `VITE_DEMO_MODE=true` aktiviert ihn; `npm run dev` und reguläre Builds behalten das bisherige API-/Cognito-Verhalten. Alle `requestJson`-Aufrufe werden in der Demo innerhalb des Browsers verarbeitet. Uploads, Drucklisten und Downloads werden lokal simuliert und senden keine Daten ins Netzwerk. Ein nicht implementierter Demo-API-Pfad bricht mit `DEMO_API_ROUTE_UNHANDLED` ab, damit fehlende Abdeckung sichtbar bleibt.

Einschränkungen:

- Änderungen existieren nur im Arbeitsspeicher und werden bei jedem Neuladen der Seite vollständig auf die Ausgangsdaten zurückgesetzt.
- E-Mails, Exporte, Dokumente, Uploads, Drucklisten, Signaturen und IAM-Einladungen werden nur simuliert; es entsteht kein produktives Artefakt und es wird nichts versendet.
- Kartenkacheln stammen weiterhin vom konfigurierten Kartenanbieter. Die Demo-API und direkte Dateiaktionen bleiben jedoch lokal.
- Der Demo-Modus ist für Produkt-Erkundung und UI-Entwicklung gedacht, nicht für Integrations-, Persistenz- oder Sicherheitsprüfungen.

## Feature-Branch Entwicklung

Feature-Branches laufen lokal gegen die gemeinsame Dev-API:

```bash
npm run dev
```

Details und lokale Overrides: `docs/feature-branch-local-dev.md`.
- IAM/Rollen im Frontend: `admin`, `editor`, `viewer` (Legacy-Claim `checkin` wird auf `editor` gemappt).
- Gelöschte Nennungen: im Nennungen-Filter über „Ansicht“ (nur für Admin) mit Wiederherstellen-Action.
