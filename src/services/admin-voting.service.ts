import { getAuthToken } from "@/app/auth/auth-store";
import { buildUrl, requestJson } from "@/services/api/http-client";
import type { AdminCandidate, CandidateOverrideState, EventHubConfig, VotingMode, VotingResults } from "@/types/admin-voting";

export const adminVotingService = {
  async getConfig(eventId: string): Promise<EventHubConfig> {
    const res = await requestJson<{ ok: boolean; config: EventHubConfig }>(`/admin/events/${eventId}/event-hub`);
    return res.config;
  },

  async getCandidates(eventId: string): Promise<AdminCandidate[]> {
    const res = await requestJson<{ ok: boolean; candidates: AdminCandidate[] }>(`/admin/events/${eventId}/event-hub/candidates`);
    return res.candidates;
  },

  async patchConfig(
    eventId: string,
    patch: Partial<{ votingOpensAt: string | null; votingClosesAt: string | null; votingMode: VotingMode; venueLat: string | null; venueLng: string | null }>
  ): Promise<EventHubConfig> {
    const res = await requestJson<{ ok: boolean; config: EventHubConfig }>(`/admin/events/${eventId}/event-hub`, {
      method: "PATCH",
      body: patch
    });
    return res.config;
  },

  async setCandidateOverride(eventId: string, entryId: string, state?: CandidateOverrideState, featured?: boolean) {
    await requestJson(`/admin/events/${eventId}/event-hub/candidates/${entryId}`, {
      method: "PUT",
      body: { ...(state === undefined ? {} : { state }), ...(featured === undefined ? {} : { featured }) }
    });
  },

  async getResults(eventId: string): Promise<VotingResults> {
    const res = await requestJson<{ ok: boolean } & VotingResults>(`/admin/events/${eventId}/voting/results`);
    return res;
  },

  async downloadResultsCsv(eventId: string): Promise<void> {
    const response = await fetch(buildUrl(`/admin/events/${eventId}/voting/results`, { format: "csv" }), {
      headers: { Authorization: `Bearer ${getAuthToken() ?? ""}` }
    });
    if (!response.ok) {
      throw new Error(`CSV-Export fehlgeschlagen (${response.status})`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "publikumsvoting-ergebnisse.csv";
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }
};
