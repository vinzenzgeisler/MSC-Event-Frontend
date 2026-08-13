import { ApiError, requestJson } from "@/services/api/http-client";
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
    contactEmail: string | null;
    websiteUrl: string | null;
  };
  classes: Array<{
    id: string;
    eventId: string;
    name: string;
    vehicleType: VehicleType;
    allowsCodriver: boolean;
    registrationClosed: boolean;
    inviteAllowed?: boolean;
    selectionGroupKey: string;
  }>;
  registration: {
    isOpen: boolean;
    reason: string | null;
  };
  invitation?: {
    recipientName: string | null;
    recipientEmail: string | null;
    expiresAt: string;
    allowedClassIds: string[];
  } | null;
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
    allowsCodriver?: boolean;
    registrationClosed?: boolean;
    runGroupId?: string | null;
  }>;
};

let publicEventCache: PublicCurrentEventResponse | null = null;
let publicEventCacheInvite: string | null = null;
let adminEventCache: AdminCurrentEventResponse | null = null;
let adminClassesCache: Array<{ id: string; name: string; vehicleType: VehicleType; allowsCodriver: boolean; registrationClosed: boolean; runGroupId: string | null }> | null = null;

export async function getPublicCurrentEvent(invite?: string) {
  const normalizedInvite = invite?.trim() || null;
  if (publicEventCache && publicEventCacheInvite === normalizedInvite) {
    return publicEventCache;
  }
  const response = await requestJson<PublicCurrentEventResponse>("/public/events/current", {
    auth: false,
    query: { invite: normalizedInvite }
  });
  publicEventCache = response;
  publicEventCacheInvite = normalizedInvite;
  return response;
}

export async function getPublicEventId(invite?: string) {
  const response = await getPublicCurrentEvent(invite);
  return response.event.id;
}

export async function getAdminCurrentEvent() {
  if (adminEventCache) {
    return adminEventCache;
  }
  try {
    const response = await requestJson<AdminCurrentEventResponse>("/admin/events/current");
    adminEventCache = response;
    return response;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      const publicEvent = await getPublicCurrentEvent();
      adminEventCache = {
        ok: true,
        event: {
          id: publicEvent.event.id,
          name: publicEvent.event.name
        }
      };
      return adminEventCache;
    }
    throw error;
  }
}

export async function getAdminEventId() {
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
      vehicleType: item.vehicleType,
      allowsCodriver: Boolean(item.allowsCodriver),
      registrationClosed: Boolean(item.registrationClosed),
      runGroupId: item.runGroupId ?? null
    }));

  return adminClassesCache;
}

export function resetEventContextCache() {
  publicEventCache = null;
  publicEventCacheInvite = null;
  adminEventCache = null;
  adminClassesCache = null;
}
