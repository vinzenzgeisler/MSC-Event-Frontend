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
- Variable: `VITE_PUBLIC_CONTACT_EMAIL`
- Variable: `VITE_PUBLIC_WEBSITE_URL`

### Environment `prod`
- Secret: `VERCEL_TOKEN`
- Secret: `VERCEL_ORG_ID`
- Secret: `VERCEL_PROJECT_ID`
- Variable: `VITE_API_BASE_URL_PROD`
- Variable: `VITE_PUBLIC_CONTACT_EMAIL`
- Variable: `VITE_PUBLIC_WEBSITE_URL`

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
- `VITE_PUBLIC_CONTACT_EMAIL`
  - Öffentliche Kontaktadresse für Nutzertexte im Frontend.
- `VITE_PUBLIC_WEBSITE_URL`
  - Öffentliche Basis-Website des Projekts, die im Frontend angezeigt/verlinkt wird.

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
