import { requestJson } from "@/services/api/http-client";
import type { SimDay, SimEntry, SimUpsertInput } from "@/types/admin-simulator";

type OkResponse = { ok: boolean };

export const adminSimulatorService = {
  async listEntries(eventId: string, day?: SimDay) {
    const query: Record<string, string> = { eventId };
    if (day) query.day = day;
    return requestJson<OkResponse & { entries: SimEntry[] }>("/admin/sim/entries", { query });
  },

  async upsertEntry(input: SimUpsertInput) {
    return requestJson<OkResponse & { entry: SimEntry }>("/admin/sim/entries", {
      method: "PUT",
      body: input
    });
  },

  async deleteEntry(id: string) {
    return requestJson<OkResponse>(`/admin/sim/entries/${id}`, { method: "DELETE" });
  }
};
