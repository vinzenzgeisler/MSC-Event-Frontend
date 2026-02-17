# MSC Event Frontend

Frontend für öffentliche Anmeldung (`/anmeldung`) und Admin-Verwaltung (`/admin/*`).

## Dokumentation

- Vollständige Projekt-Dokumentation: `docs/PROJECT-DOKUMENTATION.md`
- OpenAPI-Vertrag: `api/openapi.json`

## Stack

- React + Vite + TypeScript
- TailwindCSS + shadcn-style UI components
- React Router
- Lokaler Service-Layer + typed Models (backend-ready, aktuell UI-only)

## Commands

- `npm install`
- `npm run dev`
- `npm run typecheck`
- `npm run build`

## Notes

- Keine direkte Backend-Integration in dieser Phase.
- API-Verträge liegen in `api/openapi.json` und werden über `src/types/*` + `src/services/*` vorbereitet.
- Mock-/UI-Only Daten liegen zentral unter `src/mock/*`.
