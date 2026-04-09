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

### Environment `prod`
- Secret: `VERCEL_TOKEN`
- Secret: `VERCEL_ORG_ID`
- Secret: `VERCEL_PROJECT_ID`
- Variable: `VITE_API_BASE_URL_PROD`

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

Öffentliche Kontaktadresse und Website werden fest aus dem Frontend ausgeliefert und sind bewusst nicht Teil der CI/CD-Environment-Konfiguration.

## Hinweis zu GitHub Variables vs Secrets
- `VITE_API_BASE_URL_DEV` und `VITE_API_BASE_URL_PROD` werden bewusst nur als Environment `Variables` erwartet.
- Fehlt der Wert in der jeweiligen Stage, bricht der Workflow vor dem Build hart ab.
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
