import { requestJson } from "@/services/api/http-client";

export type SigningDevice = {
  id: string;
  deviceName: string | null;
  status: "pairing" | "connected" | "revoked" | "expired";
  pairedAt: string | null;
  lastSeenAt: string | null;
  expiresAt: string;
};

export type SigningRequirements = {
  entryId: string;
  caseId: string;
  driverName: string;
  isMinor: boolean;
  requiresMedicalCertificate: boolean;
  signerType: "driver" | "guardian";
  entryCount: number;
  vehicleCount: number;
  contract: {
    locale: string;
    version: string;
    textHash: string;
  };
  signers?: Array<{
    personId: string;
    role: "driver" | "codriver";
    label: string;
    name: string;
    isMinor: boolean;
    requiresMedicalCertificate: boolean;
    signed: boolean;
    signedAt: string | null;
    documentId: string | null;
  }>;
  entries?: Array<{
    id: string;
    className: string;
    orgaCode: string | null;
    startNumber: string | null;
    codriver: {
      firstName: string;
      lastName: string;
    } | null;
    vehicles: Array<{
      id: string;
      make: string;
      model: string;
      year: number | null;
      startNumber: string | null;
      role: "primary" | "backup";
    }>;
  }>;
};

export type SigningPrecheckTimestamps = {
  identityCheckedAt: string | null;
  signerPresentAt: string | null;
  medicalCertificateCheckedAt: string | null;
  guardianPresentAt: string | null;
  guardianAuthorityCheckedAt: string | null;
};

export type SigningSessionStatus = {
  id: string;
  status: "pending" | "displayed" | "completed" | "cancelled" | "failed";
  deviceSessionId: string;
  sourceEntryId: string | null;
  displayedAt: string | null;
  signedAt: string | null;
  documentId: string | null;
  evidenceAuditS3Key: string | null;
  expiresAt: string;
};

export const adminSigningService = {
  async createPairingCode() {
    return requestJson<{
      ok: true;
      pairingCode: string;
      expiresAt: string;
      deviceSession: SigningDevice;
    }>("/admin/signing/devices/pairing-code", {
      method: "POST"
    });
  },

  async listDevices() {
    const response = await requestJson<{ ok: true; devices: SigningDevice[] }>("/admin/signing/devices");
    return response.devices;
  },

  async revokeDevice(deviceSessionId: string) {
    return requestJson<{ ok: true; device: SigningDevice }>(`/admin/signing/devices/${deviceSessionId}`, {
      method: "DELETE"
    });
  },

  async getRequirements(entryId: string) {
    const response = await requestJson<{ ok: true; requirements: SigningRequirements }>(
      `/admin/signing/entries/${entryId}/requirements`
    );
    return response.requirements;
  },

  async startSession(input: {
    deviceSessionId: string;
    entryId: string;
    signerPersonId?: string;
    precheck?: {
      identityChecked: boolean;
      signerPresent: boolean;
      medicalCertificateChecked: boolean;
      guardianPresent: boolean;
      guardianAuthorityChecked: boolean;
    };
    precheckTimestamps?: SigningPrecheckTimestamps;
    signer?: {
      type: "driver" | "codriver" | "guardian";
      guardianName: string | null;
      guardianRelationship: string | null;
    };
  }) {
    return requestJson<{ ok: true; session: SigningSessionStatus }>("/admin/signing/sessions", {
      method: "POST",
      includeAdminEmailHeader: true,
      body: input
    });
  },

  async getSession(sessionId: string) {
    const response = await requestJson<{ ok: true; session: SigningSessionStatus }>(`/admin/signing/sessions/${sessionId}`);
    return response.session;
  },

  async cancelSession(sessionId: string) {
    const response = await requestJson<{ ok: true; session: SigningSessionStatus }>(`/admin/signing/sessions/${sessionId}/cancel`, {
      method: "POST"
    });
    return response.session;
  }
};
