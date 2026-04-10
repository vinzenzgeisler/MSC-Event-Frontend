# GitHub Actions + Vercel CI/CD

## Branching
- `dev` deployt automatisch nach Vercel Dev/Preview.
- `main` deployt automatisch nach Vercel Prod.
- Feature-Branches gehen per PR nach `dev`.
- Freigegebene Änderungen gehen per Merge von `dev` nach `main`.

## GitHub Setup
1. Repository -> `Settings` -> `Environments`
2. Environments `dev` und `prod` anlegen
3. Im Environment `prod` unter `Required reviewers` mindestens einen Freigeber eintragen
4. Secrets und Variables jeweils im passenden Environment speichern, nicht global im Repository

Die Workflow-Datei verwendet bereits `environment: dev` und `environment: prod`. Damit stoppt ein Prod-Deploy nach Push auf `main`, bis die Freigabe im `prod`-Environment erteilt wurde.

## Frontend Repo Secrets / Variables
### Environment `dev`
- Secret: `VERCEL_TOKEN`
- Secret: `VERCEL_ORG_ID`
- Secret: `VERCEL_PROJECT_ID`
- Variable: `VITE_API_BASE_URL_DEV`
- Optional Variable: `VITE_COGNITO_ENABLED_DEV`
- Optional Variable: `VITE_COGNITO_DOMAIN_DEV`
- Optional Variable: `VITE_COGNITO_CLIENT_ID_DEV`
- Optional Variable: `VITE_COGNITO_REDIRECT_URI_DEV`
- Optional Variable: `VITE_COGNITO_LOGOUT_URI_DEV`
- Optional Variable: `VITE_COGNITO_SCOPES_DEV`

### Environment `prod`
- Secret: `VERCEL_TOKEN`
- Secret: `VERCEL_ORG_ID`
- Secret: `VERCEL_PROJECT_ID`
- Variable: `VITE_API_BASE_URL_PROD`
- Optional Variable: `VITE_COGNITO_ENABLED_PROD`
- Optional Variable: `VITE_COGNITO_DOMAIN_PROD`
- Optional Variable: `VITE_COGNITO_CLIENT_ID_PROD`
- Optional Variable: `VITE_COGNITO_REDIRECT_URI_PROD`
- Optional Variable: `VITE_COGNITO_LOGOUT_URI_PROD`
- Optional Variable: `VITE_COGNITO_SCOPES_PROD`

## Woher kommen die Werte?
- `VERCEL_TOKEN`
  - In Vercel unter `Settings` -> `Tokens` einen Personal oder Team Token erzeugen.
- `VERCEL_ORG_ID`
  - In Vercel nach `vercel link` in `.vercel/project.json` sichtbar oder über die Projekteinstellungen.
- `VERCEL_PROJECT_ID`
  - Ebenfalls in `.vercel/project.json` oder in den Vercel-Projektdaten.
- `VITE_API_BASE_URL_DEV`
  - Öffentliche Dev-API-URL des Backends, zum Beispiel `https://api-dev.example.tld`.
- `VITE_API_BASE_URL_PROD`
  - Öffentliche Prod-API-URL des Backends, zum Beispiel `https://api.example.tld`.
- `VITE_COGNITO_ENABLED_*`
  - `true`, wenn der Admin-Login über Cognito aktiv sein soll.
- `VITE_COGNITO_DOMAIN_*`
  - Hosted-UI-Basis-URL aus dem Backend/Auth-Stack, zum Beispiel `https://<prefix>.auth.eu-central-1.amazoncognito.com`.
- `VITE_COGNITO_CLIENT_ID_*`
  - Cognito App Client ID aus dem Backend/Auth-Stack.
- `VITE_COGNITO_REDIRECT_URI_*`
  - Muss exakt auf `<frontend-base-url>/admin/login` zeigen.
- `VITE_COGNITO_LOGOUT_URI_*`
  - Ebenfalls `<frontend-base-url>/admin/login`.
- `VITE_COGNITO_SCOPES_*`
  - Optional, Standard ist `openid email profile`.

Öffentliche Kontaktadresse und Website werden fest aus dem Frontend ausgeliefert und sind bewusst nicht Teil der CI/CD-Environment-Konfiguration.

## Hinweis zu GitHub Variables vs Secrets
- `VITE_API_BASE_URL_DEV` und `VITE_API_BASE_URL_PROD` werden bewusst nur als Environment `Variables` erwartet.
- Fehlt der Wert in der jeweiligen Stage, bricht der Workflow vor dem Build hart ab.
- Wenn `VITE_COGNITO_ENABLED_*` auf `true` gesetzt ist, validiert der Workflow auch Domain, Client ID und Redirect-/Logout-URI.
- Die eigentliche Vercel-Produktion wird im Schritt `vercel build` gebaut. Deshalb muss die API-URL dort verfügbar sein, nicht nur im vorherigen `npm run build`.

## Verhalten
- PRs gegen `dev` oder `main` laufen Typecheck + Build.
- Push auf `dev` baut und deployed per Vercel CLI als Preview/Dev.
- Push auf `main` baut und deployed per Vercel CLI als Production.

## Vercel Auto-Deploy deaktivieren
- In Vercel das betroffene Projekt öffnen.
- `Settings` -> `Git` öffnen.
- `Production Deployment` bzw. Git-Deploy-Verhalten prüfen.
- Automatische Deploys für Pushes auf `main` deaktivieren oder die Git-Integration ganz trennen, wenn GitHub Actions der führende Deploy-Weg sein soll.
- Wichtig: Am Ende darf nur ein Mechanismus Prod deployen, sonst bekommst du doppelte oder uneinheitliche Releases.

## Empfehlung
- GitHub Actions als führenden Deploy-Weg verwenden.
- `prod` immer mit Required Reviewer absichern.
- Branch Protection für `main` aktivieren: kein Direkt-Push, nur Merge via PR.
