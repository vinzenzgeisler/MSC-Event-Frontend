import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, CircleX } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/services/api/http-client";
import { registrationService } from "@/services/registration.service";

type VerifyViewState = "loading" | "success" | "already" | "invalid" | "error";

const verificationResendUrl = String(import.meta.env.VITE_PUBLIC_VERIFY_RESEND_URL || "").trim();

export function AnmeldungVerifyPage() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<VerifyViewState>("loading");

  const entryId = useMemo(() => (searchParams.get("entryId") || "").trim(), [searchParams]);
  const token = useMemo(() => (searchParams.get("token") || "").trim(), [searchParams]);

  useEffect(() => {
    let active = true;

    if (!entryId || !token) {
      setState("invalid");
      return () => {
        active = false;
      };
    }

    setState("loading");

    registrationService
      .verifyEmail(entryId, token)
      .then((response) => {
        if (!active) {
          return;
        }
        if (response.alreadyVerified) {
          setState("already");
          return;
        }
        if (response.verified || response.ok) {
          setState("success");
          return;
        }
        setState("invalid");
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        if (error instanceof ApiError) {
          if (error.status === 409) {
            setState("already");
            return;
          }
          if (error.status === 400 || error.status === 404) {
            setState("invalid");
            return;
          }
        }
        setState("error");
      });

    return () => {
      active = false;
    };
  }, [entryId, token]);

  return (
    <Card className="mx-auto max-w-xl rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>E-Mail-Verifizierung</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-700">
        {state === "loading" && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="font-medium text-slate-900">Verifizierung wird geprüft…</p>
            <p className="mt-1 text-xs text-slate-600">Bitte einen Moment warten.</p>
          </div>
        )}

        {state === "success" && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" />
              <div>
                <p className="font-medium text-emerald-900">E-Mail verifiziert, Anmeldung bestätigt.</p>
                <p className="mt-1 text-xs text-emerald-800">Danke, deine Nennung wurde erfolgreich verifiziert.</p>
              </div>
            </div>
          </div>
        )}

        {state === "already" && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-2">
              <CircleAlert className="mt-0.5 h-5 w-5 text-blue-700" />
              <div>
                <p className="font-medium text-blue-900">Link wurde bereits verwendet.</p>
                <p className="mt-1 text-xs text-blue-800">Die E-Mail war schon verifiziert.</p>
              </div>
            </div>
          </div>
        )}

        {state === "invalid" && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <CircleX className="mt-0.5 h-5 w-5 text-amber-700" />
              <div>
                <p className="font-medium text-amber-900">Der Verifizierungslink ist ungültig oder abgelaufen.</p>
                <p className="mt-1 text-xs text-amber-800">Bitte fordere eine neue Verifizierungs-Mail an.</p>
              </div>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-destructive">
            <p className="font-medium">Verifizierung derzeit nicht möglich.</p>
            <p className="mt-1 text-xs">Bitte versuche es später erneut.</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {verificationResendUrl && state === "invalid" && (
            <Button asChild type="button">
              <a href={verificationResendUrl}>Neue Verifizierungs-Mail anfordern</a>
            </Button>
          )}
          <Button asChild type="button" variant="outline">
            <Link to="/anmeldung">Zur Anmeldung</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
