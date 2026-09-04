import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Bike, Car, CheckCircle2, Clock3, Copy, Download, Link2, Loader2, Mail, TabletSmartphone, Trash2, Wallet } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  acceptanceStatusClasses,
  acceptanceStatusLabel,
  checkinClasses,
  checkinLabel,
  outboxStatusClasses,
  outboxStatusLabel,
  paymentStatusClasses,
  paymentStatusLabel,
  techStatusClasses,
  techStatusLabel,
  waiverSignedClasses,
  waiverSignedLabel
} from "@/lib/admin-status";
import { adminEntriesService } from "@/services/admin-entries.service";
import { adminSigningService, type SigningDevice, type SigningPrecheckTimestamps, type SigningRequirements, type SigningSessionStatus } from "@/services/admin-signing.service";
import { adminTerminalService, type ParticipantTerminalSession, type ParticipantWorkflowType } from "@/services/admin-terminal.service";
import { adminCodriverInvitationsService, type CodriverInvitation } from "@/services/admin-codriver-invitations.service";
import { adminMetaService, type AdminClassOption } from "@/services/admin-meta.service";
import { ApiError, getApiErrorMessage } from "@/services/api/http-client";
import { communicationService } from "@/services/communication.service";

function centsFromEuroInput(value: string): number {
  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.round(parsed * 100);
}

function euroInputFromCents(value: number): string {
  return (value / 100).toFixed(2).replace(".", ",");
}

function euroDisplayFromCents(value: number): string {
  return `${euroInputFromCents(value)} EUR`;
}

const PREFERRED_SIGNING_DEVICE_KEY = "msc-preferred-signing-device-id";

function isSigningDeviceOnline(device: SigningDevice | undefined | null): boolean {
  if (!device?.lastSeenAt) {
    return false;
  }
  const lastSeenMs = new Date(device.lastSeenAt).getTime();
  return Number.isFinite(lastSeenMs) && Date.now() - lastSeenMs < 30_000;
}

const emptySigningPrechecks = (): SigningPrecheckTimestamps => ({
  identityCheckedAt: null,
  signerPresentAt: null,
  medicalCertificateCheckedAt: null,
  guardianPresentAt: null,
  guardianAuthorityCheckedAt: null
});

function formatTimestamp(value: string) {
  const raw = (value ?? "").trim();
  if (!raw) {
    return "-";
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return parsed.toLocaleString("de-DE");
}

function VehiclePreview({ src, label, onOpen }: { src: string | null; label: string; onOpen: () => void }) {
  if (src) {
    return (
      <button type="button" className="group relative block w-full" onClick={onOpen}>
        <img className="h-56 w-full rounded-md border object-cover md:h-[22rem]" src={src} alt={`Fahrzeug: ${label}`} />
        <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
          Vergrößern
        </span>
      </button>
    );
  }
  const isMoto = label.toLowerCase().includes("yamaha") || label.toLowerCase().includes("moto");
  return (
    <div
      className="flex h-56 w-full flex-col items-center justify-center gap-2 rounded-md border bg-slate-100 text-slate-500 md:h-[22rem]"
      title="Bild nicht verfügbar (Backend liefert keine URL)"
    >
      {isMoto ? <Bike className="h-10 w-10" /> : <Car className="h-10 w-10" />}
      <div className="text-xs text-slate-600">Bild nicht verfügbar</div>
    </div>
  );
}

function HintButton(props: {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  variant?: "default" | "outline" | "ghost" | "destructive";
  className?: string;
  disabledReason?: string;
}) {
  const disabled = Boolean(props.disabledReason);
  const button = (
    <Button
      type="button"
      variant={props.variant ?? "outline"}
      className={cn("h-auto w-full justify-start whitespace-normal break-words py-2 text-left leading-tight", props.className)}
      disabled={disabled}
      onClick={props.onClick}
    >
      {props.icon}
      {props.label}
    </Button>
  );
  if (!props.disabledReason) {
    return button;
  }
  return (
    <span className="inline-flex w-full" title={props.disabledReason}>
      <span className="w-full">{button}</span>
    </span>
  );
}

function MailNoteSwitch(props: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  title: string;
  description: string;
}) {
  const effectiveChecked = props.disabled ? false : props.checked;

  return (
    <div className="rounded-md border bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-900">{props.title}</div>
          <div className="text-xs text-slate-500">{props.description}</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={effectiveChecked}
          disabled={props.disabled}
          onClick={() => {
            if (props.disabled) {
              return;
            }
            props.onChange(!effectiveChecked);
          }}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full border transition",
            effectiveChecked ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-slate-200",
            props.disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
              effectiveChecked ? "translate-x-5" : "translate-x-0.5"
            )}
          />
        </button>
      </div>
    </div>
  );
}

export function AdminEntryDetailPage() {
  const HISTORY_PREVIEW_LIMIT = 5;
  const { roles } = useAuth();
  const canSetStatus = hasPermission(roles, "entries.status.write");
  const canCheckin = hasPermission(roles, "entries.checkin.write");
  const canPaymentWrite = hasPermission(roles, "entries.payment.write");
  const canNotesWrite = hasPermission(roles, "entries.notes.write");
  const canDeleteEntry = hasPermission(roles, "entries.delete");
  const canReadMail = hasPermission(roles, "communication.read");
  const canSendMail = hasPermission(roles, "communication.write");
  const canChangeClass = hasPermission(roles, "entries.status.write");
  const canManageParticipants = hasPermission(roles, "entries.participants.write");
  const canPrintStampCards = hasPermission(roles, "stamp_cards.print");
  const { entryId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof adminEntriesService.getEntryDetail>>>(null);
  const [mailHistory, setMailHistory] = useState<Awaited<ReturnType<typeof adminEntriesService.listEntryMailHistory>>>([]);
  const [mailHistoryLoading, setMailHistoryLoading] = useState(false);
  const [mailHistoryError, setMailHistoryError] = useState("");
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [status, setStatus] = useState<"pending" | "shortlist" | "accepted" | "rejected" | "withdrawn">("accepted");
  const [checkinDone, setCheckinDone] = useState(false);
  const [confirmationMailSent, setConfirmationMailSent] = useState(false);
  const [confirmationMailVerified, setConfirmationMailVerified] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [previewImage, setPreviewImage] = useState<{ url: string; label: string } | null>(null);
  const [internalNote, setInternalNote] = useState("");
  const [driverNote, setDriverNote] = useState("");
  const [inspectionNote, setInspectionNote] = useState("");
  const [includeDriverNoteOnAccept, setIncludeDriverNoteOnAccept] = useState(true);
  const [includeDriverNoteOnReject, setIncludeDriverNoteOnReject] = useState(true);
  const [pendingAcceptConfirm, setPendingAcceptConfirm] = useState(false);
  const [pendingRejectConfirm, setPendingRejectConfirm] = useState(false);
  const [pendingWithdrawConfirm, setPendingWithdrawConfirm] = useState(false);
  const [withdrawalReasonDraft, setWithdrawalReasonDraft] = useState("");
  const [pendingCheckinConfirm, setPendingCheckinConfirm] = useState(false);
  const [pendingPaymentConfirm, setPendingPaymentConfirm] = useState(false);
  const [pendingDeleteConfirm, setPendingDeleteConfirm] = useState(false);
  const [deleteReasonDraft, setDeleteReasonDraft] = useState("");
  const [sendingVerificationMail, setSendingVerificationMail] = useState(false);
  const [sendingPaymentReminder, setSendingPaymentReminder] = useState(false);
  const [paymentEditorOpen, setPaymentEditorOpen] = useState(false);
  const [paymentTotalInput, setPaymentTotalInput] = useState("0,00");
  const [paymentPaidInput, setPaymentPaidInput] = useState("0,00");
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);
  const [classOptions, setClassOptions] = useState<AdminClassOption[]>([]);
  const [classDraft, setClassDraft] = useState("");
  const [backupClassDraft, setBackupClassDraft] = useState("");
  const [classChangeIncludeBackup, setClassChangeIncludeBackup] = useState(true);
  const [signingDevices, setSigningDevices] = useState<SigningDevice[]>([]);
  const [signingDeviceId, setSigningDeviceId] = useState("");
  const [signingSignerPersonId, setSigningSignerPersonId] = useState("");
  const [signingDialogOpen, setSigningDialogOpen] = useState(false);
  const [signingRequirements, setSigningRequirements] = useState<SigningRequirements | null>(null);
  const [pairingCode, setPairingCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [activeSigningSession, setActiveSigningSession] = useState<SigningSessionStatus | null>(null);
  const [signingPrechecks, setSigningPrechecks] = useState<SigningPrecheckTimestamps>(emptySigningPrechecks);
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");
  const [signingBusy, setSigningBusy] = useState(false);
  const [signingLoading, setSigningLoading] = useState(false);
  const [participantDialogOpen, setParticipantDialogOpen] = useState(false);
  const [participantWorkflow, setParticipantWorkflow] = useState<ParticipantWorkflowType>("regular_codriver_registration");
  const [participantEntryIds, setParticipantEntryIds] = useState<string[]>([]);
  const [participantSession, setParticipantSession] = useState<ParticipantTerminalSession | null>(null);
  const [participantBusy, setParticipantBusy] = useState(false);
  const [participantChecks, setParticipantChecks] = useState({ identity: false, present: false, medical: false, guardianPresent: false, guardianAuthority: false });
  const [codriverLinkDialogOpen, setCodriverLinkDialogOpen] = useState(false);
  const [codriverLinkEntryIds, setCodriverLinkEntryIds] = useState<string[]>([]);
  const [codriverLinkRecipientName, setCodriverLinkRecipientName] = useState("");
  const [codriverLinkRecipientEmail, setCodriverLinkRecipientEmail] = useState("");
  const [codriverLinkExpiresAt, setCodriverLinkExpiresAt] = useState("");
  const [codriverLinkUrl, setCodriverLinkUrl] = useState("");
  const [codriverInvitations, setCodriverInvitations] = useState<CodriverInvitation[]>([]);
  const [codriverLinkBusy, setCodriverLinkBusy] = useState(false);
  const [stampCardStartSlot, setStampCardStartSlot] = useState(1);
  const [pendingCharityRevoke, setPendingCharityRevoke] = useState<{ registrationId: string; name: string } | null>(null);
  const [charityRevocationReason, setCharityRevocationReason] = useState("");
  const signingInProgress = activeSigningSession?.status === "pending" || activeSigningSession?.status === "displayed";

  const flashMessage = (message: string, timeout = 2200) => {
    setActionMessage(message);
    setTimeout(() => setActionMessage(""), timeout);
  };

  const runAction = async (
    actionKey: string,
    operation: () => Promise<unknown>,
    successMessage: string,
    errorMessage: string,
    options?: { reload?: boolean }
  ) => {
    if (actionInFlight) {
      return false;
    }
    setActionInFlight(actionKey);
    try {
      await operation();
      flashMessage(successMessage);
      if (options?.reload !== false) {
        loadDetail();
      }
      return true;
    } catch (error) {
      flashMessage(getApiErrorMessage(error, errorMessage), 2800);
      return false;
    } finally {
      setActionInFlight((current) => (current === actionKey ? null : current));
    }
  };

  const getLocalizedActionError = (error: unknown, fallback: string) => {
    if (error instanceof ApiError) {
      const code = (error.code ?? "").toLowerCase();
      const reason = typeof error.details?.reason === "string" ? error.details.reason.trim() : "";
      const haystack = `${(error.code ?? "").toLowerCase()} ${(error.message ?? "").toLowerCase()}`;
      if (code === "no_recipient") {
        return "Für diese Nennung ist keine Empfänger-E-Mail vorhanden.";
      }
      if (code === "not_allowed") {
        return "Für diese Nennung ist diese Mail-Aktion aktuell nicht zulässig.";
      }
      if (code === "template_render_failed") {
        return `Mail-Template konnte nicht gerendert werden.${reason ? ` Grund: ${reason}` : ""}`;
      }
      if (code === "template_not_found") {
        return "Mail-Template wurde im Backend nicht gefunden.";
      }
      if (code === "entry_not_found") {
        return "Nennung wurde im Backend nicht gefunden.";
      }
      if (code === "outbox_insert_failed") {
        return `Mail konnte nicht in die Outbox geschrieben werden.${reason ? ` Grund: ${reason}` : ""}`;
      }
      if (code === "pre_acceptance_payment_not_allowed") {
        return "Ein Zahlungseingang kann erst nach der Zulassung erfasst werden.";
      }
      if (code.includes("duplicate")) {
        return "Doppelte Anfrage: Eine identische Mail-Aktion wurde bereits ausgelöst. Bitte Outbox prüfen.";
      }
      if (haystack.includes("class does not match vehicle type") || haystack.includes("vehicle type")) {
        return "Die gewählte Klasse passt nicht zum Fahrzeugtyp. Prüfe die Zielklasse und optional das Ersatzfahrzeug.";
      }
      if (code === "internal_error") {
        return "Mail konnte aktuell nicht eingeplant werden. Bitte erneut versuchen.";
      }
    }
    return getApiErrorMessage(error, fallback);
  };

  const loadMailHistory = useCallback(() => {
    if (!entryId || !canReadMail) {
      setMailHistory([]);
      setMailHistoryError("");
      setMailHistoryLoading(false);
      return;
    }
    setMailHistoryLoading(true);
    setMailHistoryError("");
    adminEntriesService
      .listEntryMailHistory(entryId)
      .then(setMailHistory)
      .catch((error) => {
        setMailHistory([]);
        setMailHistoryError(getApiErrorMessage(error, "Mails konnten nicht geladen werden."));
      })
      .finally(() => setMailHistoryLoading(false));
  }, [canReadMail, entryId]);

  const loadDetail = () => {
    adminEntriesService
      .getEntryDetail(entryId)
      .then((result) => {
        setDetail(result);
        setHasLoadedOnce(true);
        if (result) {
          setStatus(result.status);
          setCheckinDone(result.checkinVerified);
          setConfirmationMailSent(result.confirmationMailSent);
          setConfirmationMailVerified(result.confirmationMailVerified);
          setInternalNote(result.internalNote);
          setDriverNote(result.driverNote);
          setInspectionNote(result.inspectionNote);
          setHistoryExpanded(false);
          setClassDraft(result.classId);
          setBackupClassDraft(result.backupClassId ?? result.classId);
          setClassChangeIncludeBackup(Boolean(result.backupVehicle.assigned));
          loadMailHistory();
        } else {
          setMailHistory([]);
        }
      })
      .catch((error) => {
        flashMessage(getApiErrorMessage(error, "Nennung konnte nicht geladen werden."), 3000);
        setDetail(null);
        setMailHistory([]);
        setHasLoadedOnce(true);
      });
  };

  const handleDocumentDownload = async (type: "waiver" | "signed_waiver" | "tech_check", label: string, actionKey: string) => {
    if (actionInFlight) {
      return;
    }
    setActionInFlight(actionKey);
    try {
      const url = await adminEntriesService.getEntryDocumentDownloadUrl(entryId, type);
      if (!url) {
        flashMessage(`${label} nicht verfügbar.`, 2600);
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      flashMessage(getApiErrorMessage(error, `${label} konnte nicht geladen werden.`), 2800);
    } finally {
      setActionInFlight((current) => (current === actionKey ? null : current));
    }
  };

  const handleInspectionQrDownload = async () => {
    if (actionInFlight) return;
    setActionInFlight("inspection-qr");
    try {
      const download = await adminEntriesService.getInspectionQr(entryId, "svg");
      const bytes = Uint8Array.from(atob(download.dataBase64), (character) => character.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: download.mimeType }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = download.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      flashMessage("Abnahme-QR-Code heruntergeladen.");
    } catch (error) {
      flashMessage(getApiErrorMessage(error, "QR-Code konnte nicht erzeugt werden."), 2800);
    } finally {
      setActionInFlight((current) => (current === "inspection-qr" ? null : current));
    }
  };

  const handleDocumentDownloadById = async (documentId: string, label: string, actionKey: string) => {
    if (actionInFlight) {
      return;
    }
    setActionInFlight(actionKey);
    try {
      const url = await adminEntriesService.getDocumentDownloadUrl(documentId);
      if (!url) {
        flashMessage(`${label} nicht verfügbar.`, 2600);
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      flashMessage(getApiErrorMessage(error, `${label} konnte nicht geladen werden.`), 2800);
    } finally {
      setActionInFlight((current) => (current === actionKey ? null : current));
    }
  };

  const loadSigningDevices = useCallback(async () => {
    try {
      const devices = await adminSigningService.listDevices();
      setSigningDevices(devices);
      const rememberedId = window.localStorage.getItem(PREFERRED_SIGNING_DEVICE_KEY);
      const preferred =
        devices.find((item) => item.status === "connected" && item.id === rememberedId && isSigningDeviceOnline(item)) ??
        devices.find((item) => item.status === "connected" && isSigningDeviceOnline(item)) ??
        devices.find((item) => item.status === "connected" && item.id === rememberedId) ??
        devices.find((item) => item.status === "connected") ??
        devices[0];
      setSigningDeviceId((current) => (devices.some((device) => device.id === current && device.status === "connected") ? current : preferred?.id || ""));
    } catch {
      setSigningDevices([]);
    }
  }, []);

  const openSigningDialog = async () => {
    setSigningDialogOpen(true);
    setPairingCode(null);
    setSigningLoading(true);
    try {
      const [requirements] = await Promise.all([adminSigningService.getRequirements(entryId), loadSigningDevices()]);
      setSigningRequirements(requirements);
      const preferredSigner = requirements.signers?.find((item) => item.role === "driver") ?? requirements.signers?.[0];
      setSigningSignerPersonId(preferredSigner?.personId ?? "");
      setActiveSigningSession(null);
      setSigningPrechecks(emptySigningPrechecks());
      setGuardianName(requirements.isMinor && detail?.consent.guardian.fullName !== "-" ? detail?.consent.guardian.fullName ?? "" : "");
      setGuardianRelationship("");
    } catch (error) {
      flashMessage(getApiErrorMessage(error, "Signing-Anforderungen konnten nicht geladen werden."), 3600);
      setSigningDialogOpen(false);
    } finally {
      setSigningLoading(false);
    }
  };

  useEffect(() => {
    setHasLoadedOnce(false);
    loadDetail();
  }, [entryId]);

  useEffect(() => {
    adminMetaService
      .listClassOptions()
      .then(setClassOptions)
      .catch(() => setClassOptions([]));
  }, []);

  useEffect(() => {
    if (!canCheckin) {
      return;
    }
    void loadSigningDevices();
  }, [canCheckin, loadSigningDevices]);

  useEffect(() => {
    if (!signingDialogOpen || !pairingCode || signingDevices.some((device) => device.status === "connected")) {
      return;
    }
    const interval = window.setInterval(() => {
      void loadSigningDevices();
    }, 2000);
    return () => window.clearInterval(interval);
  }, [loadSigningDevices, pairingCode, signingDevices, signingDialogOpen]);

  useEffect(() => {
    if (!pairingCode) {
      return;
    }
    const expiresAtMs = new Date(pairingCode.expiresAt).getTime();
    if (!Number.isFinite(expiresAtMs)) {
      return;
    }
    const delay = Math.max(0, expiresAtMs - Date.now());
    const timeout = window.setTimeout(() => {
      setPairingCode(null);
      void loadSigningDevices();
    }, delay + 250);
    return () => window.clearTimeout(timeout);
  }, [loadSigningDevices, pairingCode]);

  useEffect(() => {
    if (!signingDialogOpen || !activeSigningSession || !signingInProgress) {
      return;
    }
    const poll = async () => {
      try {
        const session = await adminSigningService.getSession(activeSigningSession.id);
        setActiveSigningSession(session);
        if (session.status === "completed") {
          loadDetail();
          adminSigningService
            .getRequirements(entryId)
            .then(setSigningRequirements)
            .catch(() => undefined);
        }
      } catch {
        // Keep the modal state; the next poll or manual close can recover.
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 2500);
    return () => window.clearInterval(interval);
  }, [activeSigningSession, signingDialogOpen, signingInProgress]);

  useEffect(() => {
    if (!participantDialogOpen || !participantSession || ["completed", "cancelled", "failed"].includes(participantSession.workflowStage)) return;
    const poll = async () => {
      try {
        const session = await adminTerminalService.getSession(participantSession.id);
        setParticipantSession(session);
        if (session.workflowStage === "completed") loadDetail();
      } catch {
        // A temporary network interruption must not discard the active tablet flow.
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 2000);
    return () => window.clearInterval(interval);
  }, [participantDialogOpen, participantSession?.id, participantSession?.workflowStage]);

  const hasDriverNote = driverNote.trim().length > 0;

  useEffect(() => {
    if (hasDriverNote) {
      return;
    }
    setIncludeDriverNoteOnAccept(false);
    setIncludeDriverNoteOnReject(false);
  }, [hasDriverNote]);

  if (!hasLoadedOnce) {
    return <div className="rounded-xl border border-dashed p-6 text-sm text-slate-500">Nennung wird geladen…</div>;
  }

  if (!detail) {
    return <div className="rounded-xl border border-dashed p-6 text-sm text-slate-500">Nennung nicht gefunden.</div>;
  }

  const paymentApplicable = detail.payment.status !== null;
  const paymentState = paymentApplicable ? detail.payment.status : null;
  const currentClassAllowsCodriver = classOptions.find((option) => option.id === detail.classId)?.allowsCodriver ?? false;
  const hiddenHistoryCount = Math.max(detail.history.length - HISTORY_PREVIEW_LIMIT, 0);
  const historyItems = historyExpanded ? detail.history : detail.history.slice(0, HISTORY_PREVIEW_LIMIT);
  const changedAt = detail.history.reduce((latest, item) => {
    const latestMs = Number(new Date(latest));
    const candidateMs = Number(new Date(item.timestamp));
    if (!Number.isFinite(candidateMs)) {
      return latest;
    }
    if (!Number.isFinite(latestMs) || candidateMs > latestMs) {
      return item.timestamp;
    }
    return latest;
  }, detail.createdAt);
  const anyActionInFlight = actionInFlight !== null;
  const statusActionInFlight =
    actionInFlight === "status-shortlist" || actionInFlight === "status-accepted" || actionInFlight === "status-rejected" || actionInFlight === "status-withdrawn";
  const actionOutlineClass = "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100";
  const actionActiveClass = "border-primary bg-primary text-primary-foreground hover:bg-primary/90";
  const mailRelationLabel = (relation: (typeof mailHistory)[number]["relation"]) => {
    if (relation === "registration_group") {
      return "Gruppe";
    }
    if (relation === "entry") {
      return "Nennung";
    }
    return "Zuordnung";
  };
  const statusDisabledReason = (target: "pending" | "shortlist" | "accepted" | "rejected" | "withdrawn") => {
    if (anyActionInFlight) {
      return "Aktion wird verarbeitet…";
    }
    if (!canSetStatus) {
      return "Nur Admin-Rollen dürfen Status ändern.";
    }
    if (!confirmationMailVerified) {
      return "Status erst nach verifizierter E-Mail änderbar.";
    }
    if (status === target) {
      return "Bereits in diesem Status.";
    }
    return undefined;
  };

  const backToEntries = () => {
    const state = location.state as { fromEntriesList?: boolean; scrollY?: number; loadedCount?: number } | null;
    if (state?.fromEntriesList) {
      navigate(-1);
      return;
    }
    navigate(`/admin/entries${location.search}`, { state: { restoreEntriesScrollY: 0 } });
  };

  const connectedSigningDevices = signingDevices.filter((device) => device.status === "connected");
  const selectedSigningDeviceId = signingDeviceId || connectedSigningDevices[0]?.id || "";
  const selectedSigningDevice = connectedSigningDevices.find((device) => device.id === selectedSigningDeviceId) ?? null;
  const selectedSigningDeviceOnline = isSigningDeviceOnline(selectedSigningDevice);
  const signedWaiverDocumentId = detail.waiverSigned.documentId;
  const hasSignedWaiverDocument = detail.waiverSigned.signed;
  const signedWaiverAt = detail.waiverSigned.signedAt;
  const signingRequirementEntries = signingRequirements?.entries ?? [];
  const signingSignerOptions =
    signingRequirements?.signers && signingRequirements.signers.length > 0
      ? signingRequirements.signers
      : signingRequirements
        ? [{
            personId: "",
            role: "driver" as const,
            label: "Fahrer",
            name: signingRequirements.driverName,
            isMinor: signingRequirements.isMinor,
            requiresMedicalCertificate: signingRequirements.requiresMedicalCertificate,
            signed: false,
            signedAt: null,
            documentId: null
          }]
        : [];
  const selectedSigningSigner = signingSignerOptions.find((item) => item.personId === signingSignerPersonId) ?? signingSignerOptions[0] ?? null;
  const signingNeedsGuardian = selectedSigningSigner?.isMinor === true;
  const signingRequiresMedicalCertificate = selectedSigningSigner?.requiresMedicalCertificate === true;
  const signingPrechecksComplete = Boolean(
    signingRequirements &&
      signingPrechecks.identityCheckedAt &&
      signingPrechecks.signerPresentAt &&
      (!signingRequiresMedicalCertificate || signingPrechecks.medicalCertificateCheckedAt) &&
      (!signingNeedsGuardian || (signingPrechecks.guardianPresentAt && signingPrechecks.guardianAuthorityCheckedAt && guardianName.trim() && guardianRelationship.trim()))
  );

  const createPairingCode = async () => {
    setSigningBusy(true);
    try {
      const result = await adminSigningService.createPairingCode();
      setPairingCode({ code: result.pairingCode, expiresAt: result.expiresAt });
      await loadSigningDevices();
      flashMessage("Pairing-Code erzeugt. Bitte am Signaturgerät eingeben.", 4200);
    } catch (error) {
      flashMessage(getApiErrorMessage(error, "Pairing-Code konnte nicht erzeugt werden."), 3200);
    } finally {
      setSigningBusy(false);
    }
  };

  const revokeSigningDevice = async (deviceSessionId: string) => {
    setSigningBusy(true);
    try {
      await adminSigningService.revokeDevice(deviceSessionId);
      if (signingDeviceId === deviceSessionId) {
        setSigningDeviceId("");
      }
      await loadSigningDevices();
      flashMessage("Signaturgerät wurde entkoppelt.", 2600);
    } catch (error) {
      flashMessage(getApiErrorMessage(error, "Signaturgerät konnte nicht entkoppelt werden."), 3200);
    } finally {
      setSigningBusy(false);
    }
  };

  const startSigningOnDevice = async () => {
    if (!detail || !selectedSigningDeviceId || signingBusy) {
      return;
    }
    if (!selectedSigningDeviceOnline) {
      flashMessage("Das ausgewählte Signaturgerät ist aktuell nicht aktiv. Bitte Terminal öffnen oder Geräte aktualisieren.", 4200);
      return;
    }
    if (!signingPrechecksComplete) {
      flashMessage("Bitte Vorprüfung im Nennungstool vollständig bestätigen.", 4200);
      return;
    }
    setSigningBusy(true);
    try {
      const result = await adminSigningService.startSession({
        deviceSessionId: selectedSigningDeviceId,
        entryId: detail.id,
        signerPersonId: selectedSigningSigner?.personId || undefined,
        precheckTimestamps: signingPrechecks,
        precheck: {
          identityChecked: Boolean(signingPrechecks.identityCheckedAt),
          signerPresent: Boolean(signingPrechecks.signerPresentAt),
          medicalCertificateChecked: Boolean(signingPrechecks.medicalCertificateCheckedAt),
          guardianPresent: Boolean(signingPrechecks.guardianPresentAt),
          guardianAuthorityChecked: Boolean(signingPrechecks.guardianAuthorityCheckedAt)
        },
        signer: {
          type: signingNeedsGuardian ? "guardian" : selectedSigningSigner?.role === "codriver" ? "codriver" : "driver",
          guardianName: signingNeedsGuardian ? guardianName.trim() || null : null,
          guardianRelationship: signingNeedsGuardian ? guardianRelationship.trim() || null : null
        }
      });
      window.localStorage.setItem(PREFERRED_SIGNING_DEVICE_KEY, selectedSigningDeviceId);
      setActiveSigningSession(result.session);
      flashMessage("Haftverzicht wurde an das gekoppelte Signaturgerät gesendet.", 4200);
    } catch (error) {
      flashMessage(getApiErrorMessage(error, "Signing-Session konnte nicht gestartet werden."), 4200);
    } finally {
      setSigningBusy(false);
    }
  };

  const cancelActiveSigningSession = async () => {
    if (!activeSigningSession || signingBusy) {
      return;
    }
    setSigningBusy(true);
    try {
      const session = await adminSigningService.cancelSession(activeSigningSession.id);
      setActiveSigningSession(session);
      flashMessage("Unterschriftenvorgang wurde abgebrochen.", 2600);
    } catch (error) {
      flashMessage(getApiErrorMessage(error, "Unterschriftenvorgang konnte nicht abgebrochen werden."), 3200);
    } finally {
      setSigningBusy(false);
    }
  };

  const closeSigningDialog = async () => {
    if (activeSigningSession && signingInProgress && !signingBusy) {
      await cancelActiveSigningSession();
    }
    setSigningDialogOpen(false);
  };

  const toggleSigningPrecheck = (key: keyof SigningPrecheckTimestamps) => {
    setSigningPrechecks((current) => ({
      ...current,
      [key]: current[key] ? null : new Date().toISOString()
    }));
  };

  const saveStampCardDownload = (download: { downloadUrl: string; filename: string }) => {
    const anchor = document.createElement("a");
    anchor.href = download.downloadUrl;
    anchor.download = download.filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const downloadStampCard = async (subject: { cardType: "driver" | "regular_codriver"; personId: string } | { cardType: "charity_codriver"; registrationId: string }) => {
    if (!detail || participantBusy) return;
    setParticipantBusy(true);
    try {
      const download = await adminEntriesService.getStampCards({
        eventId: detail.eventId,
        startSlot: stampCardStartSlot,
        selection: { type: "subjects", subjects: [subject] }
      });
      saveStampCardDownload(download);
      flashMessage("Stempelkarte wurde erstellt.");
    } catch (error) {
      flashMessage(getApiErrorMessage(error, "Stempelkarte konnte nicht erstellt werden."), 3200);
    } finally {
      setParticipantBusy(false);
    }
  };

  const resendWaiverMail = async (documentId: string, participantName: string) => {
    const actionKey = `waiver-mail-${documentId}`;
    if (actionInFlight) return;
    setActionInFlight(actionKey);
    try {
      const result = await adminSigningService.resendSignedWaiverMail(documentId);
      flashMessage(`Haftverzicht mit PDF wurde erneut an ${result.recipient} gesendet.`, 4200);
      loadMailHistory();
    } catch (error) {
      flashMessage(getApiErrorMessage(error, `Haftverzicht-Mail für ${participantName} konnte nicht versendet werden.`), 4200);
    } finally {
      setActionInFlight((current) => current === actionKey ? null : current);
    }
  };

  const openCodriverLinkDialog = async () => {
    if (!detail) return;
    const defaultExpiry = new Date(Date.now() + 14 * 24 * 60 * 60_000);
    const localExpiry = new Date(defaultExpiry.getTime() - defaultExpiry.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    setCodriverLinkEntryIds(Array.from(new Set([detail.id, ...detail.relatedEntryIds])));
    setCodriverLinkRecipientName("");
    setCodriverLinkRecipientEmail("");
    setCodriverLinkExpiresAt(localExpiry);
    setCodriverLinkUrl("");
    setCodriverLinkDialogOpen(true);
    setCodriverLinkBusy(true);
    try {
      setCodriverInvitations(await adminCodriverInvitationsService.list(detail.id));
    } catch (error) {
      flashMessage(getApiErrorMessage(error, "Bestehende Beifahrer-Links konnten nicht geladen werden."), 3200);
    } finally {
      setCodriverLinkBusy(false);
    }
  };

  const createCodriverLink = async () => {
    if (!detail || codriverLinkBusy || codriverLinkEntryIds.length === 0 || !codriverLinkExpiresAt) return;
    setCodriverLinkBusy(true);
    try {
      const result = await adminCodriverInvitationsService.create(detail.id, {
        entryIds: codriverLinkEntryIds,
        recipientName: codriverLinkRecipientName.trim() || undefined,
        recipientEmail: codriverLinkRecipientEmail.trim() || undefined,
        expiresAt: new Date(codriverLinkExpiresAt).toISOString()
      });
      setCodriverLinkUrl(result.url);
      setCodriverInvitations(await adminCodriverInvitationsService.list(detail.id));
      flashMessage("Persönlicher Beifahrer-Link wurde erstellt.");
    } catch (error) {
      flashMessage(getApiErrorMessage(error, "Beifahrer-Link konnte nicht erstellt werden."), 3400);
    } finally {
      setCodriverLinkBusy(false);
    }
  };

  const revokeCodriverLink = async (invitationId: string) => {
    if (!detail || codriverLinkBusy) return;
    setCodriverLinkBusy(true);
    try {
      await adminCodriverInvitationsService.revoke(invitationId);
      setCodriverInvitations(await adminCodriverInvitationsService.list(detail.id));
      flashMessage("Beifahrer-Link wurde widerrufen.");
    } catch (error) {
      flashMessage(getApiErrorMessage(error, "Beifahrer-Link konnte nicht widerrufen werden."), 3200);
    } finally {
      setCodriverLinkBusy(false);
    }
  };

  const openParticipantFlow = (workflow: ParticipantWorkflowType) => {
    if (!detail) return;
    const classAllowsCodriver = classOptions.find((option) => option.id === detail.classId)?.allowsCodriver ?? false;
    if (!classAllowsCodriver) {
      flashMessage("Diese Fahrzeugklasse erlaubt keine Beifahrer.", 3400);
      return;
    }
    setParticipantWorkflow(workflow);
    setParticipantEntryIds(workflow === "charity_codriver_registration" ? [detail.id] : Array.from(new Set([detail.id, ...detail.relatedEntryIds])));
    setParticipantSession(null);
    setParticipantChecks({ identity: false, present: false, medical: false, guardianPresent: false, guardianAuthority: false });
    setParticipantDialogOpen(true);
    void loadSigningDevices();
  };

  const startParticipantFlow = async () => {
    if (!selectedSigningDeviceId || !selectedSigningDeviceOnline || participantEntryIds.length === 0) return;
    setParticipantBusy(true);
    try {
      const session = await adminTerminalService.createParticipantSession({
        workflowType: participantWorkflow,
        deviceSessionId: selectedSigningDeviceId,
        entryIds: participantWorkflow === "charity_codriver_registration" ? [detail!.id] : participantEntryIds
      });
      setParticipantSession(session);
      window.localStorage.setItem(PREFERRED_SIGNING_DEVICE_KEY, selectedSigningDeviceId);
    } catch (error) {
      flashMessage(getApiErrorMessage(error, "Beifahrer-Vorgang konnte nicht gestartet werden."), 3400);
    } finally {
      setParticipantBusy(false);
    }
  };

  const participantDraft = participantSession?.draftPayload as { birthdate?: string; guardianFullName?: string } | null | undefined;
  const participantAge = participantDraft?.birthdate
    ? Math.floor((Date.now() - new Date(participantDraft.birthdate).getTime()) / 31_556_952_000)
    : null;
  const participantIsMinor = participantAge !== null && participantAge < 18;
  const participantNeedsMedical = participantWorkflow === "regular_codriver_registration" && participantAge !== null && participantAge >= 70;
  const participantApprovalComplete = participantChecks.identity && participantChecks.present
    && (!participantNeedsMedical || participantChecks.medical)
    && (!participantIsMinor || (participantChecks.guardianPresent && participantChecks.guardianAuthority));

  const approveParticipantFlow = async () => {
    if (!participantSession || !participantApprovalComplete) return;
    setParticipantBusy(true);
    const now = new Date().toISOString();
    try {
      setParticipantSession(await adminTerminalService.approve(participantSession.id, {
        identityCheckedAt: now,
        signerPresentAt: now,
        medicalCertificateCheckedAt: participantNeedsMedical ? now : null,
        guardianPresentAt: participantIsMinor ? now : null,
        guardianAuthorityCheckedAt: participantIsMinor ? now : null
      }));
    } catch (error) {
      flashMessage(getApiErrorMessage(error, "Freigabe konnte nicht erteilt werden."), 3400);
    } finally {
      setParticipantBusy(false);
    }
  };

  const closeParticipantFlow = async () => {
    if (participantSession && !["completed", "cancelled", "failed"].includes(participantSession.workflowStage)) {
      try { await adminTerminalService.cancel(participantSession.id); } catch { /* Session expires automatically. */ }
    }
    setParticipantDialogOpen(false);
  };

  return (
    <div className="w-full max-w-[1120px] pb-4 lg:flex lg:h-[calc(100dvh-3rem)] lg:flex-col lg:overflow-hidden lg:pb-0">
      <div className="-mt-4 border-b border-slate-200/80 bg-slate-100 px-3 md:-mt-6 lg:hidden">
        <div className="py-3">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="break-words text-xl font-semibold text-slate-900">
                  {detail.headline}
                  {detail.orgaCode ? ` · ${detail.orgaCode}` : ""}
                </h1>
                <p className="mt-1 break-words text-sm text-slate-600">
                  {detail.classLabel} · Startnummer {detail.startNumber}
                </p>
                <p className="mt-1 break-words text-xs text-slate-500">
                  Erstellt am: {formatTimestamp(detail.createdAt)} · Geändert am: {formatTimestamp(changedAt)}
                </p>
              </div>
              <div className="shrink-0">
                <Button type="button" variant="outline" size="sm" className="h-9 bg-white/90" onClick={backToEntries}>
                  Zurück
                </Button>
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge
                className={confirmationMailVerified ? "h-6 border-emerald-300 bg-emerald-50 px-2.5 text-xs text-emerald-900" : "h-6 border-slate-300 bg-slate-100 px-2.5 text-xs text-slate-700"}
                variant="outline"
              >
                E-Mail: {confirmationMailVerified ? "Verifiziert" : "Nicht verifiziert"}
              </Badge>
              <Badge className={`${acceptanceStatusClasses(status)} h-6 px-2.5 text-xs`} variant="outline">
                Status: {acceptanceStatusLabel(status)}
              </Badge>
              {paymentState ? (
                <Badge className={`${paymentStatusClasses(paymentState)} h-6 px-2.5 text-xs`} variant="outline">
                  Zahlung: {paymentStatusLabel(paymentState)}
                </Badge>
              ) : (
                <Badge className="h-6 border-slate-200 bg-slate-100 px-2.5 text-xs text-slate-600" variant="outline">
                  Zahlung: Nicht relevant
                </Badge>
              )}
              {status === "accepted" ? (
                <Badge className={`${techStatusClasses(detail.techStatus)} h-6 px-2.5 text-xs`} variant="outline">
                  Prüfung: {techStatusLabel(detail.techStatus)}
                </Badge>
              ) : (
                <Badge className="h-6 border-slate-200 bg-slate-100 px-2.5 text-xs text-slate-600" variant="outline">
                  Prüfung: Noch nicht relevant
                </Badge>
              )}
              <Badge className={`${waiverSignedClasses(detail.waiverSigners.driver.signed)} h-6 px-2.5 text-xs`} variant="outline">
                Fahrer-Haftverzicht: {waiverSignedLabel(detail.waiverSigners.driver.signed)}
              </Badge>
              {detail.waiverSigners.codriver ? <Badge className={`${waiverSignedClasses(detail.waiverSigners.codriver.signed)} h-6 px-2.5 text-xs`} variant="outline">
                Beifahrer-Haftverzicht: {waiverSignedLabel(detail.waiverSigners.codriver.signed)}
              </Badge> : null}
              {statusActionInFlight && (
                <Badge className="h-6 border-blue-300 bg-blue-50 px-2.5 text-xs text-blue-800" variant="outline">
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  Status wird aktualisiert…
                </Badge>
              )}
            </div>
          </div>
        </div>

      </div>

      <div className="hidden space-y-3 bg-slate-100 px-3 py-3 lg:flex-none lg:block" style={{ overflowAnchor: "none" }}>
        <div className="hidden lg:block">
          <Button type="button" variant="outline" size="sm" onClick={backToEntries}>
            Zurück zu Nennungen
          </Button>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-xl font-semibold text-slate-900 sm:text-2xl">
              {detail.headline}
              {detail.orgaCode ? ` · ${detail.orgaCode}` : ""}
            </h1>
            <p className="mt-1 break-words text-sm text-slate-600">
              {detail.classLabel} · Startnummer {detail.startNumber}
            </p>
            <p className="mt-1 break-words text-xs text-slate-500">
              Erstellt am: {formatTimestamp(detail.createdAt)} · Geändert am: {formatTimestamp(changedAt)}
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge
              className={confirmationMailVerified ? "h-6 border-emerald-300 bg-emerald-50 px-2.5 text-xs text-emerald-900" : "h-6 border-slate-300 bg-slate-100 px-2.5 text-xs text-slate-700"}
              variant="outline"
            >
              E-Mail: {confirmationMailVerified ? "Verifiziert" : "Nicht verifiziert"}
            </Badge>
            <Badge className={`${acceptanceStatusClasses(status)} h-6 px-2.5 text-xs`} variant="outline">
              Status: {acceptanceStatusLabel(status)}
            </Badge>
            {paymentState ? (
              <Badge className={`${paymentStatusClasses(paymentState)} h-6 px-2.5 text-xs`} variant="outline">
                Zahlung: {paymentStatusLabel(paymentState)}
              </Badge>
            ) : (
              <Badge className="h-6 border-slate-200 bg-slate-100 px-2.5 text-xs text-slate-600" variant="outline">
                Zahlung: Nicht relevant
              </Badge>
            )}
            {status === "accepted" ? (
              <Badge className={`${techStatusClasses(detail.techStatus)} h-6 px-2.5 text-xs`} variant="outline">
                Prüfung: {techStatusLabel(detail.techStatus)}
              </Badge>
            ) : (
              <Badge className="h-6 border-slate-200 bg-slate-100 px-2.5 text-xs text-slate-600" variant="outline">
                Prüfung: Noch nicht relevant
              </Badge>
            )}
            <Badge className={`${waiverSignedClasses(detail.waiverSigners.driver.signed)} h-6 px-2.5 text-xs`} variant="outline">
              Fahrer-Haftverzicht: {waiverSignedLabel(detail.waiverSigners.driver.signed)}
            </Badge>
            {detail.waiverSigners.codriver ? <Badge className={`${waiverSignedClasses(detail.waiverSigners.codriver.signed)} h-6 px-2.5 text-xs`} variant="outline">
              Beifahrer-Haftverzicht: {waiverSignedLabel(detail.waiverSigners.codriver.signed)}
            </Badge> : null}
            {statusActionInFlight && (
              <Badge className="h-6 border-blue-300 bg-blue-50 px-2.5 text-xs text-blue-800" variant="outline">
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                Status wird aktualisiert…
              </Badge>
            )}
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="fixed right-4 top-4 z-40 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 shadow-sm">
          {actionMessage}
        </div>
      )}

      <div className="relative z-0 grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,360px)] lg:overflow-hidden">
        <div className="order-1 min-w-0 space-y-4 lg:order-1 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-2 scrollbar-none">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Fahrerdaten</CardTitle>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-3 break-words text-sm text-slate-700 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase text-slate-500">Name</div>
                <div>{detail.driver.name}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">Geburtsdatum</div>
                <div>{detail.driver.birthdate}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">Land</div>
                <div>{detail.driver.country}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">E-Mail</div>
                <div className="break-words">{detail.driver.email}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">Telefon</div>
                <div>{detail.driver.phone}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">Straße</div>
                <div>{detail.driver.street}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">PLZ / Ort</div>
                <div>
                  {detail.driver.zip} {detail.driver.city}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">Notfallkontakt</div>
                <div>{detail.driver.emergencyContactName}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">Notfall-Telefon</div>
                <div>{detail.driver.emergencyContactPhone}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs uppercase text-slate-500">Beifahrer</div>
                {detail.codriver.assigned ? (
                  <details className="mt-1 rounded-md border bg-slate-50 p-3">
                    <summary className="cursor-pointer break-words font-medium text-slate-900">{detail.codriver.label}</summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase text-slate-500">Name</div>
                        <div>{detail.codriver.firstName} {detail.codriver.lastName}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase text-slate-500">Geburtsdatum</div>
                        <div>{detail.codriver.birthdate}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase text-slate-500">Land</div>
                        <div>{detail.codriver.country}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase text-slate-500">E-Mail</div>
                        <div className="break-words">{detail.codriver.email}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase text-slate-500">Telefon</div>
                        <div>{detail.codriver.phone}</div>
                      </div>
                      <div className="sm:col-span-2">
                        <div className="text-xs uppercase text-slate-500">Adresse</div>
                        <div>{detail.codriver.addressLine}</div>
                      </div>
                    </div>
                  </details>
                ) : (
                  <div>Nicht angegeben</div>
                )}
                {detail.charityCodrivers.length > 0 ? (
                  <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">Charity-Beifahrer</div>
                    <div className="mt-2 space-y-2">
                      {detail.charityCodrivers.map((item) => (
                        <div key={item.registrationId} className={cn("rounded border px-3 py-2", item.status === "active" ? "bg-white" : "border-slate-200 bg-slate-100 text-slate-500")}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-900">{item.name}</span>
                            <Badge variant="outline" className={item.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-slate-100 text-slate-600"}>
                              {item.status === "active" ? "Aktiv" : "Storniert"}
                            </Badge>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{item.email} · erfasst {formatTimestamp(item.createdAt)}</div>
                          {item.status === "revoked" ? <div className="mt-1 text-xs">Grund: {item.revocationReason || "-"}</div> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs uppercase text-slate-500">Bisherige motorsportliche Laufbahn</div>
                <div className="rounded-md border bg-slate-50 p-3 leading-relaxed text-slate-800">
                  {detail.driver.motorsportHistory}
                </div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs uppercase text-slate-500">Zusätzliche Hinweise</div>
                <div className="rounded-md border bg-slate-50 p-3 leading-relaxed text-slate-800">{detail.notes}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Fahrzeugdetails</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4 break-words text-sm text-slate-700">
              <VehiclePreview
                src={detail.vehicle.thumbUrl}
                label={detail.vehicle.label}
                onOpen={() => {
                  if (!detail.vehicle.thumbUrl) return;
                  setPreviewImage({ url: detail.vehicle.thumbUrl, label: detail.vehicle.label });
                }}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border bg-slate-50 p-2">
                  <div className="text-xs uppercase text-slate-500">Klasse</div>
                  <div className="font-medium text-slate-900">{detail.classLabel}</div>
                </div>
                <div className="rounded-md border bg-slate-50 p-2">
                  <div className="text-xs uppercase text-slate-500">Startnummer</div>
                  <div className="font-medium text-slate-900">{detail.startNumber}</div>
                </div>
                <div className="rounded-md border bg-slate-50 p-2">
                  <div className="text-xs uppercase text-slate-500">Fahrzeugtyp</div>
                  <div className="font-medium text-slate-900">{detail.vehicle.type === "moto" ? "Motorrad" : "Automobil"}</div>
                </div>
                <div className="rounded-md border bg-slate-50 p-2">
                  <div className="text-xs uppercase text-slate-500">Baujahr</div>
                  <div className="font-medium text-slate-900">{detail.vehicle.year}</div>
                </div>
                <div className="rounded-md border bg-slate-50 p-2">
                  <div className="text-xs uppercase text-slate-500">Hersteller / Modell</div>
                  <div className="font-medium text-slate-900">
                    {detail.vehicle.make} {detail.vehicle.model}
                  </div>
                </div>
                <div className="rounded-md border bg-slate-50 p-2">
                  <div className="text-xs uppercase text-slate-500">Hubraum</div>
                  <div className="font-medium text-slate-900">{detail.vehicle.displacementCcm}</div>
                </div>
                <div className="rounded-md border bg-slate-50 p-2">
                  <div className="text-xs uppercase text-slate-500">Zylinder</div>
                  <div className="font-medium text-slate-900">{detail.vehicle.cylinders}</div>
                </div>
                <div className="rounded-md border bg-slate-50 p-2">
                  <div className="text-xs uppercase text-slate-500">Besitzer</div>
                  <div className="font-medium text-slate-900">{detail.vehicle.ownerName}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs uppercase text-slate-500">Fahrzeughistorie</div>
                  <div className="rounded-md border bg-slate-50 p-3 leading-relaxed text-slate-800">
                    {detail.vehicle.vehicleHistory}
                  </div>
                </div>
              </div>
              {detail.backupVehicle.assigned && (
                <div className="space-y-3 rounded-lg border border-dashed bg-slate-50/60 p-3">
                  <div className="text-sm font-semibold text-slate-900">Ersatzfahrzeug</div>
                  <VehiclePreview
                    src={detail.backupVehicle.thumbUrl}
                    label={detail.backupVehicle.label}
                    onOpen={() => {
                      if (!detail.backupVehicle.thumbUrl) return;
                      setPreviewImage({ url: detail.backupVehicle.thumbUrl, label: detail.backupVehicle.label });
                    }}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border bg-white p-2">
                      <div className="text-xs uppercase text-slate-500">Klasse</div>
                      <div className="font-medium text-slate-900">{detail.backupVehicle.className}</div>
                    </div>
                    <div className="rounded-md border bg-white p-2">
                      <div className="text-xs uppercase text-slate-500">Fahrzeugtyp</div>
                      <div className="font-medium text-slate-900">{detail.backupVehicle.type === "moto" ? "Motorrad" : "Automobil"}</div>
                    </div>
                    <div className="rounded-md border bg-white p-2">
                      <div className="text-xs uppercase text-slate-500">Hersteller / Modell</div>
                      <div className="font-medium text-slate-900">
                        {detail.backupVehicle.make} {detail.backupVehicle.model}
                      </div>
                    </div>
                    <div className="rounded-md border bg-white p-2">
                      <div className="text-xs uppercase text-slate-500">Baujahr</div>
                      <div className="font-medium text-slate-900">{detail.backupVehicle.year}</div>
                    </div>
                    <div className="rounded-md border bg-white p-2">
                      <div className="text-xs uppercase text-slate-500">Hubraum</div>
                      <div className="font-medium text-slate-900">{detail.backupVehicle.displacementCcm}</div>
                    </div>
                    <div className="rounded-md border bg-white p-2">
                      <div className="text-xs uppercase text-slate-500">Zylinder</div>
                      <div className="font-medium text-slate-900">{detail.backupVehicle.cylinders}</div>
                    </div>
                    <div className="rounded-md border bg-white p-2">
                      <div className="text-xs uppercase text-slate-500">Besitzer</div>
                      <div className="font-medium text-slate-900">{detail.backupVehicle.ownerName}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-xs uppercase text-slate-500">Fahrzeughistorie</div>
                      <div className="rounded-md border bg-white p-3 leading-relaxed text-slate-800">
                        {detail.backupVehicle.vehicleHistory}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Zahlung</CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 space-y-3 break-words text-sm text-slate-700">
                {!paymentState ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-slate-600">
                    <div className="font-semibold text-slate-800">Nicht relevant</div>
                    <div className="mt-1 text-sm">
                      Für diese {status === "withdrawn" ? "abgesagte" : "abgelehnte"} Nennung ist kein Zahlungseingang dokumentiert.
                    </div>
                  </div>
                ) : (
                <>
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-xl border p-4",
                    paymentState === "paid"
                      ? "border-emerald-200 bg-emerald-50/70"
                      : paymentState === "not_required"
                        ? "border-slate-200 bg-slate-50"
                        : "border-amber-200 bg-amber-50/70"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full",
                      paymentState === "paid"
                        ? "bg-emerald-100 text-emerald-700"
                        : paymentState === "not_required"
                          ? "bg-slate-200 text-slate-700"
                          : "bg-amber-100 text-amber-700"
                    )}
                  >
                    {paymentState === "due" ? <Clock3 className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Zahlungsstatus</div>
                    <div className="mt-0.5 text-lg font-semibold text-slate-900">
                      {paymentStatusLabel(paymentState)}
                    </div>
                    <div className="text-sm text-slate-600">
                      {paymentState === "paid"
                        ? status === "withdrawn"
                          ? "Die Nennung wurde abgesagt; der Zahlungseingang bleibt vollständig dokumentiert."
                          : "Zahlungseingang wurde bestätigt."
                        : paymentState === "not_required"
                          ? "Für diese Nennung fällt kein Nenngeld an."
                          : "Zahlungseingang wurde noch nicht bestätigt."}
                    </div>
                  </div>
                  <Badge className={`${paymentStatusClasses(paymentState)} h-7 shrink-0 px-2.5 text-xs`} variant="outline">
                    {paymentStatusLabel(paymentState)}
                  </Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border bg-slate-50 p-3">
                    <div className="text-xs uppercase text-slate-500">
                      {status === "accepted"
                        ? "Nennungsbetrag"
                        : paymentState === "paid"
                          ? "Abgerechneter Betrag"
                          : "Vorgesehener Betrag"}
                    </div>
                    <div className="mt-1 font-semibold text-slate-900">{euroDisplayFromCents(detail.payment.totalCents ?? 0)}</div>
                  </div>
                  <div className="rounded-md border bg-slate-50 p-3">
                    <div className="text-xs uppercase text-slate-500">Bereits bezahlt</div>
                    <div className="mt-1 font-semibold text-slate-900">{euroDisplayFromCents(detail.payment.paidAmountCents ?? 0)}</div>
                  </div>
                  <div className="rounded-md border bg-slate-50 p-3">
                    <div className="text-xs uppercase text-slate-500">Offen</div>
                    <div className="mt-1 font-semibold text-slate-900">{euroDisplayFromCents(detail.payment.amountOpenCents ?? 0)}</div>
                  </div>
                </div>
                </>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Dokumente & Einwilligung</CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 space-y-3 break-words text-sm text-slate-700">
                {hasSignedWaiverDocument ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                    <div className="font-semibold">Haftverzicht unterschrieben</div>
                    <div className="mt-1 text-xs">Zeitpunkt: {signedWaiverAt ? formatTimestamp(signedWaiverAt) : "-"}</div>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3 h-9 bg-white"
                      disabled={anyActionInFlight}
                      onClick={() => {
                        if (signedWaiverDocumentId) {
                          void handleDocumentDownloadById(signedWaiverDocumentId, "Unterschriebener Haftverzicht", "download-waiver");
                        }
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Persönliche Erklärung laden
                    </Button>
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={Boolean(actionInFlight)}
                  onClick={() => void handleInspectionQrDownload()}
                >
                  {actionInFlight === "inspection-qr" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Abnahme-QR-Code (SVG)
                </Button>
                <div className="space-y-2">
                  {detail.documents.map((doc) => (
                    <div key={doc.id} className="rounded border p-2 text-xs">
                      {doc.type} · {doc.status}
                    </div>
                  ))}
                </div>
              <div className="rounded border bg-slate-50 p-3 text-xs">
                  <div>Teilnahmebedingungen: {detail.consent.termsAccepted ? "Ja" : "Nein"}</div>
                  <div>Datenschutz: {detail.consent.privacyAccepted ? "Ja" : "Nein"}</div>
                  <div>Haftverzicht: {detail.consent.waiverAccepted ? "Ja" : "Nein"}</div>
                  <div>Medien: {detail.consent.mediaAccepted ? "Ja" : "Nein"}</div>
                  <div>Vereinsinfos: {detail.consent.clubInfoAccepted ? "Ja" : "Nein"}</div>
                  {detail.consent.guardian.present && (
                    <>
                      <div className="pt-2 font-medium text-slate-900">Sorgeberechtigte Person</div>
                      <div>Name: {detail.consent.guardian.fullName}</div>
                      <div>E-Mail: {detail.consent.guardian.email}</div>
                      <div>Telefon: {detail.consent.guardian.phone}</div>
                      <div>Zustimmung: {detail.consent.guardian.consentAccepted ? "Ja" : "Nein"}</div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {canReadMail && (
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Mails zur Nennung</CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 space-y-3 break-words text-sm text-slate-700">
                {mailHistoryLoading && (
                  <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Mails werden geladen…
                  </div>
                )}
                {mailHistoryError && (
                  <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-rose-800">
                    {mailHistoryError}
                  </div>
                )}
                {!mailHistoryLoading && !mailHistoryError && mailHistory.length === 0 && (
                  <div className="rounded-md border border-dashed border-slate-300 p-4 text-slate-500">
                    Keine zugeordneten Mails gefunden.
                  </div>
                )}
                {mailHistory.map((mail) => (
                  <details key={mail.id} className="group rounded-md border bg-white">
                    <summary className="grid cursor-pointer gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="min-w-0 space-y-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <Badge className={`${outboxStatusClasses(mail.status)} h-6 px-2.5 text-xs`} variant="outline">
                            {outboxStatusLabel(mail.status)}
                          </Badge>
                          <Badge className="h-6 border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700" variant="outline">
                            {mailRelationLabel(mail.relation)}
                          </Badge>
                          <span className="text-xs text-slate-500">{mail.templateId} v{mail.templateVersion}</span>
                        </div>
                        <div className="break-words font-medium text-slate-900">{mail.subjectRendered}</div>
                        <div className="break-words text-xs text-slate-500">{mail.recipient}</div>
                      </div>
                      <div className="text-left text-xs text-slate-500 sm:text-right">
                        <div>Erstellt: {mail.createdAt}</div>
                        <div>Geplant: {mail.sendAfter}</div>
                        {mail.delivery?.sentAt && <div>Gesendet: {formatTimestamp(mail.delivery.sentAt)}</div>}
                      </div>
                    </summary>
                    <div className="border-t bg-slate-50 p-3">
                      <div className="grid gap-3 text-xs text-slate-600 sm:grid-cols-3">
                        <div>
                          <div className="uppercase text-slate-500">Outbox-ID</div>
                          <div className="break-all font-mono">{mail.id}</div>
                        </div>
                        <div>
                          <div className="uppercase text-slate-500">Versuche</div>
                          <div>{mail.attemptCount} / {mail.maxAttempts}</div>
                        </div>
                        <div>
                          <div className="uppercase text-slate-500">Delivery</div>
                          <div>{mail.delivery?.status ?? "-"}</div>
                        </div>
                      </div>
                      {mail.error && (
                        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
                          {mail.error}
                        </div>
                      )}
                      {mail.renderError && (
                        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                          Rendering: {mail.renderError}
                        </div>
                      )}
                      {(mail.warnings.length > 0 || mail.missingPlaceholders.length > 0 || mail.unknownPlaceholders.length > 0) && (
                        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                          {[...mail.warnings, ...mail.missingPlaceholders.map((item) => `Fehlt: ${item}`), ...mail.unknownPlaceholders.map((item) => `Unbekannt: ${item}`)].join(" · ")}
                        </div>
                      )}
                      <pre className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-md border bg-white p-3 text-xs leading-relaxed text-slate-800">
                        {mail.bodyText || mail.bodyHtml || "Kein gerenderter Inhalt verfügbar."}
                      </pre>
                    </div>
                  </details>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Historie</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 space-y-3 break-words text-sm text-slate-700">
              {historyItems.length === 0 && <div className="text-slate-500">Noch keine Änderungen protokolliert.</div>}
              {historyItems.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="font-medium text-slate-900">{item.details}</div>
                  <div className="mt-2 flex flex-wrap gap-x-2 text-xs text-slate-500">
                    <time>{formatTimestamp(item.timestamp)}</time>
                    <span aria-hidden="true">·</span>
                    <span>Bearbeitet von {item.actor}</span>
                  </div>
                </div>
              ))}
              {hiddenHistoryCount > 0 && !historyExpanded && (
                <Button type="button" variant="outline" onClick={() => setHistoryExpanded(true)}>
                  Weitere {hiddenHistoryCount} Einträge anzeigen
                </Button>
              )}
              {historyExpanded && detail.history.length > HISTORY_PREVIEW_LIMIT && (
                <Button type="button" variant="outline" onClick={() => setHistoryExpanded(false)}>
                  Auf letzte {HISTORY_PREVIEW_LIMIT} Einträge reduzieren
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="order-2 w-full min-w-0 lg:order-2 lg:min-h-0 lg:w-[340px] lg:justify-self-end">
          <div className="space-y-4 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1 scrollbar-none">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Aktionen</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4">
              {(canSetStatus || canCheckin) && (
                <div className="grid gap-2">
                  {canSetStatus && (
                    <>
                      <HintButton
                        label={actionInFlight === "status-shortlist" ? "Status wird gesetzt…" : "Auf Vorauswahl setzen"}
                        icon={actionInFlight === "status-shortlist" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : undefined}
                        variant={status === "shortlist" ? "default" : "outline"}
                        className={status === "shortlist" ? actionActiveClass : actionOutlineClass}
                        disabledReason={statusDisabledReason("shortlist")}
                        onClick={() => {
                          void runAction(
                            "status-shortlist",
                            () => adminEntriesService.setEntryStatus(detail.id, "to_shortlist"),
                            "Status auf Vorauswahl gesetzt.",
                            "Status konnte nicht geändert werden."
                          );
                        }}
                      />
                      <HintButton
                        label={actionInFlight === "status-accepted" ? "Status wird gesetzt…" : "Auf Zugelassen setzen"}
                        icon={actionInFlight === "status-accepted" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : undefined}
                        variant={status === "accepted" ? "default" : "outline"}
                        className={status === "accepted" ? actionActiveClass : actionOutlineClass}
                        disabledReason={statusDisabledReason("accepted")}
                        onClick={() => setPendingAcceptConfirm(true)}
                      />
                      <HintButton
                        label={actionInFlight === "status-rejected" ? "Status wird gesetzt…" : "Auf Abgelehnt setzen"}
                        icon={actionInFlight === "status-rejected" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : undefined}
                        variant={status === "rejected" ? "default" : "outline"}
                        className={status === "rejected" ? actionActiveClass : actionOutlineClass}
                        disabledReason={statusDisabledReason("rejected")}
                        onClick={() => setPendingRejectConfirm(true)}
                      />
                      <HintButton
                        label={actionInFlight === "status-withdrawn" ? "Status wird gesetzt…" : "Als Abgesagt markieren"}
                        icon={actionInFlight === "status-withdrawn" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : undefined}
                        variant={status === "withdrawn" ? "default" : "outline"}
                        className={status === "withdrawn" ? actionActiveClass : actionOutlineClass}
                        disabledReason={statusDisabledReason("withdrawn")}
                        onClick={() => {
                          setWithdrawalReasonDraft("");
                          setPendingWithdrawConfirm(true);
                        }}
                      />
                    </>
                  )}
                  {canCheckin && (
                    <HintButton
                      label={actionInFlight === "checkin-confirm" ? "Check-in wird bestätigt…" : "Einchecken bestätigen"}
                      icon={actionInFlight === "checkin-confirm" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : undefined}
                      variant={checkinDone ? "default" : "outline"}
                      className={checkinDone ? actionActiveClass : actionOutlineClass}
                      disabledReason={
                        anyActionInFlight
                          ? "Aktion wird verarbeitet…"
                          : status !== "accepted"
                            ? "Check-in erst nach Zulassung möglich."
                            : undefined
                      }
                      onClick={() => setPendingCheckinConfirm(true)}
                    />
                  )}
                </div>
              )}

              {canCheckin && (
                <div className="border-t border-slate-200 pt-4">
                  <HintButton
                    label={hasSignedWaiverDocument ? "Haftverzicht erneut erfassen" : "Haftverzicht unterschreiben"}
                    icon={<TabletSmartphone className="mr-2 h-4 w-4" />}
                    variant="default"
                    className={actionActiveClass}
                    disabledReason={signingBusy || signingLoading ? "Signing-Aktion läuft…" : undefined}
                    onClick={() => void openSigningDialog()}
                  />
                </div>
              )}

              {(canManageParticipants || canPrintStampCards || canSendMail || canCheckin) && (
                <div className="grid gap-2 border-t border-slate-200 pt-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fahrer &amp; Beifahrer</div>
                  {canManageParticipants && (
                    <>
                      <HintButton
                        label="Beifahrer am Terminal nachmelden"
                        icon={<TabletSmartphone className="mr-2 h-4 w-4" />}
                        variant="default"
                        className={actionActiveClass}
                        disabledReason={
                          participantBusy
                            ? "Beifahrer-Aktion läuft…"
                            : status !== "accepted"
                              ? "Beifahrer können erst nach Zulassung ergänzt werden."
                              : !currentClassAllowsCodriver
                                ? "Diese Fahrzeugklasse erlaubt keine Beifahrer."
                                : detail.codriver.assigned
                                  ? "Für diese Nennung ist bereits ein regulärer Beifahrer hinterlegt."
                                  : undefined
                        }
                        onClick={() => openParticipantFlow("regular_codriver_registration")}
                      />
                      <HintButton
                        label="Persönlichen Beifahrer-Link erstellen"
                        icon={<Link2 className="mr-2 h-4 w-4" />}
                        disabledReason={
                          codriverLinkBusy
                            ? "Beifahrer-Link wird verarbeitet…"
                            : status !== "accepted"
                              ? "Beifahrer-Links können erst nach Zulassung erstellt werden."
                              : !currentClassAllowsCodriver
                                ? "Diese Fahrzeugklasse erlaubt keine Beifahrer."
                                : detail.codriver.assigned
                                  ? "Für diese Nennung ist bereits ein regulärer Beifahrer hinterlegt."
                                  : undefined
                        }
                        onClick={() => void openCodriverLinkDialog()}
                      />
                      <HintButton
                        label="Charity-Fahrt am Terminal erfassen"
                        icon={<TabletSmartphone className="mr-2 h-4 w-4" />}
                        disabledReason={
                          participantBusy
                            ? "Beifahrer-Aktion läuft…"
                            : status !== "accepted"
                              ? "Charity-Fahrten können erst nach Zulassung erfasst werden."
                              : !currentClassAllowsCodriver
                                ? "Diese Fahrzeugklasse erlaubt keine Beifahrer."
                                : undefined
                        }
                        onClick={() => openParticipantFlow("charity_codriver_registration")}
                      />
                    </>
                  )}
                  {canPrintStampCards && (
                    <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                      <label className="flex items-center justify-between gap-2 text-xs text-slate-600">
                        Druckfeld
                        <select className="h-9 rounded-md border bg-white px-2 text-sm" value={stampCardStartSlot} onChange={(event) => setStampCardStartSlot(Number(event.target.value))}>
                          {Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
                        </select>
                      </label>
                      <Button type="button" size="sm" variant="outline" disabled={participantBusy} onClick={() => void downloadStampCard({ cardType: "driver", personId: detail.driverPersonId })}>
                        <Download className="mr-2 h-4 w-4" />Fahrerkarte drucken
                      </Button>
                      {detail.codriver.id ? (
                        <Button type="button" size="sm" variant="outline" disabled={participantBusy} onClick={() => void downloadStampCard({ cardType: "regular_codriver", personId: detail.codriver.id! })}>
                          <Download className="mr-2 h-4 w-4" />Beifahrerkarte drucken
                        </Button>
                      ) : null}
                      {detail.charityCodrivers.filter((item) => item.status === "active").map((item) => (
                        <Button key={item.registrationId} type="button" size="sm" variant="outline" className="h-auto whitespace-normal py-2" disabled={participantBusy} onClick={() => void downloadStampCard({ cardType: "charity_codriver", registrationId: item.registrationId })}>
                          <Download className="mr-2 h-4 w-4" />Charity-Karte: {item.name}
                        </Button>
                      ))}
                    </div>
                  )}
                  <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Haftverzicht-Dokumente</div>
                    {[
                      { key: "driver", name: detail.driver.name, role: "Fahrer", waiver: detail.waiverSigners.driver },
                      ...(detail.waiverSigners.codriver ? [{ key: "codriver", name: detail.codriver.label, role: "Beifahrer", waiver: detail.waiverSigners.codriver }] : [])
                    ].map((item) => (
                      <div key={item.key} className="rounded-md border bg-white p-2">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate font-medium">{item.role}: {item.name}</span>
                          <Badge className={waiverSignedClasses(item.waiver.signed)} variant="outline">{waiverSignedLabel(item.waiver.signed)}</Badge>
                        </div>
                        {item.waiver.documentId ? (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => void handleDocumentDownloadById(item.waiver.documentId!, `${item.role}-Haftverzicht`, `waiver-pdf-${item.key}`)}>
                              <Download className="mr-1.5 h-4 w-4" />PDF
                            </Button>
                            {canSendMail ? <Button type="button" size="sm" variant="outline" disabled={Boolean(actionInFlight)} onClick={() => void resendWaiverMail(item.waiver.documentId!, item.name)}>
                              <Mail className="mr-1.5 h-4 w-4" />Mail
                            </Button> : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {detail.charityCodrivers.map((item) => (
                      <div key={item.registrationId} className={cn("rounded-md border p-2", item.status === "active" ? "bg-white" : "bg-slate-100 opacity-70")}>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate font-medium">Charity: {item.name}</span>
                          <Badge className={waiverSignedClasses(item.waiverSigned.signed)} variant="outline">{waiverSignedLabel(item.waiverSigned.signed)}</Badge>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {item.waiverSigned.documentId ? <Button type="button" size="sm" variant="outline" onClick={() => void handleDocumentDownloadById(item.waiverSigned.documentId!, "Charity-Haftverzicht", `waiver-pdf-${item.registrationId}`)}>
                            <Download className="mr-1.5 h-4 w-4" />PDF
                          </Button> : null}
                          {canSendMail && item.waiverSigned.documentId ? <Button type="button" size="sm" variant="outline" disabled={Boolean(actionInFlight)} onClick={() => void resendWaiverMail(item.waiverSigned.documentId!, item.name)}>
                            <Mail className="mr-1.5 h-4 w-4" />Mail
                          </Button> : null}
                          {canManageParticipants && item.status === "active" ? <Button type="button" size="sm" variant="outline" className="col-span-2 border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => { setCharityRevocationReason(""); setPendingCharityRevoke({ registrationId: item.registrationId, name: item.name }); }}>
                            <Trash2 className="mr-1.5 h-4 w-4" />Charity-Berechtigung stornieren
                          </Button> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {canSendMail && (
                <div className="grid gap-2 border-t border-slate-200 pt-4">
                  <HintButton
                  label={
                    sendingVerificationMail
                      ? "Verifizierungsprozess wird gesendet…"
                      : confirmationMailVerified
                      ? "E-Mail bereits verifiziert"
                      : confirmationMailSent
                        ? "Erneute Verifizierung senden"
                        : "Verifizierung senden"
                  }
                  icon={sendingVerificationMail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  variant={!confirmationMailSent ? "default" : "outline"}
                  className={!confirmationMailSent ? actionActiveClass : actionOutlineClass}
                  disabledReason={confirmationMailVerified ? "E-Mail wurde bereits verifiziert." : sendingVerificationMail ? "Verifizierungs-Mail wird gerade versendet." : undefined}
                  onClick={async () => {
                    if (sendingVerificationMail) {
                      return;
                    }
                    setSendingVerificationMail(true);
                    try {
                      const result = await communicationService.queueVerificationMailForEntry(detail.id, {
                        allowDuplicate: true,
                        eventId: detail.eventId
                      });
                      if (result.queued < 1) {
                        const reason = (result.reason ?? "").trim().toLowerCase();
                        if (reason.includes("not_allowed")) {
                          flashMessage("Für diese Nennung ist das erneute Senden aktuell nicht zulässig.", 4200);
                          return;
                        }
                        if (reason.includes("no_recipient")) {
                          flashMessage("Für diese Nennung ist keine Empfänger-E-Mail vorhanden.", 4200);
                          return;
                        }
                        flashMessage(
                          result.reason?.trim() || "Es wurde keine Verifizierungs-Mail eingeplant.",
                          4200
                        );
                        return;
                      }
                      flashMessage(`Verifizierungsmail eingeplant (${result.outboxIds.length} Outbox-Eintrag).`, 4200);
                      loadDetail();
                      loadMailHistory();
                    } catch (error) {
                      flashMessage(getLocalizedActionError(error, "Verifizierungs-Mail konnte nicht versendet werden."), 3200);
                    } finally {
                      setSendingVerificationMail(false);
                    }
                  }}
                />
                  <HintButton
                    label={sendingPaymentReminder ? "Zahlungserinnerung wird gesendet…" : "Zahlungserinnerung senden"}
                    icon={sendingPaymentReminder ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    variant="outline"
                    className={actionOutlineClass}
                    disabledReason={
                      status !== "accepted"
                        ? "Zahlungserinnerung erst bei zugelassener Nennung."
                        : paymentState !== "due"
                          ? "Für diese Nennung ist keine Zahlungserinnerung nötig."
                          : sendingPaymentReminder
                            ? "Zahlungserinnerung wird gerade eingeplant."
                            : undefined
                    }
                    onClick={async () => {
                      if (sendingPaymentReminder) {
                        return;
                      }
                      if (paymentState !== "due") {
                        flashMessage("Für diese Nennung wird keine Zahlungserinnerung versendet.");
                        return;
                      }
                      setSendingPaymentReminder(true);
                      try {
                        const result = await communicationService.queuePaymentReminderForEntry(detail.id, {
                          allowDuplicate: true,
                          eventId: detail.eventId
                        });
                        if (result.queued < 1) {
                          const reason = (result.reason ?? "").trim().toLowerCase();
                          if (reason.includes("not_allowed")) {
                            flashMessage("Für diese Nennung ist aktuell keine Zahlungserinnerung zulässig.", 4200);
                            return;
                          }
                          flashMessage(
                            result.reason?.trim() || "Es wurde keine Zahlungserinnerung eingeplant (bereits vorhanden oder nicht zulässig).",
                            4200
                          );
                          return;
                        }
                        flashMessage(`Zahlungserinnerung eingeplant (${result.outboxIds.length} Outbox-Eintrag).`, 4200);
                        loadMailHistory();
                      } catch (error) {
                        if (error instanceof ApiError) {
                          const code = (error.code ?? "").toLowerCase();
                          const message = (error.message ?? "").toLowerCase();
                          if (code.includes("not_allowed") || message.includes("not allowed") || message.includes("not_allowed")) {
                            flashMessage("Für diese Nennung ist aktuell keine Zahlungserinnerung zulässig.", 4200);
                            return;
                          }
                        }
                        flashMessage(getApiErrorMessage(error, "Zahlungserinnerung konnte nicht versendet werden."), 4200);
                      } finally {
                        setSendingPaymentReminder(false);
                      }
                    }}
                  />
                </div>
              )}

                  {canPaymentWrite && (
                <div className="grid gap-2 border-t border-slate-200 pt-4">
                  <HintButton
                  label={actionInFlight === "payment-mark" ? "Zahlung wird bestätigt…" : "Zahlung als eingegangen markieren"}
                  icon={
                    actionInFlight === "payment-mark" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Wallet className="mr-2 h-4 w-4" />
                    )
                  }
                  variant={paymentState === "paid" ? "default" : "outline"}
                  className={paymentState === "paid" ? actionActiveClass : actionOutlineClass}
                  disabledReason={
                    anyActionInFlight
                      ? "Aktion wird verarbeitet…"
                      : status !== "accepted"
                        ? "Zahlung kann erst nach Zulassung bestätigt werden."
                        : paymentState === "not_required"
                          ? "Für diese Nennung ist keine Zahlung erforderlich."
                          : undefined
                  }
                  onClick={async () => {
                    setPendingPaymentConfirm(true);
                  }}
                />
                  <HintButton
                    label={actionInFlight === "payment-adjust" ? "Zahlungsdaten werden gespeichert…" : "Zahlung manuell anpassen"}
                    icon={
                      actionInFlight === "payment-adjust" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Wallet className="mr-2 h-4 w-4" />
                      )
                    }
                    variant="outline"
                    className={actionOutlineClass}
                    disabledReason={anyActionInFlight ? "Aktion wird verarbeitet…" : undefined}
                    onClick={() => {
                      setPaymentTotalInput(euroInputFromCents(detail.payment.totalCents ?? 0));
                      setPaymentPaidInput(status === "accepted" ? euroInputFromCents(detail.payment.paidAmountCents ?? 0) : "0,00");
                      setPaymentEditorOpen(true);
                    }}
                  />
                </div>
              )}

              <div className="grid gap-2 border-t border-slate-200 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={anyActionInFlight}
                  className={cn("h-auto w-full whitespace-normal break-words py-2 text-left leading-tight", actionOutlineClass)}
                  onClick={() => {
                    if (hasSignedWaiverDocument && signedWaiverDocumentId) {
                      void handleDocumentDownloadById(signedWaiverDocumentId, "Haftverzicht", "download-waiver");
                      return;
                    }
                    void handleDocumentDownload("waiver", "Haftverzicht", "download-waiver");
                  }}
                >
                  {actionInFlight === "download-waiver" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {actionInFlight === "download-waiver" ? "Haftverzicht wird geladen…" : hasSignedWaiverDocument ? "PDF unterschriebener Haftverzicht" : "PDF Haftverzicht"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={anyActionInFlight}
                  className={cn("h-auto w-full whitespace-normal break-words py-2 text-left leading-tight", actionOutlineClass)}
                  onClick={() => {
                    void handleDocumentDownload("tech_check", "Technische Abnahme", "download-tech-check");
                  }}
                >
                  {actionInFlight === "download-tech-check" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {actionInFlight === "download-tech-check" ? "Technische Abnahme wird geladen…" : "PDF Technische Abnahme"}
                </Button>
              </div>

              {canDeleteEntry && (
                <div className="grid gap-2 border-t border-slate-200 pt-4">
                  <HintButton
                  label={actionInFlight === "entry-delete" ? "Nennung wird gelöscht…" : "Nennung löschen"}
                  icon={
                    actionInFlight === "entry-delete" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )
                  }
                  variant="outline"
                  className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  disabledReason={anyActionInFlight ? "Aktion wird verarbeitet…" : undefined}
                  onClick={() => {
                    setDeleteReasonDraft("");
                    setPendingDeleteConfirm(true);
                  }}
                />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Notizen</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Intern</label>
                <textarea
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={internalNote}
                  disabled={!canNotesWrite}
                  onChange={(event) => setInternalNote(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Fahrer</label>
                <p className="text-xs text-slate-500">Kann bei Zulassung oder Ablehnung optional per E-Mail mitgesendet werden.</p>
                <textarea
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={driverNote}
                  disabled={!canNotesWrite}
                  onChange={(event) => setDriverNote(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Technische Prüfer</label>
                <p className="text-xs text-slate-500">Getrennt von internen Orga-Notizen und Fahrerhinweisen.</p>
                <textarea
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={inspectionNote}
                  disabled={!canNotesWrite}
                  onChange={(event) => setInspectionNote(event.target.value)}
                />
              </div>
              {canNotesWrite && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={anyActionInFlight}
                  onClick={async () => {
                    await runAction(
                      "notes-save",
                      () => adminEntriesService.saveEntryNotes(detail.id, { internalNote, driverNote, inspectionNote, status: detail.status }),
                      "Notizen gespeichert.",
                      "Notizen konnten nicht gespeichert werden."
                    );
                  }}
                >
                  {actionInFlight === "notes-save" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Speichert…
                    </>
                  ) : (
                    "Notizen speichern"
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {canChangeClass && (
            <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Klasse ändern</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 space-y-3 break-words">
              <div className="space-y-1">
                <div className="text-sm font-medium text-slate-900">Zielklasse</div>
                <Select value={classDraft || "__none__"} onValueChange={(next) => setClassDraft(next === "__none__" ? "" : next)}>
                  <SelectTrigger className="text-base md:text-sm">
                    <SelectValue placeholder="Klasse wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Klasse wählen</SelectItem>
                    {classOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {detail.backupVehicle.assigned && (
                <>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={classChangeIncludeBackup}
                      onChange={(event) => setClassChangeIncludeBackup(event.target.checked)}
                      disabled={!canChangeClass || anyActionInFlight}
                    />
                    Auch verknüpfte Ersatznennung auf Zielklasse umstellen
                  </label>
                  <div className="space-y-2 rounded-md border bg-slate-50 p-3">
                    <div className="text-sm font-medium text-slate-900">Klasse des Ersatzfahrzeugs</div>
                    <Select value={backupClassDraft || "__none__"} onValueChange={(next) => setBackupClassDraft(next === "__none__" ? "" : next)}>
                      <SelectTrigger><SelectValue placeholder="Ersatzklasse wählen" /></SelectTrigger>
                      <SelectContent>
                        {classOptions
                          .filter((option) => !option.registrationClosed && (option.runGroupId ?? option.id) === (classOptions.find((item) => item.id === detail.classId)?.runGroupId ?? detail.classId))
                          .map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={anyActionInFlight || !backupClassDraft || backupClassDraft === detail.backupClassId}
                      onClick={async () => {
                        setActionInFlight("backup-class-change");
                        try {
                          await adminEntriesService.changeEntryBackupClass(detail.id, backupClassDraft);
                          flashMessage("Ersatzklasse wurde aktualisiert.");
                          loadDetail();
                        } catch (error) {
                          flashMessage(getLocalizedActionError(error, "Ersatzklasse konnte nicht geändert werden."), 3200);
                        } finally {
                          setActionInFlight((current) => current === "backup-class-change" ? null : current);
                        }
                      }}
                    >
                      {actionInFlight === "backup-class-change" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Wird geändert…</> : "Ersatzklasse speichern"}
                    </Button>
                  </div>
                </>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={!canChangeClass || anyActionInFlight || !classDraft || classDraft === detail.classId}
                onClick={async () => {
                  if (actionInFlight) {
                    return;
                  }
                  setActionInFlight("class-change");
                  try {
                    const result = await adminEntriesService.changeEntryClass(detail.id, {
                      classId: classDraft,
                      applyToBackupVehicle: detail.backupVehicle.assigned ? classChangeIncludeBackup : false,
                      allowVehicleTypeChange: true
                    });
                    const warnings = (result.warnings ?? []).map((item) => item.trim()).filter(Boolean);
                    if (warnings.length > 0) {
                      flashMessage(`Klasse wurde aktualisiert. Hinweise: ${warnings.join(" | ")}`, 4200);
                    } else {
                      flashMessage("Klasse wurde aktualisiert.");
                    }
                    loadDetail();
                  } catch (error) {
                    flashMessage(getLocalizedActionError(error, "Klasse konnte nicht geändert werden."), 3200);
                  } finally {
                    setActionInFlight((current) => (current === "class-change" ? null : current));
                  }
                }}
              >
                {actionInFlight === "class-change" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird geändert…
                  </>
                ) : (
                  "Klasse ändern"
                )}
              </Button>
            </CardContent>
          </Card>
          )}
            </div>
        </aside>
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewImage(null)}>
          <img className="max-h-[90vh] max-w-[90vw] rounded-md border border-white/20 object-contain" src={previewImage.url} alt={previewImage.label} />
        </div>
      )}

      {canSetStatus && pendingAcceptConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-4 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Auf „Zugelassen“ setzen?</h2>
            <p className="mt-2 text-sm text-slate-600">Nach der Bestätigung wird automatisch die Zulassungs-Mail an den Fahrer angestoßen.</p>
            <div className="mt-3">
              <MailNoteSwitch
                checked={includeDriverNoteOnAccept}
                disabled={!hasDriverNote || actionInFlight === "status-accepted"}
                onChange={setIncludeDriverNoteOnAccept}
                title="Fahrer-Notiz in Mail mitsenden"
                description={
                  hasDriverNote
                    ? "Die aktuelle Fahrer-Notiz wird in der Zulassungs-Mail ergänzt."
                    : "Keine Fahrer-Notiz vorhanden."
                }
              />
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={actionInFlight === "status-accepted"}
                className="h-auto w-full whitespace-normal py-2 sm:w-auto"
                onClick={() => setPendingAcceptConfirm(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                disabled={actionInFlight === "status-accepted"}
                className="h-auto w-full whitespace-normal py-2 sm:w-auto"
                onClick={async () => {
                  setPendingAcceptConfirm(false);
                  await runAction(
                    "status-accepted",
                    () =>
                      adminEntriesService.setEntryStatus(detail.id, "to_accepted", {
                        includeDriverNoteInLifecycleMail: hasDriverNote ? includeDriverNoteOnAccept : false
                      }),
                    "Status auf Zugelassen gesetzt.",
                    "Status konnte nicht geändert werden."
                  );
                }}
              >
                {actionInFlight === "status-accepted" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird gesetzt…
                  </>
                ) : (
                  "Ja, zulassen"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {canCheckin && pendingCheckinConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg border bg-white p-4 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Einchecken wirklich bestätigen?</h2>
            <p className="mt-2 text-sm text-slate-600">Bitte nur bestätigen, wenn alle Punkte erfüllt sind:</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Haftverzicht unterschrieben</li>
              <li>Führerschein geprüft</li>
              <li>Bei Ü70 Ärztliches Attest geprüft</li>
              <li>Technische Abnahme durchgeführt und dokumentiert</li>
            </ul>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={actionInFlight === "checkin-confirm"}
                className="h-auto w-full whitespace-normal py-2 sm:w-auto"
                onClick={() => setPendingCheckinConfirm(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                disabled={actionInFlight === "checkin-confirm"}
                className="h-auto w-full whitespace-normal py-2 sm:w-auto"
                onClick={async () => {
                  const success = await runAction(
                    "checkin-confirm",
                    () => adminEntriesService.setEntryCheckinVerified(detail.id),
                    "Einchecken wurde bestätigt.",
                    "Check-in konnte nicht bestätigt werden."
                  );
                  if (success) {
                    setPendingCheckinConfirm(false);
                  }
                }}
              >
                {actionInFlight === "checkin-confirm" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird bestätigt…
                  </>
                ) : (
                  "Ja, bestätigen"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {canSetStatus && pendingRejectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-4 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Auf „Abgelehnt“ setzen?</h2>
            <p className="mt-2 text-sm text-slate-600">Diese Nennung wird als abgelehnt markiert. Der Status kann später wieder geändert werden.</p>
            <div className="mt-3">
              <MailNoteSwitch
                checked={includeDriverNoteOnReject}
                disabled={!hasDriverNote || actionInFlight === "status-rejected"}
                onChange={setIncludeDriverNoteOnReject}
                title="Fahrer-Notiz in Mail mitsenden"
                description={
                  hasDriverNote
                    ? "Die aktuelle Fahrer-Notiz wird in der Ablehnungs-Mail ergänzt."
                    : "Keine Fahrer-Notiz vorhanden."
                }
              />
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={actionInFlight === "status-rejected"}
                className="h-auto w-full whitespace-normal py-2 sm:w-auto"
                onClick={() => setPendingRejectConfirm(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={actionInFlight === "status-rejected"}
                className="h-auto w-full whitespace-normal py-2 sm:w-auto"
                onClick={async () => {
                  setPendingRejectConfirm(false);
                  await runAction(
                    "status-rejected",
                    () =>
                      adminEntriesService.setEntryStatus(detail.id, "to_rejected", {
                        includeDriverNoteInLifecycleMail: hasDriverNote ? includeDriverNoteOnReject : false
                      }),
                    "Status auf Abgelehnt gesetzt.",
                    "Status konnte nicht geändert werden."
                  );
                }}
              >
                {actionInFlight === "status-rejected" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird gesetzt…
                  </>
                ) : (
                  "Ja, ablehnen"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {canSetStatus && pendingWithdrawConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-4 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Teilnahme absagen?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Die historische Startnummer bleibt sichtbar, wird aber für andere Teilnehmer freigegeben.
            </p>
            <label className="mt-4 block text-sm font-medium text-slate-800" htmlFor="withdrawal-reason-detail">
              Grund der Absage
            </label>
            <Input
              id="withdrawal-reason-detail"
              className="mt-1"
              value={withdrawalReasonDraft}
              maxLength={2000}
              placeholder="z. B. Fahrer hat seine Teilnahme abgesagt"
              onChange={(event) => setWithdrawalReasonDraft(event.target.value)}
            />
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" disabled={actionInFlight === "status-withdrawn"} onClick={() => setPendingWithdrawConfirm(false)}>
                Abbrechen
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={actionInFlight === "status-withdrawn" || !withdrawalReasonDraft.trim()}
                onClick={async () => {
                  const reason = withdrawalReasonDraft.trim();
                  if (!reason) {
                    return;
                  }
                  setPendingWithdrawConfirm(false);
                  await runAction(
                    "status-withdrawn",
                    () => adminEntriesService.setEntryStatus(detail.id, "to_withdrawn", { withdrawalReason: reason }),
                    "Status auf Abgesagt gesetzt.",
                    "Status konnte nicht geändert werden."
                  );
                }}
              >
                {actionInFlight === "status-withdrawn" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Wird gesetzt…</> : "Ja, als abgesagt markieren"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {canPaymentWrite && pendingPaymentConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-4 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Zahlung als eingegangen markieren?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Diese Aktion bestätigt den Zahlungseingang für diese Nennung.
            </p>
            <div className="mt-4 rounded-md border bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Geforderter Betrag</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {euroDisplayFromCents(detail.payment.totalCents ?? 0)}
              </div>
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={actionInFlight === "payment-mark"}
                className="h-auto w-full whitespace-normal py-2 sm:w-auto"
                onClick={() => setPendingPaymentConfirm(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                disabled={actionInFlight === "payment-mark"}
                className="h-auto w-full whitespace-normal py-2 sm:w-auto"
                onClick={async () => {
                  const success = await runAction(
                    "payment-mark",
                    () => adminEntriesService.setEntryPaymentStatus(detail.id, "paid"),
                    "Zahlung als eingegangen markiert.",
                    "Zahlungsstatus konnte nicht aktualisiert werden."
                  );
                  if (success) {
                    setPendingPaymentConfirm(false);
                  }
                }}
              >
                {actionInFlight === "payment-mark" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird bestätigt…
                  </>
                ) : (
                  "Ja, bestätigen"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {canPaymentWrite && paymentEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-4 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Zahlungsbetrag anpassen</h2>
            <p className="mt-2 text-sm text-slate-600">
              {status === "accepted"
                ? "Werte in EUR eintragen, z. B. 89,00."
                : "Vor Zulassung kann hier nur der vorgesehene Betrag angepasst werden. Zahlungseingänge werden erst nach Zulassung erfasst."}
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Gesamtbetrag (EUR)</label>
                <input
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={paymentTotalInput}
                  onChange={(event) => setPaymentTotalInput(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Bereits bezahlt (EUR)</label>
                <input
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={paymentPaidInput}
                  disabled={status !== "accepted"}
                  onChange={(event) => setPaymentPaidInput(event.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={actionInFlight === "payment-adjust"}
                className="h-auto w-full whitespace-normal py-2 sm:w-auto"
                onClick={() => setPaymentEditorOpen(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                disabled={actionInFlight === "payment-adjust"}
                className="h-auto w-full whitespace-normal py-2 sm:w-auto"
                onClick={async () => {
                  const success = await runAction(
                    "payment-adjust",
                    () =>
                      adminEntriesService.setEntryPaymentAmounts(detail.id, {
                        totalCents: centsFromEuroInput(paymentTotalInput),
                        paidAmountCents: centsFromEuroInput(paymentPaidInput)
                      }),
                    "Zahlungsdaten wurden aktualisiert.",
                    "Zahlungsdaten konnten nicht aktualisiert werden."
                  );
                  if (success) {
                    setPaymentEditorOpen(false);
                  }
                }}
              >
                {actionInFlight === "payment-adjust" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Speichert…
                  </>
                ) : (
                  "Speichern"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {canDeleteEntry && pendingDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-4 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Nennung löschen?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Diese Aktion verschiebt die Nennung in die gelöschte Liste und kann dort wiederhergestellt werden.
            </p>
            <div className="mt-3 space-y-1">
              <label className="text-sm font-medium text-slate-900">Löschgrund (optional)</label>
              <textarea
                className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Optionaler Löschgrund"
                value={deleteReasonDraft}
                disabled={actionInFlight === "entry-delete"}
                onChange={(event) => setDeleteReasonDraft(event.target.value)}
              />
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={actionInFlight === "entry-delete"}
                className="h-auto w-full whitespace-normal py-2 sm:w-auto"
                onClick={() => {
                  setPendingDeleteConfirm(false);
                  setDeleteReasonDraft("");
                }}
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={actionInFlight === "entry-delete"}
                className="h-auto w-full whitespace-normal py-2 sm:w-auto"
                onClick={async () => {
                  if (anyActionInFlight) {
                    return;
                  }
                  setActionInFlight("entry-delete");
                  try {
                    const reason = deleteReasonDraft.trim();
                    await adminEntriesService.deleteEntry(detail.id, {
                      deleteReason: reason || null
                    });
                    setDeleteReasonDraft("");
                    navigate(`/admin/entries${location.search}`);
                  } catch (error) {
                    flashMessage(getLocalizedActionError(error, "Nennung konnte nicht gelöscht werden."), 3200);
                  } finally {
                    setActionInFlight((current) => (current === "entry-delete" ? null : current));
                  }
                }}
              >
                {actionInFlight === "entry-delete" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird gelöscht…
                  </>
                ) : (
                  "Ja, löschen"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {canManageParticipants && pendingCharityRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="w-full max-w-lg rounded-lg border bg-white p-5 shadow-xl">
            <h2 className="text-xl font-semibold text-slate-900">Charity-Berechtigung stornieren</h2>
            <p className="mt-2 text-sm text-slate-600">
              Die Stempelkarte von {pendingCharityRevoke.name} wird ungültig. Die unterschriebene Erklärung bleibt revisionssicher gespeichert.
            </p>
            <label className="mt-4 block text-sm font-medium text-slate-800" htmlFor="charity-revocation-reason">Begründung</label>
            <textarea
              id="charity-revocation-reason"
              className="mt-1 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              maxLength={500}
              value={charityRevocationReason}
              onChange={(event) => setCharityRevocationReason(event.target.value)}
              placeholder="Zum Beispiel doppelt oder irrtümlich erfasst"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={Boolean(actionInFlight)} onClick={() => setPendingCharityRevoke(null)}>Abbrechen</Button>
              <Button
                type="button"
                variant="destructive"
                disabled={Boolean(actionInFlight) || !charityRevocationReason.trim()}
                onClick={async () => {
                  if (!pendingCharityRevoke || !charityRevocationReason.trim() || actionInFlight) return;
                  setActionInFlight("charity-revoke");
                  try {
                    await adminEntriesService.revokeCharityCodriver(detail.id, pendingCharityRevoke.registrationId, charityRevocationReason.trim());
                    setPendingCharityRevoke(null);
                    setCharityRevocationReason("");
                    flashMessage("Charity-Berechtigung wurde storniert.", 3200);
                    loadDetail();
                  } catch (error) {
                    flashMessage(getApiErrorMessage(error, "Charity-Berechtigung konnte nicht storniert werden."), 4200);
                  } finally {
                    setActionInFlight((current) => current === "charity-revoke" ? null : current);
                  }
                }}
              >
                {actionInFlight === "charity-revoke" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Stornieren
              </Button>
            </div>
          </div>
        </div>
      )}

      {canManageParticipants && codriverLinkDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-white p-4 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Persönlichen Beifahrer-Link erstellen</h2>
                <p className="mt-1 text-sm text-slate-500">Nur für reguläre Beifahrer. Die Person erfasst ihre Daten online und unterschreibt den Haftverzicht später vor Ort. Charity-Beifahrer können keinen Link erhalten.</p>
              </div>
              <Button type="button" variant="outline" disabled={codriverLinkBusy} onClick={() => setCodriverLinkDialogOpen(false)}>Schließen</Button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-md border bg-slate-50 p-3">
                <div className="text-sm font-semibold text-slate-900">Starts für diesen Beifahrer</div>
                <div className="mt-2 space-y-2">
                  {Array.from(new Set([detail.id, ...detail.relatedEntryIds])).map((id) => (
                    <label key={id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={codriverLinkEntryIds.includes(id)} onChange={(event) => setCodriverLinkEntryIds((current) => event.target.checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id))} />
                      {id === detail.id ? `${detail.classLabel} · Startnummer ${detail.startNumber}` : `Weiterer Start · ${id.slice(0, 8)}`}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="mb-1.5 block text-sm font-medium">Empfängername (optional)</label><Input value={codriverLinkRecipientName} onChange={(event) => setCodriverLinkRecipientName(event.target.value)} placeholder="Max Mustermann" /></div>
                <div><label className="mb-1.5 block text-sm font-medium">Empfänger-E-Mail (optional)</label><Input type="email" value={codriverLinkRecipientEmail} onChange={(event) => setCodriverLinkRecipientEmail(event.target.value)} placeholder="max@example.de" /><p className="mt-1 text-xs text-slate-500">Wenn gesetzt, kann nur diese E-Mail verwendet werden.</p></div>
                <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium">Gültig bis</label><Input type="datetime-local" value={codriverLinkExpiresAt} onChange={(event) => setCodriverLinkExpiresAt(event.target.value)} /></div>
              </div>
              <Button type="button" className="w-full" disabled={codriverLinkBusy || codriverLinkEntryIds.length === 0 || !codriverLinkExpiresAt} onClick={() => void createCodriverLink()}>
                {codriverLinkBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}Link erstellen
              </Button>

              {codriverLinkUrl ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-sm font-semibold text-emerald-950">Link erstellt – jetzt kopieren</div>
                <p className="mt-1 text-xs text-emerald-800">Der vollständige persönliche Link wird aus Sicherheitsgründen nur jetzt angezeigt.</p>
                <div className="mt-3 flex gap-2"><Input readOnly value={codriverLinkUrl} /><Button type="button" variant="outline" onClick={async () => { await navigator.clipboard.writeText(codriverLinkUrl); flashMessage("Link wurde kopiert."); }}><Copy className="mr-2 h-4 w-4" />Kopieren</Button></div>
              </div> : null}

              <div>
                <h3 className="text-sm font-semibold text-slate-900">Bisherige Links</h3>
                <div className="mt-2 space-y-2">
                  {codriverInvitations.length === 0 ? <p className="rounded-md border border-dashed p-3 text-sm text-slate-500">Noch kein Link erstellt.</p> : codriverInvitations.map((invitation) => (
                    <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
                      <div><div className="font-medium">{invitation.recipientName || invitation.recipientEmail || "Nicht personalisiert"}</div><div className="text-xs text-slate-500">{invitation.entryIds.length} Start{invitation.entryIds.length === 1 ? "" : "s"} · gültig bis {formatTimestamp(invitation.expiresAt)} · Status: {invitation.status === "active" ? "aktiv" : invitation.status === "used" ? "verwendet" : invitation.status === "revoked" ? "widerrufen" : "abgelaufen"}</div></div>
                      {invitation.status === "active" ? <Button type="button" size="sm" variant="outline" disabled={codriverLinkBusy} onClick={() => void revokeCodriverLink(invitation.id)}>Widerrufen</Button> : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {canManageParticipants && participantDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-white p-4 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {participantWorkflow === "charity_codriver_registration" ? "Charity-Beifahrer erfassen" : "Beifahrer nachmelden"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Die Person trägt ihre Daten selbst am gekoppelten Tablet ein und unterschreibt anschließend.</p>
              </div>
              <Button type="button" variant="outline" disabled={participantBusy} onClick={() => void closeParticipantFlow()}>Schließen</Button>
            </div>

            {!participantSession ? (
              <div className="mt-5 space-y-4">
                {participantWorkflow === "regular_codriver_registration" && detail.relatedEntryIds.length > 0 ? (
                  <div className="rounded-md border bg-slate-50 p-3">
                    <div className="text-sm font-semibold text-slate-900">Gültige Starts auswählen</div>
                    <div className="mt-2 space-y-2">
                      {Array.from(new Set([detail.id, ...detail.relatedEntryIds])).map((id) => (
                        <label key={id} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={participantEntryIds.includes(id)} onChange={(event) => setParticipantEntryIds((current) => event.target.checked ? [...current, id] : current.filter((item) => item !== id))} />
                          {id === detail.id ? `${detail.classLabel} · Startnummer ${detail.startNumber}` : `Weiterer Start · ${id.slice(0, 8)}`}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-900">Tablet</div>
                  <Select value={signingDeviceId || selectedSigningDeviceId || "__none__"} onValueChange={(value) => setSigningDeviceId(value === "__none__" ? "" : value)}>
                    <SelectTrigger className="h-12"><SelectValue placeholder="Tablet auswählen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Tablet auswählen</SelectItem>
                      {connectedSigningDevices.map((device) => <SelectItem key={device.id} value={device.id}>{device.deviceName ?? "Terminal"}{isSigningDeviceOnline(device) ? "" : " (nicht aktiv)"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" className="h-14 w-full" disabled={participantBusy || !selectedSigningDeviceId || !selectedSigningDeviceOnline || participantEntryIds.length === 0} onClick={() => void startParticipantFlow()}>
                  {participantBusy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <TabletSmartphone className="mr-2 h-5 w-5" />}
                  Eingabe am Tablet starten
                </Button>
                {!selectedSigningDeviceOnline ? <p className="text-sm text-amber-700">Das Tablet muss geöffnet und als aktiv verbunden sein.</p> : null}
              </div>
            ) : participantSession.workflowStage === "collecting_data" ? (
              <div className="mt-6 rounded-md border border-sky-200 bg-sky-50 p-5 text-center text-sky-900">
                <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin" />
                Dateneingabe läuft am Tablet. Danach erscheint hier automatisch die Vorprüfung.
              </div>
            ) : participantSession.workflowStage === "awaiting_operator_approval" ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-md border bg-slate-50 p-4 text-sm">
                  <div className="font-semibold text-slate-900">Eingaben kontrollieren</div>
                  <div className="mt-2 grid gap-1 text-slate-700 sm:grid-cols-2">
                    <div>Name: {String((participantSession.draftPayload as Record<string, unknown> | null)?.firstName ?? "")} {String((participantSession.draftPayload as Record<string, unknown> | null)?.lastName ?? "")}</div>
                    <div>Geburtsdatum: {String((participantSession.draftPayload as Record<string, unknown> | null)?.birthdate ?? "-")}</div>
                    <div className="sm:col-span-2">E-Mail: {String((participantSession.draftPayload as Record<string, unknown> | null)?.email ?? "-")}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    ["identity", "Identität geprüft"],
                    ["present", "Beifahrer ist persönlich anwesend"],
                    ...(participantNeedsMedical ? [["medical", "Ärztliches Attest geprüft"]] : []),
                    ...(participantIsMinor ? [["guardianPresent", "Sorgeberechtigte Person ist anwesend"], ["guardianAuthority", "Vertretungsberechtigung geprüft"]] : [])
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 rounded-md border px-3 py-3 text-sm">
                      <input type="checkbox" checked={participantChecks[key as keyof typeof participantChecks]} onChange={(event) => setParticipantChecks((current) => ({ ...current, [key]: event.target.checked }))} />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" disabled={participantBusy} onClick={async () => setParticipantSession(await adminTerminalService.returnToForm(participantSession.id))}>Zur Korrektur zurückgeben</Button>
                  <Button type="button" disabled={participantBusy || !participantApprovalComplete} onClick={() => void approveParticipantFlow()}>Prüfung freigeben</Button>
                </div>
              </div>
            ) : participantSession.workflowStage === "ready_to_sign" ? (
              <div className="mt-6 rounded-md border border-sky-200 bg-sky-50 p-5 text-center text-sky-900">
                <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin" />
                Freigegeben. Haftverzicht und Unterschrift werden jetzt am Tablet abgeschlossen.
              </div>
            ) : participantSession.workflowStage === "completed" ? (
              <div className="mt-6 space-y-4 rounded-md border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
                <div className="flex items-center gap-2 text-lg font-semibold"><CheckCircle2 className="h-6 w-6" /> Beifahrer vollständig gespeichert</div>
                <p className="text-sm">Der unterschriebene Haftverzicht wurde automatisch per E-Mail versendet.</p>
                {canPrintStampCards ? <Button type="button" disabled={participantBusy} onClick={() => {
                  const result = participantSession.resultPayload as { participantId?: string; charityRegistrationId?: string } | null;
                  if (participantWorkflow === "charity_codriver_registration" && result?.charityRegistrationId) void downloadStampCard({ cardType: "charity_codriver", registrationId: result.charityRegistrationId });
                  else if (result?.participantId) void downloadStampCard({ cardType: "regular_codriver", personId: result.participantId });
                }}><Download className="mr-2 h-4 w-4" />Stempelkarte drucken</Button> : null}
              </div>
            ) : (
              <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">Der Vorgang wurde abgebrochen oder ist fehlgeschlagen.</div>
            )}
          </div>
        </div>
      )}

      {canCheckin && signingDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-white p-4 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Haftverzicht starten</h2>
                {signingRequirements ? (
                  <p className="mt-1 text-sm text-slate-500">
                    {signingRequirements.driverName} · {signingRequirements.entryCount} Nennung
                    {signingRequirements.entryCount === 1 ? "" : "en"} · {signingRequirements.vehicleCount} Fahrzeug
                    {signingRequirements.vehicleCount === 1 ? "" : "e"}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-10 px-3"
                disabled={signingBusy}
                onClick={() => void closeSigningDialog()}
              >
                Schließen
              </Button>
            </div>

            {signingLoading ? (
              <div className="mt-6 flex items-center gap-2 rounded-md border bg-slate-50 p-4 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing-Daten werden geladen…
              </div>
            ) : (
              <div className="mt-4 space-y-5">
                {/* Step indicator */}
                {(() => {
                  const currentStep = activeSigningSession?.status === "completed" ? 3 : signingInProgress ? 2 : 1;
                  const steps = [
                    { n: 1, label: "Vorprüfung" },
                    { n: 2, label: "Unterschrift" },
                    { n: 3, label: "Abgeschlossen" },
                  ];
                  return (
                    <div className="flex items-center gap-1">
                      {steps.map((step, idx) => (
                        <>
                          <div
                            key={step.n}
                            className={cn(
                              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                              step.n === currentStep
                                ? "bg-slate-900 text-white"
                                : step.n < currentStep
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-100 text-slate-400"
                            )}
                          >
                            {step.n < currentStep ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <span className="h-3.5 w-3.5 text-center leading-none">{step.n}</span>
                            )}
                            {step.label}
                          </div>
                          {idx < steps.length - 1 && (
                            <div className="h-px flex-1 bg-slate-200" />
                          )}
                        </>
                      ))}
                    </div>
                  );
                })()}

                {activeSigningSession?.status === "completed" ? (
                  /* Step 3: Success screen */
                  <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-6 text-center">
                    <div className="flex justify-center">
                      <div className="rounded-full bg-emerald-100 p-4">
                        <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                      </div>
                    </div>
                    <h3 className="mt-4 text-xl font-bold text-emerald-900">Erfolgreich unterzeichnet</h3>
                    <p className="mt-1 text-sm text-emerald-700">
                      {selectedSigningSigner?.name ?? signingRequirements?.driverName ?? detail.driver.name}
                      {activeSigningSession.signedAt ? ` · ${formatTimestamp(activeSigningSession.signedAt)}` : ""}
                    </p>
                    <div className="mt-2 text-xs text-emerald-600">
                      Gerät: {selectedSigningDevice?.deviceName ?? "Signaturterminal"}
                      {activeSigningSession.documentId ? " · Dokument erzeugt" : ""}
                    </div>
                    <div className="mt-5 flex flex-wrap justify-center gap-3">
                      <Button type="button" onClick={() => {
                        loadDetail();
                        setSigningDialogOpen(false);
                      }}>
                        Status aktualisieren & schließen
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          activeSigningSession.documentId
                            ? void handleDocumentDownloadById(activeSigningSession.documentId, "Unterschriebener Haftverzicht", "download-waiver")
                            : void handleDocumentDownload("signed_waiver", "Unterschriebener Haftverzicht", "download-waiver")
                        }
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Dokument laden
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setActiveSigningSession(null);
                          setSigningPrechecks(emptySigningPrechecks());
                        }}
                      >
                        Weitere Unterschrift erfassen
                      </Button>
                    </div>
                  </div>
                ) : signingInProgress ? (
                  /* Step 2: Wait screen */
                  <div className="rounded-xl border-2 border-sky-200 bg-sky-50 p-6 text-center">
                    <div className="flex justify-center">
                      <div className="animate-pulse rounded-full bg-sky-100 p-5">
                        <TabletSmartphone className="h-12 w-12 text-sky-600" />
                      </div>
                    </div>
                    <h3 className="mt-4 text-xl font-bold text-sky-900">Bitte auf dem Terminal unterschreiben</h3>
                    <p className="mt-1 text-sm text-sky-700">
                      {selectedSigningDevice?.deviceName ?? "Signaturterminal"} · {selectedSigningSigner?.name ?? signingRequirements?.driverName ?? detail.driver.name}
                    </p>
                    {activeSigningSession?.expiresAt ? (
                      <p className="mt-1 text-xs text-sky-500">Session läuft · Abbruch um {new Date(activeSigningSession.expiresAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</p>
                    ) : null}
                    <div className="mt-5">
                      <Button type="button" variant="outline" disabled={signingBusy} onClick={() => void cancelActiveSigningSession()}>
                        Session abbrechen
                      </Button>
                    </div>
                  </div>
                ) : activeSigningSession?.status === "cancelled" || activeSigningSession?.status === "failed" ? (
                  /* Cancelled/failed notice */
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                    <div className="font-semibold">
                      {activeSigningSession.status === "cancelled" ? "Vorgang abgebrochen" : "Vorgang fehlgeschlagen"}
                    </div>
                    <div className="mt-1 text-xs text-amber-700">Du kannst einen neuen Vorgang starten.</div>
                  </div>
                ) : null}

                {signingRequirements ? (
                  <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-700">
                    <div className="font-semibold text-slate-900">Vorgang</div>
                    <div className="mt-1">{signingRequirements.driverName}</div>
                    {signingSignerOptions.length > 1 ? (
                      <div className="mt-3">
                        <div className="mb-1 text-xs font-semibold uppercase text-slate-500">Unterzeichner</div>
                        <Select
                          value={selectedSigningSigner?.personId ?? ""}
                          disabled={Boolean(activeSigningSession && signingInProgress)}
                          onValueChange={(value) => {
                            setSigningSignerPersonId(value);
                            setSigningPrechecks(emptySigningPrechecks());
                            setGuardianName("");
                            setGuardianRelationship("");
                          }}
                        >
                          <SelectTrigger className="h-12 bg-white">
                            <SelectValue placeholder="Unterzeichner auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {signingSignerOptions.map((signer) => (
                              <SelectItem key={signer.personId || signer.role} value={signer.personId}>
                                {signer.label}: {signer.name}{signer.signed ? ` · unterschrieben ${signer.signedAt ? formatTimestamp(signer.signedAt) : ""}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedSigningSigner?.role === "codriver" ? (
                          <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                            Beifahrer unterschreiben in einem eigenen Vorgang. Diese Unterschrift ersetzt nicht die Fahrer-Unterschrift.
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-1 text-xs">
                      Haftverzicht: {signingRequirements.contract.locale} · Version {signingRequirements.contract.version} · Hash {signingRequirements.contract.textHash}
                    </div>
                    <div className="mt-3 grid gap-2">
                      {signingRequirementEntries.length > 0 ? (
                        signingRequirementEntries.map((entry) => (
                          <div key={entry.id} className="rounded border bg-white p-2">
                            <div className="font-medium text-slate-900">{entry.className} · Startnummer {entry.startNumber ?? "-"}</div>
                            <div className="text-xs text-slate-500">Beifahrer: {entry.codriver ? `${entry.codriver.firstName} ${entry.codriver.lastName}` : "-"}</div>
                            <div className="mt-1 text-xs text-slate-600">
                              {(entry.vehicles ?? []).map((vehicle) => `${vehicle.role === "backup" ? "Ersatz" : "Fahrzeug"}: ${vehicle.make} ${vehicle.model}`).join(" · ") || "Fahrzeugdaten werden am iPad aus dem Backend-Kontext geladen."}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded border bg-white p-2">
                          <div className="font-medium text-slate-900">{detail.classLabel} · Startnummer {detail.startNumber || "-"}</div>
                          <div className="text-xs text-slate-500">Beifahrer: {detail.codriver.assigned ? `${detail.codriver.firstName} ${detail.codriver.lastName}` : "-"}</div>
                          <div className="mt-1 text-xs text-slate-600">
                            Fahrzeug: {detail.vehicle.make} {detail.vehicle.model}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {signingRequirements && !activeSigningSession ? (
                  <div className="rounded-md border bg-white p-3">
                    <div className="text-sm font-semibold text-slate-900">Vorprüfung im Nennungstool</div>
                    <div className="mt-3 grid gap-2">
                      {([
                        ["identityCheckedAt", "Identität/Ausweis geprüft"],
                        ["signerPresentAt", signingNeedsGuardian ? "Unterzeichnende Person ist anwesend" : selectedSigningSigner?.role === "codriver" ? "Beifahrer ist persönlich anwesend" : "Fahrer ist persönlich anwesend"],
                        ...(signingRequiresMedicalCertificate ? [["medicalCertificateCheckedAt", "Ärztliches Attest geprüft"]] : []),
                        ...(signingNeedsGuardian
                          ? [
                              ["guardianPresentAt", "Erziehungsberechtigter ist anwesend"],
                              ["guardianAuthorityCheckedAt", "Berechtigung des Erziehungsberechtigten plausibel geprüft"]
                            ]
                          : [])
                      ] as Array<[keyof SigningPrecheckTimestamps, string]>).map(([key, label]) => {
                        const checked = Boolean(signingPrechecks[key]);
                        return (
                          <button
                            key={key}
                            type="button"
                            className={cn(
                              "flex min-h-16 w-full cursor-pointer items-center justify-between rounded-lg border-2 px-4 text-left transition",
                              checked
                                ? "border-emerald-400 bg-emerald-50"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            )}
                            onClick={() => toggleSigningPrecheck(key)}
                          >
                            <span className={cn("text-sm font-medium", checked ? "text-emerald-900" : "text-slate-900")}>{label}</span>
                            <span className={cn(
                              "ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition",
                              checked
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-slate-300 bg-white text-transparent"
                            )}>
                              <CheckCircle2 className="h-4 w-4" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {signingNeedsGuardian ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <input
                          className="h-12 rounded-md border border-slate-300 px-3 text-sm"
                          value={guardianName}
                          onChange={(event) => setGuardianName(event.target.value)}
                          placeholder="Name Erziehungsberechtigter"
                        />
                        <input
                          className="h-12 rounded-md border border-slate-300 px-3 text-sm"
                          value={guardianRelationship}
                          onChange={(event) => setGuardianRelationship(event.target.value)}
                          placeholder="Beziehung zum Fahrer"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {connectedSigningDevices.length === 0 ? (
                  <div className="space-y-4">
                    {pairingCode ? (
                      <div className="rounded-md border border-sky-200 bg-sky-50 p-4">
                        <div className="text-sm font-semibold text-sky-800">Pairing-Code</div>
                        <div className="mt-2 font-mono text-4xl font-bold tracking-widest text-sky-950">{pairingCode.code}</div>
                        <div className="mt-2 text-sm text-sky-700">Gültig bis {new Date(pairingCode.expiresAt).toLocaleTimeString("de-DE")}</div>
                        <div className="mt-3 flex items-center gap-2 text-sm text-sky-800">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Warte auf Gerät…
                        </div>
                      </div>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button type="button" className="h-16 text-base" disabled={signingBusy} onClick={() => void createPairingCode()}>
                        {signingBusy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <TabletSmartphone className="mr-2 h-5 w-5" />}
                        Gerät koppeln
                      </Button>
                      <Button type="button" variant="outline" className="h-16 text-base" disabled={signingBusy} onClick={() => void loadSigningDevices()}>
                        Geräte aktualisieren
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Select value={signingDeviceId || selectedSigningDeviceId || "__none__"} disabled={Boolean(activeSigningSession && signingInProgress)} onValueChange={(value) => setSigningDeviceId(value === "__none__" ? "" : value)}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Signaturgerät auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Signaturgerät auswählen</SelectItem>
                        {connectedSigningDevices.map((device) => (
                          <SelectItem key={device.id} value={device.id}>
                            {device.deviceName ?? "Signaturterminal"}{isSigningDeviceOnline(device) ? "" : " (nicht aktiv)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="rounded-md border bg-slate-50 p-3">
                      <div className="text-sm font-semibold text-slate-900">Gekoppelte Geräte</div>
                      <div className="mt-2 grid gap-2">
                        {connectedSigningDevices.map((device) => (
                          <div key={device.id} className="flex items-center justify-between gap-3 rounded-md border bg-white px-3 py-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-900">{device.deviceName ?? "Signaturterminal"}</div>
                              <div className={cn("text-xs", isSigningDeviceOnline(device) ? "text-emerald-700" : "text-amber-700")}>
                                {isSigningDeviceOnline(device) ? "Aktiv" : "Nicht aktiv"} · zuletzt gesehen: {device.lastSeenAt ? formatTimestamp(device.lastSeenAt) : "-"}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-10 shrink-0"
                              disabled={signingBusy || signingInProgress}
                              onClick={() => void revokeSigningDevice(device.id)}
                            >
                              Entkoppeln
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {!activeSigningSession || activeSigningSession.status === "cancelled" || activeSigningSession.status === "failed" ? (
                      <>
                        <Button
                          type="button"
                          className="h-16 w-full text-base"
                          disabled={signingBusy || !selectedSigningSigner || !selectedSigningDeviceId || !selectedSigningDeviceOnline || !signingPrechecksComplete}
                          onClick={() => void startSigningOnDevice()}
                        >
                          {signingBusy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <TabletSmartphone className="mr-2 h-5 w-5" />}
                          Haftverzicht am Gerät starten
                        </Button>
                        {!selectedSigningDeviceOnline ? (
                          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                            Das ausgewählte Terminal meldet sich gerade nicht. Öffne das Terminal auf dem iPad und tippe danach auf „Geräte aktualisieren“.
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
