import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Car,
  CheckCircle2,
  ImageOff,
  Loader2,
  LogOut,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
  XCircle
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/app/auth/auth-context";
import { InspectionQrScanner, type InspectionQrTarget } from "@/components/features/inspection/inspection-qr-scanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getVehicleTypeLabel } from "@/lib/vehicle-type";
import {
  technicalInspectionService,
  type InspectionContext,
  type InspectionEntry,
  type InspectionHistoryItem,
  type InspectionListItem
} from "@/services/technical-inspection.service";
import type { TechStatus, VehicleType } from "@/types/common";

const statusLabels: Record<TechStatus, string> = {
  pending: "Offen",
  passed: "Abnahme bestätigt",
  failed: "Abnahme abgelehnt"
};

const statusClasses: Record<TechStatus, string> = {
  pending: "border-amber-300 bg-amber-50 text-amber-900",
  passed: "border-emerald-300 bg-emerald-50 text-emerald-900",
  failed: "border-red-300 bg-red-50 text-red-900"
};

const messageFromError = (error: unknown) =>
  error instanceof Error ? error.message : "Die technische Abnahme konnte nicht geladen werden.";

const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("de-DE") : "–";

type InspectionTarget = "primary" | "backup";
type VehiclePresentation = {
  vehicleType: VehicleType;
  make: string | null;
  model: string | null;
  year: number | null;
  displacementCcm: number | null;
  cylinders: number | null;
  imageUrl: string | null;
};

function VehicleChoice({
  label,
  vehicle,
  selected,
  onSelect
}: {
  label: string;
  vehicle: VehiclePresentation;
  selected: boolean;
  onSelect: () => void;
}) {
  const vehicleName = [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Fahrzeug ohne Modellangabe";
  const facts = [
    ["Typ", getVehicleTypeLabel(vehicle.vehicleType)],
    ["Baujahr", vehicle.year?.toString() ?? "–"],
    ["Zylinder", vehicle.cylinders?.toString() ?? "–"],
    ["Hubraum", vehicle.displacementCcm ? `${vehicle.displacementCcm.toLocaleString("de-DE")} ccm` : "–"]
  ];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`overflow-hidden rounded-2xl bg-white text-left shadow-sm transition ${
        selected ? "bg-slate-50 shadow-md" : "hover:bg-slate-50 hover:shadow-md"
      }`}
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
        {vehicle.imageUrl ? (
          <img
            src={vehicle.imageUrl}
            alt={`${label}: ${vehicleName}`}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
            <ImageOff className="h-8 w-8" />
            <span className="text-xs font-medium">Kein Fahrzeugbild vorhanden</span>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-slate-950/85 px-3 py-1 text-xs font-semibold text-white">
          {label}
        </span>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-lg font-bold text-slate-950">{vehicleName}</div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4">
          {facts.map(([factLabel, value]) => (
            <div key={factLabel} className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{factLabel}</dt>
              <dd className="mt-0.5 truncate text-sm font-semibold text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </button>
  );
}

export function AdminTechnicalInspectionPage() {
  const { entryId, eventId: participantEventId, personId } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [context, setContext] = useState<InspectionContext | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InspectionListItem[]>([]);
  const [detail, setDetail] = useState<InspectionEntry | null>(null);
  const [history, setHistory] = useState<InspectionHistoryItem[]>([]);
  const [notes, setNotes] = useState<Record<InspectionTarget, string>>({ primary: "", backup: "" });
  const [activeTarget, setActiveTarget] = useState<InspectionTarget>("primary");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [noteSaveState, setNoteSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [participantHeading, setParticipantHeading] = useState("");
  const [noteRequired, setNoteRequired] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showInstallBanner, setShowInstallBanner] = useState(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return false;
    return sessionStorage.getItem("install-banner-dismissed") !== "1";
  });
  const searchRequestRef = useRef(0);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSavedNotesRef = useRef<Record<InspectionTarget, string>>({ primary: "", backup: "" });
  const noteSaveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  useEffect(() => {
    let active = true;
    void technicalInspectionService
      .getContext()
      .then((result) => {
        if (active) setContext({ event: result.event });
      })
      .catch((loadError) => {
        if (active) setError(messageFromError(loadError));
      })
      .finally(() => {
        if (active && !entryId) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [entryId]);

  useEffect(() => {
    if (!participantEventId || !personId) return;
    let active = true;
    setLoading(true);
    setError("");
    void technicalInspectionService.getParticipant(participantEventId, personId)
      .then((participant) => {
        if (!active) return;
        setParticipantHeading(`${participant.driver.firstName} ${participant.driver.lastName} · ${participant.entries.length} Starts`);
        setResults(participant.entries.map((item) => ({
          id: item.id,
          startNumber: item.startNumber,
          driverFirstName: item.driverFirstName,
          driverLastName: item.driverLastName,
          className: item.className,
          vehicleMake: item.vehicleMake,
          vehicleModel: item.vehicleModel,
          techStatus: item.techStatus,
          backupVehicleId: item.backupVehicleId,
          backupTechStatus: item.backupTechStatus,
          techCheckedAt: item.techCheckedAt
        })));
        setSearched(true);
      })
      .catch((loadError) => active && setError(messageFromError(loadError)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [participantEventId, personId]);

  useEffect(() => {
    if (!entryId) {
      setDetail(null);
      setHistory([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    void Promise.all([
      technicalInspectionService.getEntry(entryId),
      technicalInspectionService.getHistory(entryId)
    ])
      .then(([entry, items]) => {
        if (!active) return;
        setDetail(entry);
        setHistory(items);
        const loadedNotes = {
          primary: entry.inspectionNote ?? "",
          backup: entry.backupInspectionNote ?? ""
        };
        setNotes(loadedNotes);
        lastSavedNotesRef.current = loadedNotes;
        setNoteSaveState("idle");
        setActiveTarget("primary");
      })
      .catch((loadError) => {
        if (active) setError(messageFromError(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [entryId]);

  const executeSearch = useCallback(async (searchQuery: string, openSingleResult = false) => {
    const normalizedQuery = searchQuery.trim();
    if (!normalizedQuery) {
      searchRequestRef.current += 1;
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    const requestId = ++searchRequestRef.current;
    setSearching(true);
    setError("");
    setSearched(true);
    try {
      const entries = await technicalInspectionService.search(normalizedQuery);
      if (requestId !== searchRequestRef.current) return;
      setResults(entries);
      if (openSingleResult && entries.length === 1) navigate(`/inspection/${entries[0].id}`);
    } catch (searchError) {
      if (requestId !== searchRequestRef.current) return;
      setError(messageFromError(searchError));
    } finally {
      if (requestId === searchRequestRef.current) setSearching(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (entryId || personId) return;
    const timeout = window.setTimeout(() => {
      void executeSearch(query);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [entryId, executeSearch, personId, query]);

  const searchEntries = (event: FormEvent) => {
    event.preventDefault();
    if (entryId) {
      navigate("/inspection");
      return;
    }
    void executeSearch(query, true);
  };

  const persistNotes = useCallback(
    async (targets: InspectionTarget[]) => {
      if (!detail || targets.length === 0) return;
      setNoteSaveState("saving");
      try {
        await Promise.all(
          targets.map(async (target) => {
            await technicalInspectionService.saveNote(detail.id, notes[target], target);
            lastSavedNotesRef.current[target] = notes[target];
          })
        );
        setNoteSaveState("saved");
      } catch (saveError) {
        setNoteSaveState("idle");
        setError(messageFromError(saveError));
      }
    },
    [detail, notes]
  );

  useEffect(() => {
    if (!detail) return;
    const changedTargets = (["primary", "backup"] as InspectionTarget[]).filter(
      (target) => notes[target] !== lastSavedNotesRef.current[target]
    );
    if (changedTargets.length === 0) return;

    setNoteSaveState("idle");
    noteSaveTimeoutRef.current = window.setTimeout(() => {
      noteSaveTimeoutRef.current = null;
      void persistNotes(changedTargets);
    }, 700);

    return () => {
      if (noteSaveTimeoutRef.current !== null) {
        window.clearTimeout(noteSaveTimeoutRef.current);
        noteSaveTimeoutRef.current = null;
      }
    };
  }, [detail, notes, persistNotes]);

  const updateStatus = async (techStatus: TechStatus) => {
    if (!detail || saving) return;
    const note = notes[activeTarget];
    if (techStatus === "failed" && !note.trim()) {
      setNoteRequired(true);
      noteTextareaRef.current?.focus();
      return;
    }
    setSaving(`${activeTarget}:${techStatus}`);
    setError("");
    setSuccess("");
    try {
      await technicalInspectionService.update(detail.id, techStatus, note, activeTarget);
      if (techStatus === "passed") navigator.vibrate?.(200);
      if (techStatus === "failed") navigator.vibrate?.([100, 50, 100]);
      const [updated, updatedHistory] = await Promise.all([
        technicalInspectionService.getEntry(detail.id),
        technicalInspectionService.getHistory(detail.id)
      ]);
      setDetail(updated);
      setHistory(updatedHistory);
      lastSavedNotesRef.current[activeTarget] = note;
      setSuccess(`${activeTarget === "backup" ? "Ersatzfahrzeug" : "Fahrzeug"}: ${statusLabels[techStatus]}`);
    } catch (saveError) {
      setError(messageFromError(saveError));
    } finally {
      setSaving(null);
    }
  };

  const closeScanner = useCallback(() => {
    setScannerOpen(false);
  }, []);

  const openScannedTarget = useCallback(
    (target: InspectionQrTarget) => {
      setScannerOpen(false);
      navigate(target.type === "entry" ? `/inspection/${target.entryId}` : `/inspection/participant/${target.eventId}/${target.personId}`);
    },
    [navigate]
  );

  const dismissInstallBanner = () => {
    sessionStorage.setItem("install-banner-dismissed", "1");
    setShowInstallBanner(false);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <div className="flex items-center gap-2 font-semibold text-slate-950">
              <ShieldCheck className="h-5 w-5" />
              Technische Abnahme
            </div>
            {context?.event.name && <div className="text-xs text-slate-500">{context.event.name}</div>}
          </div>
          <Button type="button" size="sm" variant="outline" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Abmelden
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4 lg:p-6">
        {showInstallBanner && (
          <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <span>
              <strong>Als App installieren:</strong> iOS: Teilen → „Zum Home-Bildschirm" · Android: Menü → „App installieren"
            </span>
            <button
              type="button"
              className="ml-4 font-medium text-blue-600 hover:text-blue-800"
              onClick={dismissInstallBanner}
              aria-label="Installationshinweis schließen"
            >
              ✕
            </button>
          </div>
        )}
        {isOffline && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Keine Internetverbindung – bitte Verbindung prüfen.
          </div>
        )}
        <Card>
          <CardContent className="pt-5">
            <form className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2" onSubmit={searchEntries}>
              <div className="relative">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Startnummer, Name oder Orga-Code"
                  autoComplete="off"
                  aria-label="Nennung suchen"
                  className="h-11 rounded-xl border-slate-300 bg-slate-50 px-3 pr-10 text-sm shadow-inner placeholder:text-xs focus-visible:bg-white sm:placeholder:text-sm"
                />
                {query.length > 0 && !entryId && (
                  <button
                    type="button"
                    className="absolute right-0 top-0 flex h-11 w-10 items-center justify-center rounded-r-xl text-slate-500 hover:text-slate-900"
                    onClick={() => {
                      setQuery("");
                      setResults([]);
                      setSearched(false);
                    }}
                    aria-label="Suche leeren"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button
                type="submit"
                className="h-11 rounded-xl px-4"
                disabled={searching || (!entryId && !query.trim())}
              >
                {searching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                <span className="ml-2 hidden sm:inline">Suchen</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl px-4"
                onClick={() => setScannerOpen(true)}
                aria-label="Abnahme-QR-Code scannen"
              >
                <Camera className="h-5 w-5" />
                <span className="ml-2 hidden md:inline">QR scannen</span>
              </Button>
            </form>
          </CardContent>
        </Card>

        {(entryId || personId) && (
          <Button type="button" variant="ghost" onClick={() => navigate("/inspection")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Andere Nennung
          </Button>
        )}

        {loading && entryId && (
          <Card><CardContent className="flex justify-center gap-2 py-16 text-slate-600"><Loader2 className="h-5 w-5 animate-spin" />Nennung wird geladen</CardContent></Card>
        )}

        {!entryId && results.length > 0 && (
          <div>
            {participantHeading ? <div className="mb-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 font-semibold text-teal-950">{participantHeading} · alle angenommenen Starts</div> : null}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {results.map((item) => (
              <button
                key={item.id}
                type="button"
                className="rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                onClick={() => navigate(`/inspection/${item.id}`)}
              >
                <div className="flex justify-between gap-3">
                  <div className="text-2xl font-bold">#{item.startNumber ?? "–"}</div>
                  <Badge className={statusClasses[item.techStatus]}>{statusLabels[item.techStatus]}</Badge>
                </div>
                <div className="mt-2 font-semibold">{item.driverFirstName} {item.driverLastName}</div>
                <div className="text-sm text-slate-600">{item.vehicleMake} {item.vehicleModel} · {item.className}</div>
                {item.backupVehicleId && (
                  <div className="mt-2 flex items-center justify-between border-t pt-2 text-xs text-slate-600">
                    <span>Ersatzfahrzeug</span>
                    <Badge className={statusClasses[item.backupTechStatus]}>{statusLabels[item.backupTechStatus]}</Badge>
                  </div>
                )}
              </button>
            ))}
            </div>
          </div>
        )}

        {searched && !searching && !entryId && results.length === 0 && (
          <Card><CardContent className="py-10 text-center text-slate-600">Keine angenommene Nennung gefunden.</CardContent></Card>
        )}

        {!loading && detail && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Startnummer</div>
                    <div className="text-5xl font-bold leading-none">#{detail.startNumber ?? "–"}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge className={`${statusClasses[detail.techStatus]} px-3 py-1.5 text-sm`}>
                      {statusLabels[detail.techStatus]}
                    </Badge>
                    {detail.backupVehicle && (
                      <Badge className={`${statusClasses[detail.backupTechStatus]} px-3 py-1 text-xs`}>
                        Ersatz: {statusLabels[detail.backupTechStatus]}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                <section aria-labelledby="driver-heading" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                  <div className="min-w-0">
                    <div id="driver-heading" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Fahrer
                    </div>
                    <div className="mt-1 text-xl font-bold text-slate-950">
                      {detail.driverFirstName} {detail.driverLastName}
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4">
                    <div>
                      <dt className="text-xs text-slate-500">Klasse</dt>
                      <dd className="font-semibold text-slate-900">{detail.className}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Orga-Code</dt>
                      <dd className="font-semibold text-slate-900">{detail.orgaCode || "–"}</dd>
                    </div>
                  </dl>
                  {(detail.driverEmail || detail.driverPhone) && (
                    <div className="mt-3 flex flex-wrap gap-4">
                      {detail.driverEmail && (
                        <a href={`mailto:${detail.driverEmail}`} className="text-sm text-blue-700 underline">
                          📧 {detail.driverEmail}
                        </a>
                      )}
                      {detail.driverPhone && (
                        <a href={`tel:${detail.driverPhone}`} className="text-sm text-blue-700 underline">
                          📞 {detail.driverPhone}
                        </a>
                      )}
                    </div>
                  )}
                  {detail.codriver && (
                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Beifahrer</div>
                      <div className="mt-1 font-semibold text-slate-900">
                        {detail.codriver.firstName} {detail.codriver.lastName}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {detail.codriver.birthdate
                          ? new Date(detail.codriver.birthdate).toLocaleDateString("de-DE")
                          : "Geburtsdatum unbekannt"}
                        {detail.codriver.country ? ` · ${detail.codriver.country}` : ""}
                      </div>
                    </div>
                  )}
                </section>

                <section aria-labelledby="vehicles-heading">
                  <div className="mb-3 flex items-center gap-2">
                    <Car className="h-5 w-5 text-slate-600" />
                    <h2 id="vehicles-heading" className="font-semibold text-slate-950">Fahrzeuge</h2>
                  </div>
                  <div className={`grid gap-4 ${detail.backupVehicle ? "md:grid-cols-2" : ""}`}>
                    <VehicleChoice
                      label="Fahrzeug"
                      vehicle={{
                        vehicleType: detail.vehicleType,
                        make: detail.vehicleMake,
                        model: detail.vehicleModel,
                        year: detail.vehicleYear,
                        displacementCcm: detail.displacementCcm,
                        cylinders: detail.cylinders,
                        imageUrl: detail.vehicleImageUrl
                      }}
                      selected={activeTarget === "primary"}
                      onSelect={() => setActiveTarget("primary")}
                    />
                    {detail.backupVehicle && (
                      <VehicleChoice
                        label="Ersatzfahrzeug"
                        vehicle={detail.backupVehicle}
                        selected={activeTarget === "backup"}
                        onSelect={() => setActiveTarget("backup")}
                      />
                    )}
                  </div>
                </section>

                <div>
                  <label htmlFor="inspection-note" className="mb-2 block text-sm font-semibold">
                    Prüfernotiz für {activeTarget === "backup" ? "Ersatzfahrzeug" : "Fahrzeug"}
                  </label>
                  <textarea
                    ref={noteTextareaRef}
                    id="inspection-note"
                    value={notes[activeTarget]}
                    onChange={(event) => {
                      setNotes((current) => ({ ...current, [activeTarget]: event.target.value }));
                      setNoteRequired(false);
                    }}
                    onBlur={() => {
                      if (noteSaveTimeoutRef.current !== null) {
                        window.clearTimeout(noteSaveTimeoutRef.current);
                        noteSaveTimeoutRef.current = null;
                      }
                      if (notes[activeTarget] !== lastSavedNotesRef.current[activeTarget]) {
                        void persistNotes([activeTarget]);
                      }
                    }}
                    maxLength={2000}
                    rows={4}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
                    placeholder="Notiz"
                  />
                  {noteRequired && (
                    <p className="mt-1 text-xs text-red-600">Bei einer Ablehnung ist eine Notiz erforderlich.</p>
                  )}
                  {noteSaveState !== "idle" && (
                    <div className="mt-1 text-right text-xs text-slate-500">
                      {noteSaveState === "saving" ? "Speichert…" : "Gespeichert"}
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button type="button" className="h-20 bg-emerald-600 text-lg hover:bg-emerald-700" disabled={Boolean(saving)} onClick={() => void updateStatus("passed")}>
                    {saving === `${activeTarget}:passed` ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <CheckCircle2 className="mr-2 h-6 w-6" />}Abnahme bestätigen
                  </Button>
                  <Button type="button" variant="destructive" className="h-20 text-lg" disabled={Boolean(saving)} onClick={() => void updateStatus("failed")}>
                    {saving === `${activeTarget}:failed` ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <XCircle className="mr-2 h-6 w-6" />}Abnahme ablehnen
                  </Button>
                </div>
                {(activeTarget === "primary" ? detail.techStatus : detail.backupTechStatus) !== "pending" && (
                  <Button type="button" variant="outline" className="h-12 w-full" disabled={Boolean(saving)} onClick={() => void updateStatus("pending")}>
                    <RotateCcw className="mr-2 h-4 w-4" />Auf offen zurücksetzen
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Verlauf</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {history.length === 0 && <div className="text-sm text-slate-500">Noch keine Entscheidung.</div>}
                {history.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge className={statusClasses[item.status]}>{statusLabels[item.status]}</Badge>
                      <span className="text-xs font-medium text-slate-500">{item.target === "backup" ? "Ersatzfahrzeug" : "Fahrzeug"}</span>
                    </div>
                    <div className="mt-2 rounded-md bg-slate-50 px-2.5 py-2 text-slate-700">{item.note || "Keine Notiz"}</div>
                    <div className="mt-2 flex flex-col gap-0.5 text-xs text-slate-500">
                      <span className="font-medium text-slate-600">
                        {item.inspectorDisplay || item.inspectorEmail || "Unbekannte Person"}
                      </span>
                      <time>{formatDateTime(item.createdAt)}</time>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {success && <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-emerald-700 px-5 py-3 font-medium text-white shadow-lg">{success}</div>}
        {error && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</div>}
      </main>
      <InspectionQrScanner open={scannerOpen} onClose={closeScanner} onTargetDetected={openScannedTarget} />
    </div>
  );
}
