<!-- Nur die Architektur (racepic-architecture.md) wird 1:1 in allen 3 Repos synchron gehalten. Diese Fortschrittsdatei ist repo-spezifisch und listet nur die Arbeitspakete, die in MSC-Event-Frontend passieren. -->
# RacePic – Fortschritt (MSC-Event-Frontend)

**Stand:** 2026-09-21 · Architektur: [racepic-architecture.md](./racepic-architecture.md)

## Arbeitspakete in diesem Repo

| # | Paket | Status | Notiz |
|---|---|---|---|
| 5 | Admin-Basis `/admin/racepic`: Event-Settings, Fotografen einladen, Statistik | offen | Muster: Newsletter- und Voting-Seiten; Navigation in `admin-nav.tsx`, Permissions in `iam.ts` (`racepic.read`/`racepic.review`/`racepic.manage`, Gruppe `racepic_moderator`) |
| 7 | Review-Queue: BBox-Overlay, Tastaturbedienung, Soft-Lock, Fahreransicht zur Korrektur, Qualitätsreport | offen | Ruft die Admin-Endpunkte aus MSC-Event-Backend auf |
| 10c | Pilot 12. OLD 2026 (Admin-Teil): Fotografen einladen, Review-Durchlauf | offen | |

## Entscheidungen aus diesem Repo

- 2026-09-21: Admin-Review-Oberfläche bleibt im Nennungstool-Frontend (`/admin/racepic`), nicht in der Website, da sie am bestehenden Admin-Auth/Permission-System (`iam.ts`, `guards.tsx`) andockt.

## Offene Punkte

- Keine repo-spezifischen offenen Punkte über die im Architekturplan genannten hinaus.
