import { useEffect, useState } from "react";
import { ArrowRight, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import { AiCommunicationShell } from "@/components/features/admin/ai-communication/ai-communication-shell";
import { EmptyState } from "@/components/state/empty-state";
import { ErrorState } from "@/components/state/error-state";
import { LoadingState } from "@/components/state/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/services/api/http-client";
import { aiDashboardTools } from "@/services/ai-communication-mock.service";
import { aiCommunicationService } from "@/services/ai-communication.service";
import type { AiDraftListItem } from "@/types/ai-communication";

function draftTaskLabel(taskType: AiDraftListItem["taskType"]) {
  if (taskType === "reply_suggestion") return "Mail-Assistent";
  if (taskType === "event_report") return "Bericht";
  return "Sprecherassistenz";
}

function draftHref(taskType: AiDraftListItem["taskType"]) {
  if (taskType === "reply_suggestion") return "/admin/ai-communication/mail-assistant";
  if (taskType === "event_report") return "/admin/ai-communication/report-generator";
  return "/admin/ai-communication/speaker-assistant";
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("de-DE");
}

function toDraftsUiErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return "Die Draft-Historie ist aktuell nicht freigegeben. Bitte Anmeldung und Berechtigungen prüfen.";
    }
    if (error.status === 404) {
      return "Die Draft-Historie ist aktuell auf diesem System noch nicht verfügbar.";
    }
    return error.message || "Die Draft-Historie konnte nicht geladen werden.";
  }
  if (error instanceof Error) {
    if (error.message.trim().toLowerCase() === "failed to fetch") {
      return "Die Draft-Historie ist aktuell nicht erreichbar. Bitte API-URL, CORS und Login prüfen.";
    }
    return error.message;
  }
  return "Die Draft-Historie konnte nicht geladen werden.";
}

export function AdminAiCommunicationHubPage() {
  const [drafts, setDrafts] = useState<AiDraftListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    aiCommunicationService
      .listDrafts({ limit: 6 })
      .then((response) => {
        setDrafts(response);
        setError("");
      })
      .catch((loadError) => {
        setError(toDraftsUiErrorMessage(loadError));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AiCommunicationShell
      title="AI Communication Hub"
      description="Taskbasierter Admin-Bereich für KI-unterstützte Kommunikationsaufgaben mit klarer Trennung zwischen Quellenbasis, Entwurf und notwendiger menschlicher Prüfung."
    >
      {loading ? <LoadingState label="Lade Draft-Historie..." /> : null}
      {!loading && error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 xl:grid-cols-3">
        {aiDashboardTools.map((tool) => (
          <Card key={tool.key} className="border-slate-200">
            <CardHeader className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <CardTitle>{tool.title}</CardTitle>
                  <CardDescription>{tool.description}</CardDescription>
                </div>
                <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
                  {tool.statLabel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-slate-600">
                {tool.bulletPoints.map((item) => (
                  <li key={item} className="rounded-md bg-slate-50 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
              <Button asChild className="w-full sm:w-auto">
                <Link to={tool.href}>
                  Bereich öffnen
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Zuletzt gespeicherte Entwürfe</CardTitle>
            <CardDescription>Zuletzt gesicherte Arbeitsstände aus dem KI-Bereich.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!loading && !error && drafts.length === 0 ? (
              <EmptyState message="Noch keine gespeicherten Entwürfe vorhanden." />
            ) : null}

            {!loading && !error
              ? drafts.map((draft) => (
                  <div key={draft.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-medium text-slate-900">{draft.title || "Unbenannter Entwurf"}</div>
                        <div className="text-sm text-slate-600">
                          {draftTaskLabel(draft.taskType)} · Status {draft.status}
                        </div>
                      </div>
                      <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
                        {draft.taskType}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                      <div className="inline-flex items-center gap-2">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatDateTime(draft.updatedAt)}
                      </div>
                      <Link className="font-medium text-primary hover:underline" to={draftHref(draft.taskType)}>
                        Zum Bereich
                      </Link>
                    </div>
                  </div>
                ))
              : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>MVP-Leitplanken</CardTitle>
            <CardDescription>Was dieser Bereich im MVP bewusst transparent und prüfbar hält.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              Der Block `basis` bleibt in jedem Flow sichtbar und getrennt vom generierten Ergebnis.
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              `warnings` werden strukturiert mit Code, Severity und Message gerendert.
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              `review.required` erzeugt immer einen klaren Prüfhinweis; es gibt keinen autonomen Versand und keine autonome Veröffentlichung.
            </div>
          </CardContent>
        </Card>
      </section>
    </AiCommunicationShell>
  );
}
