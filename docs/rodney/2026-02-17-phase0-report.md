# Rodney Report - 2026-02-17 - Phase 0/1

## Attempted
- `npm run dev`
- `npm run rodney:smoke`
- `npm run rodney:auth`
- `npx playwright install`

## Result
- Failed before app launch because dependencies were not installed (`vite: not found`, `playwright: not found`).
- Dev server failed to bind `127.0.0.1:5173` (`EPERM`).
- Playwright install failed to create cache dir; after creating dir, install hung (likely blocked download).
- Rodney smoke failed because Playwright browsers were not installed.

## UI Issues Found
- No runtime screenshots available yet because dev server did not start.

## Fixes Applied
- Added Rodney flow structure and scripts under `scripts/rodney/flows`.
- Added report/screenshot artifact directories and ignore rules.
- Added note in project docs that install/codegen must run before Rodney.
