import { getAdminEventId } from "@/services/api/event-context";
import { requestJson } from "@/services/api/http-client";
import type {
  AiDraftListItem,
  AiDraftDetail,
  AiEventReportEnvelope,
  AiReportKnowledgeSuggestionsEnvelope,
  AiReportKnowledgeSuggestionsRequest,
  AiRegenerateReportVariantRequest,
  AiEventReportRequest,
  AiGenerateKnowledgeSuggestionsRequest,
  AiKnowledgeItem,
  AiKnowledgeItemStatus,
  AiKnowledgeSuggestion,
  AiKnowledgeSuggestionEnvelope,
  AiKnowledgeSuggestionStatus,
  AiKnowledgeTopic,
  AiMessageChatEnvelope,
  AiMessageChatRequest,
  AiMessageDetailResponse,
  AiMessageListItem,
  AiMessageStatus,
  AiReplySuggestionEnvelope,
  AiSpeakerRequest,
  AiSpeakerTextEnvelope,
  CreateKnowledgeItemRequest,
  UpdateKnowledgeItemRequest,
  ReplySuggestionRequest,
  SaveDraftRequest
  ,
  UpdateAiDraftRequest
} from "@/types/ai-communication";

type ListMessagesResponse = {
  ok: boolean;
  messages: AiMessageListItem[];
};

type ListDraftsResponse = {
  ok: boolean;
  drafts: AiDraftListItem[];
};

type SaveDraftResponse = {
  ok: boolean;
  draft: AiDraftListItem;
};

type GetDraftResponse = {
  ok: boolean;
  draft: AiDraftDetail;
};

type ListKnowledgeSuggestionsResponse = {
  ok: boolean;
  suggestions: AiKnowledgeSuggestion[];
};

type ListKnowledgeItemsResponse = {
  ok: boolean;
  items: AiKnowledgeItem[];
};

type CreateKnowledgeItemResponse = {
  ok: boolean;
  item: AiKnowledgeItem;
};

type GetKnowledgeItemResponse = {
  ok: boolean;
  item: AiKnowledgeItem;
};

export const aiCommunicationService = {
  async listMessages(params?: {
    status?: AiMessageStatus;
    limit?: number;
  }) {
    const eventId = await getAdminEventId();
    const response = await requestJson<ListMessagesResponse>("/admin/ai/messages", {
      query: {
        eventId,
        status: params?.status,
        limit: params?.limit ?? 20
      }
    });
    return response.messages;
  },

  async getMessageDetail(messageId: string) {
    return requestJson<AiMessageDetailResponse>(`/admin/ai/messages/${messageId}`);
  },

  async suggestReply(messageId: string, payload: ReplySuggestionRequest) {
    return requestJson<AiReplySuggestionEnvelope>(`/admin/ai/messages/${messageId}/suggest-reply`, {
      method: "POST",
      body: payload
    });
  },

  async chatMessage(messageId: string, payload: AiMessageChatRequest) {
    return requestJson<AiMessageChatEnvelope>(`/admin/ai/messages/${messageId}/chat`, {
      method: "POST",
      body: payload
    });
  },

  async generateKnowledgeSuggestionsForMessage(messageId: string, payload: AiGenerateKnowledgeSuggestionsRequest) {
    return requestJson<AiKnowledgeSuggestionEnvelope>(`/admin/ai/messages/${messageId}/knowledge-suggestions`, {
      method: "POST",
      body: payload
    });
  },

  async listKnowledgeSuggestions(params?: {
    messageId?: string;
    topic?: AiKnowledgeTopic;
    status?: AiKnowledgeSuggestionStatus;
    limit?: number;
  }) {
    const eventId = await getAdminEventId();
    const response = await requestJson<ListKnowledgeSuggestionsResponse>("/admin/ai/knowledge-suggestions", {
      query: {
        eventId,
        messageId: params?.messageId,
        topic: params?.topic,
        status: params?.status,
        limit: params?.limit ?? 12
      }
    });
    return response.suggestions;
  },

  async listKnowledgeItems(params?: {
    topic?: AiKnowledgeTopic;
    status?: AiKnowledgeItemStatus;
    limit?: number;
  }) {
    const eventId = await getAdminEventId();
    const response = await requestJson<ListKnowledgeItemsResponse>("/admin/ai/knowledge-items", {
      query: {
        eventId,
        topic: params?.topic,
        status: params?.status,
        limit: params?.limit ?? 12
      }
    });
    return response.items;
  },

  async createKnowledgeItem(payload: CreateKnowledgeItemRequest) {
    const response = await requestJson<CreateKnowledgeItemResponse>("/admin/ai/knowledge-items", {
      method: "POST",
      body: payload
    });
    return response.item;
  },

  async getKnowledgeItem(itemId: string) {
    const response = await requestJson<GetKnowledgeItemResponse>(`/admin/ai/knowledge-items/${itemId}`);
    return response.item;
  },

  async updateKnowledgeItem(itemId: string, payload: UpdateKnowledgeItemRequest) {
    const response = await requestJson<GetKnowledgeItemResponse>(`/admin/ai/knowledge-items/${itemId}`, {
      method: "PATCH",
      body: payload
    });
    return response.item;
  },

  async archiveKnowledgeItem(itemId: string) {
    const response = await requestJson<GetKnowledgeItemResponse>(`/admin/ai/knowledge-items/${itemId}`, {
      method: "DELETE"
    });
    return response.item;
  },

  async generateReport(payload: AiEventReportRequest) {
    return requestJson<AiEventReportEnvelope>("/admin/ai/reports/generate", {
      method: "POST",
      body: payload
    });
  },

  async regenerateReportVariant(draftId: string, payload: AiRegenerateReportVariantRequest) {
    return requestJson<{ ok: boolean; draft: AiDraftDetail; generated: AiEventReportEnvelope }>(`/admin/ai/reports/${draftId}/regenerate-variant`, {
      method: "POST",
      body: payload
    });
  },

  async createReportKnowledgeSuggestions(draftId: string, payload: AiReportKnowledgeSuggestionsRequest) {
    return requestJson<AiReportKnowledgeSuggestionsEnvelope>(`/admin/ai/reports/${draftId}/knowledge-suggestions`, {
      method: "POST",
      body: payload
    });
  },

  async generateSpeakerText(payload: AiSpeakerRequest) {
    return requestJson<AiSpeakerTextEnvelope>("/admin/ai/speaker/generate", {
      method: "POST",
      body: payload
    });
  },

  async listDrafts(params?: {
    taskType?: AiDraftListItem["taskType"];
    eventId?: string;
    limit?: number;
  }) {
    const eventId = await getAdminEventId();
    const response = await requestJson<ListDraftsResponse>("/admin/ai/drafts", {
      query: {
        eventId: params?.eventId ?? eventId,
        taskType: params?.taskType,
        limit: params?.limit ?? 6
      }
    });
    return response.drafts;
  },

  async saveDraft(payload: SaveDraftRequest) {
    const response = await requestJson<SaveDraftResponse>("/admin/ai/drafts", {
      method: "POST",
      body: payload
    });
    return response.draft;
  },

  async getDraft(draftId: string) {
    const response = await requestJson<GetDraftResponse>(`/admin/ai/drafts/${draftId}`);
    return response.draft;
  },

  async updateDraft(draftId: string, payload: UpdateAiDraftRequest) {
    const response = await requestJson<GetDraftResponse>(`/admin/ai/drafts/${draftId}`, {
      method: "PATCH",
      body: payload
    });
    return response.draft;
  }
};
