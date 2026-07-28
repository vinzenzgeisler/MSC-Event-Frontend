import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Car,
  CheckCircle2,
  ChevronDown,
  Loader2,
  LogOut,
  RotateCcw,
  Search,
  ShieldCheck,
  XCircle
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/app/auth/auth-context";
import { InspectionQrScanner } from "@/components/features/inspection/inspection-qr-scanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { technicalInspectionService, type InspectionContext, type InspectionEntry, type InspectionHistoryItem, type InspectionListItem } from "@/services/technical-inspection.service";
import type { TechStatus } from "@/types/common";

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

const motorSummary = (vehicle: {
  cylinders: number | null;
  displacementCcm: number | null;
  engineType: string | null;
}) =>
  [
    vehicle.cylinders ? `${vehicle.cylinders} Zylinder` : null,
    vehicle.displacementCcm ? `${vehicle.displacementCcm.toLocaleString("de-DE")} ccm` : null,
    vehicle.engineType || null
  ]
    .filter(Boolean)
    .join(" – ") || "Keine Motordaten";

export function AdminTechnicalInspectionPage() {
  const { entryId } = useParams();
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
  const [saving, setSaving] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

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
        setNotes({
          primary: items.find((item) => item.target === "primary")?.note ?? "",
          backup: items.find((item) => item.target === "backup")?.note ?? ""
        });
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

  const searchEntries = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setSearched(true);
    try {
      const entries = await technicalInspectionService.search(query.trim());
      setResults(entries);
      if (entries.length === 1) navigate(`/inspection/${entries[0].id}`);
    } catch (searchError) {
      setError(messageFromError(searchError));
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (techStatus: TechStatus) => {
    if (!detail || saving) return;
    const note = notes[activeTarget];
    if (techStatus === "failed" && !note.trim()) {
      setError("Bei einer Ablehnung ist eine Notiz erforderlich.");
      return;
    }
    setSaving(`${activeTarget}:${techStatus}`);
    setError("");
    setSuccess("");
    try {
      await technicalInspectionService.update(detail.id, techStatus, note, activeTarget);
      const [updated, updatedHistory] = await Promise.all([
        technicalInspectionService.getEntry(detail.id),
        technicalInspectionService.getHistory(detail.id)
      ]);
      setDetail(updated);
      setHistory(updatedHistory);
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

  const openScannedEntry = useCallback(
    (scannedEntryId: string) => {
      setScannerOpen(false);
      navigate(`/inspection/${scannedEntryId}`);
    },
    [navigate]
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <div className="flex items-center gap-2 font-semibold text-slate-950">
              <ShieldCheck className="h-5 w-5" />
              Technische Abnahme
            </div>
            <div className="text-xs text-slate-500">{context?.event.name ?? "Veranstaltung wird geladen"}</div>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Abmelden
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-4 lg:p-6">
        <Card>
          <CardContent className="pt-5">
            <form className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2" onSubmit={searchEntries}>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Startnummer, Name oder Orga-Code"
                autoComplete="off"
                aria-label="Nennung suchen"
                className="h-11 rounded-xl border-slate-300 bg-slate-50 px-3 text-sm shadow-inner placeholder:text-xs focus-visible:bg-white sm:placeholder:text-sm"
              />
              <Button type="submit" className="h-11 rounded-xl px-4" disabled={loading || !query.trim()}>
                {loading && !entryId ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
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

        {entryId && (
          <Button type="button" variant="ghost" onClick={() => navigate("/inspection")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Andere Nennung
          </Button>
        )}

        {loading && entryId && (
          <Card><CardContent className="flex justify-center gap-2 py-16 text-slate-600"><Loader2 className="h-5 w-5 animate-spin" />Nennung wird geladen</CardContent></Card>
        )}

        {!entryId && results.length > 0 && (
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
        )}

        {searched && !loading && !entryId && results.length === 0 && (
          <Card><CardContent className="py-10 text-center text-slate-600">Keine angenommene Nennung gefunden.</CardContent></Card>
        )}

        {!loading && detail && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-slate-50">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Startnummer</div>
                    <div className="text-5xl font-bold leading-none">#{detail.startNumber ?? "–"}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge className={`${statusClasses[detail.techStatus]} px-3 py-1.5 text-sm`}>
                      Fahrzeug: {statusLabels[detail.techStatus]}
                    </Badge>
                    {detail.backupVehicle && (
                      <Badge className={`${statusClasses[detail.backupTechStatus]} px-3 py-1 text-xs`}>
                        Ersatz: {statusLabels[detail.backupTechStatus]}
                      </Badge>
                    )}
                  </div>
                </div>
                <CardTitle className="pt-3 text-2xl">{detail.driverFirstName} {detail.driverLastName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setActiveTarget("primary")}
                    className={`rounded-xl border p-4 text-left transition ${activeTarget === "primary" ? "border-slate-800 bg-slate-50 ring-2 ring-slate-200" : "bg-white hover:border-slate-400"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 font-semibold"><Car className="h-4 w-4" />Fahrzeug</div>
                      <Badge className={statusClasses[detail.techStatus]}>{statusLabels[detail.techStatus]}</Badge>
                    </div>
                    <div className="mt-3 text-lg font-semibold">{detail.vehicleMake ?? "–"} {detail.vehicleModel ?? ""}</div>
                    <div className="text-sm text-slate-600">{detail.vehicleYear ?? "Baujahr unbekannt"} – {detail.vehicleType}</div>
                    <div className="mt-2 border-t pt-2 text-sm text-slate-700">{motorSummary(detail)}</div>
                  </button>

                  {detail.backupVehicle ? (
                    <button
                      type="button"
                      onClick={() => setActiveTarget("backup")}
                      className={`rounded-xl border p-4 text-left transition ${activeTarget === "backup" ? "border-slate-800 bg-slate-50 ring-2 ring-slate-200" : "bg-white hover:border-slate-400"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 font-semibold"><Car className="h-4 w-4" />Ersatzfahrzeug</div>
                        <Badge className={statusClasses[detail.backupTechStatus]}>{statusLabels[detail.backupTechStatus]}</Badge>
                      </div>
                      <div className="mt-3 text-lg font-semibold">{detail.backupVehicle.make ?? "–"} {detail.backupVehicle.model ?? ""}</div>
                      <div className="text-sm text-slate-600">{detail.backupVehicle.year ?? "Baujahr unbekannt"} – {detail.backupVehicle.vehicleType}</div>
                      <div className="mt-2 border-t pt-2 text-sm text-slate-700">{motorSummary(detail.backupVehicle)}</div>
                    </button>
                  ) : (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-slate-500">
                      Kein Ersatzfahrzeug für diese Nennung hinterlegt.
                    </div>
                  )}
                </div>

                <div className="grid gap-3 rounded-lg border bg-slate-50 p-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Klasse</div>
                    <div className="font-semibold">{detail.className}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">Orga-Code</div>
                    <div className="font-semibold">{detail.orgaCode || "–"}</div>
                  </div>
                </div>

                {detail.codriver && (
                  <details className="group rounded-lg border bg-white">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold">
                      Beifahrer: {detail.codriver.firstName} {detail.codriver.lastName}
                      <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                    </summary>
                    <div className="grid gap-3 border-t px-4 py-3 text-sm sm:grid-cols-2">
                      <div><span className="text-slate-500">Geburtsdatum:</span> {detail.codriver.birthdate ? new Date(detail.codriver.birthdate).toLocaleDateString("de-DE") : "–"}</div>
                      <div><span className="text-slate-500">Land:</span> {detail.codriver.country || "–"}</div>
                    </div>
                  </details>
                )}

                <div>
                  <label htmlFor="inspection-note" className="mb-2 block text-sm font-semibold">
                    Notiz für {activeTarget === "backup" ? "Ersatzfahrzeug" : "Fahrzeug"}
                  </label>
                  <textarea
                    id="inspection-note"
                    value={notes[activeTarget]}
                    onChange={(event) => setNotes((current) => ({ ...current, [activeTarget]: event.target.value }))}
                    maxLength={2000}
                    rows={4}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
                    placeholder="Bei Ablehnung verpflichtend"
                  />
                  <div className="mt-1 text-right text-xs text-slate-500">{notes[activeTarget].length}/2000</div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button type="button" className="h-20 bg-emerald-600 text-lg hover:bg-emerald-700" disabled={Boolean(saving)} onClick={() => void updateStatus("passed")}>
                    {saving === `${activeTarget}:passed` ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <CheckCircle2 className="mr-2 h-6 w-6" />}Abnahme bestätigen
                  </Button>
                  <Button type="button" variant="destructive" className="h-20 text-lg" disabled={Boolean(saving) || !notes[activeTarget].trim()} onClick={() => void updateStatus("failed")}>
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
                  <div key={item.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Badge className={statusClasses[item.status]}>{statusLabels[item.status]}</Badge>
                      <span className="text-xs font-medium text-slate-500">{item.target === "backup" ? "Ersatzfahrzeug" : "Fahrzeug"}</span>
                    </div>
                    <div className="mt-2 text-slate-700">{item.note || "Keine Notiz"}</div>
                    <div className="mt-2 text-xs text-slate-500">{item.inspectorEmail || item.inspectorUserId} · {formatDateTime(item.createdAt)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {success && <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-emerald-700 px-5 py-3 font-medium text-white shadow-lg">{success}</div>}
        {error && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</div>}
      </main>
      <InspectionQrScanner open={scannerOpen} onClose={closeScanner} onEntryDetected={openScannedEntry} />
    </div>
  );
}
