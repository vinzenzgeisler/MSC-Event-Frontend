import { requestJson } from "@/services/api/http-client";
import type { TechStatus, VehicleType } from "@/types/common";

export type InspectionContext = {
  event: {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
  };
};

export type InspectionListItem = {
  id: string;
  startNumber: string | null;
  driverFirstName: string;
  driverLastName: string;
  className: string;
  vehicleMake: string | null;
  vehicleModel: string | null;
  techStatus: TechStatus;
  techCheckedAt: string | null;
};

export type InspectionEntry = {
  id: string;
  eventId: string;
  startNumber: string | null;
  orgaCode: string | null;
  acceptanceStatus: string;
  driverFirstName: string;
  driverLastName: string;
  className: string;
  vehicleType: VehicleType;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  displacementCcm: number | null;
  engineType: string | null;
  cylinders: number | null;
  brakes: string | null;
  vehicleHistory: string | null;
  techStatus: TechStatus;
  techCheckedAt: string | null;
  techCheckedBy: string | null;
};

export type InspectionHistoryItem = {
  id: string;
  status: TechStatus;
  note: string | null;
  inspectorUserId: string;
  inspectorEmail: string | null;
  createdAt: string;
};

export const technicalInspectionService = {
  async getContext() {
    return requestJson<{ ok: true } & InspectionContext>("/inspection/context");
  },

  async search(query: string) {
    const response = await requestJson<{ ok: true; entries: InspectionListItem[] }>("/inspection/entries", {
      query: { q: query, limit: 25 }
    });
    return response.entries;
  },

  async getEntry(entryId: string) {
    const response = await requestJson<{ ok: true; entry: InspectionEntry }>(`/inspection/entries/${entryId}`);
    return response.entry;
  },

  async getHistory(entryId: string) {
    const response = await requestJson<{ ok: true; history: InspectionHistoryItem[] }>(
      `/inspection/entries/${entryId}/history`
    );
    return response.history;
  },

  async update(entryId: string, techStatus: TechStatus, note: string) {
    return requestJson(`/inspection/entries/${entryId}`, {
      method: "PATCH",
      body: {
        techStatus,
        note: note.trim() || null
      }
    });
  }
};
