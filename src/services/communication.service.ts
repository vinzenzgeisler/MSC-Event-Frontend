import { mockOutbox } from "@/mock/communication.mock";
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

export const communicationService = {
  async listOutbox() {
    return mockOutbox.map(fromOutboxDto);
  },

  async queueBroadcast(_form: BroadcastForm) {
    return { ok: true };
  },

  async retryOutbox(_id: string) {
    return { ok: true };
  },

  async queuePaymentReminderForEntry(_entryId: string) {
    return { ok: true };
  },

  async queueAcceptedMailForEntry(_entryId: string) {
    return { ok: true };
  }
};
