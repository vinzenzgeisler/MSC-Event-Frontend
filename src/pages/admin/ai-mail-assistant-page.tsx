import { useEffect, useMemo, useState } from "react";
import { Copy, RefreshCcw, Save, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { AiCommunicationShell } from "@/components/features/admin/ai-communication/ai-communication-shell";
import { AiMetaPanel, AiReviewPanel, AiWarningsPanel } from "@/components/features/admin/ai-communication/ai-contract-panels";
import { AiNotice } from "@/components/features/admin/ai-communication/ai-notice";
import { EmptyState } from "@/components/state/empty-state";
import { ErrorState } from "@/components/state/error-state";
import { LoadingState } from "@/components/state/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/services/api/http-client";
import { aiCommunicationService } from "@/services/ai-communication.service";
import { cn } from "@/lib/utils";
import { acceptanceStatusClasses, acceptanceStatusLabel, checkinClasses, paymentStatusClasses, paymentStatusLabel } from "@/lib/admin-status";
import type {
  AiMessageBasis,
  AiMessageDetail,
  AiMessageListItem,
  AiReplySuggestionEnvelope,
  AiTaskStatus,
  ReplySuggestionRequest
} from "@/types/ai-communication";

function confidenceClass(value: AiReplySuggestionEnvelope["review"]["confidence"]) {
  if (value === "high") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (value === "medium") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-rose-200 bg-rose-50 text-rose-800";
}

function confidenceLabel(value: AiReplySuggestionEnvelope["review"]["confidence"]) {
  if (value === "high") return "Hohe Sicherheit";
  if (value === "medium") return "Mittlere Sicherheit";
  return "Niedrige Sicherheit";
}

function messageStatusLabel(value: AiMessageListItem["status"]) {
  if (value === "processed") return "Verarbeitet";
  if (value === "archived") return "Archiviert";
  return "Importiert";
}

function registrationStatusLabel(value: string | null | undefined) {
  if (value === "submitted_verified") return "E-Mail bestätigt";
  if (value === "submitted_unverified") return "E-Mail unbestätigt";
  return "—";
}

function registrationStatusClasses(value: string | null | undefined) {
  if (value === "submitted_verified") {
    return checkinClasses(true);
  }
  if (value === "submitted_unverified") {
    return checkinClasses(false);
  }
  return "border-slate-300 bg-slate-100 text-slate-700";
}

function formatAcceptanceLabel(value: string | null | undefined, fallback?: string | null) {
  if (fallback) {
    return fallback;
  }
  if (!value) {
    return "—";
  }
  return acceptanceStatusLabel(value as "pending" | "shortlist" | "accepted" | "rejected");
}

function formatPaymentLabel(value: string | null | undefined, fallback?: string | null) {
  if (fallback) {
    return fallback;
  }
  if (!value) {
    return "—";
  }
  return paymentStatusLabel(value as "due" | "paid");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("de-DE");
}

async function copyText(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    throw new Error("Clipboard API ist im Browser nicht verfügbar.");
  }
  await navigator.clipboard.writeText(value);
}

function toUiErrorMessage(error: unknown, context: "list" | "detail" | "suggest" | "save") {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      if (context === "detail") {
        return "Die ausgewählte Nachricht wurde im AI-Posteingang nicht gefunden.";
      }
      return "Die angeforderte AI-Ressource wurde nicht gefunden.";
    }
    if (error.status === 401 || error.status === 403) {
      return "Der AI-Bereich ist aktuell nicht freigegeben. Bitte Anmeldung und Berechtigungen prüfen.";
    }
    return error.message || "Die AI-Anfrage konnte nicht verarbeitet werden.";
  }
  if (error instanceof Error) {
    const normalized = error.message.trim().toLowerCase();
    if (normalized === "failed to fetch") {
      if (context === "detail") {
        return "Nachrichtendetail aktuell nicht erreichbar. Bitte API-URL, CORS und Login prüfen.";
      }
      if (context === "list") {
        return "AI-Nachrichtenliste aktuell nicht erreichbar. Bitte API-URL, CORS und Login prüfen.";
      }
      if (context === "suggest") {
        return "Antwortvorschlag konnte nicht geladen werden. Bitte AI-API-Verbindung prüfen.";
      }
      return "Entwurf konnte nicht gespeichert werden. Bitte AI-API-Verbindung prüfen.";
    }
    return error.message;
  }
  if (context === "detail") {
    return "Nachrichtendetail konnte nicht geladen werden.";
  }
  if (context === "list") {
    return "Nachrichten konnten nicht geladen werden.";
  }
  if (context === "suggest") {
    return "Antwortvorschlag konnte nicht erzeugt werden.";
  }
  return "Entwurf konnte nicht gespeichert werden.";
}

export function AdminAiMailAssistantPage() {
  const [messages, setMessages] = useState<AiMessageListItem[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messagesError, setMessagesError] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [messageDetail, setMessageDetail] = useState<AiMessageDetail | null>(null);
  const [messageBasis, setMessageBasis] = useState<AiMessageBasis | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [tone, setTone] = useState<NonNullable<ReplySuggestionRequest["tone"]>>("friendly");
  const [includeWarnings, setIncludeWarnings] = useState(true);
  const [suggestion, setSuggestion] = useState<AiReplySuggestionEnvelope | null>(null);
  const [suggestionStatus, setSuggestionStatus] = useState<AiTaskStatus>("idle");
  const [suggestionError, setSuggestionError] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [actionNotice, setActionNotice] = useState<null | {
    tone: "success" | "critical" | "info";
    title: string;
    message: string;
  }>(null);

  useEffect(() => {
    aiCommunicationService
      .listMessages({ limit: 20 })
      .then((response) => {
        setMessages(response);
        setSelectedMessageId(response[0]?.id ?? "");
        setMessagesError("");
      })
      .catch((error) => {
        setMessagesError(toUiErrorMessage(error, "list"));
      })
      .finally(() => setMessagesLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedMessageId) {
      setMessageDetail(null);
      setMessageBasis(null);
      setDetailError("");
      return;
    }

    setDetailLoading(true);
    setDetailError("");

    aiCommunicationService
      .getMessageDetail(selectedMessageId)
      .then((response) => {
        setMessageDetail(response.message);
        setMessageBasis(response.basis);
      })
      .catch((error) => {
        setMessageDetail(null);
        setMessageBasis(null);
        setDetailError(toUiErrorMessage(error, "detail"));
      })
      .finally(() => setDetailLoading(false));
  }, [selectedMessageId]);

  const selectedMessage = useMemo(
    () => messages.find((item) => item.id === selectedMessageId) ?? null,
    [messages, selectedMessageId]
  );

  const handleSelect = (messageId: string) => {
    setSelectedMessageId(messageId);
    setSuggestion(null);
    setSuggestionStatus("idle");
    setSuggestionError("");
    setActionNotice(null);
  };

  const handleGenerate = async () => {
    if (!selectedMessageId) {
      return;
    }

    setSuggestionStatus("loading");
    setSuggestionError("");
    setActionNotice(null);

    try {
      const response = await aiCommunicationService.suggestReply(selectedMessageId, {
        tone,
        includeWarnings
      });
      setSuggestion(response);
      setSuggestionStatus("success");
    } catch (error) {
      setSuggestionStatus("error");
      setSuggestionError(toUiErrorMessage(error, "suggest"));
    }
  };

  const handleSaveDraft = async () => {
    if (!suggestion) {
      return;
    }

    setSavingDraft(true);
    setActionNotice(null);

    try {
      await aiCommunicationService.saveDraft({
        taskType: "reply_suggestion",
        status: suggestion.review.status,
        messageId: suggestion.messageId,
        eventId: messageBasis?.event?.id ?? selectedMessage?.eventId ?? undefined,
        title: suggestion.result.replySubject,
        promptVersion: suggestion.meta.promptVersion,
        modelId: suggestion.meta.modelId,
        inputSnapshot: {
          tone,
          includeWarnings
        },
        outputPayload: {
          summary: suggestion.result.summary,
          category: suggestion.result.category,
          replySubject: suggestion.result.replySubject,
          replyDraft: suggestion.result.replyDraft,
          analysis: suggestion.result.analysis
        },
        warnings: suggestion.warnings
      });
      setActionNotice({
        tone: "success",
        title: "Entwurf gespeichert",
        message: "Der Antwortentwurf wurde in der Draft-Historie abgelegt."
      });
    } catch (error) {
      setActionNotice({
        tone: "critical",
        title: "Speichern fehlgeschlagen",
        message: toUiErrorMessage(error, "save")
      });
    } finally {
      setSavingDraft(false);
    }
  };

  const originalSubject = messageDetail?.subject ?? selectedMessage?.subject ?? "";
  const messageBody = messageDetail?.bodyText ?? messageDetail?.textContent ?? selectedMessage?.textContent ?? "";
  const entryDetailHref = messageBasis?.entry?.detailPath || (messageBasis?.entry?.id ? `/admin/entries/${messageBasis.entry.id}` : undefined);
  const hasSuggestion = Boolean(suggestion);

  return (
    <AiCommunicationShell
      title="Anfrage- und Mail-Assistent"
      description="Mail-ähnliche Arbeitsoberfläche für eingehende Anfragen, erkannte Systembasis und einen KI-unterstützten Antwortentwurf mit klarer Prüfpflicht."
      actions={
        <Button
          type="button"
          variant="outline"
          className="border-white/20 bg-white/10 text-white hover:bg-white/20"
          onClick={() => void handleGenerate()}
          disabled={!selectedMessageId || suggestionStatus === "loading"}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Antwortvorschlag erzeugen
        </Button>
      }
    >
      <AiNotice tone="warning" title="Assistenz statt Autopilot">
        Die KI hilft beim Formulieren. Vor Übernahme bitte Betreff, Antwortinhalt und eventuelle Zusagen kurz prüfen.
      </AiNotice>

      {messagesLoading ? <LoadingState label="Lade AI-Nachrichtenliste..." /> : null}
      {!messagesLoading && messagesError ? <ErrorState message={messagesError} /> : null}

      {!messagesLoading && !messagesError ? (
        <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Nachrichtenliste</CardTitle>
              <CardDescription>Wähle eine importierte Nachricht aus dem AI-Posteingang.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {messages.length === 0 ? (
                <EmptyState message="Keine importierten Nachrichten vorhanden." />
              ) : (
                messages.map((message) => {
                  const isActive = message.id === selectedMessageId;
                  return (
                    <button
                      key={message.id}
                      type="button"
                      onClick={() => handleSelect(message.id)}
                      className={cn(
                        "w-full rounded-xl border px-4 py-3 text-left transition",
                        isActive ? "border-primary bg-primary/5 shadow-sm" : "border-slate-200 bg-white hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-900">
                            {message.fromName || message.fromEmail || "Unbekannter Absender"}
                          </div>
                          <div className="mt-1 truncate text-sm text-slate-800">{message.subject || "Ohne Betreff"}</div>
                          <div className="mt-1 line-clamp-2 text-sm text-slate-500">{message.preview}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-xs text-slate-500">{formatDateTime(message.receivedAt)}</div>
                          <Badge variant="outline" className="mt-2 border-slate-300 bg-slate-50 text-slate-700">
                            {messageStatusLabel(message.status)}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Geöffnete Nachricht</CardTitle>
                <CardDescription>Die Nachricht bleibt die Hauptquelle. Darunter steht nur der Kontext, den das System dazu tatsächlich erkannt hat.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedMessage ? <EmptyState message="Bitte links eine Nachricht auswählen." /> : null}
                {detailLoading ? <LoadingState label="Lade Nachrichten-Detail..." /> : null}
                {!detailLoading && detailError ? <ErrorState title="Detail nicht verfügbar" message={detailError} /> : null}

                {!detailLoading && !detailError && (messageDetail || selectedMessage) ? (
                  <>
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-200 px-5 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-lg font-semibold text-slate-900">{originalSubject || "Ohne Betreff"}</div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                await copyText(originalSubject || "");
                                setActionNotice({
                                  tone: "success",
                                  title: "Betreff kopiert",
                                  message: "Der Original-Betreff wurde in die Zwischenablage kopiert."
                                });
                              } catch (error) {
                                setActionNotice({
                                  tone: "critical",
                                  title: "Kopieren fehlgeschlagen",
                                  message: error instanceof Error ? error.message : "Der Betreff konnte nicht kopiert werden."
                                });
                              }
                            }}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Betreff kopieren
                          </Button>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Von</div>
                            <div className="mt-1 text-sm font-medium text-slate-900">
                              {messageDetail?.fromName || selectedMessage?.fromName || "Unbekannt"}
                            </div>
                            <div className="text-sm text-slate-600">{messageDetail?.fromEmail || selectedMessage?.fromEmail || "—"}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">An / Datum</div>
                            <div className="mt-1 text-sm text-slate-900">{messageDetail?.toEmail || selectedMessage?.toEmail || "—"}</div>
                            <div className="text-sm text-slate-600">{formatDateTime(messageDetail?.receivedAt || selectedMessage?.receivedAt)}</div>
                          </div>
                        </div>
                      </div>
                      <div className="px-5 py-5">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Nachricht</div>
                        <div className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-800">
                          {messageBody || "Kein Inhalt verfügbar."}
                        </div>
                      </div>
                    </div>

                    {(messageBasis?.event || messageBasis?.entry) ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Erkannter Kontext</div>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          {messageBasis?.event ? (
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Event</div>
                              <div className="mt-2 text-sm font-semibold text-slate-900">{messageBasis.event.name || "Event erkannt"}</div>
                              {messageBasis.event.contactEmail ? <div className="mt-1 text-sm text-slate-600">{messageBasis.event.contactEmail}</div> : null}
                            </div>
                          ) : null}
                          {messageBasis?.entry ? (
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Zugeordnete Nennung</div>
                                  <div className="mt-2 text-sm font-semibold text-slate-900">{messageBasis.entry.driverName || "Nennung erkannt"}</div>
                                  <div className="mt-1 text-sm text-slate-600">
                                    {[messageBasis.entry.className, messageBasis.entry.vehicleLabel].filter(Boolean).join(" · ") || "Keine weiteren Fahrzeug-/Klasseninfos"}
                                  </div>
                                </div>
                                {entryDetailHref ? (
                                  <Button asChild type="button" size="sm" variant="outline">
                                    <Link to={entryDetailHref}>Nennungsdetails</Link>
                                  </Button>
                                ) : null}
                              </div>
                              <div className="mt-4 flex flex-wrap gap-2">
                                {messageBasis.entry.registrationStatus ? (
                                  <Badge variant="outline" className={registrationStatusClasses(messageBasis.entry.registrationStatus)}>
                                    Registrierung: {messageBasis.entry.registrationStatusLabel || registrationStatusLabel(messageBasis.entry.registrationStatus)}
                                  </Badge>
                                ) : null}
                                {messageBasis.entry.acceptanceStatus ? (
                                  <Badge
                                    variant="outline"
                                    className={acceptanceStatusClasses(messageBasis.entry.acceptanceStatus as "pending" | "shortlist" | "accepted" | "rejected")}
                                  >
                                    Status: {formatAcceptanceLabel(messageBasis.entry.acceptanceStatus, messageBasis.entry.acceptanceStatusLabel)}
                                  </Badge>
                                ) : null}
                                {messageBasis.entry.paymentStatus ? (
                                  <Badge variant="outline" className={paymentStatusClasses(messageBasis.entry.paymentStatus as "due" | "paid")}>
                                    Zahlung: {formatPaymentLabel(messageBasis.entry.paymentStatus, messageBasis.entry.paymentStatusLabel)}
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="mt-4 grid gap-2 text-sm text-slate-700">
                                {messageBasis.entry.orgaCode ? <div className="rounded-md bg-slate-50 px-3 py-2">Orga-Code: {messageBasis.entry.orgaCode}</div> : null}
                                {typeof messageBasis.entry.amountOpenCents === "number" && messageBasis.entry.amountOpenCents > 0 ? (
                                  <div className="rounded-md bg-slate-50 px-3 py-2">
                                    Offen: {(messageBasis.entry.amountOpenCents / 100).toFixed(2).replace(".", ",")} EUR
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="space-y-1.5">
                  <CardTitle>Antwortvorschlag</CardTitle>
                  <CardDescription>Der Vorschlag trennt Entwurf, Prüfhinweise und genutzte Basis klar voneinander.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="min-w-[160px] space-y-1">
                    <Label className="text-xs">Tonalität</Label>
                    <Select value={tone} onValueChange={(next) => setTone(next as NonNullable<ReplySuggestionRequest["tone"]>)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="friendly">Freundlich</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                        <SelectItem value="formal">Formell</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" variant={includeWarnings ? "default" : "outline"} onClick={() => setIncludeWarnings((current) => !current)}>
                    Warnhinweise {includeWarnings ? "an" : "aus"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => void handleGenerate()} disabled={!selectedMessageId || suggestionStatus === "loading"}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Vorschlag erzeugen
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void handleGenerate()} disabled={!selectedMessageId || suggestionStatus === "loading"}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Neu generieren
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!suggestion?.result.replyDraft}
                    onClick={async () => {
                      if (!suggestion?.result.replyDraft) {
                        return;
                      }
                      try {
                        await copyText(suggestion.result.replyDraft);
                        setActionNotice({
                          tone: "success",
                          title: "Antwort kopiert",
                          message: "Der Antworttext wurde in die Zwischenablage kopiert."
                        });
                      } catch (error) {
                        setActionNotice({
                          tone: "critical",
                          title: "Kopieren fehlgeschlagen",
                          message: error instanceof Error ? error.message : "Der Antworttext konnte nicht kopiert werden."
                        });
                      }
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Antwort kopieren
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!suggestion?.result.replySubject}
                    onClick={async () => {
                      if (!suggestion?.result.replySubject) {
                        return;
                      }
                      try {
                        await copyText(suggestion.result.replySubject);
                        setActionNotice({
                          tone: "success",
                          title: "Antwort-Betreff kopiert",
                          message: "Der generierte Antwort-Betreff wurde in die Zwischenablage kopiert."
                        });
                      } catch (error) {
                        setActionNotice({
                          tone: "critical",
                          title: "Kopieren fehlgeschlagen",
                          message: error instanceof Error ? error.message : "Der Antwort-Betreff konnte nicht kopiert werden."
                        });
                      }
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Betreff kopieren
                  </Button>
                  <Button type="button" variant="outline" disabled={!suggestion || savingDraft} onClick={() => void handleSaveDraft()}>
                    <Save className="mr-2 h-4 w-4" />
                    {savingDraft ? "Speichert..." : "Entwurf speichern"}
                  </Button>
                </div>

                {suggestionStatus === "idle" && !hasSuggestion ? (
                  <EmptyState message="Noch kein Vorschlag vorhanden. Wähle eine Nachricht aus und erzeuge danach einen Antwortentwurf." />
                ) : null}
                {suggestionStatus === "loading" && !hasSuggestion ? <LoadingState label="Erstelle Betreff- und Antwortvorschlag..." /> : null}
                {suggestionStatus === "loading" && hasSuggestion ? (
                  <AiNotice title="Vorschlag wird aktualisiert">
                    Der bisherige Entwurf bleibt sichtbar, bis der neue Vorschlag vollständig geladen ist.
                  </AiNotice>
                ) : null}
                {suggestionStatus === "error" && !hasSuggestion ? <ErrorState title="Vorschlag nicht verfügbar" message={suggestionError} /> : null}
                {suggestionStatus === "error" && hasSuggestion ? (
                  <AiNotice tone="critical" title="Aktualisierung fehlgeschlagen">
                    {suggestionError}
                  </AiNotice>
                ) : null}

                {hasSuggestion && suggestion ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-[0.75fr_1.25fr]">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Erkanntes Anliegen</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{suggestion.result.category}</div>
                        <Badge variant="outline" className={cn("mt-3", confidenceClass(suggestion.review.confidence))}>
                          {confidenceLabel(suggestion.review.confidence)}
                        </Badge>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Kurz-Zusammenfassung</div>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{suggestion.result.summary}</p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Antwort-Betreff</div>
                          <div className="mt-2 text-sm font-medium text-slate-900">
                            {suggestion.result.replySubject || "Kein Antwort-Betreff geliefert."}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Antworttext</div>
                      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-800">{suggestion.result.replyDraft}</p>
                    </div>

                    <AiReviewPanel
                      review={suggestion.review}
                      message="Bitte Betreff, Antworttext und fachliche Aussagen vor dem Übernehmen kurz prüfen."
                    />
                    <AiWarningsPanel warnings={suggestion.warnings} />

                    <div className="grid gap-3 lg:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Systembasis für den Entwurf</div>
                        <div className="mt-3 space-y-2 text-sm text-slate-700">
                          <div className="rounded-md bg-white px-3 py-2">Ausgangsbetreff: {suggestion.basis.message.subject || "—"}</div>
                          <div className="rounded-md bg-white px-3 py-2">Event: {suggestion.basis.event?.name || "—"}</div>
                          {suggestion.basis.entry?.registrationStatus ? (
                            <div className="rounded-md bg-white px-3 py-2">
                              Registrierung: {suggestion.basis.entry.registrationStatusLabel || registrationStatusLabel(suggestion.basis.entry.registrationStatus)}
                            </div>
                          ) : null}
                          {suggestion.basis.entry?.acceptanceStatus ? (
                            <div className="rounded-md bg-white px-3 py-2">
                              Status: {formatAcceptanceLabel(suggestion.basis.entry.acceptanceStatus, suggestion.basis.entry.acceptanceStatusLabel)}
                            </div>
                          ) : null}
                          {suggestion.basis.entry?.paymentStatus ? (
                            <div className="rounded-md bg-white px-3 py-2">
                              Zahlung: {formatPaymentLabel(suggestion.basis.entry.paymentStatus, suggestion.basis.entry.paymentStatusLabel)}
                            </div>
                          ) : null}
                          {suggestion.basis.entry?.paymentReference ? (
                            <div className="rounded-md bg-white px-3 py-2">Zahlungsreferenz: {suggestion.basis.entry.paymentReference}</div>
                          ) : null}
                          <div className="rounded-md bg-white px-3 py-2">
                            Zahlung offen:{" "}
                            {typeof suggestion.basis.entry?.amountOpenCents === "number"
                              ? `${(suggestion.basis.entry.amountOpenCents / 100).toFixed(2).replace(".", ",")} EUR`
                              : "—"}
                          </div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Zusätzliche Wissensquellen</div>
                        <div className="mt-3 space-y-2 text-sm text-slate-700">
                          <div className="rounded-md bg-white px-3 py-2">FAQ-Einträge: {suggestion.basis.usedKnowledge.faqCount}</div>
                          <div className="rounded-md bg-white px-3 py-2">
                            Logistik-Notizen: {suggestion.basis.usedKnowledge.logisticsNotesCount}
                          </div>
                          <div className="rounded-md bg-white px-3 py-2">
                            Vorherige Ausgänge: {suggestion.basis.usedKnowledge.previousOutgoingCount}
                          </div>
                          {suggestion.basis.usedKnowledge.basedOnPreviousCorrespondence ? (
                            <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sky-900">
                              Dieser Vorschlag basiert auch auf bisheriger Korrespondenz.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <AiMetaPanel meta={suggestion.meta} />
                  </>
                ) : null}

                {actionNotice ? <AiNotice tone={actionNotice.tone} title={actionNotice.title}>{actionNotice.message}</AiNotice> : null}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </AiCommunicationShell>
  );
}
