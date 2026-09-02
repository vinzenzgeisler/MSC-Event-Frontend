import { requestJson } from "@/services/api/http-client";

export type ParticipantWorkflowType = "regular_codriver_registration" | "charity_codriver_registration";
export type TerminalWorkflowStage = "collecting_data" | "awaiting_operator_approval" | "ready_to_sign" | "completed" | "cancelled" | "failed";

export type ParticipantTerminalSession = {
  id: string;
  status: "pending" | "displayed" | "completed" | "cancelled" | "failed";
  workflowType: ParticipantWorkflowType;
  workflowStage: TerminalWorkflowStage;
  deviceSessionId: string;
  draftPayload?: Record<string, unknown> | null;
  resultPayload?: Record<string, unknown> | null;
  expiresAt: string;
  updatedAt: string;
};

export const adminTerminalService = {
  async createParticipantSession(payload: {
    workflowType: ParticipantWorkflowType;
    deviceSessionId: string;
    entryIds: string[];
  }) {
    const response = await requestJson<{ ok: true; session: ParticipantTerminalSession }>("/admin/terminal/sessions", {
      method: "POST",
      body: payload
    });
    return response.session;
  },

  async getSession(id: string) {
    const response = await requestJson<{ ok: true; session: ParticipantTerminalSession }>(`/admin/terminal/sessions/${id}`);
    return response.session;
  },

  async approve(id: string, prechecks: {
    identityCheckedAt: string;
    signerPresentAt: string;
    medicalCertificateCheckedAt?: string | null;
    guardianPresentAt?: string | null;
    guardianAuthorityCheckedAt?: string | null;
  }) {
    const response = await requestJson<{ ok: true; session: ParticipantTerminalSession }>(`/admin/terminal/sessions/${id}/approve`, {
      method: "POST",
      body: prechecks
    });
    return response.session;
  },

  async returnToForm(id: string) {
    const response = await requestJson<{ ok: true; session: ParticipantTerminalSession }>(`/admin/terminal/sessions/${id}/return-to-form`, { method: "POST" });
    return response.session;
  },

  async cancel(id: string) {
    const response = await requestJson<{ ok: true; session: ParticipantTerminalSession }>(`/admin/terminal/sessions/${id}/cancel`, { method: "POST" });
    return response.session;
  }
};
