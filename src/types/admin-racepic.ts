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
