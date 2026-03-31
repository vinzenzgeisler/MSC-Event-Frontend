export type AiTaskStatus = "idle" | "loading" | "success" | "error";

export type AiConfidence = "low" | "medium" | "high";

export type AiNoticeTone = "info" | "warning" | "critical" | "success";

export type AiWarningSeverity = "low" | "medium" | "high";

export type AiCommunicationToolKey = "mail-assistant" | "report-generator" | "speaker-assistant";

export type AiDashboardTool = {
  key: AiCommunicationToolKey;
  title: string;
  description: string;
  href: string;
  statLabel: string;
  bulletPoints: string[];
  availabilityLabel: string;
};

export type AiWarning = {
  code: string;
  severity: AiWarningSeverity;
  message: string;
  displayMessage?: string;
  recommendation?: string;
};

export type AiReview = {
  required: boolean;
  status: "draft";
  confidence: AiConfidence;
  reason?: string;
  recommendedChecks?: string[];
  blockingIssues?: string[];
};

export type AiMeta = {
  modelId: string;
  promptVersion: string;
  generatedAt: string;
};

export type AiEnvelopeBase = {
  ok: boolean;
  warnings: AiWarning[];
  review: AiReview;
  meta: AiMeta;
};

export type AiMessageStatus = "imported" | "processed" | "archived";

export type AiKnowledgeTopic = "documents" | "payment" | "interview" | "logistics" | "contact" | "general";

export type AiKnowledgeSuggestionStatus = "suggested" | "approved" | "rejected" | "archived";

export type AiKnowledgeItemStatus = "suggested" | "approved" | "archived";

export type AiKnowledgeSourceType = "ai_suggested" | "manual";

export type AiKnowledgeHit = {
  id?: string;
  topic: AiKnowledgeTopic;
  title: string;
  content: string;
};

export type AiMessageListItem = {
  id: string;
  source: string;
  mailboxKey: string;
  fromEmail: string | null;
  fromName: string | null;
  toEmail: string | null;
  subject: string | null;
  receivedAt: string | null;
  eventId: string | null;
  entryId: string | null;
  status: AiMessageStatus;
  aiSummary: string | null;
  aiCategory: string | null;
  textContent: string;
  createdAt: string;
  preview: string;
};

export type AiMessageDetail = AiMessageListItem & {
  aiLastProcessedAt: string | null;
  bodyText: string;
  bodyHtml: string | null;
  bodyFormat: "text" | "html+text";
  snippet: string;
};

export type AiMessageBasis = {
  event: {
    id: string;
    name: string | null;
    contactEmail: string | null;
  } | null;
  entry: {
    id: string;
    registrationStatus: string | null;
    registrationStatusLabel?: string | null;
    acceptanceStatus: string | null;
    acceptanceStatusLabel?: string | null;
    paymentStatus: string | null;
    paymentStatusLabel?: string | null;
    orgaCode: string | null;
    amountOpenCents?: number | null;
    driverName?: string | null;
    className?: string | null;
    vehicleLabel?: string | null;
    detailPath?: string;
  } | null;
};

export type AiMessageAssistantContext = {
  knowledgeHits: AiKnowledgeHit[];
};

export type AiMessageDetailResponse = {
  ok: boolean;
  message: AiMessageDetail;
  basis: AiMessageBasis;
  assistantContext: AiMessageAssistantContext;
};

export type ReplySuggestionRequest = {
  tone?: "friendly" | "neutral" | "formal";
  includeWarnings?: boolean;
  additionalContext?: string;
  mustMention?: string[];
  mustAvoid?: string[];
};

export type ReplySuggestionResult = {
  summary: string;
  category: string;
  replySubject: string;
  answerFacts: string[];
  unknowns: string[];
  replyDraft: string;
  analysis: {
    intent: string;
    language: string;
  };
};

export type ReplySuggestionBasis = {
  message: {
    id: string;
    subject: string | null;
  };
  event: {
    id: string;
    name: string | null;
    contactEmail: string | null;
  } | null;
  entry: {
    id: string;
    registrationStatus: string | null;
    registrationStatusLabel?: string | null;
    acceptanceStatus: string | null;
    acceptanceStatusLabel?: string | null;
    paymentStatus: string | null;
    paymentStatusLabel?: string | null;
    amountOpenCents?: number | null;
    paymentReference: string | null;
  } | null;
  knowledgeHits: AiKnowledgeHit[];
  operatorInput: {
    additionalContext?: string | null;
    mustMention?: string[];
    mustAvoid?: string[];
  } | null;
  usedKnowledge: {
    faqCount: number;
    logisticsNotesCount: number;
    approvedKnowledgeCount: number;
    previousOutgoingCount: number;
    basedOnPreviousCorrespondence?: boolean;
  };
};

export type AiReplySuggestionEnvelope = AiEnvelopeBase & {
  messageId: string;
  task: "reply_suggestion";
  result: ReplySuggestionResult;
  basis: ReplySuggestionBasis;
};

export type AiChatHistoryMessage = {
  role: "user" | "assistant";
  message: string;
};

export type AiMessageChatRequest = {
  message: string;
  history?: AiChatHistoryMessage[];
  contextMode?: "reply" | "knowledge_capture";
};

export type AiKnowledgeSuggestionDraft = {
  topic: AiKnowledgeTopic;
  title: string;
  content: string;
  rationale?: string;
};

export type AiMessageChatEnvelope = AiEnvelopeBase & {
  messageId: string;
  task: "message_chat";
  result: {
    answer: string;
    usedFacts: string[];
    unknowns: string[];
    knowledgeSuggestions: AiKnowledgeSuggestionDraft[];
  };
  basis: {
    message: {
      id: string;
      subject: string | null;
    };
    knowledgeHits: AiKnowledgeHit[];
    historyCount: number;
    contextMode: "reply" | "knowledge_capture";
  };
};

export type AiGenerateKnowledgeSuggestionsRequest = {
  additionalContext?: string;
  history?: AiChatHistoryMessage[];
  topicHint?: AiKnowledgeTopic;
};

export type AiKnowledgeSuggestion = {
  id: string;
  eventId: string | null;
  messageId: string | null;
  topic: AiKnowledgeTopic;
  title: string;
  content: string;
  rationale: string | null;
  status: AiKnowledgeSuggestionStatus;
  sourceType: AiKnowledgeSourceType;
  createdAt: string;
  updatedAt: string;
};

export type AiKnowledgeSuggestionEnvelope = AiEnvelopeBase & {
  messageId: string;
  task: "knowledge_suggestions";
  result: {
    suggestions: AiKnowledgeSuggestion[];
  };
  basis: {
    message: {
      id: string;
      subject: string | null;
    };
    approvedKnowledge: AiKnowledgeHit[];
    operatorInput: string | null;
    historyCount: number;
  };
};

export type AiKnowledgeItem = {
  id: string;
  eventId: string | null;
  messageId: string | null;
  suggestionId: string | null;
  topic: AiKnowledgeTopic;
  title: string;
  content: string;
  status: AiKnowledgeItemStatus;
  sourceType: AiKnowledgeSourceType;
  createdAt: string;
  updatedAt: string;
};

export type CreateKnowledgeItemRequest = {
  suggestionId?: string;
  eventId?: string;
  messageId?: string;
  topic?: AiKnowledgeTopic;
  title?: string;
  content?: string;
  status?: AiKnowledgeItemStatus;
  metadata?: Record<string, unknown>;
};

export type AiDraftTaskType = "reply_suggestion" | "event_report" | "speaker_text";

export type AiDraftStatus = "draft" | "reviewed" | "archived";

export type AiDraftListItem = {
  id: string;
  taskType: AiDraftTaskType;
  title: string | null;
  status: AiDraftStatus;
  eventId: string | null;
  entryId: string | null;
  messageId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaveDraftRequest = {
  taskType: AiDraftTaskType;
  title?: string;
  status?: AiDraftStatus;
  eventId?: string;
  entryId?: string;
  messageId?: string;
  promptVersion?: string;
  modelId?: string;
  inputSnapshot?: Record<string, unknown>;
  outputPayload: Record<string, unknown>;
  warnings?: Array<string | AiWarning>;
};

export type AiReportFormat = "website" | "short_summary";

export type AiReportTone = "neutral" | "friendly" | "formal";

export type AiReportLength = "short" | "medium" | "long";

export type AiEventReportRequest = {
  eventId: string;
  classId?: string;
  scope: "event" | "class";
  formats: AiReportFormat[];
  tone?: AiReportTone;
  length?: AiReportLength;
  highlights: string[];
};

export type AiEventReportVariant = {
  format: AiReportFormat;
  title: string | null;
  teaser: string | null;
  text: string;
};

export type AiEventReportEnvelope = AiEnvelopeBase & {
  eventId: string;
  task: "event_report";
  result: {
    variants: AiEventReportVariant[];
  };
  basis: {
    scope: "event" | "class";
    event: {
      id: string;
      name: string | null;
    };
    class: {
      id: string;
      name: string | null;
    } | null;
    facts: {
      entriesTotal: number;
      acceptedTotal: number;
      paidTotal: number;
    };
    highlights: string[];
  };
};

export type AiSpeakerMode = "short_intro" | "driver_intro" | "class_overview";

export type AiSpeakerRequest = {
  eventId: string;
  entryId?: string;
  classId?: string;
  mode: AiSpeakerMode;
  highlights: string[];
};

export type AiSpeakerTextEnvelope = AiEnvelopeBase & {
  eventId: string;
  task: "speaker_text";
  result: {
    text: string;
    facts: string[];
  };
  basis: {
    focusType: "entry" | "class";
    context: Record<string, unknown>;
    highlights: string[];
  };
};
