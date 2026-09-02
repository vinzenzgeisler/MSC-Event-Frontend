import { requestJson } from "@/services/api/http-client";

export type CodriverInvitationStatus = "active" | "expired" | "revoked" | "used";

export type CodriverInvitation = {
  id: string;
  entryIds: string[];
  recipientName: string | null;
  recipientEmail: string | null;
  expiresAt: string;
  consumedAt?: string | null;
  createdAt?: string;
  status: CodriverInvitationStatus;
};

export const adminCodriverInvitationsService = {
  async list(entryId: string) {
    const response = await requestJson<{ ok: true; invitations: CodriverInvitation[] }>(`/admin/entries/${entryId}/codriver-invitations`);
    return response.invitations;
  },

  async create(entryId: string, payload: { entryIds: string[]; recipientName?: string; recipientEmail?: string; expiresAt: string }) {
    return requestJson<{ ok: true; invitation: CodriverInvitation; url: string }>(`/admin/entries/${entryId}/codriver-invitations`, {
      method: "POST",
      body: payload
    });
  },

  async revoke(invitationId: string) {
    await requestJson(`/admin/codriver-invitations/${invitationId}/revoke`, { method: "POST" });
  }
};
