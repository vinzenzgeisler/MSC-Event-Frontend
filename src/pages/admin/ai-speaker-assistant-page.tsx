import { useEffect, useMemo, useState } from "react";
import { Mic2, RefreshCcw, Sparkles } from "lucide-react";
import { AiCommunicationShell, textareaClassName } from "@/components/features/admin/ai-communication/ai-communication-shell";
import { AiMetaPanel, AiReviewPanel, AiWarningsPanel } from "@/components/features/admin/ai-communication/ai-contract-panels";
import { AiNotice } from "@/components/features/admin/ai-communication/ai-notice";
import { EmptyState } from "@/components/state/empty-state";
import { ErrorState } from "@/components/state/error-state";
import { LoadingState } from "@/components/state/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminEntriesService } from "@/services/admin-entries.service";
import { adminMetaService, type AdminClassOption } from "@/services/admin-meta.service";
import { ApiError } from "@/services/api/http-client";
import { aiCommunicationService } from "@/services/ai-communication.service";
import type { AdminEntriesFilter, AdminEntryListItem } from "@/types/admin";
import type { AiSpeakerMode, AiSpeakerRequest, AiSpeakerTextEnvelope, AiTaskStatus } from "@/types/ai-communication";

const initialForm: AiSpeakerRequest = {
  eventId: "",
  mode: "driver_intro",
  highlights: []
};

const defaultEntryFilter: AdminEntriesFilter = {
  query: "",
  classId: "all",
  acceptanceStatus: "all",
  paymentStatus: "all",
  checkinIdVerified: "all",
  sortBy: "driverLastName",
  sortDir: "asc"
};

function toUiErrorMessage(error: unknown, label: string) {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return `${label} ist aktuell nicht freigegeben. Bitte Anmeldung und Berechtigungen prüfen.`;
    }
    if (error.status === 404) {
      return `${label} wurde nicht gefunden.`;
    }
    if (error.status === 503) {
      return `${label} ist aktuell backendseitig nicht verfügbar.`;
    }
    return error.message || `${label} konnte nicht geladen werden.`;
  }
  if (error instanceof Error) {
    if (error.message.trim().toLowerCase() === "failed to fetch") {
      return `${label} ist aktuell nicht erreichbar. Bitte API-URL, CORS und Login prüfen.`;
    }
    return error.message;
  }
  return `${label} konnte nicht geladen werden.`;
}

export function AdminAiSpeakerAssistantPage() {
  const [event, setEvent] = useState<{ id: string; name: string } | null>(null);
  const [drivers, setDrivers] = useState<AdminEntryListItem[]>([]);
  const [classOptions, setClassOptions] = useState<AdminClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [focusType, setFocusType] = useState<"entry" | "class">("entry");
  const [focusId, setFocusId] = useState("");
  const [highlightsInput, setHighlightsInput] = useState("");
  const [form, setForm] = useState<AiSpeakerRequest>(initialForm);
  const [result, setResult] = useState<AiSpeakerTextEnvelope | null>(null);
  const [status, setStatus] = useState<AiTaskStatus>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([adminMetaService.getCurrentEvent(), adminMetaService.listClassOptions(), adminEntriesService.listEntriesPage(defaultEntryFilter, { limit: 100 })])
      .then(([currentEvent, nextClassOptions, entryPage]) => {
        setEvent(currentEvent);
        setClassOptions(nextClassOptions);
        setDrivers(entryPage.entries);
        const firstDriver = entryPage.entries[0];
        setForm({
          eventId: currentEvent.id,
          entryId: firstDriver?.id ?? "",
          mode: "driver_intro",
          highlights: []
        });
        setFocusId(firstDriver?.id ?? nextClassOptions[0]?.id ?? "");
        setLoadError("");
      })
      .catch((loadDataError) => {
        setLoadError(toUiErrorMessage(loadDataError, "Der Sprecher-Kontext"));
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedDriver = useMemo(() => drivers.find((item) => item.id === focusId) ?? null, [drivers, focusId]);
  const selectedClass = useMemo(() => classOptions.find((item) => item.id === focusId) ?? null, [classOptions, focusId]);

  const modeOptions: Array<{ value: AiSpeakerMode; label: string }> = [
    { value: "short_intro", label: "Kurzansage" },
    { value: "driver_intro", label: "Fahrervorstellung" },
    { value: "class_overview", label: "Klassenüberblick" }
  ];

  const handleFocusTypeChange = (nextFocusType: "entry" | "class") => {
    setFocusType(nextFocusType);
    const nextEntryId = drivers[0]?.id ?? "";
    const nextClassId = classOptions[0]?.id ?? "";
    setFocusId(nextFocusType === "entry" ? nextEntryId : nextClassId);
    setForm((current) => ({
      ...current,
      entryId: nextFocusType === "entry" ? nextEntryId : undefined,
      classId: nextFocusType === "class" ? nextClassId : undefined
    }));
    setResult(null);
    setStatus("idle");
    setError("");
  };

  const handleGenerate = async () => {
    setStatus("loading");
    setError("");

    try {
      const response = await aiCommunicationService.generateSpeakerText({
        ...form,
        entryId: focusType === "entry" ? focusId || undefined : undefined,
        classId: focusType === "class" ? focusId || undefined : undefined,
        highlights: highlightsInput
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean)
      });
      setResult(response);
      setStatus("success");
    } catch (generationError) {
      setResult(null);
      setStatus("error");
      setError(toUiErrorMessage(generationError, "Die Sprechertext-Generierung"));
    }
  };

  return (
    <AiCommunicationShell
      title="Sprecherassistenz"
      description="Moderationsnahe Textassistenz für Fahrer- oder Klassenfokus. Auch hier bleiben Fakten, Warnungen, Review und Kontext transparent sichtbar."
      actions={
        <Button
          type="button"
          variant="outline"
          className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20"
          onClick={() => void handleGenerate()}
          disabled={!form.eventId || !focusId || status === "loading"}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Sprechertext generieren
        </Button>
      }
    >
      <AiNotice title="Live-Kontext statt Demo-Daten">
        Die Auswahl basiert auf dem aktuellen Admin-Event sowie vorhandenen Klassen und Entries. Der Text bleibt ein Entwurf für die redaktionelle Prüfung vor der Moderation.
      </AiNotice>

      {loading ? <LoadingState label="Lade Event-, Klassen- und Entry-Kontext..." /> : null}
      {!loading && loadError ? <ErrorState message={loadError} /> : null}

      {!loading && !loadError ? (
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="rounded-2xl border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">Fokus und Eingaben</CardTitle>
              <CardDescription>Reale Auswahlquellen für die spätere Live-Moderation mit bewusst sichtbarer Kontextbasis.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                    <Mic2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Aktuelles Event</div>
                    <div className="mt-2 text-base font-medium text-slate-950">{event?.name || "—"}</div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Fokus</Label>
                  <Select value={focusType} onValueChange={(next) => handleFocusTypeChange(next as "entry" | "class")}>
                    <SelectTrigger className="rounded-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entry">Entry / Fahrer</SelectItem>
                      <SelectItem value="class">Klasse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{focusType === "entry" ? "Entry auswählen" : "Klasse auswählen"}</Label>
                  <Select
                    value={focusId}
                    onValueChange={(next) => {
                      setFocusId(next);
                      setForm((current) => ({
                        ...current,
                        entryId: focusType === "entry" ? next : undefined,
                        classId: focusType === "class" ? next : undefined
                      }));
                    }}
                  >
                    <SelectTrigger className="rounded-full">
                      <SelectValue placeholder="Auswahl treffen" />
                    </SelectTrigger>
                    <SelectContent>
                      {focusType === "entry"
                        ? drivers.map((driver) => (
                            <SelectItem key={driver.id} value={driver.id}>
                              {driver.name}
                            </SelectItem>
                          ))
                        : classOptions.map((classOption) => (
                            <SelectItem key={classOption.id} value={classOption.id}>
                              {classOption.name}
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Modus</Label>
                <Select value={form.mode} onValueChange={(next) => setForm((current) => ({ ...current, mode: next as AiSpeakerMode }))}>
                  <SelectTrigger className="rounded-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Highlights</Label>
                <textarea
                  className={textareaClassName}
                  value={highlightsInput}
                  placeholder="Je Zeile ein Highlight oder eine gewünschte Setzung"
                  onChange={(event) => setHighlightsInput(event.target.value)}
                />
              </div>

              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Aktuelle Auswahlbasis</div>
                {focusType === "entry" && selectedDriver ? (
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <div className="rounded-xl bg-white px-3 py-2">{selectedDriver.name}</div>
                    <div className="rounded-xl bg-white px-3 py-2">{selectedDriver.vehicleLabel || "Fahrzeug nicht hinterlegt"}</div>
                    <div className="rounded-xl bg-white px-3 py-2">Startnummer {selectedDriver.startNumber || "—"}</div>
                    <div className="rounded-xl bg-white px-3 py-2">Klasse {selectedDriver.classLabel || "—"}</div>
                  </div>
                ) : null}
                {focusType === "class" && selectedClass ? (
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <div className="rounded-xl bg-white px-3 py-2">{selectedClass.name}</div>
                    <div className="rounded-xl bg-white px-3 py-2">{event?.name ?? "Kein Event"}</div>
                    <div className="rounded-xl bg-white px-3 py-2">{drivers.filter((item) => item.classId === selectedClass.id).length} Entries in dieser Klasse</div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="rounded-2xl border-slate-200">
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="space-y-1.5">
                  <CardTitle className="text-lg">Generierter Sprechertext</CardTitle>
                  <CardDescription>Direkt aus dem Live-Contract gerendert mit sichtbaren Fakten- und Review-Blöcken.</CardDescription>
                </div>
                <Button type="button" variant="outline" className="rounded-full" onClick={() => void handleGenerate()} disabled={!form.eventId || !focusId || status === "loading"}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Neu erzeugen
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {status === "idle" ? <EmptyState message="Noch kein Sprechertext vorhanden. Links Fokus setzen und Generierung starten." /> : null}
                {status === "loading" ? <LoadingState label="Erzeuge Sprechertext..." /> : null}
                {status === "error" ? <ErrorState message={error} /> : null}

                {status === "success" && result ? (
                  <>
                    <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Sprechertext</div>
                      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-800">{result.result.text}</p>
                    </div>

                    <AiWarningsPanel warnings={result.warnings} title="Vor Live-Nutzung prüfen" />
                    <AiReviewPanel review={result.review} />

                    <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Basis-Kontext</div>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        <div className="rounded-xl bg-white px-3 py-2">Fokus: {result.basis.focusType}</div>
                        {Object.entries(result.basis.context).map(([key, value]) => (
                          <div key={key} className="rounded-xl bg-white px-3 py-2">
                            {key}: {String(value ?? "—")}
                          </div>
                        ))}
                      </div>
                    </div>

                    <AiMetaPanel meta={result.meta} />
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg">Faktenansicht</CardTitle>
                <CardDescription>Die Seite rendert direkt `result.facts` und die gesetzten Highlights aus dem Backend-Contract.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {result?.result.facts.length ? (
                  result.result.facts.map((fact) => (
                    <div key={fact} className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-900">
                      {fact}
                    </div>
                  ))
                ) : (
                  <EmptyState message="Fakten erscheinen nach der Generierung parallel zum Sprechertext." />
                )}

                {result?.basis.highlights.length ? (
                  <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Highlights</div>
                    <div className="mt-3 grid gap-2">
                      {result.basis.highlights.map((fact) => (
                        <div key={fact} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          {fact}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {focusType === "entry" && selectedDriver ? (
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-600">
                      Fahrer: {selectedDriver.name}
                    </Badge>
                    <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-600">
                      Startnummer: {selectedDriver.startNumber || "—"}
                    </Badge>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </AiCommunicationShell>
  );
}
