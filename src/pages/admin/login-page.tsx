import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { consumeCognitoReturnTo, getCognitoConfig, handleCognitoCallbackIfPresent, isCognitoConfigured, startCognitoLogin } from "@/app/auth/cognito";
import { DocumentMeta } from "@/app/document-meta";
import { consumeAuthLogoutReason } from "@/app/auth/auth-store";
import { useAuth } from "@/app/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LocationState = {
  from?: {
    pathname?: string;
  };
};

export function AdminLoginPage() {
  const { loginWithSession } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as LocationState | null)?.from?.pathname || "/admin/dashboard";
  const cognitoReady = isCognitoConfigured();
  const cognitoConfig = cognitoReady ? getCognitoConfig() : null;

  useEffect(() => {
    const reason = consumeAuthLogoutReason();
    if (!reason) {
      return;
    }

    if (reason === "session_expired") {
      setError("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");
      return;
    }
    if (reason === "idle_timeout") {
      setError("Du wurdest wegen Inaktivität abgemeldet.");
      return;
    }
    if (reason === "session_max_age") {
      setError("Die maximale Sitzungsdauer wurde erreicht. Bitte erneut anmelden.");
    }
  }, []);

  useEffect(() => {
    const runCallback = async () => {
      try {
        setBusy(true);
        const session = await handleCognitoCallbackIfPresent();
        if (!session) {
          return;
        }
        loginWithSession(session);
        const target = consumeCognitoReturnTo(redirectTo);
        navigate(target, { replace: true });
      } catch (callbackError) {
        if (callbackError instanceof Error) {
          setError(callbackError.message);
        } else {
          setError("Cognito Login konnte nicht abgeschlossen werden.");
        }
      } finally {
        setBusy(false);
      }
    };

    void runCallback();
  }, [loginWithSession, navigate, redirectTo]);

  return (
    <div className="mx-auto mt-16 max-w-md px-4">
      <DocumentMeta />
      <Card className="rounded-xl border bg-white shadow-sm">
        <CardHeader>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">MSC</div>
          <CardTitle className="text-2xl">MSC Event Verwaltung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {cognitoReady && (
            <Button
              type="button"
              className="w-full"
              disabled={busy}
              onClick={() => {
                setError("");
                if (cognitoConfig) {
                  const currentLoginUri = `${window.location.origin}/admin/login`;
                  if (cognitoConfig.redirectUri !== currentLoginUri) {
                    setError(
                      `Cognito Redirect-URI passt nicht zur App-URL. Konfiguriert: ${cognitoConfig.redirectUri}. Erwartet für diesen Aufruf: ${currentLoginUri}.`
                    );
                    return;
                  }
                }
                setBusy(true);
                void startCognitoLogin(redirectTo).catch((startError) => {
                  setBusy(false);
                  if (startError instanceof Error) {
                    setError(startError.message);
                  } else {
                    setError("Cognito Login konnte nicht gestartet werden.");
                  }
                });
              }}
            >
              {busy ? "Weiterleitung..." : "Mit Cognito anmelden"}
            </Button>
          )}

          {!cognitoReady && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Login ist nicht konfiguriert. Bitte Cognito-Domain, Client-ID sowie Redirect- und Logout-URI fuer diese Stage setzen.
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
