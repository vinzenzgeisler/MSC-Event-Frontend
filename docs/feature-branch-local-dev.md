# Feature-Branch Local Dev

Feature-Branches werden im Frontend lokal auf `localhost` entwickelt. Es gibt keine Vercel-Preview pro Feature-Branch und keine eigene Backend-Infrastruktur.

## Standard

```bash
npm run dev:local
```

Die lokale App nutzt:

- `VITE_API_BASE_URL=/api`
- `VITE_API_PROXY_TARGET=<gemeinsame Dev API>`
- Cognito Redirect/Logout auf `http://localhost:5173/admin/login`

Damit bleiben Browser-Origin und API-Calls lokal sauber: die App ruft `/api/...` auf, Vite proxyt zur gemeinsamen Dev-API.

`npm run dev:local` synchronisiert vorher `.env.local` mit dem aktuellen `ApiUrl`-Output des Stacks `dreiecksrennen-dev-api-stack`. Dadurch bleibt Localhost stabil, auch wenn die gemeinsame Dev-API von AWS eine neue `execute-api`-URL bekommt.

## Lokale Overrides

Wenn sich die Dev-API oder Cognito-Werte aendern:

```bash
cp .env.local.example .env.local
```

Dann nur `.env.local` anpassen. `.env.local` bleibt untracked.

## CI/CD-Verhalten

- Push auf `feature/**`, `fix/**`, `chore/**`: Typecheck + Build.
- Push auf `dev`: Vercel Preview/Dev Deploy.
- Push auf `main`: Vercel Production Deploy.

Das Backend eines Feature-Branches wird bei Bedarf manuell ueber den Backend-Workflow auf die gemeinsame Dev-Infrastruktur deployed.
