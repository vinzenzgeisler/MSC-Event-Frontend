import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, CircleX } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAnmeldungI18n } from "@/app/i18n/anmeldung-i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/services/api/http-client";
import { registrationService } from "@/services/registration.service";

type VerifyViewState = "loading" | "success" | "already" | "invalid" | "conflict" | "error";

const verificationResendUrl = String(import.meta.env.VITE_PUBLIC_VERIFY_RESEND_URL || "").trim();

function apiErrorCode(error: ApiError) {
  return (error.code ?? "").trim().toUpperCase();
}

function isAlreadyVerifiedConflict(error: ApiError) {
  const code = apiErrorCode(error);
  if (code === "VERIFY_TOKEN_ALREADY_USED") {
    return true;
  }
  const haystack = `${(error.code ?? "").toLowerCase()} ${(error.message ?? "").toLowerCase()}`;
  return /already/.test(haystack) && /(verify|verified|used|token|link)/.test(haystack);
}

export function AnmeldungVerifyPage() {
  const { locale } = useAnmeldungI18n();
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
          const code = apiErrorCode(error);
          if (error.status === 409) {
            if (code === "EMAIL_ALREADY_IN_USE_ACTIVE_ENTRY") {
              setState("conflict");
              return;
            }
            if (code === "VERIFY_TOKEN_EXPIRED") {
              setState("invalid");
              return;
            }
            setState(isAlreadyVerifiedConflict(error) ? "already" : "invalid");
            return;
          }
          if (error.status === 400 || error.status === 404) {
            if (!code || code === "VERIFY_TOKEN_INVALID") {
              setState("invalid");
              return;
            }
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

  const copy =
    locale === "en"
      ? {
          title: "Email Verification",
          loadingTitle: "Checking verification...",
          loadingText: "Please wait a moment.",
          successTitle: "Email verified, registration confirmed.",
          successText: "Thank you, your entry has been verified successfully.",
          alreadyTitle: "Link already used.",
          alreadyText: "This email has already been verified.",
          invalidTitle: "The verification link is invalid or expired.",
          invalidText: "Please request a new verification email.",
          conflictTitle: "This email is already used in an active entry.",
          conflictText: "Please use a different email or contact the event team.",
          errorTitle: "Verification is currently unavailable.",
          errorText: "Please try again later.",
          resendButton: "Request new verification email"
        }
      : locale === "cz"
        ? {
            title: "Ověření e-mailu",
            loadingTitle: "Ověření probíhá...",
            loadingText: "Počkejte prosím chvíli.",
            successTitle: "E-mail ověřen, registrace potvrzena.",
            successText: "Děkujeme, vaše přihláška byla úspěšně ověřena.",
            alreadyTitle: "Odkaz už byl použit.",
            alreadyText: "Tento e-mail už byl ověřen.",
            invalidTitle: "Ověřovací odkaz je neplatný nebo vypršel.",
            invalidText: "Požádejte prosím o nový ověřovací e-mail.",
            conflictTitle: "Tento e-mail už je použit v aktivní přihlášce.",
            conflictText: "Použijte jiný e-mail nebo kontaktujte pořadatele.",
            errorTitle: "Ověření nyní není možné.",
            errorText: "Zkuste to prosím později.",
            resendButton: "Vyžádat nový ověřovací e-mail"
          }
        : locale === "pl"
          ? {
              title: "Weryfikacja e-maila",
              loadingTitle: "Sprawdzanie weryfikacji...",
              loadingText: "Poczekaj chwilę.",
              successTitle: "E-mail zweryfikowany, rejestracja potwierdzona.",
              successText: "Dziękujemy, Twoje zgłoszenie zostało poprawnie zweryfikowane.",
              alreadyTitle: "Link został już użyty.",
              alreadyText: "Ten adres e-mail został już zweryfikowany.",
              invalidTitle: "Link weryfikacyjny jest nieprawidłowy lub wygasł.",
              invalidText: "Poproś o nowy e-mail weryfikacyjny.",
              conflictTitle: "Ten adres e-mail jest już używany w aktywnym zgłoszeniu.",
              conflictText: "Użyj innego adresu e-mail lub skontaktuj się z organizatorem.",
              errorTitle: "Weryfikacja jest obecnie niedostępna.",
              errorText: "Spróbuj ponownie później.",
              resendButton: "Poproś o nowy e-mail weryfikacyjny"
            }
          : {
              title: "E-Mail-Verifizierung",
              loadingTitle: "Verifizierung wird geprüft…",
              loadingText: "Bitte einen Moment warten.",
              successTitle: "E-Mail verifiziert, Anmeldung bestätigt.",
              successText: "Danke, deine Nennung wurde erfolgreich verifiziert.",
              alreadyTitle: "Link wurde bereits verwendet.",
              alreadyText: "Die E-Mail war schon verifiziert.",
              invalidTitle: "Der Verifizierungslink ist ungültig oder abgelaufen.",
              invalidText: "Bitte fordere eine neue Verifizierungs-Mail an.",
              conflictTitle: "Diese E-Mail ist bereits in einer aktiven Nennung verwendet.",
              conflictText: "Bitte verwende eine andere E-Mail oder kontaktiere das Orga-Team.",
              errorTitle: "Verifizierung derzeit nicht möglich.",
              errorText: "Bitte versuche es später erneut.",
              resendButton: "Neue Verifizierungs-Mail anfordern"
            };

  return (
    <Card className="mx-auto max-w-xl rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-700">
        {state === "loading" && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="font-medium text-slate-900">{copy.loadingTitle}</p>
            <p className="mt-1 text-xs text-slate-600">{copy.loadingText}</p>
          </div>
        )}

        {state === "success" && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" />
              <div>
                <p className="font-medium text-emerald-900">{copy.successTitle}</p>
                <p className="mt-1 text-xs text-emerald-800">{copy.successText}</p>
              </div>
            </div>
          </div>
        )}

        {state === "already" && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-2">
              <CircleAlert className="mt-0.5 h-5 w-5 text-blue-700" />
              <div>
                <p className="font-medium text-blue-900">{copy.alreadyTitle}</p>
                <p className="mt-1 text-xs text-blue-800">{copy.alreadyText}</p>
              </div>
            </div>
          </div>
        )}

        {state === "invalid" && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <CircleX className="mt-0.5 h-5 w-5 text-amber-700" />
              <div>
                <p className="font-medium text-amber-900">{copy.invalidTitle}</p>
                <p className="mt-1 text-xs text-amber-800">{copy.invalidText}</p>
              </div>
            </div>
          </div>
        )}

        {state === "conflict" && (
          <div className="rounded-md border border-orange-300 bg-orange-50 p-4">
            <div className="flex items-start gap-2">
              <CircleAlert className="mt-0.5 h-5 w-5 text-orange-700" />
              <div>
                <p className="font-medium text-orange-900">{copy.conflictTitle}</p>
                <p className="mt-1 text-xs text-orange-800">{copy.conflictText}</p>
              </div>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-destructive">
            <p className="font-medium">{copy.errorTitle}</p>
            <p className="mt-1 text-xs">{copy.errorText}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {verificationResendUrl && state === "invalid" && (
            <Button asChild type="button">
              <a href={verificationResendUrl}>{copy.resendButton}</a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
