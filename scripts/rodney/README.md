# Rodney Flows

This directory contains browser flows used after each major implementation step.

## Structure

- `scripts/rodney/flows/*.spec.ts`: Playwright-based Rodney flows.
- `artifacts/rodney/screenshots/<timestamp>/`: generated screenshots.
- `artifacts/rodney/reports/<timestamp>.md`: run report and issues.

## Run

- `npm run rodney:smoke`
- `npm run rodney:auth`
- `npm run rodney:public`
