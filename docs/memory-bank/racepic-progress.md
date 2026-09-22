<!-- Nur die Architektur (racepic-architecture.md) wird 1:1 in allen 3 Repos synchron gehalten. Diese Fortschrittsdatei ist repo-spezifisch und listet nur die Arbeitspakete, die in MSC-Event-Frontend passieren. -->
# RacePic – Fortschritt (MSC-Event-Frontend)

**Stand:** 2026-09-22 · Architektur: [racepic-architecture.md](./racepic-architecture.md)

## Arbeitspakete in diesem Repo

| # | Paket | Status | Notiz |
|---|---|---|---|
| 5 | Admin-Basis `/admin/racepic`: Event-Settings, Fotografen einladen, Statistik | **erledigt** | siehe „Paket 5 – Ergebnis" unten |
| 7 | Review-Queue: BBox-Overlay, Fahreransicht zur Korrektur | **erledigt (Basisversion)** | siehe „Paket 7 – Ergebnis" unten; Tastaturbedienung/Soft-Lock/Qualitätsreport zurückgestellt |
| 10c | Pilot 12. OLD 2026 (Admin-Teil): Fotografen einladen, Review-Durchlauf | offen | |
| 11 (vorgeschlagen) | Fehlende Admin-Bedienelemente für bereits im Backend fertige Funktionen | offen | siehe „Bestandsaufnahme 2026-09-22" unten |

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

## Bestandsaufnahme 2026-09-22

Bei einer Prüfung des Gesamtstands über alle drei Repos wurde festgestellt, dass vier bereits
in MSC-Event-Backend fertige Endpunkte hier **keine UI** haben:

- Bild-Sichtbarkeit ändern (`PATCH /admin/racepic/images/{id}`, `visibility`) – Bilder können
  aktuell nur über einen rohen API-Aufruf veröffentlicht/verborgen/entfernt werden.
- Teilnehmer ausblenden (`POST /admin/racepic/participants/{entryId}/hide`, Paket 9).
- Matching-Config ansehen/anlegen (`GET/POST /admin/racepic/matching-configs`, Paket 6).
- Re-Match/Re-Analyze auslösen (`POST /admin/racepic/events/{id}/rematch`,
  `POST /admin/racepic/images/{id}/reanalyze`, Paket 6).
- Qualitätsreport anzeigen (`GET /admin/racepic/events/{id}/matching-quality-report`, Paket 10).

Der in `docs/racepic/runbook.md` (MSC-Event-Backend) beschriebene Kalibrierungs-Workflow für den
Piloten setzt die letzten drei Punkte als Admin-Bedienschritte voraus – ohne UI kann ihn nur
jemand mit direktem API-Zugriff durchführen, kein Vereins-Admin. **Empfehlung:** vor dem echten
Piloten (Paket 10c) ein Paket 11 einschieben, das diese Bedienelemente in `racepic-page.tsx`
(Bild-Liste mit Sichtbarkeits-Aktionen, Matching-Config-Formular, Rematch-Button,
Qualitätsreport-Tabelle) und `racepic-review-page.tsx` (Teilnehmer-ausblenden-Button)
nachrüstet. Noch nicht umgesetzt, siehe Rückfrage an den Verein im Chat vom 2026-09-22.

## Offene Punkte

- Keine weiteren repo-spezifischen offenen Punkte über die im Architekturplan und der
  Bestandsaufnahme oben genannten hinaus.
