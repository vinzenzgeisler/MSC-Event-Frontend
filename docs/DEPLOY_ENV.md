# Deploy Environment (Admin Login)

Der Admin-Login liest Cognito-Konfiguration in dieser Reihenfolge:

1. `window.__MSC_RUNTIME_CONFIG__` aus `/runtime-config.js`
2. `VITE_*` Build-Variablen

Die öffentliche API-Basis-URL kann ebenfalls zur Laufzeit geliefert werden. Für produktive Deployments sollte die Stage-Zuordnung bevorzugt über `/runtime-config.js` erfolgen, damit ein Build nicht versehentlich auf Dev-Endpunkte zeigt.

## Runtime-Konfig (ohne Rebuild)

Datei: `public/runtime-config.js` (wird als `/runtime-config.js` ausgeliefert)

```js
window.__MSC_RUNTIME_CONFIG__ = {
  apiBaseUrl: "https://<api-host>",
  cognitoEnabled: true,
  cognitoDomain: "https://<domain>.auth.<region>.amazoncognito.com",
  cognitoClientId: "<client-id>",
  cognitoRedirectUri: "https://<your-host>/admin/login",
  cognitoLogoutUri: "https://<your-host>/admin/login",
  cognitoScopes: "openid email profile",
  authIdleTimeoutMinutes: 43200,
  authMaxSessionHours: 720
};
```

Optionale Admin-Fallbacks:

```js
window.__MSC_RUNTIME_CONFIG__ = {
  adminEnableTokenLogin: false,
  adminEnableRolePreview: false
};
```

## Build-Variablen (Alternativ)

- `VITE_COGNITO_ENABLED`
- `VITE_COGNITO_DOMAIN`
- `VITE_COGNITO_CLIENT_ID`
- `VITE_COGNITO_REDIRECT_URI`
- `VITE_COGNITO_LOGOUT_URI`
- `VITE_COGNITO_SCOPES`
- `VITE_AUTH_IDLE_TIMEOUT_MINUTES`
- `VITE_AUTH_MAX_SESSION_HOURS`

Hinweis: Redirect-URI muss exakt zur App-URL passen (`/admin/login`).
Hinweis: Die tatsächliche Obergrenze bleibt die Refresh-Token-Laufzeit im Cognito App Client.
