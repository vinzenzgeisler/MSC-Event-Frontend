import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CreditCard, Download, Loader2, RefreshCw, TabletSmartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { adminEntriesService } from "@/services/admin-entries.service";
import {
  adminSigningService,
  type SigningDevice,
  type SigningPrecheckTimestamps,
  type SigningRequirements,
  type SigningSessionStatus
} from "@/services/admin-signing.service";
import { ApiError, getApiErrorMessage } from "@/services/api/http-client";

function formatCents(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return null;
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

const PREFERRED_SIGNING_DEVICE_KEY = "msc-preferred-signing-device-id";

const emptyPrechecks = (): SigningPrecheckTimestamps => ({
  identityCheckedAt: null,
  signerPresentAt: null,
  medicalCertificateCheckedAt: null,
  guardianPresentAt: null,
  guardianAuthorityCheckedAt: null
});

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("de-DE");
}

function isDeviceOnline(device: SigningDevice | null | undefined) {
  if (!device?.lastSeenAt) return false;
  const lastSeen = new Date(device.lastSeenAt).getTime();
  return Number.isFinite(lastSeen) && Date.now() - lastSeen < 30_000;
}

type WaiverSigningDialogProps = {
  entryId: string | null;
  entryName?: string;
  open: boolean;
  onClose: () => void;
  onCompleted: (entryId: string) => void | Promise<void>;
};

export function WaiverSigningDialog({ entryId, entryName = "Nennung", open, onClose, onCompleted }: WaiverSigningDialogProps) {
  const [requirements, setRequirements] = useState<SigningRequirements | null>(null);
  const [devices, setDevices] = useState<SigningDevice[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [signerPersonId, setSignerPersonId] = useState("");
  const [prechecks, setPrechecks] = useState<SigningPrecheckTimestamps>(emptyPrechecks);
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");
  const [session, setSession] = useState<SigningSessionStatus | null>(null);
  const [pairingCode, setPairingCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [payingRemaining, setPayingRemaining] = useState(false);
  const completedSessionRef = useRef<string | null>(null);

  const connectedDevices = useMemo(() => devices.filter((device) => device.status === "connected"), [devices]);
  const selectedDeviceId = deviceId || connectedDevices[0]?.id || "";
  const selectedDevice = connectedDevices.find((device) => device.id === selectedDeviceId) ?? null;
  const selectedDeviceOnline = isDeviceOnline(selectedDevice);
  const signerOptions = useMemo(() => {
    if (requirements?.signers?.length) return requirements.signers;
    if (!requirements) return [];
    return [{
      personId: "",
      role: "driver" as const,
      label: "Fahrer",
      name: requirements.driverName,
      isMinor: requirements.isMinor,
      requiresMedicalCertificate: requirements.requiresMedicalCertificate,
      signed: false,
      signedAt: null,
      documentId: null
    }];
  }, [requirements]);
  const selectedSigner = signerOptions.find((signer) => signer.personId === signerPersonId) ?? signerOptions[0] ?? null;
  const signingInProgress = session?.status === "pending" || session?.status === "displayed";
  const needsGuardian = selectedSigner?.isMinor === true;
  const needsMedicalCertificate = selectedSigner?.requiresMedicalCertificate === true;
  const prechecksComplete = Boolean(
    prechecks.identityCheckedAt
      && prechecks.signerPresentAt
      && (!needsMedicalCertificate || prechecks.medicalCertificateCheckedAt)
      && (!needsGuardian || (prechecks.guardianPresentAt && prechecks.guardianAuthorityCheckedAt && guardianName.trim() && guardianRelationship.trim()))
  );
  const allSigned = signerOptions.length > 0 && signerOptions.every((signer) => signer.signed);
  const paymentBlocksDriverSigning =
    selectedSigner?.role === "driver" && requirements?.payment.status !== "paid" && requirements?.payment.status !== "not_required";

  const loadDevices = useCallback(async () => {
    const nextDevices = await adminSigningService.listDevices();
    setDevices(nextDevices);
    const rememberedId = window.localStorage.getItem(PREFERRED_SIGNING_DEVICE_KEY);
    const preferred =
      nextDevices.find((item) => item.status === "connected" && item.id === rememberedId && isDeviceOnline(item))
      ?? nextDevices.find((item) => item.status === "connected" && isDeviceOnline(item))
      ?? nextDevices.find((item) => item.status === "connected" && item.id === rememberedId)
      ?? nextDevices.find((item) => item.status === "connected")
      ?? nextDevices[0];
    setDeviceId((current) => nextDevices.some((device) => device.id === current && device.status === "connected") ? current : preferred?.id ?? "");
  }, []);

  const loadRequirements = useCallback(async (targetEntryId: string) => {
    const nextRequirements = await adminSigningService.getRequirements(targetEntryId);
    setRequirements(nextRequirements);
    return nextRequirements;
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!entryId || refreshing) return;
    setRefreshing(true);
    setError("");
    try {
      await Promise.all([loadRequirements(entryId), loadDevices()]);
    } catch (refreshError) {
      setError(getApiErrorMessage(refreshError, "Status konnte nicht aktualisiert werden."));
    } finally {
      setRefreshing(false);
    }
  }, [entryId, loadDevices, loadRequirements, refreshing]);

  useEffect(() => {
    if (!open || !entryId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setRequirements(null);
    setSession(null);
    setPairingCode(null);
    setPrechecks(emptyPrechecks());
    setGuardianName("");
    setGuardianRelationship("");
    setConfirmingPayment(false);
    completedSessionRef.current = null;
    Promise.all([adminSigningService.getRequirements(entryId), loadDevices()])
      .then(([nextRequirements]) => {
        if (cancelled) return;
        setRequirements(nextRequirements);
        const preferred = nextRequirements.signers?.find((signer) => !signer.signed)
          ?? nextRequirements.signers?.find((signer) => signer.role === "driver")
          ?? nextRequirements.signers?.[0];
        setSignerPersonId(preferred?.personId ?? "");
      })
      .catch((loadError) => {
        if (!cancelled) setError(getApiErrorMessage(loadError, "Signing-Anforderungen konnten nicht geladen werden."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [entryId, loadDevices, open]);

  useEffect(() => {
    if (!open || !pairingCode || connectedDevices.length > 0) return;
    const interval = window.setInterval(() => void loadDevices().catch(() => undefined), 2000);
    return () => window.clearInterval(interval);
  }, [connectedDevices.length, loadDevices, open, pairingCode]);

  useEffect(() => {
    if (!open || !entryId || !session?.id || !signingInProgress) return;
    const sessionId = session.id;
    const poll = async () => {
      try {
        const nextSession = await adminSigningService.getSession(sessionId);
        setSession(nextSession);
        if (nextSession.status === "completed" && completedSessionRef.current !== nextSession.id) {
          completedSessionRef.current = nextSession.id;
          await loadRequirements(entryId);
          await onCompleted(entryId);
        }
      } catch {
        // A temporary connection issue must not discard the active session.
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 2500);
    return () => window.clearInterval(interval);
  }, [entryId, loadRequirements, onCompleted, open, session?.id, signingInProgress]);

  const togglePrecheck = (key: keyof SigningPrecheckTimestamps) => {
    setPrechecks((current) => ({ ...current, [key]: current[key] ? null : new Date().toISOString() }));
  };

  const selectSigner = (personId: string) => {
    if (signingInProgress) return;
    setSignerPersonId(personId);
    setPrechecks(emptyPrechecks());
    setGuardianName("");
    setGuardianRelationship("");
    setSession(null);
    setError("");
  };

  const createPairingCode = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await adminSigningService.createPairingCode();
      setPairingCode({ code: result.pairingCode, expiresAt: result.expiresAt });
      await loadDevices();
    } catch (pairingError) {
      setError(getApiErrorMessage(pairingError, "Pairing-Code konnte nicht erzeugt werden."));
    } finally {
      setBusy(false);
    }
  };

  const payRemainingBalance = async () => {
    if (!entryId || payingRemaining) return;
    if (!confirmingPayment) {
      setConfirmingPayment(true);
      return;
    }
    setConfirmingPayment(false);
    setPayingRemaining(true);
    setError("");
    try {
      await adminEntriesService.setEntryPaymentStatus(entryId, "paid", "Offenen Restbetrag im Haftverzicht-Dialog verbucht");
      await loadRequirements(entryId);
    } catch (paymentError) {
      setError(
        paymentError instanceof ApiError && paymentError.code === "PAYMENT_AMOUNT_UNKNOWN"
          ? "Nenngeldbetrag unbekannt. Bitte Zahlungsdaten in der Nennung prüfen, bevor eine Zahlung verbucht wird."
          : getApiErrorMessage(paymentError, "Zahlung konnte nicht verbucht werden.")
      );
    } finally {
      setPayingRemaining(false);
    }
  };

  const startSigning = async () => {
    if (!entryId || !selectedSigner || !selectedDeviceId || !selectedDeviceOnline || !prechecksComplete || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await adminSigningService.startSession({
        deviceSessionId: selectedDeviceId,
        entryId,
        signerPersonId: selectedSigner.personId || undefined,
        precheckTimestamps: prechecks,
        precheck: {
          identityChecked: Boolean(prechecks.identityCheckedAt),
          signerPresent: Boolean(prechecks.signerPresentAt),
          medicalCertificateChecked: Boolean(prechecks.medicalCertificateCheckedAt),
          guardianPresent: Boolean(prechecks.guardianPresentAt),
          guardianAuthorityChecked: Boolean(prechecks.guardianAuthorityCheckedAt)
        },
        signer: {
          type: needsGuardian ? "guardian" : selectedSigner.role,
          guardianName: needsGuardian ? guardianName.trim() || null : null,
          guardianRelationship: needsGuardian ? guardianRelationship.trim() || null : null
        }
      });
      window.localStorage.setItem(PREFERRED_SIGNING_DEVICE_KEY, selectedDeviceId);
      setSession(result.session);
    } catch (signingError) {
      const apiMessage = getApiErrorMessage(signingError, "Signing-Session konnte nicht gestartet werden.");
      setError(apiMessage.includes("SIGNING_SESSION_ALREADY_ACTIVE")
        ? "Für diese Nennung läuft bereits ein Unterschriftenvorgang bei einem anderen Operator oder Terminal."
        : apiMessage.includes("SIGNING_DEVICE_BUSY")
          ? "Dieses Terminal wird bereits für einen anderen Unterschriftenvorgang verwendet."
          : apiMessage.includes("SIGNING_PAYMENT_REQUIRED")
            ? "Nenngeld offen. Zahlung muss vor dem Fahrer-Haftverzicht verbucht werden."
            : apiMessage);
      if (entryId) await loadRequirements(entryId);
    } finally {
      setBusy(false);
    }
  };

  const cancelSession = async () => {
    if (!session || busy) return;
    setBusy(true);
    try {
      setSession(await adminSigningService.cancelSession(session.id));
    } catch (cancelError) {
      setError(getApiErrorMessage(cancelError, "Unterschriftenvorgang konnte nicht abgebrochen werden."));
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    if (signingInProgress && session && !busy) await cancelSession();
    onClose();
  };

  const downloadDocument = async (documentId = session?.documentId) => {
    if (!documentId) return;
    try {
      const url = await adminEntriesService.getDocumentDownloadUrl(documentId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (downloadError) {
      setError(getApiErrorMessage(downloadError, "Dokument konnte nicht geladen werden."));
    }
  };

  if (!open || !entryId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" role="dialog" aria-modal="true" aria-labelledby="waiver-signing-title">
      <div className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-xl border bg-white p-4 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="waiver-signing-title" className="text-xl font-semibold text-slate-900">Haftverzicht unterschreiben</h2>
            <p className="mt-1 truncate text-sm text-slate-500">{requirements?.driverName ?? entryName}</p>
          </div>
          <Button type="button" size="sm" variant="outline" className="h-10 w-10 shrink-0 p-0" disabled={busy} aria-label="Dialog schließen" onClick={() => void close()}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {error ? <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}

        {loading ? (
          <div className="mt-5 flex items-center gap-2 rounded-md border bg-slate-50 p-4 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />Signing-Daten werden geladen…
          </div>
        ) : requirements ? (
          <div className="mt-5 space-y-4">
            {requirements.payment.status === "due" || requirements.payment.status === "unknown" ? (
              <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
                <div className="font-semibold">Zahlung vor Terminalstart prüfen</div>
                <div className="mt-1">
                  {requirements.payment.status === "due"
                    ? `Diese Nennung ist noch nicht vollständig bezahlt${requirements.payment.amountOpenCents !== null ? ` (offen: ${formatCents(requirements.payment.amountOpenCents)})` : ""}.`
                    : "Für diese Nennung liegt kein bestätigter Zahlungsstatus vor. Bitte Zahlungsdaten in der Nennung prüfen."}
                </div>
                {requirements.payment.status === "due" && requirements.payment.amountOpenCents !== null && requirements.payment.amountOpenCents > 0 ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {confirmingPayment ? (
                      <>
                        <span className="text-sm font-semibold">{formatCents(requirements.payment.amountOpenCents)} wirklich als bezahlt verbuchen?</span>
                        <Button type="button" size="sm" disabled={payingRemaining} onClick={() => void payRemainingBalance()}>
                          {payingRemaining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Ja, verbuchen
                        </Button>
                        <Button type="button" size="sm" variant="outline" disabled={payingRemaining} onClick={() => setConfirmingPayment(false)}>Abbrechen</Button>
                      </>
                    ) : (
                      <Button type="button" size="sm" variant="outline" className="border-amber-400 bg-white" onClick={() => void payRemainingBalance()}>
                        <CreditCard className="mr-2 h-4 w-4" />Offenen Betrag als bezahlt verbuchen
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
            {requirements.activeSession && !signingInProgress ? (
              <div className="rounded-lg border-2 border-sky-300 bg-sky-50 p-3 text-sm text-sky-950" role="status">
                <div className="font-semibold">Für diese Nennung läuft bereits ein Unterschriftenvorgang</div>
                <div className="mt-1">{requirements.activeSession.deviceName ?? "Signaturterminal"}{requirements.activeSession.operatorDisplay ? ` · ${requirements.activeSession.operatorDisplay}` : ""}</div>
              </div>
            ) : null}
            {signerOptions.length > 1 ? (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Wer unterschreibt?</div>
                <div className="grid grid-cols-2 gap-2">
                  {signerOptions.map((signer) => {
                    const active = selectedSigner?.personId === signer.personId;
                    return (
                      <button
                        key={signer.personId}
                        type="button"
                        disabled={signingInProgress}
                        aria-pressed={active}
                        onClick={() => selectSigner(signer.personId)}
                        className={cn(
                          "min-h-14 rounded-lg border-2 px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                          active ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:border-slate-300"
                        )}
                      >
                        <span className="block text-sm font-semibold text-slate-900">{signer.label}</span>
                        <span className={cn("block truncate text-xs", signer.signed ? "text-emerald-700" : "text-amber-700")}>
                          {signer.signed ? "Unterschrieben" : "Offen"} · {signer.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border bg-slate-50 p-3 text-sm">
                <span className="font-semibold">Fahrer:</span> {selectedSigner?.name ?? requirements.driverName}
              </div>
            )}

            <div className="rounded-lg border bg-slate-50 p-3 text-xs text-slate-700">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span><strong className="text-slate-900">Teilnehmer:</strong> {selectedSigner?.name ?? requirements.driverName}</span>
                <span className="text-slate-500">{requirements.entryCount} Nennung{requirements.entryCount === 1 ? "" : "en"} · {requirements.vehicleCount} Fahrzeug{requirements.vehicleCount === 1 ? "" : "e"}</span>
              </div>
              <div className="grid gap-1.5">
                {(requirements.entries ?? []).map((entry) => (
                  <div key={entry.id} className="rounded border bg-white px-2.5 py-2">
                    <span className="font-semibold text-slate-900">{entry.className} · Startnummer {entry.startNumber ?? "-"}</span>
                    <span className="text-slate-500"> · Beifahrer: {entry.codriver?.displayName ?? "-"}</span>
                    <span> · {(entry.vehicles ?? []).map((vehicle) => `${vehicle.role === "backup" ? "Ersatz" : "Fahrzeug"}: ${vehicle.make} ${vehicle.model}`).join(" · ") || "Kein Fahrzeug"}</span>
                  </div>
                ))}
              </div>
            </div>

            {session?.status === "completed" ? (
              <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-5 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                <h3 className="mt-3 text-lg font-bold text-emerald-900">Erfolgreich unterzeichnet</h3>
                <p className="mt-1 text-sm text-emerald-700">{selectedSigner?.name}{session.signedAt ? ` · ${formatTimestamp(session.signedAt)}` : ""}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {session.documentId ? <Button type="button" variant="outline" onClick={() => void downloadDocument()}><Download className="mr-2 h-4 w-4" />Dokument</Button> : null}
                  {!allSigned ? (
                    <Button type="button" onClick={() => {
                      const nextSigner = signerOptions.find((signer) => !signer.signed);
                      if (nextSigner) selectSigner(nextSigner.personId);
                    }}>Nächste Unterschrift</Button>
                  ) : <Button type="button" onClick={onClose}>Fertig & schließen</Button>}
                </div>
              </div>
            ) : signingInProgress ? (
              <div className="rounded-xl border-2 border-sky-200 bg-sky-50 p-6 text-center text-sky-900">
                <TabletSmartphone className="mx-auto h-11 w-11 animate-pulse" />
                <h3 className="mt-3 text-lg font-bold">Bitte am Terminal unterschreiben</h3>
                <p className="mt-1 text-sm">{selectedDevice?.deviceName ?? "Signaturterminal"} · {selectedSigner?.name}</p>
                <Button type="button" variant="outline" className="mt-4" disabled={busy} onClick={() => void cancelSession()}>Session abbrechen</Button>
              </div>
            ) : selectedSigner?.signed ? (
              <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-5 text-center">
                <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
                <h3 className="mt-2 font-bold text-emerald-900">Aktueller Haftverzicht bereits unterschrieben</h3>
                <p className="mt-1 text-sm text-emerald-700">{selectedSigner.name}{selectedSigner.signedAt ? ` · ${formatTimestamp(selectedSigner.signedAt)}` : ""}</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {selectedSigner.documentId ? <Button type="button" variant="outline" onClick={() => void downloadDocument(selectedSigner.documentId)}><Download className="mr-2 h-4 w-4" />Dokument</Button> : null}
                  <Button type="button" onClick={onClose}>Schließen</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-lg border bg-white p-3">
                  <div className="text-sm font-semibold text-slate-900">Vorprüfung für {selectedSigner?.label}</div>
                  <div className="mt-3 grid gap-2">
                    {([
                      ["identityCheckedAt", "Identität/Ausweis geprüft"],
                      ["signerPresentAt", selectedSigner?.role === "codriver" ? "Beifahrer ist persönlich anwesend" : "Fahrer ist persönlich anwesend"],
                      ...(needsMedicalCertificate ? [["medicalCertificateCheckedAt", "Ärztliches Attest geprüft"]] : []),
                      ...(needsGuardian ? [["guardianPresentAt", "Erziehungsberechtigte Person ist anwesend"], ["guardianAuthorityCheckedAt", "Alleinvertretungsberechtigung geprüft"]] : [])
                    ] as Array<[keyof SigningPrecheckTimestamps, string]>).map(([key, label]) => {
                      const checked = Boolean(prechecks[key]);
                      return (
                        <button key={key} type="button" onClick={() => togglePrecheck(key)} className={cn("flex min-h-12 items-center justify-between rounded-lg border-2 px-3 text-left", checked ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white")}>
                          <span className="text-sm font-medium">{label}</span>
                          <CheckCircle2 className={cn("h-5 w-5", checked ? "text-emerald-600" : "text-slate-300")} />
                        </button>
                      );
                    })}
                  </div>
                  {needsGuardian ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <input className="h-11 rounded-md border px-3 text-sm" value={guardianName} onChange={(event) => setGuardianName(event.target.value)} placeholder="Name Erziehungsberechtigte/r" />
                      <input className="h-11 rounded-md border px-3 text-sm" value={guardianRelationship} onChange={(event) => setGuardianRelationship(event.target.value)} placeholder="Beziehung zur Person" />
                    </div>
                  ) : null}
                </div>

                {connectedDevices.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <Select value={selectedDeviceId || "__none__"} onValueChange={(value) => setDeviceId(value === "__none__" ? "" : value)}>
                          <SelectTrigger className="h-12"><SelectValue placeholder="Signaturgerät auswählen" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Signaturgerät auswählen</SelectItem>
                            {connectedDevices.map((device) => <SelectItem key={device.id} value={device.id}>{device.deviceName ?? "Signaturterminal"}{isDeviceOnline(device) ? "" : " (nicht aktiv)"}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="button" size="sm" variant="outline" className="h-12 w-12 shrink-0 p-0" disabled={busy || refreshing} title="Geräte- und Sessionstatus aktualisieren" aria-label="Geräte- und Sessionstatus aktualisieren" onClick={() => void refreshStatus()}>
                        <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                      </Button>
                    </div>
                    <Button type="button" className="h-14 w-full text-base" disabled={busy || Boolean(requirements.activeSession) || !selectedDeviceOnline || !selectedSigner || !prechecksComplete || paymentBlocksDriverSigning} onClick={() => void startSigning()}>
                      {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <TabletSmartphone className="mr-2 h-5 w-5" />}Haftverzicht am Gerät starten
                    </Button>
                    {paymentBlocksDriverSigning ? <p className="text-sm text-amber-700">Nenngeld muss zuerst verbucht werden, bevor der Fahrer-Haftverzicht gestartet werden kann.</p> : null}
                    {!selectedDeviceOnline ? <p className="text-sm text-amber-700">Das ausgewählte Terminal ist nicht aktiv. Terminal öffnen und Geräte aktualisieren.</p> : null}
                  </div>
                ) : (
                  <div className="rounded-lg border bg-slate-50 p-4">
                    {pairingCode ? (
                      <div className="mb-4 rounded-md border border-sky-200 bg-sky-50 p-4 text-sky-900">
                        <div className="text-sm font-semibold">Pairing-Code</div>
                        <div className="mt-2 font-mono text-4xl font-bold tracking-widest">{pairingCode.code}</div>
                        <div className="mt-2 text-xs">Gültig bis {new Date(pairingCode.expiresAt).toLocaleTimeString("de-DE")}</div>
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <Button type="button" className="flex-1" disabled={busy} onClick={() => void createPairingCode()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TabletSmartphone className="mr-2 h-4 w-4" />}Gerät koppeln</Button>
                      <Button type="button" variant="outline" className="h-10 w-10 shrink-0 p-0" disabled={busy || refreshing} title="Geräte- und Sessionstatus aktualisieren" aria-label="Geräte- und Sessionstatus aktualisieren" onClick={() => void refreshStatus()}>
                        <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
