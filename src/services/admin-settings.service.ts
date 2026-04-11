import { resetEventContextCache } from "@/services/api/event-context";
import { requestJson } from "@/services/api/http-client";
import type {
  AdminSettingsClass,
  AdminSettingsClassDraft,
  AdminSettingsEntryConfirmationConfig,
  AdminSettingsEntryConfirmationScheduleItem,
  AdminSettingsEvent,
  AdminSettingsEventForm,
  AdminSettingsPricingForm
} from "@/types/admin-settings";
import type { VehicleType } from "@/types/common";

type AdminCurrentEventResponse = {
  ok: boolean;
  event: Record<string, unknown>;
};

type AdminEventResponse = {
  ok: boolean;
  event: Record<string, unknown>;
};

type AdminEventsListResponse = {
  ok: boolean;
  events: Array<Record<string, unknown>>;
};

type AdminEntryConfirmationDefaultsResponse = {
  ok: boolean;
  config: Record<string, unknown>;
};

type AdminClassResponse = {
  ok: boolean;
  class: AdminSettingsClass;
};

type AdminClassDeleteResponse = {
  ok: boolean;
  classId: string;
  eventId: string;
};

type AdminPricingRulesResponse = {
  ok: boolean;
};

type AdminPricingRulesReadResponse = {
  ok: boolean;
  pricingRules: {
    eventId: string;
    earlyDeadline: string;
    lateFeeCents: number;
    secondVehicleDiscountCents: number;
    currency: string;
    classRules: Array<{
      classId: string;
      className: string;
      baseFeeCents: number;
    }>;
  };
};

type AdminInvoiceRecalculateResponse = {
  ok: boolean;
  recalculated: number;
};

type AdminClassesListResponse = {
  ok: boolean;
  classes: Array<{
    id?: string;
    eventId?: string;
    name?: string;
    vehicleType?: VehicleType;
    allowsCodriver?: boolean;
    createdAt?: string;
    updatedAt?: string;
  }>;
};

function asVehicleType(value: unknown): VehicleType {
  return value === "moto" ? "moto" : "auto";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asRequiredString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeScheduleItem(item: unknown): AdminSettingsEntryConfirmationScheduleItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const value = item as Record<string, unknown>;
  const label = asRequiredString(value.label).trim();
  if (!label) {
    return null;
  }
  return {
    label,
    startsAt: asNullableString(value.startsAt) ?? "",
    endsAt: asNullableString(value.endsAt) ?? "",
    note: asNullableString(value.note) ?? ""
  };
}

function emptyEntryConfirmationConfig(): AdminSettingsEntryConfirmationConfig {
  return {
    orgaCodePrefix: "",
    organizerName: "",
    organizerAddressLine: "",
    organizerContactEmail: "",
    organizerContactPhone: "",
    websiteUrl: "",
    gateHeadline: "",
    venueName: "",
    venueStreet: "",
    venueZip: "",
    venueCity: "",
    paddockInfo: "",
    arrivalNotes: "",
    accessNotes: "",
    importantNotes: [],
    scheduleItems: [],
    paymentRecipient: "",
    paymentIban: "",
    paymentBic: "",
    paymentBankName: "",
    paymentReferencePrefix: ""
  };
}

function normalizeEntryConfirmationConfig(value: unknown): AdminSettingsEntryConfirmationConfig {
  const fallback = emptyEntryConfirmationConfig();
  if (!value || typeof value !== "object") {
    return fallback;
  }
  const source = value as Record<string, unknown>;
  return {
    orgaCodePrefix: asNullableString(source.orgaCodePrefix) ?? "",
    organizerName: asNullableString(source.organizerName) ?? "",
    organizerAddressLine: asNullableString(source.organizerAddressLine) ?? "",
    organizerContactEmail: asNullableString(source.organizerContactEmail) ?? "",
    organizerContactPhone: asNullableString(source.organizerContactPhone) ?? "",
    websiteUrl: asNullableString(source.websiteUrl) ?? "",
    gateHeadline: asNullableString(source.gateHeadline) ?? "",
    venueName: asNullableString(source.venueName) ?? "",
    venueStreet: asNullableString(source.venueStreet) ?? "",
    venueZip: asNullableString(source.venueZip) ?? "",
    venueCity: asNullableString(source.venueCity) ?? "",
    paddockInfo: asNullableString(source.paddockInfo) ?? "",
    arrivalNotes: asNullableString(source.arrivalNotes) ?? "",
    accessNotes: asNullableString(source.accessNotes) ?? "",
    importantNotes: Array.isArray(source.importantNotes)
      ? source.importantNotes.filter((item): item is string => typeof item === "string")
      : [],
    scheduleItems: Array.isArray(source.scheduleItems)
      ? source.scheduleItems
          .map((item) => normalizeScheduleItem(item))
          .filter((item): item is AdminSettingsEntryConfirmationScheduleItem => item !== null)
      : [],
    paymentRecipient: asNullableString(source.paymentRecipient) ?? "",
    paymentIban: asNullableString(source.paymentIban) ?? "",
    paymentBic: asNullableString(source.paymentBic) ?? "",
    paymentBankName: asNullableString(source.paymentBankName) ?? "",
    paymentReferencePrefix: asNullableString(source.paymentReferencePrefix) ?? ""
  };
}

function mapEvent(event: Record<string, unknown>): AdminSettingsEvent {
  return {
    id: asRequiredString(event.id),
    name: asRequiredString(event.name),
    startsAt: asRequiredString(event.startsAt),
    endsAt: asRequiredString(event.endsAt),
    contactEmail: asNullableString(event.contactEmail),
    websiteUrl: asNullableString(event.websiteUrl),
    status: event.status === "open" || event.status === "closed" || event.status === "archived" ? event.status : "draft",
    isCurrent: Boolean(event.isCurrent),
    registrationOpenAt: asNullableString(event.registrationOpenAt),
    registrationCloseAt: asNullableString(event.registrationCloseAt),
    openedAt: asNullableString(event.openedAt),
    closedAt: asNullableString(event.closedAt),
    archivedAt: asNullableString(event.archivedAt),
    createdAt: asRequiredString(event.createdAt),
    updatedAt: asRequiredString(event.updatedAt),
    entryConfirmationConfig: normalizeEntryConfirmationConfig(event.entryConfirmationConfig)
  };
}

function toNullableText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toEntryConfirmationPayload(
  config: AdminSettingsEntryConfirmationConfig,
  mode: "full" | "compact" = "full"
) {
  const normalized = {
    orgaCodePrefix: toNullableText(config.orgaCodePrefix),
    organizerName: toNullableText(config.organizerName),
    organizerAddressLine: toNullableText(config.organizerAddressLine),
    organizerContactEmail: toNullableText(config.organizerContactEmail),
    organizerContactPhone: toNullableText(config.organizerContactPhone),
    websiteUrl: toNullableText(config.websiteUrl),
    gateHeadline: toNullableText(config.gateHeadline),
    venueName: toNullableText(config.venueName),
    venueStreet: toNullableText(config.venueStreet),
    venueZip: toNullableText(config.venueZip),
    venueCity: toNullableText(config.venueCity),
    paddockInfo: toNullableText(config.paddockInfo),
    arrivalNotes: toNullableText(config.arrivalNotes),
    accessNotes: toNullableText(config.accessNotes),
    importantNotes: config.importantNotes.map((item) => item.trim()).filter(Boolean),
    scheduleItems: config.scheduleItems
      .map((item) => ({
        label: item.label.trim(),
        startsAt: item.startsAt ? new Date(item.startsAt).toISOString() : null,
        endsAt: item.endsAt ? new Date(item.endsAt).toISOString() : null,
        note: toNullableText(item.note)
      }))
      .filter((item) => item.label),
    paymentRecipient: toNullableText(config.paymentRecipient),
    paymentIban: toNullableText(config.paymentIban),
    paymentBic: toNullableText(config.paymentBic),
    paymentBankName: toNullableText(config.paymentBankName),
    paymentReferencePrefix: toNullableText(config.paymentReferencePrefix)
  };

  if (mode === "full") {
    return normalized;
  }

  return Object.fromEntries(
    Object.entries(normalized).filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return value !== null;
    })
  );
}

function mapClass(item: AdminClassesListResponse["classes"][number], eventId: string): AdminSettingsClass | null {
  if (!item?.id || !item?.name) {
    return null;
  }
  return {
    id: item.id,
    eventId: item.eventId ?? eventId,
    name: item.name,
    vehicleType: asVehicleType(item.vehicleType),
    allowsCodriver: Boolean(item.allowsCodriver),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

export const adminSettingsService = {
  async getEntryConfirmationDefaults(): Promise<AdminSettingsEntryConfirmationConfig> {
    const response = await requestJson<AdminEntryConfirmationDefaultsResponse>("/admin/config/entry-confirmation-defaults");
    return normalizeEntryConfirmationConfig(response.config);
  },

  async updateEntryConfirmationDefaults(
    config: AdminSettingsEntryConfirmationConfig
  ): Promise<AdminSettingsEntryConfirmationConfig> {
    const response = await requestJson<AdminEntryConfirmationDefaultsResponse>("/admin/config/entry-confirmation-defaults", {
      method: "PATCH",
      body: {
        config: toEntryConfirmationPayload(config, "full")
      }
    });
    return normalizeEntryConfirmationConfig(response.config);
  },

  async getCurrentEvent(): Promise<AdminSettingsEvent> {
    const response = await requestJson<AdminCurrentEventResponse>("/admin/events/current");
    return mapEvent(response.event);
  },

  async getEvent(eventId: string): Promise<AdminSettingsEvent> {
    const response = await requestJson<AdminEventResponse>(`/admin/events/${eventId}`);
    return mapEvent(response.event);
  },

  async listEvents(): Promise<AdminSettingsEvent[]> {
    const response = await requestJson<AdminEventsListResponse>("/admin/events");
    return Array.isArray(response.events) ? response.events.map((item) => mapEvent(item)) : [];
  },

  async createEvent(payload: AdminSettingsEventForm): Promise<AdminSettingsEvent> {
    const body: Record<string, unknown> = {
      name: payload.name,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      entryConfirmationConfig: toEntryConfirmationPayload(payload.entryConfirmationConfig, "compact")
    };

    if (payload.registrationOpenAt) {
      body.registrationOpenAt = new Date(payload.registrationOpenAt).toISOString();
    }

    if (payload.registrationCloseAt) {
      body.registrationCloseAt = new Date(payload.registrationCloseAt).toISOString();
    }

    const response = await requestJson<AdminEventResponse>("/admin/events", {
      method: "POST",
      body
    });

    resetEventContextCache();
    return mapEvent(response.event);
  },

  async updateEvent(eventId: string, payload: AdminSettingsEventForm): Promise<AdminSettingsEvent> {
    const response = await requestJson<AdminEventResponse>(`/admin/events/${eventId}`, {
      method: "PATCH",
      body: {
        name: payload.name,
        startsAt: payload.startsAt,
        endsAt: payload.endsAt,
        registrationOpenAt: payload.registrationOpenAt ? new Date(payload.registrationOpenAt).toISOString() : null,
        registrationCloseAt: payload.registrationCloseAt ? new Date(payload.registrationCloseAt).toISOString() : null,
        entryConfirmationConfig: toEntryConfirmationPayload(payload.entryConfirmationConfig, "compact")
      }
    });

    resetEventContextCache();
    return mapEvent(response.event);
  },

  async listClasses(eventId: string): Promise<AdminSettingsClass[]> {
    const response = await requestJson<AdminClassesListResponse>(`/admin/events/${eventId}/classes`);
    return response.classes.map((item) => mapClass(item, eventId)).filter((item): item is AdminSettingsClass => item !== null);
  },

  async createClass(eventId: string, payload: AdminSettingsClassDraft): Promise<AdminSettingsClass> {
    const response = await requestJson<AdminClassResponse>(`/admin/events/${eventId}/classes`, {
      method: "POST",
      body: payload
    });

    resetEventContextCache();
    return response.class;
  },

  async updateClass(classId: string, payload: AdminSettingsClassDraft): Promise<AdminSettingsClass> {
    const response = await requestJson<AdminClassResponse>(`/admin/classes/${classId}`, {
      method: "PATCH",
      body: payload
    });

    resetEventContextCache();
    return response.class;
  },

  async deleteClass(classId: string): Promise<AdminClassDeleteResponse> {
    const response = await requestJson<AdminClassDeleteResponse>(`/admin/classes/${classId}`, {
      method: "DELETE"
    });

    resetEventContextCache();
    return response;
  },

  async savePricingRules(eventId: string, form: AdminSettingsPricingForm): Promise<AdminPricingRulesResponse> {
    return requestJson<AdminPricingRulesResponse>(`/admin/events/${eventId}/pricing-rules`, {
      method: "PUT",
      body: {
        earlyDeadline: new Date(form.earlyDeadline).toISOString(),
        lateFeeCents: Number(form.lateFeeCents),
        secondVehicleDiscountCents: Number(form.secondVehicleDiscountCents || 0),
        classRules: form.classRules.map((rule) => ({
          classId: rule.classId,
          baseFeeCents: Number(rule.baseFeeCents)
        }))
      }
    });
  },

  async getPricingRules(eventId: string) {
    const response = await requestJson<AdminPricingRulesReadResponse>(`/admin/events/${eventId}/pricing-rules`);
    return response.pricingRules;
  },

  async activateEvent(eventId: string): Promise<AdminSettingsEvent> {
    const response = await requestJson<AdminEventResponse>(`/admin/events/${eventId}/activate`, { method: "POST" });
    resetEventContextCache();
    return mapEvent(response.event);
  },

  async closeEvent(eventId: string): Promise<AdminSettingsEvent> {
    const response = await requestJson<AdminEventResponse>(`/admin/events/${eventId}/close`, { method: "POST" });
    resetEventContextCache();
    return mapEvent(response.event);
  },

  async archiveEvent(eventId: string): Promise<AdminSettingsEvent> {
    const response = await requestJson<AdminEventResponse>(`/admin/events/${eventId}/archive`, { method: "POST" });
    resetEventContextCache();
    return mapEvent(response.event);
  },

  async recalculateInvoices(eventId: string): Promise<AdminInvoiceRecalculateResponse> {
    return requestJson<AdminInvoiceRecalculateResponse>(`/admin/events/${eventId}/invoices/recalculate`, {
      method: "POST"
    });
  }
};
