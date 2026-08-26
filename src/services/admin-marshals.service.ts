import { getAuthToken } from "@/app/auth/auth-store";
import { requestJson } from "@/services/api/http-client";
import type {
  MarshalAreaConfigInput,
  MarshalAssignmentInput,
  MarshalCommitmentStatus,
  MarshalEvent,
  MarshalImportPreview,
  MarshalPersonInput,
  MarshalPersonPatch,
  MarshalPostConfigInput,
  MarshalWorkspace,
} from "@/types/admin-marshals";

type OkResponse = { ok: boolean };

function apiBaseUrl() {
  const runtime = window.__MSC_RUNTIME_CONFIG__;
  const value = runtime?.apiBaseUrl ?? runtime?.VITE_API_BASE_URL ?? import.meta.env.VITE_API_BASE_URL ?? "";
  return String(value).trim().replace(/\/$/, "");
}

export const adminMarshalsService = {
  async listEvents() {
    return requestJson<{ ok: boolean; events: MarshalEvent[] }>("/admin/marshals/events");
  },

  async getWorkspace(eventId: string, search?: string, area?: string) {
    return requestJson<OkResponse & MarshalWorkspace>("/admin/marshals/workspace", { query: { eventId, search, area } });
  },

  async saveAssignment(personId: string, payload: MarshalAssignmentInput) {
    return requestJson<OkResponse>(`/admin/marshals/assignments/${personId}`, { method: "PUT", body: payload });
  },

  async upsertAreaAssignment(personId: string, body: { eventId: string; areaId: string; commitmentStatus: MarshalCommitmentStatus; note?: string | null }) {
    return requestJson<OkResponse>(`/admin/marshals/area-assignments/${personId}`, { method: "PUT", body });
  },

  async deleteAreaAssignment(personId: string, eventId: string, areaId: string) {
    return requestJson<OkResponse>(`/admin/marshals/area-assignments/${personId}`, { method: "DELETE", query: { eventId, areaId } });
  },

  async upsertShiftAssignment(personId: string, body: { eventId: string; shiftId: string; commitmentStatus: MarshalCommitmentStatus; note?: string | null }) {
    return requestJson<OkResponse>(`/admin/marshals/shift-assignments/${personId}`, { method: "PUT", body });
  },

  async deletePerson(personId: string) {
    return requestJson<OkResponse>(`/admin/marshals/persons/${personId}`, { method: "DELETE" });
  },

  async resetEventAssignments(eventId: string) {
    return requestJson<OkResponse>(`/admin/marshals/events/${eventId}/reset`, { method: "POST", body: { scope: "assignments" } });
  },

  async updateAreaConfig(body: MarshalAreaConfigInput) {
    return requestJson<OkResponse>("/admin/marshals/config/areas", { method: "PUT", body });
  },

  async createPerson(payload: MarshalPersonInput) {
    return requestJson<OkResponse>("/admin/marshals/persons", { method: "POST", body: payload });
  },

  async updatePerson(personId: string, payload: MarshalPersonPatch) {
    return requestJson<OkResponse>(`/admin/marshals/persons/${personId}`, { method: "PATCH", body: payload });
  },

  async saveConfig(payload: {
    eventId: string;
    sections: Array<{ code: string; name: string; leaderCode: string; sortOrder: number }>;
    posts: MarshalPostConfigInput[];
  }) {
    return requestJson<OkResponse>("/admin/marshals/config", { method: "PUT", body: payload });
  },

  async createTraining(payload: { eventId: string; sessionType: "training" | "briefing"; title: string; sessionDate: string; location?: string | null }) {
    return requestJson<OkResponse>("/admin/marshals/trainings", { method: "POST", body: payload });
  },

  async saveTrainingParticipant(sessionId: string, personId: string, attendanceStatus: "registered" | "attended" | "absent" | "excused") {
    return requestJson<OkResponse>(`/admin/marshals/trainings/${sessionId}/participants/${personId}`, { method: "PUT", body: { attendanceStatus } });
  },

  async previewImport(eventId: string, file: File) {
    const dataBase64 = await fileToBase64(file);
    const response = await requestJson<OkResponse & MarshalImportPreview>("/admin/marshals/import/preview", { method: "POST", body: { eventId, filename: file.name, dataBase64 } });
    return { response, dataBase64 };
  },

  async commitImport(eventId: string, filename: string, dataBase64: string, expectedSha256: string) {
    return requestJson<OkResponse>("/admin/marshals/import/commit", { method: "POST", body: { eventId, filename, dataBase64, expectedSha256 } });
  },

  async downloadPrint(params: { eventId: string; type: "attendance" | "section" | "training"; dayId?: string; sectionId?: string; trainingId?: string }) {
    const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])));
    const response = await fetch(`${apiBaseUrl()}/admin/marshals/print?${query.toString()}`, { headers: { Authorization: `Bearer ${getAuthToken() ?? ""}` } });
    if (!response.ok) throw new Error(`Druckliste konnte nicht erstellt werden (${response.status})`);
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") ?? "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "streckenposten-liste.pdf";
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
  }
};

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error ?? new Error("Datei konnte nicht gelesen werden"));
    reader.readAsDataURL(file);
  });
}
