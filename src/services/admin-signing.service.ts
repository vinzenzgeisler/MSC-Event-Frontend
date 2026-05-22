import { requestJson } from "@/services/api/http-client";

export type SigningDevice = {
  id: string;
  deviceName: string | null;
  status: "pairing" | "connected" | "revoked" | "expired";
  pairedAt: string | null;
  lastSeenAt: string | null;
  expiresAt: string;
};

export type SigningPrecheckInput = {
  identityChecked: boolean;
  signerPresent: boolean;
  medicalCertificateChecked: boolean;
  guardianPresent: boolean;
  guardianAuthorityChecked: boolean;
};

export type SigningSignerInput = {
  type: "driver" | "guardian";
  guardianName: string | null;
  guardianRelationship: string | null;
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

  async startSession(input: {
    deviceSessionId: string;
    entryId: string;
    precheck: SigningPrecheckInput;
    signer: SigningSignerInput;
  }) {
    return requestJson<{ ok: true; session: { id: string; status: string } }>("/admin/signing/sessions", {
      method: "POST",
      body: input
    });
  }
};
