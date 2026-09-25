// RacePic Admin-Basis (Paket 5), spiegelt api/src/racepic/handler.ts (MSC-Event-Backend-Repo).

export type RacepicImageVisibility = "DRAFT" | "PUBLISHED" | "HIDDEN" | "REMOVED";
export type RacepicProcessingStatus = "UPLOADED" | "VALIDATED" | "DERIVED" | "ANALYZED" | "MATCHED" | "FAILED" | "DUPLICATE";
export type RacepicAssignmentStatus = "AUTO_MATCHED" | "REVIEW_REQUIRED" | "MANUALLY_CONFIRMED" | "MANUALLY_CORRECTED" | "REJECTED";
export type RacepicPhotographerStatus = "INVITED" | "PENDING_APPROVAL" | "ACTIVE_FREE" | "PAYMENT_ONBOARDING_REQUIRED" | "PAYMENT_ONBOARDING_PENDING" | "PAYMENT_ENABLED" | "PAYMENT_RESTRICTED" | "PAYMENT_DISABLED" | "DISABLED";

export type RacepicEventConfig = {
  slug: string;
  title: string;
  enabled: boolean;
  uploadOpensAt: string | null;
  uploadClosesAt: string | null;
  published: boolean;
  defaultLicenseId: string | null;
};

export type RacepicEventListItem = {
  eventId: string;
  eventName: string;
  startsAt: string;
  endsAt: string;
  racepic: RacepicEventConfig | null;
};

export type RacepicEventStats = {
  photographerCount: number;
  imagesByStatus: Record<string, number>;
  imagesByVisibility: Record<string, number>;
  assignmentsByStatus: Record<string, number>;
};

export type RacepicPhotographer = {
  id: string;
  email: string;
  displayName: string;
  status: RacepicPhotographerStatus;
  events: { eventId: string; eventName: string }[];
};

export type RacepicLicenseOption = {
  id: string;
  code: string;
  title: Record<string, string>;
};

// --- Paket 7: Review-Queue -----------------------------------------------------------------------

export type RacepicBoundingBox = { width: number; height: number; left: number; top: number };

export type RacepicCandidate = {
  candidateId: string;
  entryId: string;
  score: number;
  rank: number;
  driverName: string;
  startNumber: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
};

export type RacepicReviewItem = {
  /** null = Fahrzeug erkannt, aber (noch) keine Zuordnung vorhanden - nur manuelles Zuordnen möglich. */
  assignmentId: string | null;
  imageId: string;
  imagePreviewUrl: string;
  detection: { id: string; label: string; bbox: RacepicBoundingBox } | null;
  confidence: number;
  suggestedEntryId: string | null;
  candidates: RacepicCandidate[];
};

export type RacepicEntrySearchResult = {
  entryId: string;
  startNumber: string | null;
  driverName: string;
  vehicleMake: string | null;
  vehicleModel: string | null;
};

// --- Paket 11: Bildliste, Matching-Config, Qualitätsreport ----------------------------------------

export type RacepicAdminImage = {
  id: string;
  previewUrl: string | null;
  visibility: RacepicImageVisibility;
  processingStatus: RacepicProcessingStatus;
  processingError: string | null;
  assignmentState: string;
  photographerDisplayName: string;
  capturedAt: string | null;
  createdAt: string;
};

export type RacepicImagePipelineStatus = {
  id: string;
  processingStatus: RacepicProcessingStatus;
  processingError: string | null;
  visibility: RacepicImageVisibility;
  offerMode: string;
  priceCents: number | null;
  assignmentState: string;
  detectionCount: number;
  candidateCount: number;
  steps: { step: string; pipelineVersion: string; status: string; startedAt: string; finishedAt: string | null; error: string | null }[];
};

export type RacepicMatchingWeights = {
  ocrExact: number;
  ocrConfidence: number;
  vehicleTypeMatch: number;
  embeddingSimilarity: number;
  colorSimilarity: number;
  ambiguityPenalty: number;
};

/**
 * Spiegelt die rohe DB-Zeile aus `GET /admin/racepic/matching-configs` (`listMatchingConfigs` in
 * MSC-Event-Backend gibt die Drizzle-Zeile unveraendert zurueck) - die `numeric`-Spalten kommen
 * dabei als String, nicht als Zahl (Standardverhalten von drizzle-orm ohne `mode: 'number'`).
 * Beim Anlegen (`POST`) erwartet das Backend dagegen echte Zahlen, siehe `RacepicMatchingConfigInput`.
 */
export type RacepicMatchingConfig = {
  id: string;
  eventId: string | null;
  version: number;
  weights: RacepicMatchingWeights;
  autoThreshold: string;
  reviewThreshold: string;
  minMargin: string;
  active: boolean;
};

export type RacepicMatchingConfigInput = {
  eventId: string | null;
  weights: RacepicMatchingWeights;
  autoThreshold: number;
  reviewThreshold: number;
  minMargin: number;
};

export type RacepicQualityThresholdRow = {
  threshold: number;
  candidateCount: number;
  correctCount: number;
  incorrectCount: number;
  precision: number | null;
  recall: number | null;
};

// --- Paket 16: Zuordnungen je Bild (Admin-Redesign) -----------------------------------------------

export type RacepicImageAssignment = {
  assignmentId: string;
  entryId: string;
  status: RacepicAssignmentStatus;
  source: string;
  confidence: number | null;
  driverName: string;
  startNumber: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
};

export type RacepicMatchQualityReport = {
  eventId: string;
  reviewedDetectionCount: number;
  detectionsWithConfirmedMatchCount: number;
  thresholds: RacepicQualityThresholdRow[];
};
