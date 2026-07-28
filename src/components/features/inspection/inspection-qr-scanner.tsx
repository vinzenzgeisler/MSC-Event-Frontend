import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, RefreshCw, X } from "lucide-react";
import type QrScannerType from "qr-scanner";
import { Button } from "@/components/ui/button";

const ENTRY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function inspectionEntryIdFromQrPayload(payload: string): string | null {
  const value = payload.trim();
  if (ENTRY_ID_PATTERN.test(value)) {
    return value;
  }

  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin || url.search || url.hash) {
      return null;
    }
    const match = url.pathname.match(/^\/inspection\/([^/]+)\/?$/);
    const entryId = match ? decodeURIComponent(match[1]) : "";
    return ENTRY_ID_PATTERN.test(entryId) ? entryId : null;
  } catch {
    return null;
  }
}

type InspectionQrScannerProps = {
  open: boolean;
  onClose: () => void;
  onEntryDetected: (entryId: string) => void;
};

function cameraErrorMessage(error: unknown) {
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError")) {
    return "Der Kamerazugriff wurde abgelehnt. Bitte erlaube ihn in den Browser-Einstellungen.";
  }
  if (error instanceof DOMException && (error.name === "NotFoundError" || error.name === "DevicesNotFoundError")) {
    return "Auf diesem Gerät wurde keine Kamera gefunden.";
  }
  if (!window.isSecureContext) {
    return "Der QR-Scanner benötigt eine sichere HTTPS-Verbindung.";
  }
  return "Die Kamera konnte nicht gestartet werden. Bitte prüfe die Browser-Berechtigung.";
}

export function InspectionQrScanner({ open, onClose, onEntryDetected }: InspectionQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const scannerRef = useRef<QrScannerType | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [invalidCode, setInvalidCode] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open || !videoRef.current) return;

    let active = true;
    setStarting(true);
    setError("");
    setInvalidCode(false);

    let scanner: QrScannerType | null = null;

    void import("qr-scanner")
      .then(async ({ default: QrScanner }) => {
        if (!active || !videoRef.current) return;
        const hasCamera = await QrScanner.hasCamera();
        if (!hasCamera) throw new DOMException("No camera", "NotFoundError");

        scanner = new QrScanner(
          videoRef.current,
          (result) => {
            if (!active) return;
            const entryId = inspectionEntryIdFromQrPayload(result.data);
            if (!entryId) {
              setInvalidCode(true);
              return;
            }
            active = false;
            scanner?.stop();
            onEntryDetected(entryId);
          },
          {
            preferredCamera: "environment",
            maxScansPerSecond: 10,
            highlightScanRegion: true,
            highlightCodeOutline: true,
            returnDetailedScanResult: true
          }
        );
        scannerRef.current = scanner;
        await scanner.start();
      })
      .catch((startError) => {
        if (active) setError(cameraErrorMessage(startError));
      })
      .finally(() => {
        if (active) setStarting(false);
      });

    return () => {
      active = false;
      scanner?.destroy();
      if (scannerRef.current === scanner) scannerRef.current = null;
    };
  }, [attempt, onEntryDetected, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end bg-slate-950/75 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspection-scanner-title"
    >
      <div className="w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 id="inspection-scanner-title" className="text-lg font-semibold text-slate-950">
              Abnahme-QR scannen
            </h2>
            <p className="text-xs text-slate-500">QR-Code auf dem Nennungsblatt in den Rahmen halten</p>
          </div>
          <Button ref={closeButtonRef} type="button" size="sm" variant="ghost" onClick={onClose} aria-label="Scanner schließen">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="relative aspect-[4/5] max-h-[70vh] overflow-hidden bg-slate-950 sm:aspect-square">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-950 text-sm text-white">
              <Loader2 className="h-5 w-5 animate-spin" />
              Kamera wird gestartet
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950 px-8 text-center text-white">
              <Camera className="h-10 w-10 text-slate-400" />
              <p className="text-sm">{error}</p>
              <Button type="button" variant="secondary" onClick={() => setAttempt((value) => value + 1)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Erneut versuchen
              </Button>
            </div>
          )}
        </div>

        <div className="min-h-14 px-4 py-3 text-center text-sm text-slate-600" aria-live="polite">
          {invalidCode ? "Dieser QR-Code gehört nicht zu einer technischen Abnahme." : "Die Nennung öffnet sich nach dem Scan automatisch."}
        </div>
      </div>
    </div>
  );
}
