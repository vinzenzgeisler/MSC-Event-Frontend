import { getAuthToken } from "@/app/auth/auth-store";
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

export type SigningSessionListItem = {
  id: string;
  status: "pending" | "displayed" | "completed" | "cancelled" | "failed";
  eventId: string;
  eventName: string | null;
  sourceEntryId: string | null;
  deviceName: string | null;
  operatorDisplay: string | null;
  signerName: string | null;
  signerRole: "driver" | "codriver" | null;
  signedAt: string | null;
  createdAt: string;
  documentId: string | null;
  errorLast: string | null;
};

export type SigningSessionsListResponse = {
  sessions: SigningSessionListItem[];
  total: number;
};

export const adminSigningService = {
  async createPairingCode() {
    return requestJson<{
      ok: true;
      pairingCode: string;
      expiresAt: string;
      deviceSession: SigningDevice;
    }>("/admin/terminal/devices/pairing-code", {
      method: "POST"
    });
  },

  async listDevices() {
    const response = await requestJson<{ ok: true; devices: SigningDevice[] }>("/admin/terminal/devices");
    return response.devices;
  },

  async revokeDevice(deviceSessionId: string) {
    return requestJson<{ ok: true; device: SigningDevice }>(`/admin/terminal/devices/${deviceSessionId}`, {
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
    return requestJson<{ ok: true; session: SigningSessionStatus }>("/admin/terminal/sessions", {
      method: "POST",
      includeAdminEmailHeader: true,
      body: { ...input, workflowType: "waiver_signature" }
    });
  },

  async getSession(sessionId: string) {
    const response = await requestJson<{ ok: true; session: SigningSessionStatus }>(`/admin/terminal/sessions/${sessionId}`);
    return response.session;
  },

  async cancelSession(sessionId: string) {
    const response = await requestJson<{ ok: true; session: SigningSessionStatus }>(`/admin/terminal/sessions/${sessionId}/cancel`, {
      method: "POST"
    });
    return response.session;
  },

  async resendSignedWaiverMail(documentId: string) {
    return requestJson<{ ok: true; outboxId: string; recipient: string }>(
      `/admin/documents/${documentId}/resend-waiver-mail`,
      { method: "POST" }
    );
  },

  // Alias used in settings page
  async generatePairingCode() {
    return adminSigningService.createPairingCode();
  },

  async listSessions(opts?: { limit?: number; offset?: number; status?: string }): Promise<SigningSessionsListResponse> {
    const params = new URLSearchParams();
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.offset) params.set("offset", String(opts.offset));
    if (opts?.status) params.set("status", opts.status);
    const qs = params.toString();
    return requestJson<SigningSessionsListResponse>(`/admin/signing/sessions${qs ? `?${qs}` : ""}`);
  },

  async downloadSignedWaiver(entryId: string): Promise<Blob> {
    const token = getAuthToken();
    const runtimeConfig = (window as Window & { __MSC_RUNTIME_CONFIG__?: Record<string, string | boolean | null | undefined> }).__MSC_RUNTIME_CONFIG__;
    const baseUrl = String(runtimeConfig?.apiBaseUrl ?? runtimeConfig?.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
    const url = `${baseUrl}/admin/signing/entries/${entryId}/signed-waiver`;
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }
    return response.blob();
  }
};
