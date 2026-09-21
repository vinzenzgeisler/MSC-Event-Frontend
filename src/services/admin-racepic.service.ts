import { requestJson } from "@/services/api/http-client";
import type {
  RacepicEntrySearchResult,
  RacepicEventConfig,
  RacepicEventListItem,
  RacepicEventStats,
  RacepicLicenseOption,
  RacepicPhotographer,
  RacepicReviewItem,
} from "@/types/admin-racepic";

/** RacePic Admin-Basis (Paket 5), spiegelt api/src/racepic/handler.ts (MSC-Event-Backend-Repo). */
export const adminRacepicService = {
  async listEvents(): Promise<RacepicEventListItem[]> {
    const res = await requestJson<{ ok: boolean; events: RacepicEventListItem[] }>("/admin/racepic/events");
    return res.events;
  },

  async putEventConfig(eventId: string, config: RacepicEventConfig): Promise<RacepicEventConfig> {
    const res = await requestJson<{ ok: boolean; config: RacepicEventConfig }>(`/admin/racepic/events/${eventId}`, {
      method: "PUT",
      body: config,
    });
    return res.config;
  },

  async getEventStats(eventId: string): Promise<RacepicEventStats> {
    const res = await requestJson<{ ok: boolean; stats: RacepicEventStats }>(`/admin/racepic/events/${eventId}/stats`);
    return res.stats;
  },

  async listPhotographers(): Promise<RacepicPhotographer[]> {
    const res = await requestJson<{ ok: boolean; photographers: RacepicPhotographer[] }>("/admin/racepic/photographers");
    return res.photographers;
  },

  async invitePhotographer(input: { email: string; displayName: string; eventIds: string[] }): Promise<{ photographerId: string }> {
    return requestJson<{ ok: boolean; photographerId: string }>("/admin/racepic/photographers", {
      method: "POST",
      body: input,
    });
  },

  async listLicenses(): Promise<RacepicLicenseOption[]> {
    const res = await requestJson<{ ok: boolean; licenses: RacepicLicenseOption[] }>("/admin/racepic/licenses");
    return res.licenses;
  },

  // --- Paket 7: Review-Queue ---

  async listReviewQueue(eventId: string, offset: number, limit: number): Promise<{ items: RacepicReviewItem[]; total: number }> {
    return requestJson<{ ok: boolean; items: RacepicReviewItem[]; total: number }>(`/admin/racepic/events/${eventId}/review-queue`, {
      query: { offset, limit },
    });
  },

  async searchEntries(eventId: string, q: string): Promise<RacepicEntrySearchResult[]> {
    const res = await requestJson<{ ok: boolean; entries: RacepicEntrySearchResult[] }>(`/admin/racepic/events/${eventId}/entries/search`, {
      query: { q },
    });
    return res.entries;
  },

  async confirmAssignment(assignmentId: string): Promise<void> {
    await requestJson(`/admin/racepic/assignments/${assignmentId}/confirm`, { method: "POST" });
  },

  async rejectAssignment(assignmentId: string): Promise<void> {
    await requestJson(`/admin/racepic/assignments/${assignmentId}/reject`, { method: "POST" });
  },

  async correctAssignment(assignmentId: string, entryId: string): Promise<void> {
    await requestJson(`/admin/racepic/assignments/${assignmentId}/correct`, { method: "POST", body: { entryId } });
  },

  async addAssignment(imageId: string, entryId: string, detectionId: string | null): Promise<void> {
    await requestJson(`/admin/racepic/images/${imageId}/assignments`, { method: "POST", body: { entryId, detectionId } });
  },
};
