# Deploy Environment (Admin Login)

Der Admin-Login liest Cognito-Konfiguration in dieser Reihenfolge:

1. `window.__MSC_RUNTIME_CONFIG__` aus `/runtime-config.js`
2. `VITE_*` Build-Variablen

## Runtime-Konfig (ohne Rebuild)

Datei: `public/runtime-config.js` (wird als `/runtime-config.js` ausgeliefert)

```js
window.__MSC_RUNTIME_CONFIG__ = {
  cognitoEnabled: true,
  cognitoDomain: "https://<domain>.auth.<region>.amazoncognito.com",
  cognitoClientId: "<client-id>",
  cognitoRedirectUri: "https://<your-host>/admin/login",
  cognitoLogoutUri: "https://<your-host>/admin/login",
  cognitoScopes: "openid email profile"
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

Hinweis: Redirect-URI muss exakt zur App-URL passen (`/admin/login`).
