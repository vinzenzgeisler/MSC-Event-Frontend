export type ApiError = {
  ok: boolean;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  fieldErrors?: { field: string; code: string; message: string }[];
};

export type ListMeta = {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
};

export type OkResponse<T extends object = {}> = { ok: boolean } & T;

export const acceptanceStatuses = ["pending", "shortlist", "accepted", "rejected"] as const;
export const registrationStatuses = ["submitted_unverified", "submitted_verified"] as const;
export const paymentStatuses = ["due", "paid"] as const;
export const techStatuses = ["pending", "passed", "failed"] as const;
export const lifecycleEventTypes = [
  "registration_received",
  "preselection",
  "accepted_open_payment",
  "accepted_paid_completed",
  "rejected",
  "waitlist"
] as const;
export const vehicleTypes = ["auto", "moto"] as const;
export const exportTypes = ["startlist_csv", "participants_csv", "payments_open_csv", "checkin_status_csv"] as const;
export const exportFormats = ["csv"] as const;
export const paymentMethods = ["bank_transfer", "cash", "card", "other"] as const;
