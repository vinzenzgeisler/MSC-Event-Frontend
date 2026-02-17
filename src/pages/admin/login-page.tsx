import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LocationState = {
  from?: {
    pathname?: string;
  };
};

function base64UrlEncode(payload: string) {
  return btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createDummyToken(role: string) {
  const header = base64UrlEncode(JSON.stringify({ alg: "none", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64UrlEncode(
    JSON.stringify({
      sub: "dummy-user",
      roles: [role],
      iat: now,
      exp: now + 60 * 60 * 8
    })
  );
  return `${header}.${body}.signature`;
}

export function AdminLoginPage() {
  const { login } = useAuth();
  const [token, setToken] = useState("");
  const [dummyUser, setDummyUser] = useState("");
  const [dummyPassword, setDummyPassword] = useState("");
  const [dummyError, setDummyError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as LocationState | null)?.from?.pathname || "/admin/entries";
  const showDummy = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DUMMY_LOGIN === "true";

  const loginWithRole = (role: string) => {
    const dummy = createDummyToken(role);
    setToken(dummy);
    login(dummy);
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="mx-auto mt-20 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Admin Login (Token Bootstrap)</CardTitle>
          <CardDescription>
            Temporärer Login per Bearer Token, bis Cognito Hosted UI integriert ist.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">Bearer Token</Label>
            <Input id="token" value={token} onChange={(event) => setToken(event.target.value)} placeholder="eyJ..." />
          </div>
          {showDummy && (
            <div className="space-y-2">
              <Label>Dummy Login (MVP)</Label>
              <div className="grid gap-2 md:grid-cols-3">
                {["admin", "checkin", "viewer"].map((role) => (
                  <Button
                    key={role}
                    variant="outline"
                    onClick={() => {
                      setDummyError("");
                      loginWithRole(role);
                    }}
                  >
                    {role}
                  </Button>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dummyUser">Benutzername</Label>
                  <Input
                    id="dummyUser"
                    value={dummyUser}
                    onChange={(event) => setDummyUser(event.target.value)}
                    placeholder="admin | checkin | viewer"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dummyPassword">Passwort</Label>
                  <Input
                    id="dummyPassword"
                    type="password"
                    value={dummyPassword}
                    onChange={(event) => setDummyPassword(event.target.value)}
                    placeholder="admin | checkin | viewer"
                  />
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  const user = dummyUser.trim();
                  const pass = dummyPassword.trim();
                  if (user && pass && user === pass && ["admin", "checkin", "viewer"].includes(user)) {
                    setDummyError("");
                    loginWithRole(user);
                    return;
                  }
                  setDummyError("Ungültige Dummy-Credentials. Verwende admin/admin, checkin/checkin, viewer/viewer.");
                }}
              >
                Dummy Login
              </Button>
              {dummyError && <div className="text-xs text-destructive">{dummyError}</div>}
              <div className="text-xs text-muted-foreground">
                Nur für lokale Entwicklung ohne Backend-Login. Tokens enthalten die jeweilige Rolle.
              </div>
            </div>
          )}
          <Button
            className="w-full"
            onClick={() => {
              if (!token.trim()) {
                return;
              }
              login(token.trim());
              navigate(redirectTo, { replace: true });
            }}
          >
            Einloggen
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
