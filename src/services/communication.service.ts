import { getAdminEventId } from "@/services/api/event-context";
import { requestJson } from "@/services/api/http-client";
import type {
  MailRenderOptionsInput,
  MailRecipientSearchItem,
  MailTemplate,
  MailTemplatePlaceholder,
  MailTemplatePreview,
  OutboxItem,
  OutboxItemDto,
  ResolveRecipientsResult
} from "@/types/admin";

function fromOutboxDto(dto: OutboxItemDto): OutboxItem {
  const createdAtRaw = dto.createdAt;
  return {
    id: dto.id,
    batchId: dto.batchId ?? null,
    recipient: dto.toEmail,
    subject: dto.subject,
    status: dto.status,
    error: dto.errorLast ?? "",
    createdAt: new Date(dto.createdAt).toLocaleString("de-DE"),
    createdAtRaw,
    templateId: dto.templateId,
    templateVersion: dto.templateVersion,
    attemptCount: dto.attemptCount,
    maxAttempts: dto.maxAttempts,
    sendAfter: dto.sendAfter
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

type MailRecipientSearchResponse = {
  ok: true;
  recipients: MailRecipientSearchItem[];
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

  async previewTemplate(payload: {
    templateKey: string;
    entryId?: string;
    templateData?: Record<string, unknown>;
    sampleData?: Record<string, unknown>;
    subjectOverride?: string;
    bodyOverride?: string;
    bodyHtmlOverride?: string;
    renderOptions?: MailRenderOptionsInput;
    previewMode?: "stored" | "draft";
  }) {
    return requestJson<MailTemplatePreview>("/admin/mail/templates/preview", {
      method: "POST",
      body: {
        templateKey: payload.templateKey,
        entryId: payload.entryId || undefined,
        templateData: payload.templateData || undefined,
        sampleData: payload.sampleData || undefined,
        subjectOverride: payload.subjectOverride || undefined,
        bodyOverride: payload.bodyOverride || undefined,
        bodyHtmlOverride: payload.bodyHtmlOverride || undefined,
        renderOptions: payload.renderOptions || undefined,
        previewMode: payload.previewMode || undefined
      }
    });
  },

  async listTemplatePlaceholders(key: string) {
    const response = await requestJson<MailTemplatePlaceholdersResponse>(`/admin/mail/templates/${key}/placeholders`);
    return response.placeholders;
  },

  async searchRecipients(payload: {
    query?: string;
    classId?: string;
    acceptanceStatus?: "pending" | "shortlist" | "accepted" | "rejected";
    paymentStatus?: "due" | "paid";
    limit?: number;
  }) {
    const eventId = await getAdminEventId();
    const rawQuery = (payload.query ?? "").trim();
    const queryBase = {
      eventId,
      classId: payload.classId || undefined,
      acceptanceStatus: payload.acceptanceStatus || undefined,
      paymentStatus: payload.paymentStatus || undefined,
      limit: payload.limit || undefined
    };

    const runSearch = async (q: string | undefined) => {
      const response = await requestJson<MailRecipientSearchResponse>("/admin/mail/recipients/search", {
        query: {
          ...queryBase,
          q
        }
      });
      return response.recipients;
    };

    const primary = await runSearch(rawQuery ? rawQuery : undefined);
    if (primary.length > 0 || rawQuery.length < 2) {
      return primary;
    }

    // Backend search may still only match first names in some deployments.
    // Fallback: search by the longest token, then filter results client-side by all tokens.
    const tokens = rawQuery
      .split(/[\s,;]+/)
      .map((token) => token.trim())
      .filter(Boolean);
    if (tokens.length < 2) {
      return primary;
    }

    const normalizedTokens = Array.from(new Set(tokens.map((t) => t.toLowerCase()))).filter((t) => t.length >= 2);
    if (normalizedTokens.length < 2) {
      return primary;
    }

    const tokenToSearch = [...normalizedTokens].sort((a, b) => b.length - a.length)[0];
    const fallback = await runSearch(tokenToSearch);
    if (fallback.length === 0) {
      return primary;
    }

    const filtered = fallback.filter((item) => {
      const hay = `${item.driverName} ${item.driverEmail}`.toLowerCase();
      return normalizedTokens.every((token) => hay.includes(token));
    });

    const deduped = new Map<string, MailRecipientSearchItem>();
    [...filtered].forEach((item) => deduped.set(item.driverPersonId, item));
    return [...deduped.values()];
  },

  async resolveBroadcastRecipients(payload: {
    classId?: string;
    acceptanceStatus?: "pending" | "shortlist" | "accepted" | "rejected";
    registrationStatus?: "submitted_unverified" | "submitted_verified";
    paymentStatus?: "due" | "paid";
    additionalEmails?: string[];
    driverPersonIds?: string[];
    entryIds?: string[];
  }) {
    const eventId = await getAdminEventId();
    return requestJson<ResolveRecipientsResult>("/admin/mail/broadcast/resolve-recipients", {
      method: "POST",
      body: {
        eventId,
        classId: payload.classId || undefined,
        acceptanceStatus: payload.acceptanceStatus || undefined,
        registrationStatus: payload.registrationStatus || undefined,
        paymentStatus: payload.paymentStatus || undefined,
        additionalEmails: payload.additionalEmails?.length ? payload.additionalEmails : undefined,
        driverPersonIds: payload.driverPersonIds?.length ? payload.driverPersonIds : undefined,
        entryIds: payload.entryIds?.length ? payload.entryIds : undefined
      }
    });
  },

  async sendMail(payload: {
    templateKey: string;
    subjectOverride?: string;
    bodyOverride?: string;
    bodyHtmlOverride?: string;
    templateData?: Record<string, unknown>;
    renderOptions?: MailRenderOptionsInput;
    additionalEmails?: string[];
    driverPersonIds?: string[];
    entryIds?: string[];
    filters?: {
      classId?: string;
      acceptanceStatus?: "pending" | "shortlist" | "accepted" | "rejected";
      registrationStatus?: "submitted_unverified" | "submitted_verified";
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
        bodyHtmlOverride: payload.bodyHtmlOverride || undefined,
        templateData: payload.templateData || undefined,
        renderOptions: payload.renderOptions || undefined,
        additionalEmails: payload.additionalEmails?.length ? payload.additionalEmails : undefined,
        driverPersonIds: payload.driverPersonIds?.length ? payload.driverPersonIds : undefined,
        entryIds: payload.entryIds?.length ? payload.entryIds : undefined,
        filters:
          payload.filters &&
          (payload.filters.classId || payload.filters.acceptanceStatus || payload.filters.registrationStatus || payload.filters.paymentStatus)
            ? {
                classId: payload.filters.classId || undefined,
                acceptanceStatus: payload.filters.acceptanceStatus || undefined,
                registrationStatus: payload.filters.registrationStatus || undefined,
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
