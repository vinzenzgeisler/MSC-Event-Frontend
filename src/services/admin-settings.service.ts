import { resetEventContextCache } from "@/services/api/event-context";
import { requestJson } from "@/services/api/http-client";
import type {
  AdminSettingsClass,
  AdminSettingsClassDraft,
  AdminSettingsEvent,
  AdminSettingsEventForm,
  AdminSettingsPricingForm
} from "@/types/admin-settings";
import type { VehicleType } from "@/types/common";

type AdminCurrentEventResponse = {
  ok: boolean;
  event: AdminSettingsEvent;
};

type AdminEventResponse = {
  ok: boolean;
  event: AdminSettingsEvent;
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
    createdAt?: string;
    updatedAt?: string;
  }>;
};

function asVehicleType(value: unknown): VehicleType {
  return value === "moto" ? "moto" : "auto";
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
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

export const adminSettingsService = {
  async getCurrentEvent(): Promise<AdminSettingsEvent> {
    const response = await requestJson<AdminCurrentEventResponse>("/admin/events/current");
    return response.event;
  },

  async createEvent(payload: AdminSettingsEventForm): Promise<AdminSettingsEvent> {
    const body: Record<string, unknown> = {
      name: payload.name,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt
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
    return response.event;
  },

  async updateEvent(eventId: string, payload: AdminSettingsEventForm): Promise<AdminSettingsEvent> {
    const response = await requestJson<AdminEventResponse>(`/admin/events/${eventId}`, {
      method: "PATCH",
      body: {
        name: payload.name,
        startsAt: payload.startsAt,
        endsAt: payload.endsAt,
        registrationOpenAt: payload.registrationOpenAt ? new Date(payload.registrationOpenAt).toISOString() : null,
        registrationCloseAt: payload.registrationCloseAt ? new Date(payload.registrationCloseAt).toISOString() : null
      }
    });

    resetEventContextCache();
    return response.event;
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
    return response.event;
  },

  async closeEvent(eventId: string): Promise<AdminSettingsEvent> {
    const response = await requestJson<AdminEventResponse>(`/admin/events/${eventId}/close`, { method: "POST" });
    resetEventContextCache();
    return response.event;
  },

  async archiveEvent(eventId: string): Promise<AdminSettingsEvent> {
    const response = await requestJson<AdminEventResponse>(`/admin/events/${eventId}/archive`, { method: "POST" });
    resetEventContextCache();
    return response.event;
  },

  async recalculateInvoices(eventId: string): Promise<AdminInvoiceRecalculateResponse> {
    return requestJson<AdminInvoiceRecalculateResponse>(`/admin/events/${eventId}/invoices/recalculate`, {
      method: "POST"
    });
  }
};
