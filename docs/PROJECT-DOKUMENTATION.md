# MSC Event Frontend – Projekt-Dokumentation

## 1) Ziel des Projekts

Dieses Frontend bildet zwei klar getrennte Bereiche ab:

- Öffentliche Fahrer-Anmeldung unter `/anmeldung`
- Admin-Verwaltung unter `/admin/*`

Aktuell ist die Anwendung bewusst **UI-first / backend-ready** umgesetzt:

- Keine produktiven API-Calls
- Voll typisierte Models und Service-Layer als Integrationsschnittstelle
- Mock-Daten als temporäre Datenquelle

## 2) Technologie-Stack

- React + Vite + TypeScript
- React Router
- TailwindCSS + shadcn-style UI-Komponenten
- Lokaler Service-Layer in `src/services/*`
- Typen/DTOs in `src/types/*`

## 3) Start & Build

- Installation: `npm install`
- Dev-Server: `npm run dev`
- Typecheck: `npm run typecheck`
- Build: `npm run build`

## 4) Projektstruktur

Wichtige Verzeichnisse:

- `src/app/*`
  - App-Router, Layouts, Auth-Kontext, i18n-Kontext für Anmeldung
- `src/pages/*`
  - Seiten pro Route (`public` und `admin`)
- `src/components/*`
  - UI-Bausteine und Feature-Komponenten
- `src/services/*`
  - UI-Service-Layer (derzeit mockbasiert)
- `src/types/*`
  - Domänenmodelle und API-nahe DTOs
- `src/mock/*`
  - Zentrale Mock-Daten
- `api/openapi.json`
  - Backend-Vertrag (OpenAPI)

## 5) Routing-Übersicht

Öffentlich:

- `/` – Landing/Home
- `/anmeldung` – Multi-Step-Wizard
- `/anmeldung/rechtliches/:docId` – Rechtliche Platzhalterseiten

Admin:

- `/admin/login` – Login mit Dummy/Bearer-Flow
- `/admin/dashboard`
- `/admin/entries`
- `/admin/entries/:entryId`
- `/admin/communication`
- `/admin/exports`
- `/admin/settings`

## 6) Öffentliche Anmeldung (`/anmeldung`)

### 6.1 Wizard-Schritte

1. Fahrer
2. Startmeldungen (mehrere pro Fahrer)
3. Zusammenfassung + Einwilligungen

### 6.2 Validierung

Fahrer:

- Pflichtfelder inkl. Adresse
- E-Mail- und Telefonnummer-Validierung
- Telefonnummern international und lokal unterstützt (z. B. `0152...`, `+420...`, `0049...`)

Startmeldungen:

- Feldvalidierung direkt an jedem Feld (inline)
- Startnummer-Format + Verfügbarkeitsprüfung (UI/Mock)
- Erfolgsindikator (grüner Haken) bei freier Startnummer
- Unterstützung für Zylinderangaben wie `4` oder `V8`
- Optionaler Beifahrer und optionales Ersatzfahrzeug

### 6.3 Draft-Persistenz

Anmeldedaten werden lokal gespeichert (`localStorage`), damit Eingaben beim Wechsel auf rechtliche Seiten oder nach Reload nicht verloren gehen.

### 6.4 Internationalisierung (Anmeldung)

Unterstützte Sprachen:

- `DE`
- `EN`
- `CZ`

Die Sprachwahl gilt für den kompletten Anmeldebereich (Header, Formulare, Hinweise, Legal-Seiten, Footer).

## 7) Admin-Bereich (`/admin`)

### 7.1 Layout

- Linke Sidebar (stabil positioniert)
- Content-Bereich mit CMS-artigem Tabellen-/Card-Layout

### 7.2 Nennungen-Liste

- Tabellenansicht mit Filterleiste
- Status-/Zahlungs-/Check-in-Badges
- Quick Actions je Eintrag
- Filterzustand bleibt über URL-Query-Parameter erhalten

### 7.3 Nennungs-Detail

- Fahrerdaten, Fahrzeugdaten, Zahlung, Dokumente, Historie
- Quick Actions (Status, Mail, Zahlung, Dokumente, Löschen UI-only)
- Bestätigungsdialoge für kritische Aktionen
- Notizbereich (intern + fahrersichtbar)

## 8) Service-Layer & Typisierung

Service-Layer:

- `src/services/registration.service.ts`
- `src/services/admin-entries.service.ts`
- weitere Admin-Services (Communication/Exports)

Typen:

- `src/types/registration.ts`
- `src/types/admin.ts`
- `src/types/common.ts`

Hinweis:

- Die Services sind so aufgebaut, dass später API-Calls mit minimalem Umbau eingehängt werden können.
- UI-Komponenten konsumieren ViewModels statt roher API-Strukturen.

## 9) Mock-Daten

Zentrale Mock-Quellen liegen in `src/mock/*`, u. a.:

- `src/mock/registration.mock.ts`
- `src/mock/admin-entries.mock.ts`

Das erleichtert den späteren Wechsel auf echte Backend-Datenquellen.

## 10) Rechtliches

Rechtliche Seiten sind als Platzhalter umgesetzt:

- Impressum
- Datenschutz
- Haftungshinweise

Die finalen Texte sollen vor Go-Live juristisch abgestimmt ergänzt werden.

## 11) OpenAPI-Integration (später)

Der Vertrag liegt unter:

- `api/openapi.json`

Aktuell:

- Keine Live-Backend-Anbindung
- Kein Orval/Rodney-Lauf im Frontend-Flow

Empfohlener nächster Schritt:

- DTO-Abgleich gegen OpenAPI finalisieren
- Service-Layer schrittweise von Mock auf echte Endpunkte umstellen
- Fehlerfälle/Loading pro Endpoint vollständig anbinden

## 12) Qualitätsstatus

Aktuelle Qualitätssicherung:

- TypeScript-Checks via `npm run typecheck`
- Konsistente Component-Aufteilung nach Public/Admin
- Responsive Fokus für Anmeldung (mobile-first) und Admin (desktop-first, tablet-safe)
