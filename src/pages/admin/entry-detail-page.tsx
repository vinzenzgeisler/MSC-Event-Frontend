import { useEffect, useState, type ReactNode } from "react";
import { Bike, Car, CheckCircle2, Clock3, Download, Loader2, Mail, Trash2, Wallet } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  acceptanceStatusClasses,
  acceptanceStatusLabel,
  checkinClasses,
  checkinLabel,
  paymentStatusClasses,
  paymentStatusLabel
} from "@/lib/admin-status";
import { adminEntriesService } from "@/services/admin-entries.service";
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
  const canSendMail = hasPermission(roles, "communication.write");
  const canChangeClass = hasPermission(roles, "entries.status.write");
  const { entryId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof adminEntriesService.getEntryDetail>>>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [status, setStatus] = useState<"pending" | "shortlist" | "accepted" | "rejected">("accepted");
  const [paid, setPaid] = useState(false);
  const [checkinDone, setCheckinDone] = useState(false);
  const [confirmationMailSent, setConfirmationMailSent] = useState(false);
  const [confirmationMailVerified, setConfirmationMailVerified] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [previewImage, setPreviewImage] = useState<{ url: string; label: string } | null>(null);
  const [internalNote, setInternalNote] = useState("");
  const [driverNote, setDriverNote] = useState("");
  const [includeDriverNoteOnAccept, setIncludeDriverNoteOnAccept] = useState(true);
  const [includeDriverNoteOnReject, setIncludeDriverNoteOnReject] = useState(true);
  const [pendingAcceptConfirm, setPendingAcceptConfirm] = useState(false);
  const [pendingRejectConfirm, setPendingRejectConfirm] = useState(false);
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
  const [classChangeIncludeBackup, setClassChangeIncludeBackup] = useState(true);

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

  const loadDetail = () => {
    adminEntriesService
      .getEntryDetail(entryId)
      .then((result) => {
        setDetail(result);
        setHasLoadedOnce(true);
        if (result) {
          setStatus(result.status);
          setPaid(result.payment.status === "paid");
          setCheckinDone(result.checkinVerified);
          setConfirmationMailSent(result.confirmationMailSent);
          setConfirmationMailVerified(result.confirmationMailVerified);
          setInternalNote(result.internalNote);
          setDriverNote(result.driverNote);
          setHistoryExpanded(false);
          setClassDraft(result.classId);
          setClassChangeIncludeBackup(Boolean(result.backupVehicle.assigned));
        }
      })
      .catch((error) => {
        flashMessage(getApiErrorMessage(error, "Nennung konnte nicht geladen werden."), 3000);
        setDetail(null);
        setHasLoadedOnce(true);
      });
  };

  const handleDocumentDownload = async (type: "waiver" | "tech_check", label: string, actionKey: string) => {
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

  const paymentState = paid ? "paid" : "due";
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
    actionInFlight === "status-shortlist" || actionInFlight === "status-accepted" || actionInFlight === "status-rejected";
  const actionOutlineClass = "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100";
  const actionActiveClass = "border-primary bg-primary text-primary-foreground hover:bg-primary/90";
  const statusDisabledReason = (target: "pending" | "shortlist" | "accepted" | "rejected") => {
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

  return (
    <div className="w-full max-w-[1120px] space-y-4 overflow-x-hidden">
      <div className="sticky top-[57px] z-20 -mx-2 space-y-3 border-b border-slate-200 bg-slate-100/95 px-2 pb-3 pt-1 backdrop-blur md:top-0 md:-mx-3 md:px-3">
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const state = location.state as { fromEntriesList?: boolean; scrollY?: number; loadedCount?: number } | null;
              if (state?.fromEntriesList) {
                navigate(-1);
                return;
              }
              navigate(`/admin/entries${location.search}`, { state: { restoreEntriesScrollY: 0 } });
            }}
          >
            Zurück zu Nennungen
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold text-slate-900">
              {detail.headline}
              {detail.orgaCode ? ` · ${detail.orgaCode}` : ""}
            </h1>
            <p className="break-words text-sm text-slate-600">
              {detail.classLabel} · Startnummer {detail.startNumber}
            </p>
            <p className="break-words text-xs text-slate-500">
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
            <Badge className={`${paymentStatusClasses(paymentState)} h-6 px-2.5 text-xs`} variant="outline">
              Zahlung: {paymentStatusLabel(paymentState)}
            </Badge>
            {status === "accepted" ? (
              <Badge className={`${checkinClasses(checkinDone)} h-6 px-2.5 text-xs`} variant="outline">
                Check-in: {checkinLabel(checkinDone)}
              </Badge>
            ) : (
              <Badge className="h-6 border-slate-200 bg-slate-100 px-2.5 text-xs text-slate-600" variant="outline">
                Check-in: Noch nicht relevant
              </Badge>
            )}
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
        <div className="order-1 min-w-0 space-y-4 lg:order-1">
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
                  <div className="font-medium text-slate-900">{detail.vehicle.type === "moto" ? "Motorrad" : "Auto"}</div>
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
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-xl border p-4",
                    paymentState === "paid"
                      ? "border-emerald-200 bg-emerald-50/70"
                      : "border-amber-200 bg-amber-50/70"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full",
                      paymentState === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}
                  >
                    {paymentState === "paid" ? <CheckCircle2 className="h-6 w-6" /> : <Clock3 className="h-6 w-6" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Zahlungsstatus</div>
                    <div className="mt-0.5 text-lg font-semibold text-slate-900">
                      {paymentState === "paid" ? "Bezahlt" : "Offen"}
                    </div>
                    <div className="text-sm text-slate-600">
                      {paymentState === "paid"
                        ? "Zahlungseingang wurde bestätigt."
                        : "Zahlungseingang wurde noch nicht bestätigt."}
                    </div>
                  </div>
                  <Badge className={`${paymentStatusClasses(paymentState)} h-7 shrink-0 px-2.5 text-xs`} variant="outline">
                    {paymentStatusLabel(paymentState)}
                  </Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border bg-slate-50 p-3">
                    <div className="text-xs uppercase text-slate-500">Nennungsbetrag</div>
                    <div className="mt-1 font-semibold text-slate-900">{euroDisplayFromCents(detail.payment.totalCents)}</div>
                  </div>
                  <div className="rounded-md border bg-slate-50 p-3">
                    <div className="text-xs uppercase text-slate-500">Bereits bezahlt</div>
                    <div className="mt-1 font-semibold text-slate-900">{euroDisplayFromCents(detail.payment.paidAmountCents)}</div>
                  </div>
                  <div className="rounded-md border bg-slate-50 p-3">
                    <div className="text-xs uppercase text-slate-500">Offen</div>
                    <div className="mt-1 font-semibold text-slate-900">{euroDisplayFromCents(detail.payment.amountOpenCents)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Dokumente & Einwilligung</CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 space-y-3 break-words text-sm text-slate-700">
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

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Historie</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 space-y-3 break-words text-sm text-slate-700">
              {historyItems.map((item) => (
                <div key={item.id} className="rounded border p-3">
                  <div className="mb-1 font-medium">{item.action}</div>
                  <div className="break-words">{item.details}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {new Date(item.timestamp).toLocaleString("de-DE")} · {item.actor}
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

        <div className="order-2 w-full min-w-0 space-y-4 lg:order-2 lg:sticky lg:top-28 lg:w-[340px] lg:justify-self-end lg:self-start">
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
                        : paymentState === "paid"
                          ? "Bei bezahlter Nennung keine Zahlungserinnerung nötig."
                          : sendingPaymentReminder
                            ? "Zahlungserinnerung wird gerade eingeplant."
                            : undefined
                    }
                    onClick={async () => {
                      if (sendingPaymentReminder) {
                        return;
                      }
                      if (paymentState === "paid") {
                        flashMessage("Für bezahlte Nennungen wird keine Zahlungserinnerung versendet.");
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
                  variant={paid ? "default" : "outline"}
                  className={paid ? actionActiveClass : actionOutlineClass}
                  disabledReason={anyActionInFlight ? "Aktion wird verarbeitet…" : status !== "accepted" ? "Zahlung kann erst nach Zulassung bestätigt werden." : undefined}
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
                      setPaymentTotalInput(euroInputFromCents(detail.payment.totalCents));
                      setPaymentPaidInput(euroInputFromCents(detail.payment.paidAmountCents));
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
                    void handleDocumentDownload("waiver", "Haftverzicht", "download-waiver");
                  }}
                >
                  {actionInFlight === "download-waiver" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {actionInFlight === "download-waiver" ? "Haftverzicht wird geladen…" : "PDF Haftverzicht"}
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
              {canNotesWrite && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={anyActionInFlight}
                  onClick={async () => {
                    await runAction(
                      "notes-save",
                      () => adminEntriesService.saveEntryNotes(detail.id, { internalNote, driverNote, status: detail.status }),
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
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={classChangeIncludeBackup}
                    onChange={(event) => setClassChangeIncludeBackup(event.target.checked)}
                    disabled={!canChangeClass || anyActionInFlight}
                  />
                  Auch Ersatzfahrzeug auf Zielklasse umstellen
                </label>
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
              <li>Bei Ü70 ärztliches Attest geprüft</li>
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

      {canPaymentWrite && pendingPaymentConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-4 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Zahlung als eingegangen markieren?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Diese Aktion bestätigt den Zahlungseingang für diese Nennung.
            </p>
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
            <p className="mt-2 text-sm text-slate-600">Werte in EUR eintragen, z. B. 89,00.</p>
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
    </div>
  );
}
