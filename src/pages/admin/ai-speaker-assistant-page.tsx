import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, Sparkles } from "lucide-react";
import { AiCommunicationShell, textareaClassName } from "@/components/features/admin/ai-communication/ai-communication-shell";
import { AiMetaPanel, AiReviewPanel, AiWarningsPanel } from "@/components/features/admin/ai-communication/ai-contract-panels";
import { AiNotice } from "@/components/features/admin/ai-communication/ai-notice";
import { EmptyState } from "@/components/state/empty-state";
import { ErrorState } from "@/components/state/error-state";
import { LoadingState } from "@/components/state/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aiCommunicationMockService } from "@/services/ai-communication-mock.service";
import type { AiDriverOption, AiEventOption, AiSpeakerMode, AiSpeakerRequest, AiSpeakerTextEnvelope, AiTaskStatus } from "@/types/ai-communication";

const initialForm: AiSpeakerRequest = {
  eventId: "",
  mode: "driver_intro",
  highlights: []
};

export function AdminAiSpeakerAssistantPage() {
  const [events, setEvents] = useState<AiEventOption[]>([]);
  const [drivers, setDrivers] = useState<AiDriverOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [focusType, setFocusType] = useState<"entry" | "class">("entry");
  const [focusId, setFocusId] = useState("");
  const [highlightsInput, setHighlightsInput] = useState("Erstmals in dieser Klasse\nHistorische BMW\nPublikum reagiert stark");
  const [form, setForm] = useState<AiSpeakerRequest>(initialForm);
  const [result, setResult] = useState<AiSpeakerTextEnvelope | null>(null);
  const [status, setStatus] = useState<AiTaskStatus>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([aiCommunicationMockService.listEvents(), aiCommunicationMockService.listDrivers()])
      .then(([nextEvents, nextDrivers]) => {
        setEvents(nextEvents);
        setDrivers(nextDrivers);
        const firstEvent = nextEvents[0];
        const firstDriver = nextDrivers.find((item) => item.eventId === firstEvent?.id);
        setForm({
          eventId: firstEvent?.id ?? "",
          entryId: firstDriver?.entryId ?? "",
          mode: "driver_intro",
          highlights: []
        });
        setFocusId(firstDriver?.entryId ?? "");
      })
      .catch((loadDataError) => {
        setLoadError(loadDataError instanceof Error ? loadDataError.message : "Sprecherdaten konnten nicht geladen werden.");
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedEvent = useMemo(() => events.find((item) => item.id === form.eventId) ?? null, [events, form.eventId]);
  const driverOptions = useMemo(() => drivers.filter((item) => item.eventId === form.eventId), [drivers, form.eventId]);
  const classOptions = selectedEvent?.classes ?? [];
  const selectedDriver = driverOptions.find((item) => item.entryId === focusId) ?? null;
  const selectedClass = classOptions.find((item) => item.id === focusId) ?? null;

  const modeOptions: Array<{ value: AiSpeakerMode; label: string }> = [
    { value: "short_intro", label: "Kurzansage" },
    { value: "driver_intro", label: "Fahrervorstellung" },
    { value: "class_overview", label: "Klassenüberblick" }
  ];

  const handleEventChange = (nextEventId: string) => {
    const nextDriver = drivers.find((item) => item.eventId === nextEventId);
    const nextClass = events.find((item) => item.id === nextEventId)?.classes[0];
    setForm((current) => ({
      ...current,
      eventId: nextEventId,
      entryId: focusType === "entry" ? nextDriver?.entryId ?? "" : undefined,
      classId: focusType === "class" ? nextClass?.id : undefined
    }));
    setFocusId(focusType === "entry" ? nextDriver?.entryId ?? "" : nextClass?.id ?? "");
    setResult(null);
    setStatus("idle");
    setError("");
  };

  const handleFocusTypeChange = (nextFocusType: "entry" | "class") => {
    setFocusType(nextFocusType);
    const nextEntryId = driverOptions[0]?.entryId ?? "";
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
      const response = await aiCommunicationMockService.generateSpeakerText({
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
      setError(generationError instanceof Error ? generationError.message : "Sprechertext konnte nicht erzeugt werden.");
    }
  };

  return (
    <AiCommunicationShell
      title="Sprecherassistenz"
      description="Die UI bleibt vorerst mock-basiert, folgt aber bereits dem Zielcontract für `POST /admin/ai/speaker/generate`: `result.text`, `result.facts`, `basis.context`, `warnings`, `review`, `meta`."
      actions={
        <Button
          type="button"
          variant="outline"
          className="border-white/20 bg-white/10 text-white hover:bg-white/20"
          onClick={() => void handleGenerate()}
          disabled={!form.eventId || !focusId || status === "loading"}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Sprechertext generieren
        </Button>
      }
    >
      <AiNotice title="Vorläufiger Integrationsmodus">
        Für reale `entryId`-/`classId`-Auswahl fehlen noch verbindliche Read-Quellen. Die Seite bleibt deshalb klickbar mit Demo-Daten, rendert aber bereits die finale Contract-Struktur.
      </AiNotice>

      {loading ? <LoadingState label="Lade Demo-Event- und Entry-Daten..." /> : null}
      {!loading && loadError ? <ErrorState message={loadError} /> : null}

      {!loading && !loadError ? (
        <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Fokus und Eingaben</CardTitle>
              <CardDescription>Contract-nahe Eingaben für den späteren Speaker-Generate-Flow.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Event</Label>
                <Select value={form.eventId} onValueChange={handleEventChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Event auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Fokus</Label>
                  <Select value={focusType} onValueChange={(next) => handleFocusTypeChange(next as "entry" | "class")}>
                    <SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Auswahl treffen" />
                    </SelectTrigger>
                    <SelectContent>
                      {focusType === "entry"
                        ? driverOptions.map((driver) => (
                            <SelectItem key={driver.entryId} value={driver.entryId}>
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
                  <SelectTrigger>
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
                  placeholder="Je Zeile ein Highlight"
                  onChange={(event) => setHighlightsInput(event.target.value)}
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Aktuelle Auswahlbasis</div>
                {focusType === "entry" && selectedDriver ? (
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <div className="rounded-md bg-white px-3 py-2">{selectedDriver.name}</div>
                    <div className="rounded-md bg-white px-3 py-2">{selectedDriver.vehicleLabel}</div>
                    <div className="rounded-md bg-white px-3 py-2">Startnummer {selectedDriver.startNumber}</div>
                  </div>
                ) : null}
                {focusType === "class" && selectedClass ? (
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <div className="rounded-md bg-white px-3 py-2">{selectedClass.name}</div>
                    <div className="rounded-md bg-white px-3 py-2">{selectedEvent?.name ?? "Kein Event"}</div>
                    <div className="rounded-md bg-white px-3 py-2">{selectedEvent?.stageLabel ?? "Kein Status"}</div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-slate-200">
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="space-y-1.5">
                  <CardTitle>Generierter Sprechertext</CardTitle>
                  <CardDescription>Contract-nahes Mock-Ergebnis mit `result.text` und `result.facts`.</CardDescription>
                </div>
                <Button type="button" variant="outline" onClick={() => void handleGenerate()} disabled={!form.eventId || !focusId || status === "loading"}>
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
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Sprechertext</div>
                      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-800">{result.result.text}</p>
                    </div>

                    <AiWarningsPanel warnings={result.warnings} title="Vor Live-Nutzung prüfen" />
                    <AiReviewPanel review={result.review} />

                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Basis-Kontext</div>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        <div className="rounded-md bg-white px-3 py-2">FocusType: {result.basis.focusType}</div>
                        {Object.entries(result.basis.context).map(([key, value]) => (
                          <div key={key} className="rounded-md bg-white px-3 py-2">
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

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Faktenansicht</CardTitle>
                <CardDescription>Die Seite rendert direkt `result.facts` aus dem Contract-Zielbild.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {result?.result.facts.length ? (
                  result.result.facts.map((fact) => (
                    <div key={fact} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-900">
                      {fact}
                    </div>
                  ))
                ) : (
                  <EmptyState message="Fakten erscheinen nach der Generierung parallel zum Sprechertext." />
                )}

                {result?.basis.highlights.length ? (
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Highlights</div>
                    <ul className="mt-3 space-y-2 text-sm text-slate-700">
                      {result.basis.highlights.map((fact) => (
                        <li key={fact} className="rounded-md bg-slate-50 px-3 py-2">
                          {fact}
                        </li>
                      ))}
                    </ul>
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
