import { requestJson } from "@/services/api/http-client";

export type CodriverParticipantInput = {
  locale: "de-DE" | "en-GB" | "cs-CZ" | "pl-PL";
  firstName: string;
  lastName: string;
  birthdate: string;
  country: string;
  street: string;
  zip: string;
  city: string;
  email: string;
  phone: string;
  emergencyContactFirstName: string;
  emergencyContactLastName: string;
  emergencyContactPhone: string;
  motorsportHistory?: string | null;
  guardianFullName?: string | null;
  guardianEmail?: string | null;
  guardianPhone?: string | null;
  guardianRelationship?: string | null;
};

export type PublicCodriverInvitation = {
  invitation: { recipientName: string | null; recipientEmail: string | null; expiresAt: string };
  event: { name: string; startsAt: string; endsAt: string };
  driver: { firstName: string; lastName: string };
  entries: Array<{ id: string; className: string; startNumber: string | null }>;
};

export const publicCodriverInvitationService = {
  async get(token: string) {
    const response = await requestJson<{ ok: true } & PublicCodriverInvitation>(`/public/codriver-invitations/${encodeURIComponent(token)}`, { auth: false });
    return response;
  },

  async complete(token: string, participant: CodriverParticipantInput) {
    return requestJson<{ ok: true; participantId: string; entryIds: string[]; waiverRequiredOnSite: true }>(`/public/codriver-invitations/${encodeURIComponent(token)}/complete`, {
      method: "POST",
      auth: false,
      body: { participant, privacyAccepted: true }
    });
  }
};
