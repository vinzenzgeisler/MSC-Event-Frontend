import { requestJson } from "@/services/api/http-client";
import type {
  RacepicEventConfig,
  RacepicEventListItem,
  RacepicEventStats,
  RacepicLicenseOption,
  RacepicPhotographer,
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
};
