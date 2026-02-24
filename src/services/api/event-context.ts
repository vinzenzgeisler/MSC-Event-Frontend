import { requestJson } from "@/services/api/http-client";
import type { VehicleType } from "@/types/common";

type PublicCurrentEventResponse = {
  ok: boolean;
  event: {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
    status: "draft" | "open" | "closed" | "archived";
    isCurrent: boolean;
    registrationOpenAt: string | null;
    registrationCloseAt: string | null;
  };
  classes: Array<{
    id: string;
    eventId: string;
    name: string;
    vehicleType: VehicleType;
  }>;
  registration: {
    isOpen: boolean;
    reason: string | null;
  };
  pricingRules?: unknown;
  pricing?: unknown;
};

type AdminCurrentEventResponse = {
  ok: boolean;
  event: {
    id: string;
    name: string;
  };
};

type AdminClassesResponse = {
  ok: boolean;
  classes: Array<{
    id: string;
    eventId?: string;
    name: string;
    vehicleType: VehicleType;
  }>;
};

const configuredEventId = (import.meta.env.VITE_PUBLIC_EVENT_ID || "").trim() || null;

let publicEventCache: PublicCurrentEventResponse | null = null;
let adminEventCache: AdminCurrentEventResponse | null = null;
let adminClassesCache: Array<{ id: string; name: string; vehicleType: VehicleType }> | null = null;

export async function getPublicCurrentEvent() {
  if (publicEventCache) {
    return publicEventCache;
  }
  const response = await requestJson<PublicCurrentEventResponse>("/public/events/current", { auth: false });
  publicEventCache = response;
  return response;
}

export async function getPublicEventId() {
  if (configuredEventId) {
    return configuredEventId;
  }
  const response = await getPublicCurrentEvent();
  return response.event.id;
}

export async function getAdminCurrentEvent() {
  if (adminEventCache) {
    return adminEventCache;
  }
  if (configuredEventId) {
    adminEventCache = {
      ok: true,
      event: {
        id: configuredEventId,
        name: ""
      }
    };
    return adminEventCache;
  }
  const response = await requestJson<AdminCurrentEventResponse>("/admin/events/current");
  adminEventCache = response;
  return response;
}

export async function getAdminEventId() {
  if (configuredEventId) {
    return configuredEventId;
  }
  const response = await getAdminCurrentEvent();
  return response.event.id;
}

export async function getAdminClassOptions() {
  if (adminClassesCache) {
    return adminClassesCache;
  }

  const eventId = await getAdminEventId();
  const response = await requestJson<AdminClassesResponse>(`/admin/events/${eventId}/classes`);

  adminClassesCache = (response.classes || [])
    .filter((item) => item && typeof item.id === "string" && typeof item.name === "string")
    .map((item) => ({
      id: item.id,
      name: item.name,
      vehicleType: item.vehicleType
    }));

  return adminClassesCache;
}

export function resetEventContextCache() {
  publicEventCache = null;
  adminEventCache = null;
  adminClassesCache = null;
}
