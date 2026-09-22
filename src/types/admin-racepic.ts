// RacePic Admin-Basis (Paket 5), spiegelt api/src/racepic/handler.ts (MSC-Event-Backend-Repo).

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
};

export type RacepicPhotographer = {
  id: string;
  email: string;
  displayName: string;
  status: string;
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
  assignmentId: string;
  imageId: string;
  imagePreviewUrl: string;
  detection: { id: string; label: string; bbox: RacepicBoundingBox } | null;
  confidence: number;
  suggestedEntryId: string;
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
  visibility: "DRAFT" | "PUBLISHED" | "HIDDEN" | "REMOVED";
  processingStatus: string;
  photographerDisplayName: string;
  capturedAt: string | null;
  createdAt: string;
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

export type RacepicMatchQualityReport = {
  eventId: string;
  reviewedDetectionCount: number;
  detectionsWithConfirmedMatchCount: number;
  thresholds: RacepicQualityThresholdRow[];
};
