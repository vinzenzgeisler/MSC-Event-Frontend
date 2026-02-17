import type { ExportJobDto } from "@/types/admin";

export const mockExportJobs: ExportJobDto[] = [
  {
    id: "exp-101",
    type: "startlist_csv",
    status: "succeeded",
    createdAt: "2026-02-16T07:00:00.000Z"
  },
  {
    id: "exp-102",
    type: "entries_csv",
    status: "processing",
    createdAt: "2026-02-16T09:10:00.000Z"
  },
  {
    id: "exp-103",
    type: "payments_open_csv",
    status: "queued",
    createdAt: "2026-02-16T11:22:00.000Z"
  }
];
