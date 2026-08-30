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
  // Scanner instance lives across open/close cycles; destroyed only on unmount.
  const scannerRef = useRef<QrScannerType | null>(null);
  // Whether the scanner has been created at least once (lazy init on first open).
  const initializedRef = useRef(false);
  const onEntryDetectedRef = useRef(onEntryDetected);
  const scanTimeoutRef = useRef<number | null>(null);
  const scanPendingRef = useRef(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [invalidCode, setInvalidCode] = useState(false);
  const [scanSuccessful, setScanSuccessful] = useState(false);

  // Keep callback ref current without re-triggering effects.
  onEntryDetectedRef.current = onEntryDetected;

  // Unmount-only cleanup: destroy scanner instance.
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current !== null) window.clearTimeout(scanTimeoutRef.current);
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, []);

  // Keyboard + body-scroll handling while open.
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

  // Core scanner lifecycle: lazy-init on first open, start/stop on subsequent opens/closes.
  // Initialising only when open=true guarantees the <video> element is visible (not display:none)
  // so QrScanner can measure its dimensions — which prevents the blank-camera bug on iOS.
  useEffect(() => {
    // Reset per-session state on every open/close transition.
    setInvalidCode(false);
    setScanSuccessful(false);
    scanPendingRef.current = false;

    if (!open) {
      // Closing: stop stream without destroying the instance so iOS keeps the permission grant.
      scannerRef.current?.stop();
      return;
    }

    // Opening: if already initialised, just start.
    if (initializedRef.current && scannerRef.current) {
      setError("");
      void scannerRef.current
        .start()
        .catch((startError: unknown) => setError(cameraErrorMessage(startError)));
      return;
    }

    // First open: create scanner now that the video element is visible.
    if (!videoRef.current) return;

    initializedRef.current = true;
    let active = true;
    setStarting(true);
    setError("");

    void import("qr-scanner")
      .then(async ({ default: QrScanner }) => {
        if (!active || !videoRef.current) return;

        const hasCamera = await QrScanner.hasCamera();
        if (!hasCamera) throw new DOMException("No camera", "NotFoundError");

        const scanner = new QrScanner(
          videoRef.current,
          (result) => {
            if (!active || scanPendingRef.current) return;
            const entryId = inspectionEntryIdFromQrPayload(result.data);
            if (!entryId) {
              setInvalidCode(true);
              return;
            }
            scanPendingRef.current = true;
            setScanSuccessful(true);
            scanner.stop();
            // Brief green flash before navigating away.
            scanTimeoutRef.current = window.setTimeout(() => {
              scanTimeoutRef.current = null;
              onEntryDetectedRef.current(entryId);
            }, 400);
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
        if (active) await scanner.start();
      })
      .catch((startError: unknown) => {
        if (active) {
          setError(cameraErrorMessage(startError));
          // Allow re-init on next open if initialisation failed.
          initializedRef.current = false;
        }
      })
      .finally(() => {
        if (active) setStarting(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  const retryScanner = async () => {
    const scanner = scannerRef.current;
    if (!scanner) {
      // Not yet initialised; reset so next open triggers fresh init.
      initializedRef.current = false;
      setError("");
      return;
    }
    setStarting(true);
    setError("");
    scanner.stop();
    try {
      await scanner.start();
    } catch (startError) {
      setError(cameraErrorMessage(startError));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end bg-slate-950/75 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"
      style={{ display: open ? undefined : "none" }}
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
          {/*
            The <video> element must always be in the DOM (never conditionally rendered).
            We use CSS visibility instead of display:none here to ensure the element has
            proper layout dimensions when QrScanner initialises on first open.
            The outer wrapper already hides the entire dialog via display:none when !open.
          */}
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
          />
          {scanSuccessful && (
            <div className="absolute inset-0 bg-emerald-400/70" aria-hidden="true" />
          )}
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
              <Button type="button" variant="secondary" onClick={() => void retryScanner()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Erneut versuchen
              </Button>
            </div>
          )}
        </div>

        <div className="min-h-14 px-4 py-3 text-center text-sm text-slate-600" aria-live="polite">
          {invalidCode
            ? "Dieser QR-Code gehört nicht zu einer technischen Abnahme."
            : "Die Nennung öffnet sich nach dem Scan automatisch."}
        </div>
      </div>
    </div>
  );
}
