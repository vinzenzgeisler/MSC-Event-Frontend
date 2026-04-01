# AI Communication Hub Frontend

Stand: 2026-04-02

## Ziel

Dieses Dokument ermoeglicht einer fremden Person, die Frontend-Seite des `AI Communication Hub` nachzuvollziehen, lokal zu starten und technisch einzuordnen.

Der Hub besteht aus drei review-pflichtigen KI-Assistenzbereichen:

- Mail-Assistent
- Event-Berichte
- Sprecherassistenz

Die UI ist bewusst nicht als offener Chatbot gebaut. KI bleibt Assistenz, nicht Entscheider.

## Relevante Frontend-Dateien

- Shell / Navigation: `src/components/features/admin/ai-communication/ai-communication-shell.tsx`
- Dashboard: `src/pages/admin/ai-communication-hub-page.tsx`
- Mail-Assistent: `src/pages/admin/ai-mail-assistant-page.tsx`
- Berichte: `src/pages/admin/ai-report-generator-page.tsx`
- Sprecherassistenz: `src/pages/admin/ai-speaker-assistant-page.tsx`
- Service-Layer: `src/services/ai-communication.service.ts`
- Verträge / Typen: `src/types/ai-communication.ts`

## Backend-Referenzen

Zum fachlichen und technischen Verstaendnis parallel lesen:

- `C:\Users\VinzenzGeisler\source\MSC-Event-Backend\README.md`
- `C:\Users\VinzenzGeisler\source\MSC-Event-Backend\docs\ai\architecture.md`
- `C:\Users\VinzenzGeisler\source\MSC-Event-Backend\docs\ai\api-draft.md`
- `C:\Users\VinzenzGeisler\source\MSC-Event-Backend\docs\ai\setup-and-deploy.md`
- `C:\Users\VinzenzGeisler\source\MSC-Event-Backend\docs\ai\demo-runbook.md`

## Voraussetzungen

- Node.js 20+
- npm 10+
- laufendes Backend mit vorbereitetem AI-Branch
- Admin- oder Editor-Login

## Frontend lokal starten

```bash
npm install
npm run dev
```

Empfohlene Qualitaetschecks:

```bash
npm run typecheck
npm run build
```

## Benoetigte Frontend-Konfiguration

Mindestens:

- `VITE_API_BASE_URL`
- `VITE_COGNITO_ENABLED`

Je nach Setup:

- `VITE_COGNITO_DOMAIN`
- `VITE_COGNITO_CLIENT_ID`
- `VITE_COGNITO_REDIRECT_URI`
- `VITE_COGNITO_LOGOUT_URI`
- `VITE_COGNITO_SCOPES`

Wichtig:

- Die API-Base-URL muss auf die vorbereitete Backend-Stage zeigen.
- Fuer die Admin-AI-Bereiche braucht der Nutzer `admin` oder `editor`.
- Wenn Login/CORS nicht stimmen, schlagen besonders die Admin-AI-Endpunkte schnell mit `401`, `403` oder `Failed to fetch` fehl.

## Relevante AI-Endpunkte im Frontend

Mail:

- `GET /admin/ai/messages`
- `GET /admin/ai/messages/{id}`
- `POST /admin/ai/messages/{id}/suggest-reply`
- `POST /admin/ai/messages/{id}/chat`
- `POST /admin/ai/messages/{id}/knowledge-suggestions`

Berichte:

- `POST /admin/ai/reports/generate`
- `POST /admin/ai/reports/{draftId}/regenerate-variant`
- `POST /admin/ai/reports/{draftId}/knowledge-suggestions`

Sprecher:

- `POST /admin/ai/speaker/generate`

Persistenz:

- `GET /admin/ai/drafts`
- `GET /admin/ai/drafts/{id}`
- `PATCH /admin/ai/drafts/{id}`
- `GET /admin/ai/knowledge-items`
- `GET /admin/ai/knowledge-items/{id}`
- `PATCH /admin/ai/knowledge-items/{id}`
- `DELETE /admin/ai/knowledge-items/{id}`

## Was im Frontend enthalten ist

### 1. Dashboard

Enthaelt:

- ruhigen Einstieg in die drei Use Cases
- schnelle Orientierung ueber letzte Drafts und Wissensbasis

### 2. Mail-Assistent

Enthaelt:

- Inbox links, geoeffnete Mail rechts
- erkannter Event-/Nennungskontext
- Antwortentwurf mit kompakten Review-/Warn-/Faktenleisten
- Draft laden, bearbeiten und serverseitig aktualisieren
- Wissensreview und Wissensbasis

### 3. Berichtsgenerator

Enthaelt:

- Event-/Klassenfokus
- Varianten `website` und `short_summary`
- transparente `factBlocks`, `usedKnowledge`, `missingData`
- serverseitigen Draft-Flow
- gezielte Varianten-Regenerierung
- Ableitung von Wissensvorschlaegen aus dem Bericht

### 4. Sprecherassistenz

Enthaelt:

- Entry- oder Klassenfokus
- generierten Sprechertext
- sichtbare Review-/Warnhinweise
- Kontextbasis einklappbar statt dauerhaft dominant

## UI-/UX-Leitlinien im aktuellen Frontend

- ruhige Admin-Oberflaeche statt KI-Showcase
- Split-View auf grossen Breiten, Stack auf kleineren Breiten
- grosse Aktionen nur dort, wo sie den Arbeitsfluss tragen
- Copy und Nebenfunktionen kompakt in Toolbars
- Review, Warnungen und Quellenbasis sichtbar, aber nicht flaechig aufdringlich

## Typische Fehlerbilder

- `401/403`:
  Auth oder Rollen passen nicht

- `Failed to fetch`:
  Base-URL, CORS oder lokales Backend-Setup falsch

- `503 AI model not configured`:
  Backend/Bedrock-Konfiguration fehlt

- leere AI-Seiten:
  es fehlen Testdaten wie importierte Mails, vorhandene Entries oder freigegebene Knowledge-Items

## Betriebs-Checkliste

- mindestens eine importierte AI-Mail vorhanden
- mindestens ein freigegebener Wissenseintrag vorhanden
- Event mit Klassen/Entries vorhanden
- Admin- oder Editor-Login funktioniert
- `npm run build` laeuft lokal sauber
