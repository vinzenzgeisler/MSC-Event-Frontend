import { useEffect, useMemo, useState } from "react";
import { Copy, Mic2, RefreshCcw, Sparkles } from "lucide-react";
import { AiCommunicationShell, textareaClassName } from "@/components/features/admin/ai-communication/ai-communication-shell";
import { aiActiveOutlineButtonClass, aiPrimaryButtonClass } from "@/components/features/admin/ai-communication/ai-button-styles";
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
import { cn } from "@/lib/utils";
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

async function copyText(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    throw new Error("Clipboard API ist im Browser nicht verfügbar.");
  }
  await navigator.clipboard.writeText(value);
}

function InfoPill(props: { label: string; tone?: "neutral" | "warning" | "critical"; children: React.ReactNode }) {
  const toneClass =
    props.tone === "critical"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : props.tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-slate-200 bg-white text-slate-700";

  return (
    <div className="group relative inline-flex">
      <button type="button" className={cn("inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium", toneClass)}>
        {props.label}
      </button>
      <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-[320px] rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm leading-6 text-slate-700 shadow-xl group-hover:block group-focus-within:block">
        {props.children}
      </div>
    </div>
  );
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
  const [copyState, setCopyState] = useState("");

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
      actions={
        <Button
          type="button"
          variant="outline"
          className={aiPrimaryButtonClass}
          onClick={() => void handleGenerate()}
          disabled={!form.eventId || !focusId || status === "loading"}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Sprechertext generieren
        </Button>
      }
    >
      {loading ? <LoadingState label="Lade Event-, Klassen- und Entry-Kontext..." /> : null}
      {!loading && loadError ? <ErrorState message={loadError} /> : null}

      {!loading && !loadError ? (
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="rounded-3xl border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">Fokus und Eingaben</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
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
                    <SelectTrigger className="rounded-md">
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
                    <SelectTrigger className="rounded-md">
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
                  <SelectTrigger className="rounded-md">
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

              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70 p-4">
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
            <Card className="rounded-3xl border-slate-200">
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="space-y-1.5">
                  <CardTitle className="text-lg">Generierter Sprechertext</CardTitle>
                  {copyState ? <div className="text-xs text-slate-500">{copyState}</div> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" className="h-9 rounded-md" onClick={() => void handleGenerate()} disabled={!form.eventId || !focusId || status === "loading"}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Neu erzeugen
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-md"
                    disabled={!result?.result.text}
                    onClick={async () => {
                      if (!result?.result.text) return;
                      await copyText(result.result.text);
                      setCopyState("Text kopiert");
                      window.setTimeout(() => setCopyState(""), 1200);
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Kopieren
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {status === "idle" ? <EmptyState message="Noch kein Sprechertext vorhanden. Links Fokus setzen und Generierung starten." /> : null}
                {status === "loading" ? <LoadingState label="Erzeuge Sprechertext..." /> : null}
                {status === "error" ? <ErrorState message={error} /> : null}

                {status === "success" && result ? (
                  <>
                    <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Sprechertext</div>
                      <p className="mt-4 whitespace-pre-line text-sm leading-8 text-slate-800">{result.result.text}</p>
                    </div>

                    <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {result.review.required ? (
                          <InfoPill label="Menschliche Prüfung erforderlich" tone="critical">
                            <div>{result.review.reason || "Bitte Sprechertext vor der Live-Nutzung kurz redaktionell prüfen."}</div>
                          </InfoPill>
                        ) : null}
                        {result.warnings.length ? (
                          <InfoPill label={`Warnungen (${result.warnings.length})`} tone="warning">
                            <div className="space-y-3">
                              {result.warnings.map((warning) => (
                                <div key={`${warning.code}:${warning.message}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                                  <div className="font-medium text-slate-900">{warning.displayMessage || warning.message}</div>
                                  {warning.recommendation ? <div className="mt-2 text-slate-600">{warning.recommendation}</div> : null}
                                </div>
                              ))}
                            </div>
                          </InfoPill>
                        ) : null}
                        <details className="min-w-[220px] rounded-full border border-slate-200 bg-white">
                          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-slate-700">Basis-Kontext</summary>
                          <div className="border-t border-slate-200 p-4 text-sm text-slate-700">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
                                Fokus: {result.basis.focusType}
                              </Badge>
                              {Object.entries(result.basis.context).map(([key, value]) => (
                                <Badge key={key} variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
                                  {key}: {String(value ?? "—")}
                                </Badge>
                              ))}
                            </div>
                            <div className="mt-3 text-xs text-slate-500">
                              Modell {result.meta.modelId} · Prompt {result.meta.promptVersion}
                            </div>
                          </div>
                        </details>
                      </div>
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200">
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
                  <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
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
