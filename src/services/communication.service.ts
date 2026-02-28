import { getAdminEventId } from "@/services/api/event-context";
import { requestJson } from "@/services/api/http-client";
import type { BroadcastForm, OutboxItem, OutboxItemDto } from "@/types/admin";

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

  async queueBroadcast(form: BroadcastForm) {
    const eventId = await getAdminEventId();
    return requestJson<AdminMailQueueResponse>("/admin/mail/broadcast/queue", {
      method: "POST",
      body: {
        eventId,
        templateKey: form.templateKey,
        classId: form.classId !== "all" ? form.classId : undefined,
        acceptanceStatus: form.acceptanceStatus !== "all" ? form.acceptanceStatus : undefined,
        paymentStatus: form.paymentStatus !== "all" ? form.paymentStatus : undefined,
        subjectOverride: form.subjectOverride || undefined
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
