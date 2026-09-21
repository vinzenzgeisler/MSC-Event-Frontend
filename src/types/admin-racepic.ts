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
