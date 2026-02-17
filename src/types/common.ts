export type Id = string;

export type VehicleType = "auto" | "moto";

export type RegistrationStatus = "submitted_unverified" | "submitted_verified";

export type AcceptanceStatus = "pending" | "shortlist" | "accepted" | "rejected";

export type PaymentStatus = "due" | "paid";

export type TechStatus = "pending" | "passed" | "failed";

export type OutboxStatus = "queued" | "sending" | "sent" | "failed";

export type ExportJobStatus = "queued" | "processing" | "succeeded" | "failed";

export type StartNumberConflictType = "none" | "same_class_taken" | "invalid_format";
