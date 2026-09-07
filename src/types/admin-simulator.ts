export type SimDay = "saturday" | "sunday";

export type SimEntry = {
  id: string;
  eventId: string;
  name: string;
  bestTimeMs: number;
  day: SimDay;
  createdAt: string;
  updatedAt: string;
};

export type SimUpsertInput = {
  eventId: string;
  name: string;
  bestTimeMs: number;
  day: SimDay;
};
