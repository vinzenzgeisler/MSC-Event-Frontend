# GitHub Actions + Vercel CI/CD

## Branching

- Normale Commits und Pull Requests starten keine GitHub Actions.
- `dev` oder ein Feature-Branch kann bei Bedarf über einen `deploy-dev/**`-Git-Tag oder manuell nach Vercel Dev/Preview deployt werden.
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
- Variable: `VITE_COGNITO_DOMAIN_DEV`
- Variable: `VITE_COGNITO_CLIENT_ID_DEV`
- Variable: `VITE_COGNITO_REDIRECT_URI_DEV`
- Variable: `VITE_COGNITO_LOGOUT_URI_DEV`
- Optional Variable: `VITE_COGNITO_SCOPES_DEV`
- Optional Variable: `VITE_COGNITO_SCOPES_DEV`

### Environment `prod`

- Secret: `VERCEL_TOKEN`
- Secret: `VERCEL_ORG_ID`
- Secret: `VERCEL_PROJECT_ID`
- Variable: `VITE_API_BASE_URL_PROD`
- Variable: `VITE_COGNITO_DOMAIN_PROD`
- Variable: `VITE_COGNITO_CLIENT_ID_PROD`
- Variable: `VITE_COGNITO_REDIRECT_URI_PROD`
- Variable: `VITE_COGNITO_LOGOUT_URI_PROD`
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
- `VITE_COGNITO_DOMAIN_*`
  - Hosted-UI-Basis-URL aus dem Backend/Auth-Stack, zum Beispiel `https://<cognito-hosted-ui-domain>`.
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
- Für den Admin-Login werden Cognito Domain, Client ID und Redirect-/Logout-URI in jeder Stage verpflichtend erwartet.
- Die eigentliche Vercel-Produktion wird im Schritt `vercel build` gebaut. Deshalb muss die API-URL dort verfügbar sein, nicht nur im vorherigen `npm run build`.

## Verhalten

- Feature-/Dev-Commits und Pull Requests lösen keine Pipeline aus.
- Ein Git-Tag mit Präfix `deploy-dev/` baut und deployt den markierten Commit per Vercel CLI als Preview/Dev.
- Ein manueller `workflow_dispatch` deployt den ausgewählten Branch als Preview/Dev oder löscht alle Preview-Deployments des Projekts.
- Push auf `main` baut zunächst ein gestagtes Production-Deployment ohne Domain-Umschaltung, promotet anschließend exakt diese Deployment-URL auf `current` und prüft, dass keine Promotion offen bleibt.

## Vercel Auto-Deploy deaktivieren

- `vercel.json` setzt `git.deploymentEnabled` auf `false`.
- Dadurch erzeugt die Vercel-Git-Integration keine Deployments; GitHub Actions bleibt der einzige Deploy-Weg.
- Wichtig: Am Ende darf nur ein Mechanismus Prod deployen, sonst bekommst du doppelte oder uneinheitliche Releases.

## Empfehlung

- GitHub Actions als führenden Deploy-Weg verwenden.
- `prod` immer mit Required Reviewer absichern.
- Branch Protection für `main` aktivieren: kein Direkt-Push, nur Merge via PR.
