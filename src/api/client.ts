import { customInstance } from "@/lib/http/client";
import type { ListMeta, OkResponse } from "@/api/types";

export type PublicCurrentEventResponse = OkResponse<{
  event: Record<string, unknown>;
  classes: Record<string, unknown>[];
  registration: { isOpen: boolean; reason: string | null };
}>;

export type StartNumberValidationResponse = OkResponse<{
  normalizedStartNumber: string | null;
  validFormat: boolean;
  available: boolean;
  conflictEntryId: string | null;
}>;

export type VehicleImageUploadInitResponse = OkResponse<{
  uploadId: string;
  key: string;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
}>;

export type VehicleImageUploadFinalizeResponse = OkResponse<{
  uploadId: string;
  imageS3Key: string;
  finalizedAt: string | null;
}>;

export type AdminEntriesResponse = OkResponse<{
  entries: Record<string, unknown>[];
  meta: ListMeta;
}>;

export type AdminEntryDetailResponse = OkResponse<{
  entry: Record<string, unknown>;
  history: Record<string, unknown>[];
}>;

export type AdminOutboxResponse = OkResponse<{
  outbox: Record<string, unknown>[];
  meta: ListMeta;
}>;

export type AdminExportsResponse = OkResponse<{
  exports: Record<string, unknown>[];
  meta: ListMeta;
}>;

export type AdminClassesResponse = OkResponse<{
  classes: Record<string, unknown>[];
  meta: ListMeta;
}>;

export type PublicCreateEntryRequest = {
  classId: string;
  driver: PersonInput;
  codriver?: PersonInput;
  vehicle: VehicleInput;
  startNumber?: string;
  isBackupVehicle?: boolean;
};

export type PersonInput = {
  email: string;
  firstName: string;
  lastName: string;
  birthdate?: string;
  nationality?: string;
  street?: string;
  zip?: string;
  city?: string;
  phone?: string;
};

export type VehicleInput = {
  vehicleType: string;
  make?: string;
  model?: string;
  year?: number;
  startNumberRaw?: string;
  imageS3Key?: string;
};

export async function getPublicCurrentEvent() {
  return customInstance<PublicCurrentEventResponse>({
    url: "/public/events/current",
    method: "GET"
  });
}

export async function validateStartNumber(eventId: string, payload: { classId: string; startNumber: string }) {
  return customInstance<StartNumberValidationResponse>({
    url: `/public/events/${eventId}/start-number/validate`,
    method: "POST",
    data: payload
  });
}

export async function initVehicleImageUpload(payload: {
  eventId: string;
  contentType: string;
  fileName?: string;
  fileSizeBytes: number;
}) {
  return customInstance<VehicleImageUploadInitResponse>({
    url: "/public/uploads/vehicle-image/init",
    method: "POST",
    data: payload
  });
}

export async function finalizeVehicleImageUpload(payload: { uploadId: string }) {
  return customInstance<VehicleImageUploadFinalizeResponse>({
    url: "/public/uploads/vehicle-image/finalize",
    method: "POST",
    data: payload
  });
}

export async function createPublicEntry(eventId: string, payload: PublicCreateEntryRequest) {
  return customInstance<OkResponse>({
    url: `/public/events/${eventId}/entries`,
    method: "POST",
    data: payload
  });
}

export async function getAdminEventsCurrent() {
  return customInstance<OkResponse<Record<string, unknown>>>({
    url: "/admin/events/current",
    method: "GET"
  });
}

export async function getAdminEventClasses(eventId: string) {
  return customInstance<AdminClassesResponse>({
    url: `/admin/events/${eventId}/classes`,
    method: "GET"
  });
}

export async function getAdminEntries(params: Record<string, unknown>) {
  return customInstance<AdminEntriesResponse>({
    url: "/admin/entries",
    method: "GET",
    params
  });
}

export async function getAdminEntryDetail(entryId: string) {
  return customInstance<AdminEntryDetailResponse>({
    url: `/admin/entries/${entryId}`,
    method: "GET"
  });
}

export async function patchEntryStatus(entryId: string, payload: { acceptanceStatus: string; sendLifecycleMail?: boolean; lifecycleEventType?: string }) {
  return customInstance<OkResponse>({
    url: `/admin/entries/${entryId}/status`,
    method: "PATCH",
    data: payload
  });
}

export async function patchTechStatus(entryId: string, payload: { techStatus: string }) {
  return customInstance<OkResponse>({
    url: `/admin/entries/${entryId}/tech-status`,
    method: "PATCH",
    data: payload
  });
}

export async function patchCheckinIdVerify(entryId: string) {
  return customInstance<OkResponse>({
    url: `/admin/entries/${entryId}/checkin/id-verify`,
    method: "PATCH",
    data: {}
  });
}

export async function recordPayment(invoiceId: string, payload: { amountCents: number; paidAt: string; method: string; note?: string }) {
  return customInstance<OkResponse>({
    url: `/admin/invoices/${invoiceId}/payments`,
    method: "POST",
    data: payload
  });
}

export async function generateWaiver(payload: { eventId: string; entryId: string }) {
  return customInstance<Record<string, unknown>>({
    url: "/admin/documents/waiver",
    method: "POST",
    data: payload
  });
}

export async function generateTechCheck(payload: { eventId: string; entryId: string }) {
  return customInstance<Record<string, unknown>>({
    url: "/admin/documents/tech-check",
    method: "POST",
    data: payload
  });
}

export async function getAdminOutbox(params: Record<string, unknown>) {
  return customInstance<AdminOutboxResponse>({
    url: "/admin/mail/outbox",
    method: "GET",
    params
  });
}

export async function retryOutbox(outboxId: string) {
  return customInstance<OkResponse>({
    url: `/admin/mail/outbox/${outboxId}/retry`,
    method: "POST"
  });
}

export async function queueBroadcastMail(payload: Record<string, unknown>) {
  return customInstance<OkResponse>({
    url: "/admin/mail/broadcast/queue",
    method: "POST",
    data: payload
  });
}

export async function queuePaymentReminder(payload: Record<string, unknown>) {
  return customInstance<OkResponse>({
    url: "/admin/payment/reminders/queue",
    method: "POST",
    data: payload
  });
}

export async function getAdminExports(eventId: string) {
  return customInstance<AdminExportsResponse>({
    url: "/admin/exports",
    method: "GET",
    params: { eventId }
  });
}

export async function createExport(payload: Record<string, unknown>) {
  return customInstance<OkResponse>({
    url: "/admin/exports/entries",
    method: "POST",
    data: payload
  });
}

export async function downloadExport(exportJobId: string) {
  return customInstance<Blob>({
    url: `/admin/exports/${exportJobId}/download`,
    method: "GET",
    responseType: "blob"
  });
}
