<!-- Nur die Architektur (racepic-architecture.md) wird 1:1 in allen 3 Repos synchron gehalten. Diese Fortschrittsdatei ist repo-spezifisch und listet nur die Arbeitspakete, die in MSC-Event-Frontend passieren. -->
# RacePic – Fortschritt (MSC-Event-Frontend)

**Stand:** 2026-09-22 · Architektur: [racepic-architecture.md](./racepic-architecture.md)

## Arbeitspakete in diesem Repo

| # | Paket | Status | Notiz |
|---|---|---|---|
| 5 | Admin-Basis `/admin/racepic`: Event-Settings, Fotografen einladen, Statistik | **erledigt** | siehe „Paket 5 – Ergebnis" unten |
| 7 | Review-Queue: BBox-Overlay, Fahreransicht zur Korrektur | **erledigt (Basisversion)** | siehe „Paket 7 – Ergebnis" unten; Tastaturbedienung/Soft-Lock/Qualitätsreport zurückgestellt |
| 10c | Pilot 12. OLD 2026 (Admin-Teil): Fotografen einladen, Review-Durchlauf | offen | |
| 11 | Fehlende Admin-Bedienelemente für bereits im Backend fertige Funktionen | **erledigt** | siehe „Paket 11 – Ergebnis" unten |

## Paket 5 – Ergebnis (2026-09-21)

- `src/app/auth/iam.ts`: neue Rolle `racepic_moderator` (Cognito-Gruppenname muss mit dem Backend übereinstimmen, siehe `MSC-Event-Backend/infra/lib/stacks/auth-stack.ts`), Permissions `racepic.read`/`racepic.review`/`racepic.manage`; `admin` bekommt alle drei.
- `src/services/admin-racepic.service.ts`, `src/types/admin-racepic.ts` (neu): API-Client für die Backend-Endpunkte aus Paket 5 (`GET/PUT /admin/racepic/events`, `GET .../stats`, `GET/POST /admin/racepic/photographers`, `GET /admin/racepic/licenses`).
- `src/pages/admin/racepic-page.tsx` (neu): Event-Tabelle mit aufklappbarer Konfiguration (Slug, Titel, Upload-Fenster, aktiviert/veröffentlicht, Standard-Lizenz) + Live-Statistik; Fotografen-Tabelle mit Einladungsformular (E-Mail, Anzeigename, Mehrfachauswahl der Events). Bewusst mit einfachen `<table>`-Elementen statt einer Tabellen-Komponente, da dieses Repo kein UI-Kit mit Table/Dialog/Tabs hat (nur `button`/`input`/`label`/`select`/`card`/`badge`).
- `src/components/navigation/admin-nav.tsx`, `src/app/router.tsx`: neuer Menüpunkt/Route `/admin/racepic`, Zugriff für `admin` und `racepic_moderator`.
- **Backend-Ergänzung (im MSC-Event-Backend-Repo, nicht hier):** Die Endpunkte `GET/PUT /admin/racepic/events`, `GET .../stats` und `GET /admin/racepic/licenses` gab es vor Paket 5 noch nicht (Abschnitt H des Architekturplans hatte sie nur vorgesehen) – wurden dort ergänzt, siehe `MSC-Event-Backend/docs/memory-bank/racepic-progress.md`.
- **Verifiziert:** `npm run typecheck` und `npm run build` beide fehlerfrei (neue Seite erscheint als eigener Lazy-Chunk `racepic-page-*.js`, 9.65 kB).

## Paket 7 – Ergebnis (2026-09-21)

- `src/pages/admin/racepic-review-page.tsx` (neu), Route `/admin/racepic/review/:eventId`, verlinkt aus der Event-Tabelle in `racepic-page.tsx`: Karten-Ansicht der offenen Zuordnungen mit Bild + roter BBox-Overlay (per-Prozent positioniertes `div` über dem Vorschaubild), KI-Vorschlag mit Konfidenz, Buttons für alternative Kandidaten, "Bestätigen"/"Keine Zuordnung", sowie eine Live-Suche (Name/Startnummer/Fahrzeug) zum Hinzufügen eines weiteren oder abweichenden Fahrers.
- `src/services/admin-racepic.service.ts`, `src/types/admin-racepic.ts`: Client für die neuen Backend-Endpunkte (Review-Queue, Entry-Suche, confirm/reject/correct/add).
- **Backend-Ergänzung (im MSC-Event-Backend-Repo, nicht hier):** Sämtliche Review-Endpunkte (`GET .../review-queue`, `.../entries/search`, `POST .../assignments/{id}/{confirm,reject,correct}`, `POST .../images/{id}/assignments`, `GET .../participants/{id}/images`) gab es vor Paket 7 noch nicht – wurden dort ergänzt, siehe `MSC-Event-Backend/docs/memory-bank/racepic-progress.md`.
- **Bewusst zurückgestellt** (siehe Architekturplan Abschnitt H, dort als Teil von Paket 7 genannt): Tastaturbedienung, Soft-Lock pro Item (zwei Reviewer könnten theoretisch gleichzeitig dasselbe Bild bearbeiten – bei einem kleinen Orga-Team ein akzeptables MVP-Risiko), Qualitätsreport (Precision/Recall) – letzterer ergibt ohne echte Review-Daten aus dem Piloten (Paket 10) noch keinen Sinn.
- **Verifiziert:** `npm run typecheck` und `npm run build` beide fehlerfrei.

## Entscheidungen aus diesem Repo

- 2026-09-21: Admin-Review-Oberfläche bleibt im Nennungstool-Frontend (`/admin/racepic`), nicht in der Website, da sie am bestehenden Admin-Auth/Permission-System (`iam.ts`, `guards.tsx`) andockt.

## Paket 11 – Ergebnis (2026-09-22)

Bei einer Prüfung des Gesamtstands über alle drei Repos wurde festgestellt, dass vier bereits
in MSC-Event-Backend fertige Endpunkte hier keine UI hatten (Bild-Sichtbarkeit, Teilnehmer
ausblenden, Matching-Config, Rematch/Qualitätsreport) – der in `docs/racepic/runbook.md`
(MSC-Event-Backend) beschriebene Kalibrierungs-Workflow für den Piloten setzte drei davon als
Admin-Bedienschritte voraus, die ohne UI nur per rohem API-Aufruf erreichbar waren. Auf
Rückfrage vom Verein priorisiert und umgesetzt:

- `src/pages/admin/racepic-page.tsx`: neue `ImagesSection` je Event (Sichtbarkeitsfilter,
  Vorschaubild, Fotograf, Status, Sichtbarkeits-Badge, Aktions-Buttons Veröffentlichen/
  Verbergen/Entfernen je nach aktuellem Zustand, Entfernen mit Bestätigungsdialog, Offset-
  Pagination) und `MatchingSection` (aktive event-spezifische Config anzeigen, Formular für
  `autoThreshold`/`reviewThreshold`/`minMargin` – Gewichte bewusst nicht per UI editierbar,
  siehe Code-Kommentar –, „Re-Match auslösen"-Button, Qualitätsreport-Tabelle).
- `src/pages/admin/racepic-review-page.tsx`: neue `HideParticipantSection` oben auf der Seite
  (Entry-Suche + Bestätigungsdialog + Ergebnis-Meldung mit Anzahl abgelehnter Zuordnungen),
  nutzt die bereits vorhandene `EntrySearchPicker`-Komponente.
- `src/services/admin-racepic.service.ts`, `src/types/admin-racepic.ts`: Client für die neuen
  Backend-Endpunkte, inkl. `RacepicAdminImage`/`RacepicMatchingConfig`/`RacepicMatchQualityReport`.
  **Hinweis:** `RacepicMatchingConfig.autoThreshold`/`reviewThreshold`/`minMargin` sind `string`,
  nicht `number` – `listMatchingConfigs` im Backend gibt die rohe Drizzle-Zeile zurück, und
  `numeric`-Spalten kommen ohne `mode: 'number'` als String zurück (anders als beim Anlegen, wo
  das Backend echte Zahlen erwartet, siehe `RacepicMatchingConfigInput`).
- **Backend-Ergänzung (im MSC-Event-Backend-Repo, nicht hier):** `GET /admin/racepic/events/{id}/images`
  gab es vor Paket 11 noch nicht – ohne sie gab es keinen Weg, ein frisch hochgeladenes
  (`visibility=DRAFT`) Bild ohne bestehende Zuordnung admin-seitig zu erreichen.
- **Verifiziert:** `npm run typecheck` und `npm run build` beide fehlerfrei (`racepic-page`-Chunk
  auf 16,46 kB gewachsen, `racepic-review-page` auf 5,03 kB).

## Offene Punkte

- Gewichte der Matching-Config (`ocrExact` etc.) sind nur über die API editierbar, nicht über
  das neue Formular (nur die drei Schwellen) – für die Paket-10-Kalibrierung ausreichend, bei
  Bedarf später ergänzen.
- Keine weiteren repo-spezifischen offenen Punkte über die im Architekturplan genannten hinaus.
