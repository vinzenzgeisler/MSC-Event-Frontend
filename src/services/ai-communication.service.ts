import { getAdminEventId } from "@/services/api/event-context";
import { requestJson } from "@/services/api/http-client";
import type {
  AiDraftListItem,
  AiEventReportEnvelope,
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
  ReplySuggestionRequest,
  SaveDraftRequest
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

  async generateReport(payload: AiEventReportRequest) {
    return requestJson<AiEventReportEnvelope>("/admin/ai/reports/generate", {
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
    limit?: number;
  }) {
    const eventId = await getAdminEventId();
    const response = await requestJson<ListDraftsResponse>("/admin/ai/drafts", {
      query: {
        eventId,
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
  }
};
