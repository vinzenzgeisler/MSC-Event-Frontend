import { useEffect, useMemo, useState } from "react";
import { BookOpenText, Bot, Check, ChevronLeft, ChevronRight, Copy, Link2, MessageSquareQuote, RefreshCcw, Save, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { AiCommunicationShell, textareaClassName } from "@/components/features/admin/ai-communication/ai-communication-shell";
import { AiMetaPanel, AiReviewPanel, AiWarningsPanel } from "@/components/features/admin/ai-communication/ai-contract-panels";
import { AiNotice } from "@/components/features/admin/ai-communication/ai-notice";
import { EmptyState } from "@/components/state/empty-state";
import { ErrorState } from "@/components/state/error-state";
import { LoadingState } from "@/components/state/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/services/api/http-client";
import { aiCommunicationService } from "@/services/ai-communication.service";
import { cn } from "@/lib/utils";
import { acceptanceStatusClasses, acceptanceStatusLabel, checkinClasses, paymentStatusClasses, paymentStatusLabel } from "@/lib/admin-status";
import type {
  AiChatHistoryMessage,
  AiKnowledgeItem,
  AiKnowledgeSuggestion,
  AiMessageAssistantContext,
  AiMessageChatEnvelope,
  AiMessageDetail,
  AiMessageDetailResponse,
  AiMessageListItem,
  AiReplySuggestionEnvelope,
  AiTaskStatus,
  ReplySuggestionRequest
} from "@/types/ai-communication";

type ActionNoticeTone = "success" | "critical" | "info";

type ActionNotice = {
  tone: ActionNoticeTone;
  title: string;
  message: string;
};

type SuggestionOptionsState = {
  additionalContext: string;
  mustMention: string;
  mustAvoid: string;
};

const initialSuggestionOptions: SuggestionOptionsState = {
  additionalContext: "",
  mustMention: "",
  mustAvoid: ""
};

const defaultChatPrompt = "Welche Rückfrage oder Regel ist für diese Mail noch wichtig?";

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

function formatParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

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
  if (fallback) return fallback;
  if (!value) return "—";
  return acceptanceStatusLabel(value as "pending" | "shortlist" | "accepted" | "rejected");
}

function formatPaymentLabel(value: string | null | undefined, fallback?: string | null) {
  if (fallback) return fallback;
  if (!value) return "—";
  return paymentStatusLabel(value as "due" | "paid");
}

function formatCurrency(cents: number | null | undefined) {
  if (typeof cents !== "number") {
    return null;
  }
  return `${(cents / 100).toFixed(2).replace(".", ",")} EUR`;
}

function listFromTextarea(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function copyText(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    throw new Error("Clipboard API ist im Browser nicht verfügbar.");
  }
  await navigator.clipboard.writeText(value);
}

function toUiErrorMessage(error: unknown, context: string) {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return `${context} wurde nicht gefunden.`;
    }
    if (error.status === 401 || error.status === 403) {
      return `${context} ist aktuell nicht freigegeben. Bitte Anmeldung und Berechtigungen prüfen.`;
    }
    if (error.status === 503) {
      return `${context} ist aktuell backendseitig nicht verfügbar. Bitte AI-Konfiguration prüfen.`;
    }
    return error.message || `${context} konnte nicht verarbeitet werden.`;
  }
  if (error instanceof Error) {
    if (error.message.trim().toLowerCase() === "failed to fetch") {
      return `${context} ist aktuell nicht erreichbar. Bitte API-URL, CORS und Login prüfen.`;
    }
    return error.message;
  }
  return `${context} konnte nicht verarbeitet werden.`;
}

function IconActionButton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: React.ReactNode }) {
  const { label, icon, className, ...buttonProps } = props;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("h-8 rounded-full px-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900", className)}
      title={label}
      aria-label={label}
      {...buttonProps}
    >
      {icon}
    </Button>
  );
}

function SectionList(props: { title: string; items: string[]; tone?: "neutral" | "warning"; emptyMessage?: string }) {
  if (!props.items.length && !props.emptyMessage) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{props.title}</div>
      {props.items.length ? (
        <div className="mt-3 space-y-2">
          {props.items.map((item) => (
            <div
              key={item}
              className={cn(
                "rounded-xl px-3 py-3 text-sm leading-6",
                props.tone === "warning" ? "border border-amber-200 bg-amber-50 text-amber-900" : "border border-slate-200 bg-slate-50 text-slate-700"
              )}
            >
              {item}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-sm text-slate-500">{props.emptyMessage}</div>
      )}
    </div>
  );
}

function KnowledgeHitList(props: { title: string; items: AiMessageAssistantContext["knowledgeHits"] | AiReplySuggestionEnvelope["basis"]["knowledgeHits"] | AiMessageChatEnvelope["basis"]["knowledgeHits"] }) {
  if (!props.items.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{props.title}</div>
      <div className="grid gap-3 md:grid-cols-2">
        {props.items.map((item) => (
          <div key={`${item.id ?? item.title}-${item.content}`} className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-slate-300 bg-white text-slate-600">
                {item.topic}
              </Badge>
            </div>
            <div className="mt-3 font-medium text-slate-950">{item.title}</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">{item.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminAiMailAssistantPage() {
  const [messages, setMessages] = useState<AiMessageListItem[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messagesError, setMessagesError] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [messageDetail, setMessageDetail] = useState<AiMessageDetail | null>(null);
  const [messageBasis, setMessageBasis] = useState<AiMessageDetailResponse["basis"] | null>(null);
  const [assistantContext, setAssistantContext] = useState<AiMessageAssistantContext>({ knowledgeHits: [] });
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [showInboxOnMobile, setShowInboxOnMobile] = useState(true);
  const [tone, setTone] = useState<NonNullable<ReplySuggestionRequest["tone"]>>("friendly");
  const [includeWarnings, setIncludeWarnings] = useState(true);
  const [suggestionOptions, setSuggestionOptions] = useState<SuggestionOptionsState>(initialSuggestionOptions);
  const [showSuggestionOptions, setShowSuggestionOptions] = useState(false);
  const [suggestion, setSuggestion] = useState<AiReplySuggestionEnvelope | null>(null);
  const [suggestionStatus, setSuggestionStatus] = useState<AiTaskStatus>("idle");
  const [suggestionError, setSuggestionError] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [chatInput, setChatInput] = useState(defaultChatPrompt);
  const [chatMode, setChatMode] = useState<"reply" | "knowledge_capture">("reply");
  const [chatHistory, setChatHistory] = useState<AiChatHistoryMessage[]>([]);
  const [chatResult, setChatResult] = useState<AiMessageChatEnvelope | null>(null);
  const [chatStatus, setChatStatus] = useState<AiTaskStatus>("idle");
  const [chatError, setChatError] = useState("");
  const [knowledgeSuggestions, setKnowledgeSuggestions] = useState<AiKnowledgeSuggestion[]>([]);
  const [knowledgeSuggestionsStatus, setKnowledgeSuggestionsStatus] = useState<AiTaskStatus>("idle");
  const [knowledgeSuggestionsError, setKnowledgeSuggestionsError] = useState("");
  const [approvedKnowledgeItems, setApprovedKnowledgeItems] = useState<AiKnowledgeItem[]>([]);
  const [approvedKnowledgeStatus, setApprovedKnowledgeStatus] = useState<AiTaskStatus>("idle");
  const [approvedKnowledgeError, setApprovedKnowledgeError] = useState("");
  const [knowledgeActionBusyId, setKnowledgeActionBusyId] = useState("");
  const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null);

  useEffect(() => {
    aiCommunicationService
      .listMessages({ limit: 20 })
      .then((response) => {
        setMessages(response);
        setSelectedMessageId(response[0]?.id ?? "");
        setMessagesError("");
      })
      .catch((error) => {
        setMessagesError(toUiErrorMessage(error, "Die AI-Nachrichtenliste"));
      })
      .finally(() => setMessagesLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedMessageId) {
      setMessageDetail(null);
      setMessageBasis(null);
      setAssistantContext({ knowledgeHits: [] });
      setDetailError("");
      setKnowledgeSuggestions([]);
      return;
    }

    setDetailLoading(true);
    setDetailError("");
    setKnowledgeSuggestionsStatus("loading");
    setApprovedKnowledgeStatus("loading");

    aiCommunicationService
      .getMessageDetail(selectedMessageId)
      .then((response) => {
        setMessageDetail(response.message);
        setMessageBasis(response.basis);
        setAssistantContext(response.assistantContext);
        setDetailError("");
      })
      .catch((error) => {
        setMessageDetail(null);
        setMessageBasis(null);
        setAssistantContext({ knowledgeHits: [] });
        setDetailError(toUiErrorMessage(error, "Das Nachrichtendetail"));
      })
      .finally(() => setDetailLoading(false));

    void loadKnowledgeData(selectedMessageId);
  }, [selectedMessageId]);

  const selectedMessage = useMemo(
    () => messages.find((item) => item.id === selectedMessageId) ?? null,
    [messages, selectedMessageId]
  );

  async function loadKnowledgeData(messageId: string) {
    try {
      const [openSuggestions, approvedItems] = await Promise.all([
        aiCommunicationService.listKnowledgeSuggestions({ messageId, status: "suggested", limit: 8 }),
        aiCommunicationService.listKnowledgeItems({ status: "approved", limit: 8 })
      ]);
      setKnowledgeSuggestions(openSuggestions);
      setApprovedKnowledgeItems(approvedItems);
      setKnowledgeSuggestionsError("");
      setApprovedKnowledgeError("");
      setKnowledgeSuggestionsStatus("success");
      setApprovedKnowledgeStatus("success");
    } catch (error) {
      const message = toUiErrorMessage(error, "Das Wissensreview");
      setKnowledgeSuggestionsError(message);
      setApprovedKnowledgeError(message);
      setKnowledgeSuggestionsStatus("error");
      setApprovedKnowledgeStatus("error");
    }
  }

  const handleSelect = (messageId: string) => {
    setSelectedMessageId(messageId);
    setSuggestion(null);
    setSuggestionStatus("idle");
    setSuggestionError("");
    setChatResult(null);
    setChatStatus("idle");
    setChatError("");
    setChatHistory([]);
    setActionNotice(null);
    setShowInboxOnMobile(false);
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
        includeWarnings,
        additionalContext: suggestionOptions.additionalContext.trim() || undefined,
        mustMention: listFromTextarea(suggestionOptions.mustMention),
        mustAvoid: listFromTextarea(suggestionOptions.mustAvoid)
      });
      setSuggestion(response);
      setSuggestionStatus("success");
    } catch (error) {
      setSuggestionStatus("error");
      setSuggestionError(toUiErrorMessage(error, "Der Antwortvorschlag"));
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
        entryId: messageBasis?.entry?.id ?? selectedMessage?.entryId ?? undefined,
        title: suggestion.result.replySubject,
        promptVersion: suggestion.meta.promptVersion,
        modelId: suggestion.meta.modelId,
        inputSnapshot: {
          tone,
          includeWarnings,
          additionalContext: suggestionOptions.additionalContext.trim() || undefined,
          mustMention: listFromTextarea(suggestionOptions.mustMention),
          mustAvoid: listFromTextarea(suggestionOptions.mustAvoid)
        },
        outputPayload: {
          summary: suggestion.result.summary,
          category: suggestion.result.category,
          replySubject: suggestion.result.replySubject,
          answerFacts: suggestion.result.answerFacts,
          unknowns: suggestion.result.unknowns,
          replyDraft: suggestion.result.replyDraft,
          analysis: suggestion.result.analysis,
          basis: suggestion.basis
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
        message: toUiErrorMessage(error, "Das Speichern des Entwurfs")
      });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSendChat = async () => {
    if (!selectedMessageId || !chatInput.trim()) {
      return;
    }

    const nextHistory: AiChatHistoryMessage[] = [...chatHistory, { role: "user", message: chatInput.trim() }];
    setChatStatus("loading");
    setChatError("");
    setActionNotice(null);

    try {
      const response = await aiCommunicationService.chatMessage(selectedMessageId, {
        message: chatInput.trim(),
        history: chatHistory,
        contextMode: chatMode
      });
      setChatResult(response);
      setChatHistory([...nextHistory, { role: "assistant", message: response.result.answer }]);
      setChatStatus("success");
      setChatInput("");
    } catch (error) {
      setChatStatus("error");
      setChatError(toUiErrorMessage(error, "Die Rückfrage zur Mail"));
    }
  };

  const handleCreateKnowledgeSuggestions = async () => {
    if (!selectedMessageId) {
      return;
    }

    setKnowledgeSuggestionsStatus("loading");
    setKnowledgeSuggestionsError("");
    setActionNotice(null);

    try {
      const response = await aiCommunicationService.generateKnowledgeSuggestionsForMessage(selectedMessageId, {
        additionalContext: suggestionOptions.additionalContext.trim() || chatResult?.result.knowledgeSuggestions.map((item) => item.content).join("\n\n") || undefined,
        history: chatHistory,
        topicHint: chatResult?.result.knowledgeSuggestions[0]?.topic
      });
      setKnowledgeSuggestions(response.result.suggestions);
      setKnowledgeSuggestionsStatus("success");
      setActionNotice({
        tone: "success",
        title: "Wissensvorschläge aktualisiert",
        message: "Reviewpflichtige Wissensvorschläge wurden für diese Mail neu erzeugt."
      });
    } catch (error) {
      setKnowledgeSuggestionsStatus("error");
      setKnowledgeSuggestionsError(toUiErrorMessage(error, "Die Erzeugung von Wissensvorschlägen"));
    }
  };

  const handleApproveKnowledgeSuggestion = async (suggestionId: string) => {
    setKnowledgeActionBusyId(suggestionId);
    setActionNotice(null);

    try {
      await aiCommunicationService.createKnowledgeItem({
        suggestionId,
        status: "approved"
      });
      await loadKnowledgeData(selectedMessageId);
      setActionNotice({
        tone: "success",
        title: "Wissenseintrag übernommen",
        message: "Der Vorschlag wurde in die freigegebene Wissensbasis übernommen."
      });
    } catch (error) {
      setActionNotice({
        tone: "critical",
        title: "Übernahme fehlgeschlagen",
        message: toUiErrorMessage(error, "Die Übernahme in die Wissensbasis")
      });
    } finally {
      setKnowledgeActionBusyId("");
    }
  };

  const originalSubject = messageDetail?.subject ?? selectedMessage?.subject ?? "";
  const messageBody = messageDetail?.bodyText ?? messageDetail?.textContent ?? selectedMessage?.textContent ?? "";
  const entryDetailHref = messageBasis?.entry?.detailPath || (messageBasis?.entry?.id ? `/admin/entries/${messageBasis.entry.id}` : undefined);
  const hasSuggestion = Boolean(suggestion);
  const bodyParagraphs = formatParagraphs(messageBody);

  return (
    <AiCommunicationShell
      title="Mail-Assistent"
      description="Posteingang, Kontext und KI-Assistenz bleiben getrennt. Die Mail bleibt Primärquelle, der Entwurf ist prüfbar und wiederverwendbares Wissen wird bewusst reviewt."
      actions={
        <Button
          type="button"
          variant="outline"
          className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20"
          onClick={() => void handleGenerate()}
          disabled={!selectedMessageId || suggestionStatus === "loading"}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Antwortvorschlag erzeugen
        </Button>
      }
    >
      <AiNotice tone="warning" title="Assistenz statt Autopilot">
        Antwortentwürfe, Rückfragen und Wissensvorschläge dienen als Arbeitshilfe. Versand, Freigaben und Knowledge-Übernahme bleiben bewusst manuelle Entscheidungen.
      </AiNotice>

      {actionNotice ? (
        <AiNotice tone={actionNotice.tone} title={actionNotice.title}>
          {actionNotice.message}
        </AiNotice>
      ) : null}

      {messagesLoading ? <LoadingState label="Lade AI-Nachrichtenliste..." /> : null}
      {!messagesLoading && messagesError ? <ErrorState message={messagesError} /> : null}

      {!messagesLoading && !messagesError ? (
        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className={cn("space-y-4", !showInboxOnMobile ? "hidden xl:block" : "")}>
            <Card className="rounded-2xl border-slate-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Posteingang</CardTitle>
                <CardDescription>Importierte Nachrichten für den KI-gestützten Antwort- und Wissensfluss.</CardDescription>
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
                          "w-full rounded-2xl border px-4 py-3 text-left transition",
                          isActive
                            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className={cn("truncate text-sm font-semibold", isActive ? "text-white" : "text-slate-900")}>
                              {message.fromName || message.fromEmail || "Unbekannter Absender"}
                            </div>
                            <div className={cn("mt-1 truncate text-sm", isActive ? "text-slate-100" : "text-slate-700")}>
                              {message.subject || "Ohne Betreff"}
                            </div>
                            <div className={cn("mt-2 line-clamp-3 text-sm", isActive ? "text-slate-300" : "text-slate-500")}>{message.preview}</div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className={cn("text-xs", isActive ? "text-slate-300" : "text-slate-500")}>{formatDateTime(message.receivedAt)}</div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "mt-2",
                                isActive ? "border-white/20 bg-white/10 text-white" : "border-slate-300 bg-slate-50 text-slate-600"
                              )}
                            >
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
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between xl:hidden">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setShowInboxOnMobile((current) => !current)}>
                {showInboxOnMobile ? <ChevronLeft className="mr-2 h-4 w-4" /> : <ChevronRight className="mr-2 h-4 w-4" />}
                {showInboxOnMobile ? "Posteingang ausblenden" : "Posteingang anzeigen"}
              </Button>
              {selectedMessage ? (
                <div className="max-w-[65%] truncate text-sm font-medium text-slate-600">{selectedMessage.subject || "Ohne Betreff"}</div>
              ) : null}
            </div>

            <Card className="rounded-2xl border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg">Geöffnete Mail</CardTitle>
                <CardDescription>Die Originalnachricht ist die Hauptquelle. Darunter steht nur der Kontext, den das System tatsächlich erkannt hat.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {!selectedMessage ? <EmptyState message="Bitte links eine Nachricht auswählen." /> : null}
                {detailLoading ? <LoadingState label="Lade Nachrichtendetail..." /> : null}
                {!detailLoading && detailError ? <ErrorState title="Detail nicht verfügbar" message={detailError} /> : null}

                {!detailLoading && !detailError && (messageDetail || selectedMessage) ? (
                  <>
                    <div className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-lg font-semibold text-slate-950">{originalSubject || "Ohne Betreff"}</div>
                            <div className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                              <div>
                                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Von</div>
                                <div className="mt-1 font-medium text-slate-900">{messageDetail?.fromName || selectedMessage?.fromName || "Unbekannt"}</div>
                                <div>{messageDetail?.fromEmail || selectedMessage?.fromEmail || "—"}</div>
                              </div>
                              <div>
                                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">An / Datum</div>
                                <div className="mt-1 font-medium text-slate-900">{messageDetail?.toEmail || selectedMessage?.toEmail || "—"}</div>
                                <div>{formatDateTime(messageDetail?.receivedAt || selectedMessage?.receivedAt)}</div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <IconActionButton
                              label="Original-Betreff kopieren"
                              icon={<Copy className="h-4 w-4" />}
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
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4 px-5 py-5">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Nachricht</div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-800">
                          {bodyParagraphs.length ? (
                            <div className="space-y-4">
                              {bodyParagraphs.map((paragraph) => (
                                <p key={paragraph} className="whitespace-pre-line">
                                  {paragraph}
                                </p>
                              ))}
                            </div>
                          ) : (
                            "Kein Inhalt verfügbar."
                          )}
                        </div>
                      </div>
                    </div>

                    {(messageBasis?.event || messageBasis?.entry || assistantContext.knowledgeHits.length > 0) ? (
                      <div className="space-y-4 rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                            <Link2 className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-950">Erkannter Systemkontext</div>
                            <div className="text-sm text-slate-600">Nur die vorhandenen Systemdaten werden angezeigt; fehlender Kontext bleibt explizit sichtbar.</div>
                          </div>
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2">
                          {messageBasis?.event ? (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Event</div>
                              <div className="mt-2 text-base font-medium text-slate-950">{messageBasis.event.name || "Event erkannt"}</div>
                              {messageBasis.event.contactEmail ? <div className="mt-2 text-sm text-slate-600">{messageBasis.event.contactEmail}</div> : null}
                            </div>
                          ) : null}

                          {messageBasis?.entry ? (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Nennung</div>
                                  <div className="mt-2 text-base font-medium text-slate-950">{messageBasis.entry.driverName || "Nennung erkannt"}</div>
                                  <div className="mt-1 text-sm text-slate-600">
                                    {[messageBasis.entry.className, messageBasis.entry.vehicleLabel].filter(Boolean).join(" · ") || "Keine weiteren Detailinfos"}
                                  </div>
                                </div>
                                {entryDetailHref ? (
                                  <Button asChild type="button" variant="outline" size="sm" className="rounded-full">
                                    <Link to={entryDetailHref}>Details</Link>
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
                              {(messageBasis.entry.orgaCode || typeof messageBasis.entry.amountOpenCents === "number") && (
                                <div className="mt-4 grid gap-2 text-sm text-slate-700">
                                  {messageBasis.entry.orgaCode ? <div className="rounded-xl bg-slate-50 px-3 py-2">Orga-Code: {messageBasis.entry.orgaCode}</div> : null}
                                  {typeof messageBasis.entry.amountOpenCents === "number" ? (
                                    <div className="rounded-xl bg-slate-50 px-3 py-2">Offener Betrag: {formatCurrency(messageBasis.entry.amountOpenCents)}</div>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>

                        <KnowledgeHitList title="Freigegebene Wissens-Treffer" items={assistantContext.knowledgeHits} />
                      </div>
                    ) : null}
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200">
              <CardHeader className="gap-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1.5">
                    <CardTitle className="text-lg">Antwortentwurf</CardTitle>
                    <CardDescription>Der Entwurf bleibt vom Quellenkontext getrennt und macht bestätigte Fakten, Unknowns und Review-Hinweise einzeln sichtbar.</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-[150px]">
                      <Select value={tone} onValueChange={(next) => setTone(next as NonNullable<ReplySuggestionRequest["tone"]>)}>
                        <SelectTrigger className="rounded-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="friendly">Freundlich</SelectItem>
                          <SelectItem value="neutral">Neutral</SelectItem>
                          <SelectItem value="formal">Formell</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant={includeWarnings ? "default" : "outline"}
                      className="rounded-full"
                      onClick={() => setIncludeWarnings((current) => !current)}
                    >
                      Warnhinweise {includeWarnings ? "an" : "aus"}
                    </Button>
                    <Button type="button" variant="outline" className="rounded-full" onClick={() => setShowSuggestionOptions((current) => !current)}>
                      Assistenzhinweise {showSuggestionOptions ? "ausblenden" : "anzeigen"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {showSuggestionOptions ? (
                  <div className="grid gap-4 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Zusätzlicher Kontext</Label>
                      <textarea
                        className={textareaClassName}
                        value={suggestionOptions.additionalContext}
                        onChange={(event) => setSuggestionOptions((current) => ({ ...current, additionalContext: event.target.value }))}
                        placeholder="Nur ergänzen, was wirklich belastbar ist."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Muss erwähnt werden</Label>
                      <textarea
                        className={textareaClassName}
                        value={suggestionOptions.mustMention}
                        onChange={(event) => setSuggestionOptions((current) => ({ ...current, mustMention: event.target.value }))}
                        placeholder="Eine Zeile pro Punkt"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Muss vermieden werden</Label>
                      <textarea
                        className={textareaClassName}
                        value={suggestionOptions.mustAvoid}
                        onChange={(event) => setSuggestionOptions((current) => ({ ...current, mustAvoid: event.target.value }))}
                        placeholder="Eine Zeile pro Punkt"
                      />
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("border px-3 py-1", hasSuggestion && suggestion ? confidenceClass(suggestion.review.confidence) : "border-slate-300 bg-white text-slate-600")}>
                      {hasSuggestion && suggestion ? confidenceLabel(suggestion.review.confidence) : "Noch kein Entwurf"}
                    </Badge>
                    {hasSuggestion && suggestion ? (
                      <div className="text-sm text-slate-600">
                        Kategorie {suggestion.result.category} · Zusammenfassung {suggestion.result.summary}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">Entwurf, Warnungen und Quellenbasis bleiben nach der Generierung getrennt.</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-white px-1 py-1 shadow-sm ring-1 ring-slate-200">
                    <IconActionButton
                      label="Entwurf generieren"
                      icon={<Sparkles className="h-4 w-4" />}
                      disabled={!selectedMessageId || suggestionStatus === "loading"}
                      onClick={() => void handleGenerate()}
                    />
                    <IconActionButton
                      label="Entwurf neu generieren"
                      icon={<RefreshCcw className="h-4 w-4" />}
                      disabled={!selectedMessageId || suggestionStatus === "loading"}
                      onClick={() => void handleGenerate()}
                    />
                    <IconActionButton
                      label="Antworttext kopieren"
                      icon={<Copy className="h-4 w-4" />}
                      disabled={!suggestion?.result.replyDraft}
                      onClick={async () => {
                        if (!suggestion?.result.replyDraft) return;
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
                    />
                    <IconActionButton
                      label="Entwurf speichern"
                      icon={<Save className="h-4 w-4" />}
                      disabled={!suggestion || savingDraft}
                      onClick={() => void handleSaveDraft()}
                    />
                  </div>
                </div>

                {suggestionStatus === "idle" && !hasSuggestion ? (
                  <EmptyState message="Noch kein Vorschlag vorhanden. Wähle eine Nachricht aus und erzeuge danach einen Antwortentwurf." />
                ) : null}
                {suggestionStatus === "loading" && !hasSuggestion ? <LoadingState label="Erstelle Betreff- und Antwortvorschlag..." /> : null}
                {suggestionStatus === "error" && !hasSuggestion ? <ErrorState title="Vorschlag nicht verfügbar" message={suggestionError} /> : null}
                {suggestionStatus === "error" && hasSuggestion ? (
                  <AiNotice tone="critical" title="Aktualisierung fehlgeschlagen">
                    {suggestionError}
                  </AiNotice>
                ) : null}

                {hasSuggestion && suggestion ? (
                  <>
                    <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                      <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Antwort-Betreff</div>
                        <div className="mt-3 text-base font-medium text-slate-950">{suggestion.result.replySubject || "Kein Betreff geliefert."}</div>
                      </div>
                      <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Antworttext</div>
                        <div className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-800">{suggestion.result.replyDraft}</div>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <SectionList title="Bestätigte Fakten" items={suggestion.result.answerFacts} emptyMessage="Es wurden keine gesonderten Fakten hervorgehoben." />
                      <SectionList title="Unbekannte Punkte" items={suggestion.result.unknowns} tone="warning" emptyMessage="Keine offenen Punkte vom Modell markiert." />
                    </div>

                    <AiReviewPanel
                      review={suggestion.review}
                      message="Bitte Betreff, Antworttext, Zusagen und fachliche Aussagen vor dem Übernehmen manuell prüfen."
                    />
                    <AiWarningsPanel warnings={suggestion.warnings} />

                    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                      <div className="space-y-4 rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Verwendete Quellenbasis</div>
                        {suggestion.basis.entry ? (
                          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                            <div className="font-medium text-slate-950">Systemstatus zur Nennung</div>
                            <div className="mt-3 space-y-2">
                              {suggestion.basis.entry.registrationStatusLabel ? <div>{suggestion.basis.entry.registrationStatusLabel}</div> : null}
                              {suggestion.basis.entry.acceptanceStatusLabel ? <div>{suggestion.basis.entry.acceptanceStatusLabel}</div> : null}
                              {suggestion.basis.entry.paymentStatusLabel ? <div>{suggestion.basis.entry.paymentStatusLabel}</div> : null}
                              {suggestion.basis.entry.paymentReference ? (
                                <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">Verwendungszweck: {suggestion.basis.entry.paymentReference}</div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                          <div className="font-medium text-slate-950">Knowledge-Nutzung</div>
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            <div className="rounded-xl bg-slate-50 px-3 py-2">Freigegebene Treffer: {suggestion.basis.usedKnowledge.approvedKnowledgeCount}</div>
                            <div className="rounded-xl bg-slate-50 px-3 py-2">Frühere Ausgänge: {suggestion.basis.usedKnowledge.previousOutgoingCount}</div>
                            <div className="rounded-xl bg-slate-50 px-3 py-2">FAQ-Treffer: {suggestion.basis.usedKnowledge.faqCount}</div>
                            <div className="rounded-xl bg-slate-50 px-3 py-2">Logistik-Notizen: {suggestion.basis.usedKnowledge.logisticsNotesCount}</div>
                          </div>
                        </div>
                        {suggestion.basis.operatorInput ? (
                          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                            <div className="font-medium text-slate-950">Operator-Hinweise</div>
                            <div className="mt-3 space-y-3">
                              {suggestion.basis.operatorInput.additionalContext ? (
                                <div className="rounded-xl bg-slate-50 px-3 py-2">{suggestion.basis.operatorInput.additionalContext}</div>
                              ) : null}
                              {suggestion.basis.operatorInput.mustMention?.length ? (
                                <SectionList title="Muss erwähnt werden" items={suggestion.basis.operatorInput.mustMention} />
                              ) : null}
                              {suggestion.basis.operatorInput.mustAvoid?.length ? (
                                <SectionList title="Muss vermieden werden" items={suggestion.basis.operatorInput.mustAvoid} tone="warning" />
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-4">
                        <KnowledgeHitList title="Im Entwurf berücksichtigte Knowledge-Treffer" items={suggestion.basis.knowledgeHits} />
                        <AiMetaPanel meta={suggestion.meta} />
                      </div>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid gap-4 2xl:grid-cols-[0.95fr_1.05fr]">
              <Card className="rounded-2xl border-slate-200">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Rückfrage zur aktuellen Mail</CardTitle>
                      <CardDescription>Kontextgebundener Mini-Chat für Klärungen und optionale Wissensgewinnung, nicht als allgemeiner Chatbot.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                    <div>
                      <Label>Modus</Label>
                      <Select value={chatMode} onValueChange={(next) => setChatMode(next as "reply" | "knowledge_capture")}>
                        <SelectTrigger className="mt-2 rounded-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="reply">Antwortklärung</SelectItem>
                          <SelectItem value="knowledge_capture">Wissensgewinnung</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Rückfrage</Label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Konkrete Rückfrage zur geöffneten Mail" />
                        <Button type="button" className="rounded-full" disabled={!selectedMessageId || chatStatus === "loading" || !chatInput.trim()} onClick={() => void handleSendChat()}>
                          Rückfrage senden
                        </Button>
                      </div>
                    </div>
                  </div>

                  {chatHistory.length ? (
                    <div className="space-y-2 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Verlauf</div>
                      {chatHistory.map((item, index) => (
                        <div key={`${item.role}-${index}-${item.message}`} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.role === "user" ? "Operator" : "Assistenz"}</div>
                          <div className="whitespace-pre-line leading-6">{item.message}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {chatStatus === "loading" ? <LoadingState label="Beantworte Rückfrage..." /> : null}
                  {chatStatus === "error" ? <ErrorState title="Rückfrage nicht verfügbar" message={chatError} /> : null}

                  {chatResult ? (
                    <div className="space-y-4">
                      <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Antwort</div>
                        <div className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-800">{chatResult.result.answer}</div>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <SectionList title="Verwendete Fakten" items={chatResult.result.usedFacts} emptyMessage="Keine gesondert ausgewiesenen Fakten." />
                        <SectionList title="Offene Punkte" items={chatResult.result.unknowns} tone="warning" emptyMessage="Keine offenen Punkte markiert." />
                      </div>
                      {chatResult.result.knowledgeSuggestions.length ? (
                        <div className="space-y-3 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-950">Potenzielle Wissensbausteine</div>
                              <div className="text-sm text-slate-600">Diese Vorschläge sind noch nicht Teil der freigegebenen Wissensbasis.</div>
                            </div>
                            <Button type="button" variant="outline" className="rounded-full" onClick={() => void handleCreateKnowledgeSuggestions()}>
                              In Reviewliste übernehmen
                            </Button>
                          </div>
                          <div className="grid gap-3">
                            {chatResult.result.knowledgeSuggestions.map((item) => (
                              <div key={`${item.topic}-${item.title}-${item.content}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-600">
                                    {item.topic}
                                  </Badge>
                                  <div className="font-medium text-slate-950">{item.title}</div>
                                </div>
                                <div className="mt-3 text-sm leading-6 text-slate-700">{item.content}</div>
                                {item.rationale ? <div className="mt-3 text-xs text-slate-500">Begründung: {item.rationale}</div> : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <KnowledgeHitList title="Im Chat verfügbare Knowledge-Treffer" items={chatResult.basis.knowledgeHits} />
                      <AiReviewPanel review={chatResult.review} message="Bitte Antwort und vorgeschlagene Wissensbausteine vor der Weiterverwendung kurz prüfen." />
                      <AiWarningsPanel warnings={chatResult.warnings} />
                      <AiMetaPanel meta={chatResult.meta} />
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                      <BookOpenText className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Wissensreview und Basis</CardTitle>
                      <CardDescription>Vorschläge bleiben reviewpflichtig, freigegebene Einträge bilden die wiederverwendbare Wissensbasis.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-3">
                    <div className="text-sm text-slate-600">Offene Vorschläge beziehen sich auf die aktuell geöffnete Mail. Die Wissensbasis rechts darunter bleibt eventweit freigegeben.</div>
                    <Button type="button" variant="outline" className="rounded-full" disabled={!selectedMessageId || knowledgeSuggestionsStatus === "loading"} onClick={() => void handleCreateKnowledgeSuggestions()}>
                      Vorschläge aus Mail ableiten
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">Offene Wissensvorschläge</div>
                        <div className="text-sm text-slate-600">Reviewbare Vorschläge mit Themenbezug und Mail-Kontext.</div>
                      </div>
                      <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-600">
                        {knowledgeSuggestions.length}
                      </Badge>
                    </div>
                    {knowledgeSuggestionsStatus === "loading" ? <LoadingState label="Lade Wissensvorschläge..." /> : null}
                    {knowledgeSuggestionsStatus === "error" ? <ErrorState title="Wissensvorschläge nicht verfügbar" message={knowledgeSuggestionsError} /> : null}
                    {knowledgeSuggestionsStatus !== "loading" && knowledgeSuggestionsStatus !== "error" && knowledgeSuggestions.length === 0 ? (
                      <EmptyState message="Für diese Mail liegen aktuell keine offenen Wissensvorschläge vor." />
                    ) : null}
                    {knowledgeSuggestions.map((item) => (
                      <div key={item.id} className="rounded-[1.4rem] border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-600">
                                {item.topic}
                              </Badge>
                              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                                {item.status}
                              </Badge>
                            </div>
                            <div className="font-medium text-slate-950">{item.title}</div>
                            <div className="text-sm leading-6 text-slate-700">{item.content}</div>
                            {item.rationale ? <div className="text-xs text-slate-500">Begründung: {item.rationale}</div> : null}
                            <div className="text-xs text-slate-500">Erzeugt am {formatDateTime(item.createdAt)}</div>
                          </div>
                          <Button
                            type="button"
                            className="rounded-full"
                            size="sm"
                            disabled={knowledgeActionBusyId === item.id}
                            onClick={() => void handleApproveKnowledgeSuggestion(item.id)}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            {knowledgeActionBusyId === item.id ? "Übernimmt..." : "In Wissensbasis übernehmen"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">Freigegebene Wissensbasis</div>
                        <div className="text-sm text-slate-600">Bereits übernommene Regeln und Fakten, die später wiederverwendet werden können.</div>
                      </div>
                      <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-600">
                        {approvedKnowledgeItems.length}
                      </Badge>
                    </div>
                    {approvedKnowledgeStatus === "loading" ? <LoadingState label="Lade Wissensbasis..." /> : null}
                    {approvedKnowledgeStatus === "error" ? <ErrorState title="Wissensbasis nicht verfügbar" message={approvedKnowledgeError} /> : null}
                    {approvedKnowledgeStatus !== "loading" && approvedKnowledgeStatus !== "error" && approvedKnowledgeItems.length === 0 ? (
                      <EmptyState message="Noch keine freigegebenen Wissenseinträge vorhanden." />
                    ) : null}
                    {approvedKnowledgeItems.map((item) => (
                      <div key={item.id} className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="border-slate-300 bg-white text-slate-600">
                                {item.topic}
                              </Badge>
                              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                {item.status}
                              </Badge>
                            </div>
                            <div className="font-medium text-slate-950">{item.title}</div>
                            <div className="text-sm leading-6 text-slate-700">{item.content}</div>
                            <div className="text-xs text-slate-500">Freigegeben am {formatDateTime(item.createdAt)}</div>
                          </div>
                          {item.messageId === selectedMessageId ? (
                            <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                              Bezug zur aktuellen Mail
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </AiCommunicationShell>
  );
}
