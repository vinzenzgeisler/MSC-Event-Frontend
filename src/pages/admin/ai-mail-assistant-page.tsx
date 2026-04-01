import { useEffect, useMemo, useState } from "react";
import { BookOpenText, Bot, Check, ChevronLeft, ChevronRight, Copy, Info, Link2, Plus, RefreshCcw, Save, Sparkles, X } from "lucide-react";
import { Link } from "react-router-dom";
import { aiActiveOutlineButtonClass, aiPrimaryButtonClass } from "@/components/features/admin/ai-communication/ai-button-styles";
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
  AiDraftDetail,
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

type ManualKnowledgeFormState = {
  topic: "documents" | "payment" | "interview" | "logistics" | "contact" | "general";
  title: string;
  content: string;
};

type KnowledgeEditFormState = {
  topic: "documents" | "payment" | "interview" | "logistics" | "contact" | "general";
  title: string;
  content: string;
};

const initialSuggestionOptions: SuggestionOptionsState = {
  additionalContext: "",
  mustMention: "",
  mustAvoid: ""
};

const initialManualKnowledgeForm: ManualKnowledgeFormState = {
  topic: "general",
  title: "",
  content: ""
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

function normalizeDraftWarnings(value: AiDraftDetail["warnings"] | undefined): AiReplySuggestionEnvelope["warnings"] {
  if (!value?.length) {
    return [];
  }

  return value.flatMap((item) =>
    typeof item === "string"
      ? [
          {
            code: "draft_warning",
            severity: "low" as const,
            message: item,
            displayMessage: item
          }
        ]
      : [item]
  );
}

function hydrateReplyEnvelopeFromDraft(draft: AiDraftDetail): AiReplySuggestionEnvelope | null {
  const payload = draft.outputPayload as Partial<AiReplySuggestionEnvelope["result"]> & {
    basis?: AiReplySuggestionEnvelope["basis"];
    review?: AiReplySuggestionEnvelope["review"];
    warnings?: AiReplySuggestionEnvelope["warnings"];
  };

  if (typeof payload.replyDraft !== "string" && typeof payload.replySubject !== "string") {
    return null;
  }

  const basis = {
    message: {
      id: payload.basis?.message?.id ?? draft.messageId ?? "",
      subject: payload.basis?.message?.subject ?? draft.title
    },
    event: payload.basis?.event ?? null,
    entry: payload.basis?.entry ?? null,
    knowledgeHits: Array.isArray(payload.basis?.knowledgeHits) ? payload.basis.knowledgeHits : [],
    operatorInput: payload.basis?.operatorInput ?? null,
    usedKnowledge: {
      faqCount: payload.basis?.usedKnowledge?.faqCount ?? 0,
      logisticsNotesCount: payload.basis?.usedKnowledge?.logisticsNotesCount ?? 0,
      approvedKnowledgeCount: payload.basis?.usedKnowledge?.approvedKnowledgeCount ?? 0,
      previousOutgoingCount: payload.basis?.usedKnowledge?.previousOutgoingCount ?? 0,
      basedOnPreviousCorrespondence: payload.basis?.usedKnowledge?.basedOnPreviousCorrespondence ?? false
    }
  } satisfies AiReplySuggestionEnvelope["basis"];

  return {
    ok: true,
    task: "reply_suggestion",
    messageId: draft.messageId ?? "",
    result: {
      summary: typeof payload.summary === "string" ? payload.summary : "",
      category: typeof payload.category === "string" ? payload.category : "",
      replySubject: typeof payload.replySubject === "string" ? payload.replySubject : "",
      answerFacts: Array.isArray(payload.answerFacts) ? payload.answerFacts.filter((item): item is string => typeof item === "string") : [],
      unknowns: Array.isArray(payload.unknowns) ? payload.unknowns.filter((item): item is string => typeof item === "string") : [],
      replyDraft: typeof payload.replyDraft === "string" ? payload.replyDraft : "",
      analysis: payload.analysis ?? {
        intent: "",
        language: ""
      }
    },
    basis,
    review: draft.review ?? payload.review ?? { required: false, status: "draft", confidence: "medium" },
    warnings: normalizeDraftWarnings(draft.warnings ?? payload.warnings),
    meta: {
      modelId: draft.modelId ?? "—",
      promptVersion: draft.promptVersion ?? "—",
      generatedAt: draft.updatedAt ?? draft.createdAt
    }
  };
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

function SectionList(props: {
  title: string;
  items: string[];
  tone?: "neutral" | "warning";
  emptyMessage?: string;
  onRemoveItem?: (item: string, index: number) => void;
  removeLabel?: string;
}) {
  if (!props.items.length && !props.emptyMessage) {
    return null;
  }

  return (
    <div className="h-full rounded-3xl border border-slate-200 bg-white p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{props.title}</div>
      {props.items.length ? (
        <div className="mt-4 space-y-3">
          {props.items.map((item, index) => (
            <div
              key={`${item}-${index}`}
              className={cn(
                "flex items-start justify-between gap-3 rounded-2xl px-4 py-3.5 text-sm leading-7",
                props.tone === "warning" ? "border border-amber-200 bg-amber-50 text-amber-900" : "border border-slate-200 bg-slate-50 text-slate-700"
              )}
            >
              <div className="min-w-0 flex-1">{item}</div>
              {props.onRemoveItem ? (
                <button
                  type="button"
                  className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
                  onClick={() => props.onRemoveItem?.(item, index)}
                  aria-label={props.removeLabel ?? "Eintrag entfernen"}
                  title={props.removeLabel ?? "Eintrag entfernen"}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
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
    <div className="space-y-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{props.title}</div>
      <div className="grid items-stretch gap-4 md:grid-cols-2">
        {props.items.map((item) => (
          <div key={`${item.id ?? item.title}-${item.content}`} className="flex h-full flex-col rounded-3xl border border-slate-200 bg-slate-50/90 p-5">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-slate-300 bg-white text-slate-600">
                {item.topic}
              </Badge>
            </div>
            <div className="mt-4 font-medium text-slate-950">{item.title}</div>
            <div className="mt-3 flex-1 text-sm leading-7 text-slate-600">{item.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const aiToolbarButtonClass =
  "h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-none hover:bg-slate-50 hover:text-slate-950";

function HoverHint(props: { label: string; tone?: "neutral" | "warning" | "critical"; children: React.ReactNode }) {
  const toneClass =
    props.tone === "critical"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : props.tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className="group relative inline-flex">
      <button
        type="button"
        className={cn("inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors", toneClass)}
        aria-label={props.label}
        title={props.label}
      >
        <Info className="h-3.5 w-3.5" />
        <span>{props.label}</span>
      </button>
      <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-[320px] rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm leading-6 text-slate-700 shadow-xl group-hover:block group-focus-within:block">
        {props.children}
      </div>
    </div>
  );
}

function EvidenceSummary(props: {
  facts: string[];
  unknowns: string[];
  review: AiReplySuggestionEnvelope["review"];
  warnings: AiReplySuggestionEnvelope["warnings"];
  onRemoveFact: (index: number) => void;
  onRemoveUnknown: (index: number) => void;
}) {
  return (
    <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {props.facts.length ? (
          <HoverHint label={`Fakten ${props.facts.length > 0 ? `(${props.facts.length})` : ""}`.trim()}>
            <div className="space-y-3">
              {props.facts.map((fact, index) => (
                <div key={`${fact}-${index}`} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="min-w-0 flex-1">{fact}</div>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
                    onClick={() => props.onRemoveFact(index)}
                    aria-label="Fakt aus Entwurf entfernen"
                    title="Fakt aus Entwurf entfernen"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </HoverHint>
        ) : (
          <span className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-500">
            Keine hervorgehobenen Fakten
          </span>
        )}

        {props.unknowns.length ? (
          <HoverHint label={`Offene Punkte (${props.unknowns.length})`} tone="warning">
            <div className="space-y-3">
              {props.unknowns.map((unknown, index) => (
                <div key={`${unknown}-${index}`} className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-amber-900">
                  <div className="min-w-0 flex-1">{unknown}</div>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-amber-700/70 transition-colors hover:bg-white/70 hover:text-amber-900"
                    onClick={() => props.onRemoveUnknown(index)}
                    aria-label="Offenen Punkt entfernen"
                    title="Offenen Punkt entfernen"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </HoverHint>
        ) : (
          <span className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-500">
            Keine offenen Punkte
          </span>
        )}

        {props.review.required ? (
          <HoverHint label="Menschliche Prüfung erforderlich" tone="critical">
            <div className="space-y-3">
              <div>Bitte Betreff, Antworttext, Zusagen und fachliche Aussagen vor dem Übernehmen manuell prüfen.</div>
              {props.review.reason ? <div><span className="font-medium text-slate-950">Grund:</span> {props.review.reason}</div> : null}
              {props.review.blockingIssues?.length ? (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Vor Übernahme klären</div>
                  <ul className="mt-2 space-y-1">
                    {props.review.blockingIssues.map((issue) => (
                      <li key={issue}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {props.review.recommendedChecks?.length ? (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Empfohlene Prüfungen</div>
                  <ul className="mt-2 space-y-1">
                    {props.review.recommendedChecks.map((check) => (
                      <li key={check}>• {check}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Badge variant="outline" className={cn("border", confidenceClass(props.review.confidence))}>
                {confidenceLabel(props.review.confidence)}
              </Badge>
            </div>
          </HoverHint>
        ) : null}

        {props.warnings.length ? (
          <HoverHint label={`Warnungen ${props.warnings.length > 1 ? `(${props.warnings.length})` : ""}`.trim()} tone="warning">
            <div className="space-y-3">
              {props.warnings.map((warning) => (
                <div key={`${warning.code}:${warning.message}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900">
                      {warning.severity}
                    </Badge>
                    <span className="text-xs text-slate-500">{warning.code}</span>
                  </div>
                  <div className="mt-2">{warning.displayMessage || warning.message}</div>
                  {warning.recommendation ? <div className="mt-2 text-slate-600">Empfehlung: {warning.recommendation}</div> : null}
                </div>
              ))}
            </div>
          </HoverHint>
        ) : null}
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
  const [activeDraftId, setActiveDraftId] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [editableAnswerFacts, setEditableAnswerFacts] = useState<string[]>([]);
  const [editableUnknowns, setEditableUnknowns] = useState<string[]>([]);
  const [editableReplySubject, setEditableReplySubject] = useState("");
  const [editableReplyDraft, setEditableReplyDraft] = useState("");
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
  const [editingKnowledgeItemId, setEditingKnowledgeItemId] = useState("");
  const [knowledgeEditForm, setKnowledgeEditForm] = useState<KnowledgeEditFormState | null>(null);
  const [manualKnowledgeForm, setManualKnowledgeForm] = useState<ManualKnowledgeFormState>(initialManualKnowledgeForm);
  const [manualKnowledgeSaving, setManualKnowledgeSaving] = useState(false);
  const [activeWorkbenchPanel, setActiveWorkbenchPanel] = useState<"assistant" | "knowledge">("knowledge");
  const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null);

  const applySuggestionToEditor = (nextSuggestion: AiReplySuggestionEnvelope | null) => {
    setSuggestion(nextSuggestion);
    setEditableReplySubject(nextSuggestion?.result.replySubject ?? "");
    setEditableReplyDraft(nextSuggestion?.result.replyDraft ?? "");
    setEditableAnswerFacts(nextSuggestion?.result.answerFacts ?? []);
    setEditableUnknowns(nextSuggestion?.result.unknowns ?? []);
  };

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
      setActiveDraftId("");
      applySuggestionToEditor(null);
      return;
    }

    setDetailLoading(true);
    setDetailError("");
    setDraftLoading(true);
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

    aiCommunicationService
      .listDrafts({ taskType: "reply_suggestion", limit: 50 })
      .then(async (drafts) => {
        const replyDraft = drafts.find((draft) => draft.messageId === selectedMessageId);
        if (!replyDraft) {
          setActiveDraftId("");
          applySuggestionToEditor(null);
          return;
        }

        const draftDetail = await aiCommunicationService.getDraft(replyDraft.id);
        const hydratedSuggestion = hydrateReplyEnvelopeFromDraft(draftDetail);
        setActiveDraftId(draftDetail.id);
        if (hydratedSuggestion) {
          applySuggestionToEditor(hydratedSuggestion);
          setSuggestionStatus("success");
          setSuggestionError("");
        }
      })
      .catch(() => {
        setActiveDraftId("");
      })
      .finally(() => setDraftLoading(false));

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
    applySuggestionToEditor(null);
    setActiveDraftId("");
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
      applySuggestionToEditor(response);
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
      const outputPayload = {
        summary: suggestion.result.summary,
        category: suggestion.result.category,
        replySubject: editableReplySubject,
        answerFacts: editableAnswerFacts,
        unknowns: editableUnknowns,
        replyDraft: editableReplyDraft,
        analysis: suggestion.result.analysis,
        basis: suggestion.basis
      };

      const persistedDraft = activeDraftId
        ? await aiCommunicationService.updateDraft(activeDraftId, {
            replySubject: editableReplySubject,
            replyDraft: editableReplyDraft,
            answerFacts: editableAnswerFacts,
            unknowns: editableUnknowns,
            operatorEdits: {
              source: "frontend-edit"
            }
          })
        : await aiCommunicationService.saveDraft({
            taskType: "reply_suggestion",
            status: suggestion.review.status,
            messageId: suggestion.messageId,
            eventId: messageBasis?.event?.id ?? selectedMessage?.eventId ?? undefined,
            entryId: messageBasis?.entry?.id ?? selectedMessage?.entryId ?? undefined,
            title: editableReplySubject,
            promptVersion: suggestion.meta.promptVersion,
            modelId: suggestion.meta.modelId,
            inputSnapshot: {
              tone,
              includeWarnings,
              additionalContext: suggestionOptions.additionalContext.trim() || undefined,
              mustMention: listFromTextarea(suggestionOptions.mustMention),
              mustAvoid: listFromTextarea(suggestionOptions.mustAvoid)
            },
            outputPayload,
            warnings: suggestion.warnings
          });

      const refreshedDraft = await aiCommunicationService.getDraft(persistedDraft.id);
      const hydratedSuggestion = hydrateReplyEnvelopeFromDraft(refreshedDraft);
      setActiveDraftId(refreshedDraft.id);
      if (hydratedSuggestion) {
        applySuggestionToEditor(hydratedSuggestion);
      }
      setActionNotice({
        tone: "success",
        title: activeDraftId ? "Entwurf aktualisiert" : "Entwurf gespeichert",
        message: activeDraftId
          ? "Der bearbeitete Antwortentwurf wurde serverseitig aktualisiert."
          : "Der Antwortentwurf wurde in der Draft-Historie abgelegt."
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

  const handleCreateManualKnowledgeItem = async () => {
    if (!manualKnowledgeForm.title.trim() || !manualKnowledgeForm.content.trim()) {
      setActionNotice({
        tone: "critical",
        title: "Wissenseintrag unvollständig",
        message: "Titel und Inhalt sind für einen manuellen Wissenseintrag erforderlich."
      });
      return;
    }

    setManualKnowledgeSaving(true);
    setActionNotice(null);

    try {
      await aiCommunicationService.createKnowledgeItem({
        eventId: messageBasis?.event?.id ?? selectedMessage?.eventId ?? undefined,
        messageId: selectedMessageId || undefined,
        topic: manualKnowledgeForm.topic,
        title: manualKnowledgeForm.title.trim(),
        content: manualKnowledgeForm.content.trim(),
        status: "approved",
        metadata: { source: "manual_ui" }
      });
      setManualKnowledgeForm(initialManualKnowledgeForm);
      await loadKnowledgeData(selectedMessageId);
      setActionNotice({
        tone: "success",
        title: "Wissenseintrag angelegt",
        message: "Der Eintrag wurde direkt in die freigegebene Wissensbasis übernommen."
      });
    } catch (error) {
      setActionNotice({
        tone: "critical",
        title: "Anlegen fehlgeschlagen",
        message: toUiErrorMessage(error, "Das Anlegen des Wissenseintrags")
      });
    } finally {
      setManualKnowledgeSaving(false);
    }
  };

  const handleStartEditingKnowledgeItem = async (itemId: string) => {
    setKnowledgeActionBusyId(itemId);
    setActionNotice(null);

    try {
      const item = await aiCommunicationService.getKnowledgeItem(itemId);
      setEditingKnowledgeItemId(item.id);
      setKnowledgeEditForm({
        topic: item.topic,
        title: item.title,
        content: item.content
      });
    } catch (error) {
      setActionNotice({
        tone: "critical",
        title: "Wissenseintrag nicht ladbar",
        message: toUiErrorMessage(error, "Das Laden des Wissenseintrags")
      });
    } finally {
      setKnowledgeActionBusyId("");
    }
  };

  const handleCancelEditingKnowledgeItem = () => {
    setEditingKnowledgeItemId("");
    setKnowledgeEditForm(null);
  };

  const handleSaveKnowledgeItem = async (itemId: string) => {
    if (!knowledgeEditForm?.title.trim() || !knowledgeEditForm.content.trim()) {
      setActionNotice({
        tone: "critical",
        title: "Wissenseintrag unvollständig",
        message: "Titel und Inhalt dürfen nicht leer sein."
      });
      return;
    }

    setKnowledgeActionBusyId(itemId);
    setActionNotice(null);

    try {
      await aiCommunicationService.updateKnowledgeItem(itemId, {
        topic: knowledgeEditForm.topic,
        title: knowledgeEditForm.title.trim(),
        content: knowledgeEditForm.content.trim(),
        status: "approved"
      });
      await loadKnowledgeData(selectedMessageId);
      setEditingKnowledgeItemId("");
      setKnowledgeEditForm(null);
      setActionNotice({
        tone: "success",
        title: "Wissenseintrag aktualisiert",
        message: "Die Änderungen wurden in der Wissensbasis gespeichert."
      });
    } catch (error) {
      setActionNotice({
        tone: "critical",
        title: "Aktualisierung fehlgeschlagen",
        message: toUiErrorMessage(error, "Die Aktualisierung des Wissenseintrags")
      });
    } finally {
      setKnowledgeActionBusyId("");
    }
  };

  const handleArchiveKnowledgeItem = async (itemId: string) => {
    setKnowledgeActionBusyId(itemId);
    setActionNotice(null);

    try {
      await aiCommunicationService.archiveKnowledgeItem(itemId);
      if (editingKnowledgeItemId === itemId) {
        setEditingKnowledgeItemId("");
        setKnowledgeEditForm(null);
      }
      await loadKnowledgeData(selectedMessageId);
      setActionNotice({
        tone: "success",
        title: "Wissenseintrag archiviert",
        message: "Der Eintrag wurde aus der freigegebenen Wissensbasis entfernt."
      });
    } catch (error) {
      setActionNotice({
        tone: "critical",
        title: "Archivierung fehlgeschlagen",
        message: toUiErrorMessage(error, "Die Archivierung des Wissenseintrags")
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
      description=""
      actions={
        <Button
          type="button"
          variant="outline"
          className={aiPrimaryButtonClass}
          onClick={() => void handleGenerate()}
          disabled={!selectedMessageId || suggestionStatus === "loading"}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Antwortvorschlag erzeugen
        </Button>
      }
    >
      {actionNotice ? (
        <AiNotice tone={actionNotice.tone} title={actionNotice.title}>
          {actionNotice.message}
        </AiNotice>
      ) : null}

      {messagesLoading ? <LoadingState label="Lade AI-Nachrichtenliste..." /> : null}
      {!messagesLoading && messagesError ? <ErrorState message={messagesError} /> : null}

      {!messagesLoading && !messagesError ? (
        <div className="grid items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className={cn("space-y-4 xl:sticky xl:top-0", !showInboxOnMobile ? "hidden xl:block" : "")}>
            <Card className="rounded-3xl border-slate-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Posteingang</CardTitle>
                <CardDescription>Importierte Nachrichten für den KI-gestützten Antwort- und Wissensfluss.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
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
                          "w-full rounded-2xl border px-4 py-4 text-left transition",
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
                            <div className={cn("mt-2 line-clamp-3 text-sm leading-6", isActive ? "text-slate-300" : "text-slate-500")}>{message.preview}</div>
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

            <Card className="rounded-3xl border-slate-200">
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
                    <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-lg font-semibold text-slate-950">{originalSubject || "Ohne Betreff"}</div>
                            <div className="mt-4 grid gap-4 text-sm leading-6 text-slate-600 sm:grid-cols-2">
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
                                  setActionNotice(null);
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
                      <div className="space-y-4 px-6 py-6">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Nachricht</div>
                        <div className="rounded-3xl bg-slate-50 px-5 py-5 text-sm leading-8 text-slate-800">
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
                      <div className="space-y-5 rounded-[1.6rem] border border-slate-200 bg-slate-50/70 p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                            <Link2 className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-950">Erkannter Systemkontext</div>
                            <div className="text-sm text-slate-600">Nur die vorhandenen Systemdaten werden angezeigt; fehlender Kontext bleibt explizit sichtbar.</div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {messageBasis?.event ? (
                            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3.5">
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Event</span>
                                <span className="font-medium text-slate-950">{messageBasis.event.name || "Event erkannt"}</span>
                                {messageBasis.event.contactEmail ? <span className="text-slate-500">· {messageBasis.event.contactEmail}</span> : null}
                              </div>
                            </div>
                          ) : null}

                          {messageBasis?.entry ? (
                            <div className="rounded-3xl border border-slate-200 bg-white p-5">
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
                              <div className="mt-5 flex flex-wrap gap-2">
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
                                <div className="mt-5 grid gap-3 text-sm leading-6 text-slate-700 sm:grid-cols-2">
                                  {messageBasis.entry.orgaCode ? <div className="rounded-2xl bg-slate-50 px-4 py-3">Orga-Code: {messageBasis.entry.orgaCode}</div> : null}
                                  {typeof messageBasis.entry.amountOpenCents === "number" ? (
                                    <div className="rounded-2xl bg-slate-50 px-4 py-3">Offener Betrag: {formatCurrency(messageBasis.entry.amountOpenCents)}</div>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>

                        {assistantContext.knowledgeHits.length ? (
                          <details className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70">
                            <summary className="cursor-pointer list-none px-4 py-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Freigegebene Wissens-Treffer</div>
                                  <div className="mt-1 text-sm text-slate-600">Kontext aus freigegebener Wissensbasis bei Bedarf einblenden.</div>
                                </div>
                                <Badge variant="outline" className="border-slate-300 bg-white text-slate-600">
                                  {assistantContext.knowledgeHits.length}
                                </Badge>
                              </div>
                            </summary>
                            <div className="border-t border-slate-200 p-4">
                              <KnowledgeHitList title="Freigegebene Wissens-Treffer" items={assistantContext.knowledgeHits} />
                            </div>
                          </details>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200">
              <CardHeader className="gap-4">
                <div className="space-y-3">
                  <CardTitle className="text-lg">Antwortentwurf</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-[150px]">
                      <Select value={tone} onValueChange={(next) => setTone(next as NonNullable<ReplySuggestionRequest["tone"]>)}>
                        <SelectTrigger className="h-9 rounded-md border-slate-200 bg-white text-sm shadow-none">
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
                      className={includeWarnings ? aiActiveOutlineButtonClass : aiToolbarButtonClass}
                      onClick={() => setIncludeWarnings((current) => !current)}
                    >
                      Warnhinweise {includeWarnings ? "an" : "aus"}
                    </Button>
                    <Button
                      type="button"
                      variant={showSuggestionOptions ? "default" : "outline"}
                      className={showSuggestionOptions ? aiActiveOutlineButtonClass : aiToolbarButtonClass}
                      onClick={() => setShowSuggestionOptions((current) => !current)}
                    >
                      Assistenzhinweise {showSuggestionOptions ? "ausblenden" : "anzeigen"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {showSuggestionOptions ? (
                  <div className="grid gap-4 rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5 lg:grid-cols-3">
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

                <div className="flex flex-wrap items-start justify-between gap-4 rounded-[1.6rem] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <Badge variant="outline" className={cn("border px-3 py-1", hasSuggestion && suggestion ? confidenceClass(suggestion.review.confidence) : "border-slate-300 bg-white text-slate-600")}>
                      {hasSuggestion && suggestion ? confidenceLabel(suggestion.review.confidence) : "Noch kein Entwurf"}
                    </Badge>
                    {hasSuggestion && suggestion ? (
                      <div className="text-sm leading-6 text-slate-600">
                        Kategorie {suggestion.result.category} · Zusammenfassung {suggestion.result.summary}
                      </div>
                    ) : (
                      <div className="text-sm leading-6 text-slate-500">Entwurf, Warnungen und Quellenbasis bleiben nach der Generierung getrennt.</div>
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
                      disabled={!editableReplyDraft.trim()}
                      onClick={async () => {
                        if (!editableReplyDraft.trim()) return;
                        try {
                          await copyText(editableReplyDraft);
                          setActionNotice(null);
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
                {draftLoading && !hasSuggestion ? <LoadingState label="Lade letzten Antwortentwurf..." /> : null}
                {suggestionStatus === "loading" && !hasSuggestion ? <LoadingState label="Erstelle Betreff- und Antwortvorschlag..." /> : null}
                {suggestionStatus === "error" && !hasSuggestion ? <ErrorState title="Vorschlag nicht verfügbar" message={suggestionError} /> : null}
                {suggestionStatus === "error" && hasSuggestion ? (
                  <AiNotice tone="critical" title="Aktualisierung fehlgeschlagen">
                    {suggestionError}
                  </AiNotice>
                ) : null}

                {hasSuggestion && suggestion ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {activeDraftId ? (
                        <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
                          Server-Draft aktiv
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
                          Noch nicht gespeichert
                        </Badge>
                      )}
                    </div>

                    <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
                      <div className="rounded-[1.15rem] border border-slate-200 bg-slate-50/70 px-4 py-3">
                        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Antwort-Betreff</div>
                        <Input
                          className="mt-2 h-10 rounded-xl border-slate-200 bg-white text-sm font-medium text-slate-950 shadow-none"
                          value={editableReplySubject}
                          onChange={(event) => setEditableReplySubject(event.target.value)}
                          placeholder="Antwort-Betreff"
                        />
                      </div>
                      <div className="mt-4 flex h-full flex-col rounded-[1.15rem] border border-slate-200 bg-white px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Antworttext</div>
                        <textarea
                          className={cn(textareaClassName, "mt-3 min-h-[220px] border-0 px-0 py-0 text-sm leading-8 text-slate-800 shadow-none focus-visible:ring-0")}
                          value={editableReplyDraft}
                          onChange={(event) => setEditableReplyDraft(event.target.value)}
                          placeholder="Antworttext"
                        />
                      </div>
                    </div>

                    <EvidenceSummary
                      facts={editableAnswerFacts}
                      unknowns={editableUnknowns}
                      review={suggestion.review}
                      warnings={suggestion.warnings}
                      onRemoveFact={(index) => setEditableAnswerFacts((current) => current.filter((__, currentIndex) => currentIndex !== index))}
                      onRemoveUnknown={(index) => setEditableUnknowns((current) => current.filter((__, currentIndex) => currentIndex !== index))}
                    />
                    <details className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Quellenbasis</div>
                          <div className="mt-1 text-sm text-slate-600">Mail-Kontext, Knowledge-Treffer und Operator-Hinweise bei Bedarf einblenden.</div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>Modell: {suggestion.meta.modelId}</span>
                          <span>Prompt: {suggestion.meta.promptVersion}</span>
                        </div>
                      </summary>
                      <div className="border-t border-slate-200 px-4 pb-4 pt-4">
                        {suggestion.basis.entry ? (
                          <div className="flex flex-wrap gap-2">
                            {suggestion.basis.entry.registrationStatusLabel ? (
                              <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                                {suggestion.basis.entry.registrationStatusLabel}
                              </Badge>
                            ) : null}
                            {suggestion.basis.entry.acceptanceStatusLabel ? (
                              <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                                {suggestion.basis.entry.acceptanceStatusLabel}
                              </Badge>
                            ) : null}
                            {suggestion.basis.entry.paymentStatusLabel ? (
                              <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                                {suggestion.basis.entry.paymentStatusLabel}
                              </Badge>
                            ) : null}
                            {suggestion.basis.entry.paymentReference ? (
                              <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                                Verwendungszweck: {suggestion.basis.entry.paymentReference}
                              </Badge>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                            Freigegebene Treffer: {suggestion.basis.usedKnowledge.approvedKnowledgeCount}
                          </Badge>
                          <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                            Frühere Ausgänge: {suggestion.basis.usedKnowledge.previousOutgoingCount}
                          </Badge>
                          <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                            FAQ-Treffer: {suggestion.basis.usedKnowledge.faqCount}
                          </Badge>
                          <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                            Logistik-Notizen: {suggestion.basis.usedKnowledge.logisticsNotesCount}
                          </Badge>
                        </div>

                        {suggestion.basis.operatorInput ? (
                          <details className="mt-4 rounded-2xl border border-slate-200 bg-white">
                            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-900">
                              Operator-Hinweise
                            </summary>
                            <div className="border-t border-slate-200 px-4 py-4 text-sm leading-7 text-slate-700">
                              {suggestion.basis.operatorInput.additionalContext ? <div>{suggestion.basis.operatorInput.additionalContext}</div> : null}
                              {suggestion.basis.operatorInput.mustMention?.length ? (
                                <div className="mt-3">
                                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Muss erwähnt werden</div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {suggestion.basis.operatorInput.mustMention.map((item) => (
                                      <Badge key={item} variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
                                        {item}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              {suggestion.basis.operatorInput.mustAvoid?.length ? (
                                <div className="mt-3">
                                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Muss vermieden werden</div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {suggestion.basis.operatorInput.mustAvoid.map((item) => (
                                      <Badge key={item} variant="outline" className="border-amber-200 bg-amber-50 text-amber-900">
                                        {item}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </details>
                        ) : null}

                        {suggestion.basis.knowledgeHits.length ? (
                          <details className="mt-4 rounded-2xl border border-slate-200 bg-white">
                            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-900">
                              Berücksichtigte Wissenseinträge ({suggestion.basis.knowledgeHits.length})
                            </summary>
                            <div className="grid gap-3 border-t border-slate-200 p-4 md:grid-cols-2">
                              {suggestion.basis.knowledgeHits.map((item) => (
                                <div key={`${item.id ?? item.title}-${item.content}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="border-slate-300 bg-white text-slate-600">
                                      {item.topic}
                                    </Badge>
                                  </div>
                                  <div className="mt-2 font-medium text-slate-950">{item.title}</div>
                                  <div className="mt-2 text-sm leading-6 text-slate-700">{item.content}</div>
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    </details>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <div className="space-y-4">
              {activeWorkbenchPanel === "assistant" ? (
                <Card className="rounded-3xl border-slate-200">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Rückfrage zur aktuellen Mail</CardTitle>
                        <CardDescription>Untergeordnete Assistenzfläche für eine konkrete Rückfrage zur geöffneten Mail, nicht als eigenständiger Chatmodus.</CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className={aiActiveOutlineButtonClass} onClick={() => setActiveWorkbenchPanel("assistant")}>
                        Assistenz
                      </Button>
                      <Button type="button" variant="outline" className={aiToolbarButtonClass} onClick={() => setActiveWorkbenchPanel("knowledge")}>
                        Wissensreview
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/80 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="text-sm font-semibold text-slate-950">Assistenzmodus</div>
                        <div className="text-sm text-slate-600">
                          {chatMode === "reply"
                            ? "Klärt eine konkrete Rückfrage für die Antwort auf diese Mail."
                            : "Sammelt belastbare Hinweise, die sich für spätere Wissensbausteine eignen könnten."}
                        </div>
                      </div>
                      <div className="w-full sm:w-[220px]">
                        <Select value={chatMode} onValueChange={(next) => setChatMode(next as "reply" | "knowledge_capture")}>
                          <SelectTrigger className="rounded-full bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="reply">Antwortklärung</SelectItem>
                            <SelectItem value="knowledge_capture">Wissensgewinnung</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="mt-5 space-y-2">
                      <Label>Rückfrage oder Arbeitsnotiz</Label>
                      <textarea
                        className={cn(textareaClassName, "min-h-24 bg-white")}
                        value={chatInput}
                        onChange={(event) => setChatInput(event.target.value)}
                        placeholder="Zum Beispiel: Welche Aussage ist für die Antwort belastbar? Oder: Welche Regel daraus wäre später wiederverwendbar?"
                      />
                    </div>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-slate-500">Die Assistenz sieht nur die aktuelle Mail, den erkannten Kontext und vorhandene Knowledge-Treffer.</div>
                      <Button type="button" className={aiPrimaryButtonClass} disabled={!selectedMessageId || chatStatus === "loading" || !chatInput.trim()} onClick={() => void handleSendChat()}>
                        {chatStatus === "loading" ? "Prüft..." : "Rückfrage prüfen"}
                      </Button>
                    </div>
                  </div>

                  {chatHistory.length ? (
                    <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Zuletzt geprüft</div>
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
                          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Letzte Rückfrage</div>
                          <div className="whitespace-pre-line leading-6">{[...chatHistory].reverse().find((item) => item.role === "user")?.message || "—"}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
                          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Letzte Assistenzantwort</div>
                          <div className="whitespace-pre-line leading-6">{[...chatHistory].reverse().find((item) => item.role === "assistant")?.message || "—"}</div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {chatStatus === "loading" ? <LoadingState label="Beantworte Rückfrage..." /> : null}
                  {chatStatus === "error" ? <ErrorState title="Rückfrage nicht verfügbar" message={chatError} /> : null}

                  {chatResult ? (
                    <div className="space-y-4">
                      <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Assistenzantwort</div>
                          <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-600">
                            {chatMode === "reply" ? "Antwortklärung" : "Wissensgewinnung"}
                          </Badge>
                        </div>
                        <div className="mt-4 whitespace-pre-line text-sm leading-8 text-slate-800">{chatResult.result.answer}</div>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <SectionList title="Verwendete Fakten" items={chatResult.result.usedFacts} emptyMessage="Keine gesondert ausgewiesenen Fakten." />
                        <SectionList title="Offene Punkte" items={chatResult.result.unknowns} tone="warning" emptyMessage="Keine offenen Punkte markiert." />
                      </div>
                      {chatResult.result.knowledgeSuggestions.length ? (
                        <div className="space-y-4 rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
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
                              <div key={`${item.topic}-${item.title}-${item.content}`} className="rounded-3xl border border-slate-200 bg-white p-5">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-600">
                                    {item.topic}
                                  </Badge>
                                  <div className="font-medium text-slate-950">{item.title}</div>
                                </div>
                                <div className="mt-3 text-sm leading-7 text-slate-700">{item.content}</div>
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
              ) : (
                <Card className="rounded-3xl border-slate-200">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                        <BookOpenText className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Wissensreview und Basis</CardTitle>
                        <CardDescription>Vorschläge bleiben reviewpflichtig, freigegebene Einträge bilden die wiederverwendbare Wissensbasis.</CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className={aiToolbarButtonClass} onClick={() => setActiveWorkbenchPanel("assistant")}>
                        Assistenz
                      </Button>
                      <Button type="button" variant="outline" className={aiActiveOutlineButtonClass} onClick={() => setActiveWorkbenchPanel("knowledge")}>
                        Wissensreview
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.6rem] border border-slate-200 bg-slate-50/80 p-4">
                    <div className="text-sm leading-6 text-slate-600">Offene Vorschläge beziehen sich auf die aktuell geöffnete Mail. Die Wissensbasis rechts darunter bleibt eventweit freigegeben.</div>
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
                      <div key={item.id} className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
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
                            <div className="text-sm leading-7 text-slate-700">{item.content}</div>
                            {item.rationale ? <div className="text-xs text-slate-500">Begründung: {item.rationale}</div> : null}
                            <div className="text-xs text-slate-500">Erzeugt am {formatDateTime(item.createdAt)}</div>
                          </div>
                          <Button
                            type="button"
                            className={aiPrimaryButtonClass}
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
                    <details className="rounded-[1.35rem] border border-slate-200 bg-white">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-slate-900">
                        <span>Wissensbasis manuell ergänzen</span>
                        <Plus className="h-4 w-4 text-slate-500" />
                      </summary>
                      <div className="border-t border-slate-200 px-4 py-4">
                        <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                          <div>
                            <Label>Thema</Label>
                            <Select
                              value={manualKnowledgeForm.topic}
                              onValueChange={(next) =>
                                setManualKnowledgeForm((current) => ({
                                  ...current,
                                  topic: next as ManualKnowledgeFormState["topic"]
                                }))
                              }
                            >
                              <SelectTrigger className="mt-2 rounded-xl bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="general">Allgemein</SelectItem>
                                <SelectItem value="documents">Dokumente</SelectItem>
                                <SelectItem value="payment">Zahlung</SelectItem>
                                <SelectItem value="interview">Interview</SelectItem>
                                <SelectItem value="logistics">Logistik</SelectItem>
                                <SelectItem value="contact">Kontakt</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Titel</Label>
                            <Input
                              className="mt-2 rounded-xl border-slate-200"
                              value={manualKnowledgeForm.title}
                              onChange={(event) => setManualKnowledgeForm((current) => ({ ...current, title: event.target.value }))}
                              placeholder="Kurzer Titel für die wiederverwendbare Regel oder Information"
                            />
                          </div>
                        </div>
                        <div className="mt-3">
                          <Label>Inhalt</Label>
                          <textarea
                            className={cn(textareaClassName, "mt-2 min-h-24 bg-white")}
                            value={manualKnowledgeForm.content}
                            onChange={(event) => setManualKnowledgeForm((current) => ({ ...current, content: event.target.value }))}
                            placeholder="Zum Beispiel eine belastbare Regel, eine bestätigte Logistik-Info oder eine sauber formulierte Antwortgrundlage."
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs text-slate-500">Damit fütterst du die freigegebene Wissensbasis direkt, ohne Umweg über einen Vorschlag.</div>
                          <Button type="button" className={aiPrimaryButtonClass} disabled={manualKnowledgeSaving} onClick={() => void handleCreateManualKnowledgeItem()}>
                            {manualKnowledgeSaving ? "Speichert..." : "Wissenseintrag anlegen"}
                          </Button>
                        </div>
                      </div>
                    </details>
                    {approvedKnowledgeStatus === "loading" ? <LoadingState label="Lade Wissensbasis..." /> : null}
                    {approvedKnowledgeStatus === "error" ? <ErrorState title="Wissensbasis nicht verfügbar" message={approvedKnowledgeError} /> : null}
                    {approvedKnowledgeStatus !== "loading" && approvedKnowledgeStatus !== "error" && approvedKnowledgeItems.length === 0 ? (
                      <EmptyState message="Noch keine freigegebenen Wissenseinträge vorhanden." />
                    ) : null}
                    {approvedKnowledgeItems.map((item) => (
                      <div key={item.id} className="rounded-[1.6rem] border border-slate-200 bg-slate-50/80 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="border-slate-300 bg-white text-slate-600">
                                {item.topic}
                              </Badge>
                              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                {item.status}
                              </Badge>
                              {item.messageId === selectedMessageId ? (
                                <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                                  Bezug zur aktuellen Mail
                                </Badge>
                              ) : null}
                            </div>

                            {editingKnowledgeItemId === item.id && knowledgeEditForm ? (
                              <div className="space-y-3">
                                <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                                  <div>
                                    <Label>Thema</Label>
                                    <Select
                                      value={knowledgeEditForm.topic}
                                      onValueChange={(next) =>
                                        setKnowledgeEditForm((current) =>
                                          current
                                            ? {
                                                ...current,
                                                topic: next as KnowledgeEditFormState["topic"]
                                              }
                                            : current
                                        )
                                      }
                                    >
                                      <SelectTrigger className="mt-2 rounded-xl bg-white">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="general">Allgemein</SelectItem>
                                        <SelectItem value="documents">Dokumente</SelectItem>
                                        <SelectItem value="payment">Zahlung</SelectItem>
                                        <SelectItem value="interview">Interview</SelectItem>
                                        <SelectItem value="logistics">Logistik</SelectItem>
                                        <SelectItem value="contact">Kontakt</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label>Titel</Label>
                                    <Input
                                      className="mt-2 rounded-xl border-slate-200 bg-white"
                                      value={knowledgeEditForm.title}
                                      onChange={(event) =>
                                        setKnowledgeEditForm((current) =>
                                          current
                                            ? {
                                                ...current,
                                                title: event.target.value
                                              }
                                            : current
                                        )
                                      }
                                    />
                                  </div>
                                </div>
                                <div>
                                  <Label>Inhalt</Label>
                                  <textarea
                                    className={cn(textareaClassName, "mt-2 min-h-24 bg-white")}
                                    value={knowledgeEditForm.content}
                                    onChange={(event) =>
                                      setKnowledgeEditForm((current) =>
                                        current
                                          ? {
                                              ...current,
                                              content: event.target.value
                                            }
                                          : current
                                      )
                                    }
                                  />
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    type="button"
                                    className={aiPrimaryButtonClass}
                                    disabled={knowledgeActionBusyId === item.id}
                                    onClick={() => void handleSaveKnowledgeItem(item.id)}
                                  >
                                    {knowledgeActionBusyId === item.id ? "Speichert..." : "Speichern"}
                                  </Button>
                                  <Button type="button" variant="outline" className={aiToolbarButtonClass} onClick={handleCancelEditingKnowledgeItem}>
                                    Abbrechen
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-9 rounded-md border-amber-200 bg-amber-50 px-3 text-sm font-medium text-amber-900 hover:bg-amber-100"
                                    disabled={knowledgeActionBusyId === item.id}
                                    onClick={() => void handleArchiveKnowledgeItem(item.id)}
                                  >
                                    Archivieren
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="font-medium text-slate-950">{item.title}</div>
                                <div className="text-sm leading-7 text-slate-700">{item.content}</div>
                                <div className="text-xs text-slate-500">Freigegeben am {formatDateTime(item.createdAt)}</div>
                              </>
                            )}
                          </div>
                          {editingKnowledgeItemId !== item.id ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className={aiToolbarButtonClass}
                                disabled={knowledgeActionBusyId === item.id}
                                onClick={() => void handleStartEditingKnowledgeItem(item.id)}
                              >
                                {knowledgeActionBusyId === item.id ? "Lädt..." : "Bearbeiten"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9 rounded-md border-amber-200 bg-amber-50 px-3 text-sm font-medium text-amber-900 hover:bg-amber-100"
                                disabled={knowledgeActionBusyId === item.id}
                                onClick={() => void handleArchiveKnowledgeItem(item.id)}
                              >
                                Archivieren
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </AiCommunicationShell>
  );
}
