import { ApiError, requestJson } from "@/services/api/http-client";
import type { TechStatus, VehicleType } from "@/types/common";

export type InspectionContext = {
  event: {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
  };
};

export type InspectionRequirement = "payment" | "waiver";

export type InspectionEligibility = {
  ready: boolean;
  paymentStatus: "due" | "paid" | "not_required" | "unknown";
  waiverSigned: boolean;
  missingRequirements: InspectionRequirement[];
};

export type InspectionProgressTarget = {
  entryId: string;
  target: "primary" | "backup";
  startNumber: string | null;
  className: string;
  vehicleMake: string | null;
  vehicleModel: string | null;
  status: TechStatus;
};

export type ParticipantInspectionSummary = {
  totalTargets: number;
  passedTargets: number;
  pendingTargets: number;
  failedTargets: number;
  stampReady: boolean;
  targets: InspectionProgressTarget[];
};

export type InspectionListItem = {
  id: string;
  driverPersonId: string;
  startNumber: string | null;
  driverDisplayName: string;
  identityProtected: boolean;
  driverFirstName: string | null;
  driverLastName: string | null;
  className: string;
  vehicleMake: string | null;
  vehicleModel: string | null;
  techStatus: TechStatus;
  backupVehicleId: string | null;
  backupTechStatus: TechStatus;
  techCheckedAt: string | null;
  eligibility?: InspectionEligibility;
};

export type InspectionAccessSource = "qr" | "search" | "participant" | "history" | "direct";

export type InspectionAccessResult = {
  allowed: boolean;
  eventId: string;
  entryIds: string[];
  driverPersonId: string;
  driverDisplayName: string;
  eligibility: InspectionEligibility;
};

export type InspectionOverview = {
  event: InspectionContext["event"];
  counters: {
    totalDrivers: number;
    totalTargets: number;
    notEligibleTargets: number;
    pendingTargets: number;
    passedTargets: number;
    failedTargets: number;
    stampReadyDrivers: number;
  };
  recentEntries: Array<{
    entryId: string;
    driverPersonId: string;
    driverDisplayName: string;
    startNumber: string | null;
    className: string;
    vehicleMake: string | null;
    vehicleModel: string | null;
    techStatus: TechStatus;
    backupTechStatus: TechStatus;
    lastAction: { status: TechStatus; target: "primary" | "backup"; note: string | null; createdAt: string };
    stampReady: boolean;
  }>;
};

export type InspectionVehicle = {
  vehicleType: VehicleType;
  make: string | null;
  model: string | null;
  year: number | null;
  displacementCcm: number | null;
  engineType: string | null;
  cylinders: number | null;
  vehicleHistory: string | null;
  imageUrl: string | null;
};

export type InspectionEntry = {
  id: string;
  eventId: string;
  driverPersonId: string;
  eligibility: InspectionEligibility;
  participantSummary: ParticipantInspectionSummary;
  startNumber: string | null;
  orgaCode: string | null;
  acceptanceStatus: string;
  driverDisplayName: string;
  identityProtected: boolean;
  driverFirstName: string | null;
  driverLastName: string | null;
  driverEmail: string | null;
  driverPhone: string | null;
  codriverPersonId: string | null;
  codriver: {
    displayName: string;
    identityProtected: boolean;
    firstName: string | null;
    lastName: string | null;
    birthdate: string | null;
    country: string | null;
  } | null;
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
  vehicleImageUrl: string | null;
  inspectionNote: string | null;
  backupInspectionNote: string | null;
  backupVehicleId: string | null;
  backupVehicle: InspectionVehicle | null;
  techStatus: TechStatus;
  techCheckedAt: string | null;
  techCheckedBy: string | null;
  backupTechStatus: TechStatus;
  backupTechCheckedAt: string | null;
  backupTechCheckedBy: string | null;
};

export type InspectionHistoryItem = {
  id: string;
  status: TechStatus;
  target: "primary" | "backup";
  note: string | null;
  inspectorUserId: string;
  inspectorEmail: string | null;
  inspectorDisplay: string | null;
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

  async getParticipant(eventId: string, personId: string) {
    const response = await requestJson<{ ok: true; participant: { event: InspectionContext["event"]; driver: { personId: string; displayName: string; identityProtected: boolean; firstName: string | null; lastName: string | null }; entries: InspectionEntry[] } }>(
      `/inspection/participants/${eventId}/${personId}`
    );
    return response.participant;
  },

  async getHistory(entryId: string) {
    const response = await requestJson<{ ok: true; history: InspectionHistoryItem[] }>(
      `/inspection/entries/${entryId}/history`
    );
    return response.history;
  },

  async update(entryId: string, techStatus: TechStatus, note: string, target: "primary" | "backup" = "primary") {
    return requestJson(`/inspection/entries/${entryId}`, {
      method: "PATCH",
      body: {
        techStatus,
        target,
        note: note.trim() || null
      }
    });
  },

  async saveNote(entryId: string, note: string, target: "primary" | "backup" = "primary") {
    return requestJson(`/inspection/entries/${entryId}/note`, {
      method: "PATCH",
      body: {
        target,
        note: note.trim() || null
      }
    });
  },

  async checkAccess(
    target: { type: "entry"; entryId: string } | { type: "participant"; eventId: string; personId: string },
    source: InspectionAccessSource
  ) {
    try {
      const response = await requestJson<{ ok: true; access: InspectionAccessResult }>("/inspection/access-check", {
        method: "POST",
        body: { ...target, source }
      });
      return response.access;
    } catch (error) {
      if (error instanceof ApiError && error.code === "INSPECTION_CHECKIN_REQUIRED" && error.details?.access) {
        return error.details.access as InspectionAccessResult;
      }
      throw error;
    }
  },

  async getOverview(limit = 40) {
    const response = await requestJson<{ ok: true } & InspectionOverview>("/inspection/overview", {
      query: { limit }
    });
    return response;
  }
};
