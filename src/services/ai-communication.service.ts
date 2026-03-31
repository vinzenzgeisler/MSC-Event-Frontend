import { getAdminEventId } from "@/services/api/event-context";
import { requestJson } from "@/services/api/http-client";
import type {
  AiDraftListItem,
  AiMessageBasis,
  AiMessageDetail,
  AiMessageListItem,
  AiMessageStatus,
  AiReplySuggestionEnvelope,
  ReplySuggestionRequest,
  SaveDraftRequest
} from "@/types/ai-communication";

type ListMessagesResponse = {
  ok: boolean;
  messages: AiMessageListItem[];
};

type MessageDetailResponse = {
  ok: boolean;
  message: AiMessageDetail;
  basis: AiMessageBasis;
};

type ListDraftsResponse = {
  ok: boolean;
  drafts: AiDraftListItem[];
};

type SaveDraftResponse = {
  ok: boolean;
  draft: AiDraftListItem;
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
    return requestJson<MessageDetailResponse>(`/admin/ai/messages/${messageId}`);
  },

  async suggestReply(messageId: string, payload: ReplySuggestionRequest) {
    return requestJson<AiReplySuggestionEnvelope>(`/admin/ai/messages/${messageId}/suggest-reply`, {
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
