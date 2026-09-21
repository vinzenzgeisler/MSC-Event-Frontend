<!-- Nur die Architektur (racepic-architecture.md) wird 1:1 in allen 3 Repos synchron gehalten. Diese Fortschrittsdatei ist repo-spezifisch und listet nur die Arbeitspakete, die in MSC-Event-Frontend passieren. -->
# RacePic – Fortschritt (MSC-Event-Frontend)

**Stand:** 2026-09-21 · Architektur: [racepic-architecture.md](./racepic-architecture.md)

## Arbeitspakete in diesem Repo

| # | Paket | Status | Notiz |
|---|---|---|---|
| 5 | Admin-Basis `/admin/racepic`: Event-Settings, Fotografen einladen, Statistik | **erledigt** | siehe „Paket 5 – Ergebnis" unten |
| 7 | Review-Queue: BBox-Overlay, Tastaturbedienung, Soft-Lock, Fahreransicht zur Korrektur, Qualitätsreport | offen | Ruft die Admin-Endpunkte aus MSC-Event-Backend auf |
| 10c | Pilot 12. OLD 2026 (Admin-Teil): Fotografen einladen, Review-Durchlauf | offen | |

## Paket 5 – Ergebnis (2026-09-21)

- `src/app/auth/iam.ts`: neue Rolle `racepic_moderator` (Cognito-Gruppenname muss mit dem Backend übereinstimmen, siehe `MSC-Event-Backend/infra/lib/stacks/auth-stack.ts`), Permissions `racepic.read`/`racepic.review`/`racepic.manage`; `admin` bekommt alle drei.
- `src/services/admin-racepic.service.ts`, `src/types/admin-racepic.ts` (neu): API-Client für die Backend-Endpunkte aus Paket 5 (`GET/PUT /admin/racepic/events`, `GET .../stats`, `GET/POST /admin/racepic/photographers`, `GET /admin/racepic/licenses`).
- `src/pages/admin/racepic-page.tsx` (neu): Event-Tabelle mit aufklappbarer Konfiguration (Slug, Titel, Upload-Fenster, aktiviert/veröffentlicht, Standard-Lizenz) + Live-Statistik; Fotografen-Tabelle mit Einladungsformular (E-Mail, Anzeigename, Mehrfachauswahl der Events). Bewusst mit einfachen `<table>`-Elementen statt einer Tabellen-Komponente, da dieses Repo kein UI-Kit mit Table/Dialog/Tabs hat (nur `button`/`input`/`label`/`select`/`card`/`badge`).
- `src/components/navigation/admin-nav.tsx`, `src/app/router.tsx`: neuer Menüpunkt/Route `/admin/racepic`, Zugriff für `admin` und `racepic_moderator`.
- **Backend-Ergänzung (im MSC-Event-Backend-Repo, nicht hier):** Die Endpunkte `GET/PUT /admin/racepic/events`, `GET .../stats` und `GET /admin/racepic/licenses` gab es vor Paket 5 noch nicht (Abschnitt H des Architekturplans hatte sie nur vorgesehen) – wurden dort ergänzt, siehe `MSC-Event-Backend/docs/memory-bank/racepic-progress.md`.
- **Verifiziert:** `npm run typecheck` und `npm run build` beide fehlerfrei (neue Seite erscheint als eigener Lazy-Chunk `racepic-page-*.js`, 9.65 kB).

## Entscheidungen aus diesem Repo

- 2026-09-21: Admin-Review-Oberfläche bleibt im Nennungstool-Frontend (`/admin/racepic`), nicht in der Website, da sie am bestehenden Admin-Auth/Permission-System (`iam.ts`, `guards.tsx`) andockt.

## Offene Punkte

- Keine repo-spezifischen offenen Punkte über die im Architekturplan genannten hinaus.
