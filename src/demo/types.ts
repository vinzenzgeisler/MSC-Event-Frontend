import type { IamRole } from "@/types/admin-iam";
import type { AdminSettingsClass, AdminSettingsEntryConfirmationConfig, AdminSettingsEvent, AdminSettingsRunGroup } from "@/types/admin-settings";
import type { AdminEntryDetailDto, ExportJobDto, MailTemplate, OutboxItemDto } from "@/types/admin";
import type { InspectionHistoryItem } from "@/services/technical-inspection.service";
import type { MarshalWorkspace } from "@/types/admin-marshals";

export type DemoRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
};

export type DemoHistoryItem = {
  id: string;
  action: string;
  actorUserId?: string | null;
  actorDisplay?: string | null;
  createdAt: string;
  payload?: Record<string, unknown> | null;
};

export type DemoEntry = {
  detail: AdminEntryDetailDto;
  history: DemoHistoryItem[];
  deletedAt?: string | null;
  deletedByDisplay?: string | null;
  deleteReason?: string | null;
};

export type DemoIamUser = {
  id: string;
  username: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  enabled: boolean;
  status: string;
  emailVerified: boolean;
  roles: IamRole[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type DemoState = {
  events: AdminSettingsEvent[];
  classes: AdminSettingsClass[];
  runGroups: AdminSettingsRunGroup[];
  entryConfirmationConfig: AdminSettingsEntryConfirmationConfig;
  pricingRules: Record<string, {
    eventId: string;
    earlyDeadline: string;
    lateFeeCents: number;
    secondVehicleDiscountCents: number;
    currency: string;
    classRules: Array<{ classId: string; className: string; baseFeeCents: number }>;
  }>;
  entries: DemoEntry[];
  inspectionHistory: Record<string, InspectionHistoryItem[]>;
  iamUsers: DemoIamUser[];
  templates: MailTemplate[];
  outbox: OutboxItemDto[];
  exports: ExportJobDto[];
  marshalWorkspace: MarshalWorkspace;
  counter: number;
};
