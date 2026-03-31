import { useEffect, useState } from "react";
import { ArrowRight, BookOpenText, Clock3, Mail, Mic2, Newspaper } from "lucide-react";
import { Link } from "react-router-dom";
import { AiCommunicationShell } from "@/components/features/admin/ai-communication/ai-communication-shell";
import { aiDashboardTools } from "@/components/features/admin/ai-communication/ai-communication-config";
import { EmptyState } from "@/components/state/empty-state";
import { ErrorState } from "@/components/state/error-state";
import { LoadingState } from "@/components/state/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/services/api/http-client";
import { aiCommunicationService } from "@/services/ai-communication.service";
import type { AiCommunicationToolKey, AiDraftListItem, AiKnowledgeItem } from "@/types/ai-communication";

function draftTaskLabel(taskType: AiDraftListItem["taskType"]) {
  if (taskType === "reply_suggestion") return "Mail-Assistent";
  if (taskType === "event_report") return "Event-Bericht";
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

function toUiErrorMessage(error: unknown, label: string) {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return `${label} ist aktuell nicht freigegeben. Bitte Anmeldung und Berechtigungen prüfen.`;
    }
    if (error.status === 404) {
      return `${label} ist auf diesem System noch nicht verfügbar.`;
    }
    return error.message || `${label} konnte nicht geladen werden.`;
  }
  if (error instanceof Error) {
    if (error.message.trim().toLowerCase() === "failed to fetch") {
      return `${label} ist aktuell nicht erreichbar. Bitte API-URL, CORS und Login prüfen.`;
    }
    return error.message;
  }
  return `${label} konnte nicht geladen werden.`;
}

function toolIcon(toolKey: AiCommunicationToolKey) {
  if (toolKey === "mail-assistant") return Mail;
  if (toolKey === "report-generator") return Newspaper;
  return Mic2;
}

export function AdminAiCommunicationHubPage() {
  const [drafts, setDrafts] = useState<AiDraftListItem[]>([]);
  const [knowledgeItems, setKnowledgeItems] = useState<AiKnowledgeItem[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [knowledgeLoading, setKnowledgeLoading] = useState(true);
  const [draftsError, setDraftsError] = useState("");
  const [knowledgeError, setKnowledgeError] = useState("");

  useEffect(() => {
    aiCommunicationService
      .listDrafts({ limit: 4 })
      .then((response) => {
        setDrafts(response);
        setDraftsError("");
      })
      .catch((error) => {
        setDraftsError(toUiErrorMessage(error, "Die Draft-Historie"));
      })
      .finally(() => setDraftsLoading(false));

    aiCommunicationService
      .listKnowledgeItems({ status: "approved", limit: 4 })
      .then((response) => {
        setKnowledgeItems(response);
        setKnowledgeError("");
      })
      .catch((error) => {
        setKnowledgeError(toUiErrorMessage(error, "Die Wissensbasis"));
      })
      .finally(() => setKnowledgeLoading(false));
  }, []);

  return (
    <AiCommunicationShell
      title="AI Communication Hub"
      description="Ruhiger Admin-Arbeitsbereich für KI-unterstützte Kommunikation. Quellenbasis, Review-Pflicht und wiederverwendbares Wissen bleiben in jedem Flow sichtbar."
    >
      <section className="grid gap-4 xl:grid-cols-3">
        {aiDashboardTools.map((tool) => {
          const Icon = toolIcon(tool.key);
          return (
            <Card key={tool.key} className="rounded-2xl border-slate-200 bg-white/95 shadow-sm">
              <CardHeader className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <CardTitle className="text-xl text-slate-950">{tool.title}</CardTitle>
                      <CardDescription className="leading-6 text-slate-600">{tool.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                      {tool.availabilityLabel}
                    </Badge>
                    <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-600">
                      {tool.statLabel}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-slate-600">
                  {tool.bulletPoints.map((item) => (
                    <li key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      {item}
                    </li>
                  ))}
                </ul>
                <Button asChild className="rounded-full">
                  <Link to={tool.href}>
                    Bereich öffnen
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-2xl border-slate-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Clock3 className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg">Zuletzt gesicherte Arbeitsstände</CardTitle>
                <CardDescription>Gespeicherte Entwürfe bleiben als nachvollziehbare Zwischenstände verfügbar.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {draftsLoading ? <LoadingState label="Lade Draft-Historie..." /> : null}
            {!draftsLoading && draftsError ? <ErrorState message={draftsError} /> : null}
            {!draftsLoading && !draftsError && drafts.length === 0 ? <EmptyState message="Noch keine gespeicherten Entwürfe vorhanden." /> : null}
            {!draftsLoading && !draftsError
              ? drafts.map((draft) => (
                  <div key={draft.id} className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-medium text-slate-950">{draft.title || "Unbenannter Entwurf"}</div>
                        <div className="text-sm text-slate-600">
                          {draftTaskLabel(draft.taskType)} · Status {draft.status}
                        </div>
                      </div>
                      <Badge variant="outline" className="border-slate-300 bg-white text-slate-600">
                        {draft.taskType}
                      </Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                      <div className="inline-flex items-center gap-2">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatDateTime(draft.updatedAt)}
                      </div>
                      <Link className="font-medium text-slate-900 hover:text-primary" to={draftHref(draft.taskType)}>
                        Öffnen
                      </Link>
                    </div>
                  </div>
                ))
              : null}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="rounded-2xl border-slate-200">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                  <BookOpenText className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-lg">Freigegebene Wissensbasis</CardTitle>
                  <CardDescription>Kurzüberblick über zuletzt übernommene, wiederverwendbare Regeln und Fakten.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {knowledgeLoading ? <LoadingState label="Lade Wissenseinträge..." /> : null}
              {!knowledgeLoading && knowledgeError ? <ErrorState message={knowledgeError} /> : null}
              {!knowledgeLoading && !knowledgeError && knowledgeItems.length === 0 ? (
                <EmptyState message="Noch keine freigegebenen Wissenseinträge vorhanden." />
              ) : null}
              {!knowledgeLoading && !knowledgeError
                ? knowledgeItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="font-medium text-slate-950">{item.title}</div>
                          <div className="line-clamp-3 text-sm leading-6 text-slate-600">{item.content}</div>
                        </div>
                        <Badge variant="outline" className="border-slate-300 bg-white text-slate-600">
                          {item.topic}
                        </Badge>
                      </div>
                    </div>
                  ))
                : null}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-slate-950 text-slate-50">
            <CardHeader>
              <CardTitle className="text-lg text-white">Arbeitsprinzipien</CardTitle>
              <CardDescription className="text-slate-300">
                Die KI bleibt Assistenz. Entscheidungen, Freigaben und Versand liegen bewusst beim Team.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-slate-200">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Quellenbasis und Wissensbezug bleiben sichtbar und werden nicht mit generierten Texten vermischt.
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Warnungen, Unknowns und Review-Hinweise werden als eigene Blöcke gerendert und nicht im Entwurf versteckt.
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Wissensvorschläge sind reviewpflichtig; erst freigegebene Knowledge-Items werden wiederverwendbare Basis.
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </AiCommunicationShell>
  );
}
