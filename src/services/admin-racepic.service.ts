import { requestJson } from "@/services/api/http-client";
import type {
  RacepicAdminImage,
  RacepicImagePipelineStatus,
  RacepicEntrySearchResult,
  RacepicEventConfig,
  RacepicEventListItem,
  RacepicEventStats,
  RacepicImageAssignment,
  RacepicLicenseOption,
  RacepicMatchingConfig,
  RacepicMatchingConfigInput,
  RacepicMatchQualityReport,
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

  async reviewPhotographerRegistration(photographerId: string, decision: 'approve' | 'reject', eventIds: string[]): Promise<void> {
    await requestJson(`/admin/racepic/photographers/${photographerId}/review`, { method: 'POST', body: { decision, eventIds } });
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

  async hideParticipant(entryId: string): Promise<{ rejectedCount: number }> {
    return requestJson<{ ok: boolean; rejectedCount: number }>(`/admin/racepic/participants/${entryId}/hide`, { method: "POST" });
  },

  // --- Paket 11: Bildliste, Matching-Config, Rematch/Reanalyze, Qualitätsreport ---

  async listImages(
    eventId: string,
    filter: { visibility?: string; processingStatus?: string },
    offset: number,
    limit: number,
  ): Promise<{ items: RacepicAdminImage[]; total: number }> {
    return requestJson<{ ok: boolean; items: RacepicAdminImage[]; total: number }>(`/admin/racepic/events/${eventId}/images`, {
      query: { ...filter, offset, limit },
    });
  },

  async getImagePipelineStatus(imageId: string): Promise<RacepicImagePipelineStatus> {
    const res = await requestJson<{ ok: boolean; status: RacepicImagePipelineStatus }>(`/admin/racepic/images/${imageId}/status`);
    return res.status;
  },

  async setImageVisibility(imageId: string, visibility: "PUBLISHED" | "HIDDEN" | "REMOVED"): Promise<void> {
    await requestJson(`/admin/racepic/images/${imageId}`, { method: "PATCH", body: { visibility } });
  },

  /** Nur fuer bereits entfernte (visibility=REMOVED) Bilder - loescht die DB-Zeile endgültig. */
  async hardDeleteImage(imageId: string): Promise<void> {
    await requestJson(`/admin/racepic/images/${imageId}/permanent`, { method: "DELETE" });
  },

  async listMatchingConfigs(eventId?: string): Promise<RacepicMatchingConfig[]> {
    const res = await requestJson<{ ok: boolean; configs: RacepicMatchingConfig[] }>("/admin/racepic/matching-configs", {
      query: eventId ? { eventId } : undefined,
    });
    return res.configs;
  },

  async createMatchingConfig(input: RacepicMatchingConfigInput): Promise<RacepicMatchingConfig> {
    const res = await requestJson<{ ok: boolean; config: RacepicMatchingConfig }>("/admin/racepic/matching-configs", {
      method: "POST",
      body: input,
    });
    return res.config;
  },

  async triggerRematch(eventId: string): Promise<{ queued: number }> {
    return requestJson<{ ok: boolean; queued: number }>(`/admin/racepic/events/${eventId}/rematch`, { method: "POST" });
  },

  async reanalyzeImage(imageId: string): Promise<void> {
    await requestJson(`/admin/racepic/images/${imageId}/reanalyze`, { method: "POST" });
  },

  async getMatchQualityReport(eventId: string): Promise<RacepicMatchQualityReport> {
    const res = await requestJson<{ ok: boolean; report: RacepicMatchQualityReport }>(`/admin/racepic/events/${eventId}/matching-quality-report`);
    return res.report;
  },

  // --- Paket 16: Zuordnungen je Bild (Admin-Redesign) ---

  async getImageAssignments(imageId: string): Promise<RacepicImageAssignment[]> {
    const res = await requestJson<{ ok: boolean; assignments: RacepicImageAssignment[] }>(`/admin/racepic/images/${imageId}/assignments`);
    return res.assignments;
  },
};
