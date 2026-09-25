<!-- Nur die Architektur (racepic-architecture.md) wird 1:1 in allen 3 Repos synchron gehalten. Diese Fortschrittsdatei ist repo-spezifisch und listet nur die Arbeitspakete, die in MSC-Event-Frontend passieren. -->
# RacePic – Fortschritt (MSC-Event-Frontend)

**Stand:** 2026-09-25 · Architektur: [racepic-architecture.md](./racepic-architecture.md) · Offene Punkte (konsolidiert): [racepic-open-items.md](./racepic-open-items.md) · UI/UX-Redesign-Roadmap: [racepic-ux-redesign-plan.md](./racepic-ux-redesign-plan.md)

## Gesamt-Review 2026-09-25

- RacePic-Navigation und Route sind per Build-/Runtime-Flag standardmäßig deaktiviert.
- Die alte Review-Route leitet kompatibel in den Assignment-Tab weiter; Event und Tab bleiben in der URL adressierbar.
- `racepic.manage` trennt schreibende Einstellungen, Fotografen-, Bilder- und Matching-Funktionen von der lesenden/prüfenden Ansicht.
- API-Typen verwenden begrenzte Status-Unions; der Widerspruchs-Contract meldet nur die Anzahl abgelehnter Zuordnungen und behauptet keine Bildlöschung.
- Lokal verifiziert: Typecheck, drei Tests (zwei bestehende Node-Tests und ein RacePic-Vertragstest) sowie Produktions-Build erfolgreich. Der strikte repositoryweite Lint zeigt weiterhin vorbestehende Warnungen/Fehler außerhalb RacePic; die Qualitätsregeln wurden nicht gelockert.

## Arbeitspakete in diesem Repo

| # | Paket | Status | Notiz |
|---|---|---|---|
| 5 | Admin-Basis `/admin/racepic`: Event-Settings, Fotografen einladen, Statistik | **erledigt** | siehe „Paket 5 – Ergebnis" unten |
| 7 | Review-Queue: BBox-Overlay, Fahreransicht zur Korrektur | **erledigt (Basisversion)** | siehe „Paket 7 – Ergebnis" unten; Tastaturbedienung/Soft-Lock/Qualitätsreport zurückgestellt |
| 10c | Pilot 12. OLD 2026 (Admin-Teil): Fotografen einladen, Review-Durchlauf | offen | |
| 11 | Fehlende Admin-Bedienelemente für bereits im Backend fertige Funktionen | **erledigt** | siehe „Paket 11 – Ergebnis" unten |
| 14 | UI/UX-Redesign-Grundlage: Tabs-Komponente portiert | **erledigt** | siehe „Paket 14 – Ergebnis" unten; Roadmap in [racepic-ux-redesign-plan.md](./racepic-ux-redesign-plan.md) |
| 16 | Admin-Redesign mit Tabs | **erledigt (ungedeployed)** | siehe „Paket 16 – Ergebnis" unten; Backend-Teil siehe MSC-Event-Backend |

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

## Paket 14 – Ergebnis (2026-09-22)

Erste Umsetzung aus der [UI/UX-Redesign-Roadmap](./racepic-ux-redesign-plan.md) (Pakete 14–18).

- `src/components/ui/tabs.tsx` (neu, portiert aus msc-website): identisches shadcn-Tabs-Muster,
  fehlte in diesem Repo bisher komplett.
- `@radix-ui/react-tabs` als neue Dependency (`package.json`), analog zur bestehenden
  `@radix-ui/react-select`-Einbindung.
- Grundlage für Paket 16 (Admin-Redesign mit Tabs) – hier noch nicht in `racepic-page.tsx`
  eingebaut.
- **Verifiziert:** `npm run typecheck` fehlerfrei.

## Paket 16 – Ergebnis (2026-09-22)

Admin-Redesign, siehe [racepic-ux-redesign-plan.md](./racepic-ux-redesign-plan.md). Auf
`feature/racepic-ux-redesign`.

- `src/pages/admin/racepic-page.tsx`: `EventConfigForm` (der bisherige lineare Konfigurations-
  block je Event) läuft jetzt in fünf Tabs statt gestapelt: **Einstellungen** (bisheriges
  Formular + Statistik unverändert), **Fotograf:innen** (neue `EventPhotographersTab` –
  event-gescopte Sicht statt der globalen Liste unten auf der Seite, mit direktem
  "Für dieses Event einladen"-Formular), **Bilder** (`ImagesSection` von einer Tabelle auf ein
  Kontaktabzug-Grid umgebaut: Checkbox pro Kachel, Mehrfachauswahl für Bulk-Veröffentlichen/
  -Verbergen, größere Thumbnails), **Zuordnung** (Link zur bestehenden Review-Queue-Seite, bleibt
  eine eigene Route wegen BBox-Overlay), **KI-Konfiguration** (bisherige `MatchingSection`,
  unverändert).
- `src/pages/admin/racepic-page.tsx`: neue `ImageAssignmentDetail`-Komponente – Klick auf
  "Zuordnung" bei einem Bild im Grid zeigt dessen aktuelle Zuordnung(en) mit Bestätigen/Ablehnen
  direkt dort, ohne erst über die Fahrersuche zu gehen. Schließt die vom Verein genannte Lücke
  "wie ich die Zuordnung zum Fahrer sehen/ändern kann". Eine Korrektur auf einen *anderen* Fahrer
  bleibt bewusst der vollen Review-Queue vorbehalten (BBox-Overlay + Kandidatenliste + Fahrersuche
  wären hier eine Doppelimplementierung).
- `src/services/admin-racepic.service.ts`, `src/types/admin-racepic.ts`: `getImageAssignments`
  gegen den neuen Backend-Endpunkt `GET /admin/racepic/images/{id}/assignments`.
- **Verifiziert:** `npm run typecheck` und `npm run build` fehlerfrei (`racepic-page`-Chunk auf
  52,38 kB gewachsen). Kein Browser-Test in dieser Sandbox möglich.

## Offene Punkte

- Gewichte der Matching-Config (`ocrExact` etc.) sind nur über die API editierbar, nicht über
  das neue Formular (nur die drei Schwellen) – für die Paket-10-Kalibrierung ausreichend, bei
  Bedarf später ergänzen.
- Keine weiteren repo-spezifischen offenen Punkte über die im Architekturplan genannten hinaus.
## Pakete 19–24 – Implementierungsstand 2026-09-22

Nennungstool-Admin: direkter Event-Einstieg, Zustandsübersicht, Pipeline-Schritte, manuelle Fahrerzuordnung, Reanalyse, Fotografenfreigabe und editierbare Matching-Gewichte.

Dies ist Feature-Branch-Arbeit. Lokal erfolgreich: TypeScript-Typechecks der Website, Backend-API, Backend-Infrastruktur und des Nennungstool-Admins. Ein echter Browser-/Cognito-/AWS-Durchlauf, eine KI-Qualitätsmessung mit bestätigten Bildern und eine rechtliche Freigabe stehen aus. Keine Merges, Deployments oder öffentliche Freischaltung erfolgten in diesem Paket. Das genaue Paket- und Abnahme-Raster steht in racepic-open-items.md, Abschnitt E.

## Marketplace-/Checkout-Plan (2026-09-25)

Der vollständige Plan ist in [racepic-marketplace-checkout-plan.md](./racepic-marketplace-checkout-plan.md) dokumentiert. Dieses Repo übernimmt FREE→PAID-Freigaben, Bestell- und Zahlungsübersichten, vollständige Positions-/Order-Refunds, Takedowns, Disputes, Transfers, Reversals und die Reconciliation-Ausnahmewarteschlange. Diese Adminfunktionen sind noch nicht implementiert oder freigeschaltet.
