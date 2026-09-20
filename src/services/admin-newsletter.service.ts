import { requestJson } from "@/services/api/http-client";
import type { NewsletterOverview, NewsletterSubscriber, NewsletterSubscriberStatus } from "@/types/admin-newsletter";

export const adminNewsletterService = {
  async overview() { return requestJson<{ ok: boolean; overview: NewsletterOverview }>("/admin/newsletter/overview"); },
  async list(query: { status?: NewsletterSubscriberStatus; locale?: string; search?: string; page?: number; pageSize?: number }) {
    return requestJson<{ ok: boolean; items: NewsletterSubscriber[]; total: number; page: number; pageSize: number }>("/admin/newsletter/subscribers", { query });
  },
  async unsubscribe(id: string) { return requestJson<{ ok: boolean }>(`/admin/newsletter/subscribers/${id}/unsubscribe`, { method: "POST" }); },
  async resend(id: string) { return requestJson<{ ok: boolean }>(`/admin/newsletter/subscribers/${id}/resend-verification`, { method: "POST" }); }
};
