# MSC Event Frontend

SPA for public registration and admin event management.

## Stack

- React + Vite + TypeScript
- TailwindCSS + shadcn-style UI components
- TanStack React Query
- Orval code generation from `api/openapi.json`

## Commands

- `npm install`
- `npm run api:generate`
- `npm run dev`
- `npm run typecheck`
- `npm run build`
- `npm run rodney:smoke`

## Notes

Current OpenAPI lacks success response schemas for many endpoints. Screens in phase 2 are scaffolded and annotated with backend gaps.

Run `npm install` and `npm run api:generate` before starting the dev server or Rodney flows.
