export type NewsletterSubscriberStatus = "pending" | "active" | "unsubscribed" | "bounced" | "complained";
export type NewsletterSubscriber = { id: string; email: string; locale: "de" | "en" | "cs" | "pl"; status: NewsletterSubscriberStatus; createdAt: string; confirmedAt: string | null; unsubscribedAt: string | null; verificationSentAt: string | null; totalCount?: number };
export type NewsletterOverview = { total: number; active: number; pending: number; unsubscribed: number; suppressed: number };
