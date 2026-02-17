import type { OutboxItemDto } from "@/types/admin";

export const mockOutbox: OutboxItemDto[] = [
  {
    id: "mail-001",
    toEmail: "lena@example.com",
    subject: "Startzeiten bestätigt",
    status: "queued",
    errorLast: null,
    createdAt: "2026-02-15T11:00:00.000Z"
  },
  {
    id: "mail-002",
    toEmail: "mila@example.com",
    subject: "Zahlung offen",
    status: "failed",
    errorLast: "Mailbox temporär nicht erreichbar",
    createdAt: "2026-02-15T12:24:00.000Z"
  },
  {
    id: "mail-003",
    toEmail: "rashid@example.com",
    subject: "Nennbestätigung",
    status: "sent",
    errorLast: null,
    createdAt: "2026-02-15T12:42:00.000Z"
  }
];
