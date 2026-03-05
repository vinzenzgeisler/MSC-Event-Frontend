import { getAdminEventId } from "@/services/api/event-context";
import { requestJson } from "@/services/api/http-client";
import type {
  MailTemplate,
  MailTemplatePlaceholder,
  MailTemplatePreview,
  OutboxItem,
  OutboxItemDto,
  ResolveRecipientsResult
} from "@/types/admin";

function fromOutboxDto(dto: OutboxItemDto): OutboxItem {
  return {
    id: dto.id,
    recipient: dto.toEmail,
    subject: dto.subject,
    status: dto.status,
    error: dto.errorLast ?? "",
    createdAt: new Date(dto.createdAt).toLocaleString("de-DE")
  };
}

type AdminOutboxListResponse = {
  ok: boolean;
  outbox: OutboxItemDto[];
};

type AdminMailQueueResponse = {
  ok: boolean;
  queued: number;
  skipped: number;
  reason?: string;
  outboxIds: string[];
};

type MailTemplatesResponse = {
  ok: true;
  templates: MailTemplate[];
};

type MailTemplateResponse = {
  ok: true;
  template: MailTemplate;
};

type MailTemplateVersionsResponse = {
  ok: true;
  key: string;
  versions: MailTemplate[];
};

type MailTemplatePlaceholdersResponse = {
  ok: true;
  templateKey: string;
  placeholders: MailTemplatePlaceholder[];
};

type MailSendResponse = {
  ok: true;
  queued: number;
};

export const communicationService = {
  async listOutbox() {
    const eventId = await getAdminEventId();
    const response = await requestJson<AdminOutboxListResponse>("/admin/mail/outbox", {
      query: {
        eventId,
        limit: 100,
        sortBy: "createdAt",
        sortDir: "desc"
      }
    });

    const sortedOutbox = [...response.outbox].sort((left, right) => {
      const leftTs = Number(new Date(left.createdAt));
      const rightTs = Number(new Date(right.createdAt));
      return rightTs - leftTs;
    });

    return sortedOutbox.map(fromOutboxDto);
  },

  async listTemplates() {
    const response = await requestJson<MailTemplatesResponse>("/admin/mail/templates");
    return response.templates;
  },

  async createTemplate(payload: {
    key: string;
    label: string;
    subject: string;
    bodyText: string;
    bodyHtml?: string;
    status?: "draft" | "published";
    isActive?: boolean;
  }) {
    const response = await requestJson<MailTemplateResponse>("/admin/mail/templates", {
      method: "POST",
      body: {
        key: payload.key,
        label: payload.label,
        subject: payload.subject,
        bodyText: payload.bodyText,
        bodyHtml: payload.bodyHtml || undefined,
        status: payload.status || undefined,
        isActive: payload.isActive
      }
    });
    return response.template;
  },

  async updateTemplate(
    key: string,
    payload: {
      label?: string;
      subject?: string;
      bodyText?: string;
      bodyHtml?: string;
      status?: "draft" | "published";
      isActive?: boolean;
    }
  ) {
    const response = await requestJson<MailTemplateResponse>(`/admin/mail/templates/${key}`, {
      method: "PATCH",
      body: {
        label: payload.label,
        subject: payload.subject,
        bodyText: payload.bodyText,
        bodyHtml: payload.bodyHtml,
        status: payload.status,
        isActive: payload.isActive
      }
    });
    return response.template;
  },

  async listTemplateVersions(key: string) {
    const response = await requestJson<MailTemplateVersionsResponse>(`/admin/mail/templates/${key}/versions`);
    return response.versions;
  },

  async createTemplateVersion(
    key: string,
    payload: { subject: string; bodyText: string; bodyHtml?: string; status?: "draft" | "published" }
  ) {
    return requestJson<{ ok: true; key: string; version: number; status: "draft" | "published"; createdAt: string }>(
      `/admin/mail/templates/${key}/versions`,
      {
        method: "POST",
        body: {
          subject: payload.subject,
          bodyText: payload.bodyText,
          bodyHtml: payload.bodyHtml || undefined,
          status: payload.status || undefined
        }
      }
    );
  },

  async previewTemplate(payload: { templateKey: string; entryId?: string; sampleData?: Record<string, unknown> }) {
    return requestJson<MailTemplatePreview>("/admin/mail/templates/preview", {
      method: "POST",
      body: {
        templateKey: payload.templateKey,
        entryId: payload.entryId || undefined,
        sampleData: payload.sampleData || undefined
      }
    });
  },

  async listTemplatePlaceholders(key: string) {
    const response = await requestJson<MailTemplatePlaceholdersResponse>(`/admin/mail/templates/${key}/placeholders`);
    return response.placeholders;
  },

  async resolveBroadcastRecipients(payload: {
    classId?: string;
    acceptanceStatus?: "pending" | "shortlist" | "accepted" | "rejected";
    paymentStatus?: "due" | "paid";
    additionalEmails?: string[];
  }) {
    const eventId = await getAdminEventId();
    return requestJson<ResolveRecipientsResult>("/admin/mail/broadcast/resolve-recipients", {
      method: "POST",
      body: {
        eventId,
        classId: payload.classId || undefined,
        acceptanceStatus: payload.acceptanceStatus || undefined,
        paymentStatus: payload.paymentStatus || undefined,
        additionalEmails: payload.additionalEmails?.length ? payload.additionalEmails : undefined
      }
    });
  },

  async sendMail(payload: {
    templateKey: string;
    subjectOverride?: string;
    bodyOverride?: string;
    additionalEmails?: string[];
    filters?: {
      classId?: string;
      acceptanceStatus?: "pending" | "shortlist" | "accepted" | "rejected";
      paymentStatus?: "due" | "paid";
    };
  }) {
    const eventId = await getAdminEventId();
    return requestJson<MailSendResponse>("/admin/mail/send", {
      method: "POST",
      body: {
        eventId,
        templateKey: payload.templateKey,
        subjectOverride: payload.subjectOverride || undefined,
        bodyOverride: payload.bodyOverride || undefined,
        additionalEmails: payload.additionalEmails?.length ? payload.additionalEmails : undefined,
        filters:
          payload.filters &&
          (payload.filters.classId || payload.filters.acceptanceStatus || payload.filters.paymentStatus)
            ? {
                classId: payload.filters.classId || undefined,
                acceptanceStatus: payload.filters.acceptanceStatus || undefined,
                paymentStatus: payload.filters.paymentStatus || undefined
              }
            : undefined
      }
    });
  },

  async retryOutbox(id: string) {
    return requestJson<{ ok: boolean }>(`/admin/mail/outbox/${id}/retry`, {
      method: "POST"
    });
  },

  async queueDirectMail(payload: {
    toEmail: string;
    templateKey: string;
    subjectOverride?: string;
    bodyOverride?: string;
    sendAfter?: string;
  }) {
    const eventId = await getAdminEventId();
    return requestJson<{ ok: boolean; queued?: number; skipped?: number; reason?: string }>("/admin/mail/queue", {
      method: "POST",
      body: {
        eventId,
        toEmail: payload.toEmail,
        templateKey: payload.templateKey,
        subjectOverride: payload.subjectOverride || undefined,
        bodyOverride: payload.bodyOverride || undefined,
        sendAfter: payload.sendAfter || undefined
      }
    });
  },

  async queuePaymentReminderForEntry(entryId: string, options?: { allowDuplicate?: boolean; eventId?: string }) {
    const eventId = options?.eventId?.trim() || (await getAdminEventId());
    return requestJson<AdminMailQueueResponse>("/admin/payment/reminders/queue", {
      method: "POST",
      body: {
        eventId,
        entryId,
        allowDuplicate: options?.allowDuplicate === true ? true : undefined
      }
    });
  },

  async queueAcceptedMailForEntry(
    entryId: string,
    options?: { allowDuplicate?: boolean; includeDriverNote?: boolean; eventId?: string }
  ) {
    const eventId = options?.eventId?.trim() || (await getAdminEventId());
    return requestJson<AdminMailQueueResponse>("/admin/mail/lifecycle/queue", {
      method: "POST",
      body: {
        eventId,
        entryId,
        eventType: "registration_received",
        includeDriverNote: options?.includeDriverNote === true ? true : undefined,
        allowDuplicate: options?.allowDuplicate === true ? true : undefined
      }
    });
  },

  async queueVerificationMailForEntry(entryId: string, options?: { allowDuplicate?: boolean; eventId?: string }) {
    const eventId = options?.eventId?.trim() || (await getAdminEventId());
    const sendRequest = async (allowDuplicate?: boolean) =>
      requestJson<AdminMailQueueResponse>("/admin/mail/lifecycle/queue", {
        method: "POST",
        body: {
          eventId,
          entryId,
          eventType: "registration_received",
          allowDuplicate: allowDuplicate === true ? true : undefined
        }
      });

    try {
      return await sendRequest(options?.allowDuplicate);
    } catch (error) {
      // Some backend builds still fail on forced duplicate mode for registration_received.
      // Retry once without allowDuplicate to keep the action usable.
      if (options?.allowDuplicate && error instanceof Error && error.message.toLowerCase().includes("internal_error")) {
        return sendRequest(false);
      }
      throw error;
    }
  }
};
