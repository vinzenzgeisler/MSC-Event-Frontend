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
import type { AiEventOption, AiEventReportEnvelope, AiEventReportRequest, AiReportFormat, AiReportLength, AiReportTone, AiTaskStatus } from "@/types/ai-communication";

const initialForm: AiEventReportRequest = {
  eventId: "",
  scope: "event",
  formats: ["website", "short_summary"],
  tone: "neutral",
  length: "medium",
  highlights: []
};

export function AdminAiReportGeneratorPage() {
  const [events, setEvents] = useState<AiEventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<AiEventReportRequest>(initialForm);
  const [highlightsInput, setHighlightsInput] = useState(
    "Enges Finish im Hauptlauf\nViele Zuschauer entlang der Boxengasse\nPositives Feedback zur Fahrerlagerführung"
  );
  const [result, setResult] = useState<AiEventReportEnvelope | null>(null);
  const [status, setStatus] = useState<AiTaskStatus>("idle");
  const [error, setError] = useState("");
  const [activeFormat, setActiveFormat] = useState<AiReportFormat>("website");

  useEffect(() => {
    aiCommunicationMockService
      .listEvents()
      .then((response) => {
        setEvents(response);
        const firstEvent = response[0];
        setForm((current) => ({
          ...current,
          eventId: firstEvent?.id ?? "",
          scope: "event",
          classId: undefined
        }));
      })
      .catch((loadEventsError) => {
        setLoadError(loadEventsError instanceof Error ? loadEventsError.message : "Eventdaten konnten nicht geladen werden.");
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedEvent = useMemo(() => events.find((item) => item.id === form.eventId) ?? null, [events, form.eventId]);
  const availableClasses = selectedEvent?.classes ?? [];
  const activeVariant = result?.result.variants.find((item) => item.format === activeFormat) ?? result?.result.variants[0] ?? null;

  const handleGenerate = async () => {
    setStatus("loading");
    setError("");

    try {
      const response = await aiCommunicationMockService.generateReport({
        ...form,
        highlights: highlightsInput
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean)
      });
      setResult(response);
      setActiveFormat(response.result.variants[0]?.format ?? "website");
      setStatus("success");
    } catch (generationError) {
      setResult(null);
      setStatus("error");
      setError(generationError instanceof Error ? generationError.message : "Bericht konnte nicht erzeugt werden.");
    }
  };

  const toneOptions: Array<{ value: AiReportTone; label: string }> = [
    { value: "neutral", label: "Sachlich" },
    { value: "friendly", label: "Freundlich" },
    { value: "formal", label: "Formell" }
  ];
  const lengthOptions: Array<{ value: AiReportLength; label: string }> = [
    { value: "short", label: "Kurz" },
    { value: "medium", label: "Mittel" },
    { value: "long", label: "Ausführlich" }
  ];

  return (
    <AiCommunicationShell
      title="Event-Bericht-Generator"
      description="Die Seite bleibt vorläufig mock-basiert, ist aber bereits auf den späteren Request/Response-Contract ausgerichtet: `formats[]`, `result.variants[]`, `basis`, `warnings`, `review`, `meta`."
      actions={
        <Button
          type="button"
          variant="outline"
          className="border-white/20 bg-white/10 text-white hover:bg-white/20"
          onClick={() => void handleGenerate()}
          disabled={!form.eventId || status === "loading"}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Entwurf generieren
        </Button>
      }
    >
      <AiNotice title="Vorläufiger Integrationsmodus">
        Die Generierung bleibt bewusst auf Demo-Daten, bis zusätzliche Read-Endpunkte oder verbindliche Auswahlquellen für Event- und Klassenkontext vorliegen. Das Rendering folgt aber schon dem Backend-Contract.
      </AiNotice>

      {loading ? <LoadingState label="Lade Demo-Eventdaten..." /> : null}
      {!loading && loadError ? <ErrorState message={loadError} /> : null}

      {!loading && !loadError ? (
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Eingaben und Kontext</CardTitle>
              <CardDescription>Contract-nahe Eingaben für `POST /admin/ai/reports/generate`.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Event</Label>
                <Select
                  value={form.eventId}
                  onValueChange={(next) => {
                    setForm((current) => ({
                      ...current,
                      eventId: next,
                      classId: undefined,
                      scope: "event"
                    }));
                    setResult(null);
                    setStatus("idle");
                    setError("");
                  }}
                >
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
                  <Label>Scope</Label>
                  <Select
                    value={form.scope}
                    onValueChange={(next) =>
                      setForm((current) => ({
                        ...current,
                        scope: next as AiEventReportRequest["scope"],
                        classId: next === "class" ? availableClasses[0]?.id : undefined
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="event">Gesamtes Event</SelectItem>
                      <SelectItem value="class">Klasse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Klasse</Label>
                  <Select
                    value={form.classId ?? "__none__"}
                    onValueChange={(next) => setForm((current) => ({ ...current, classId: next === "__none__" ? undefined : next }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Keine Klasse</SelectItem>
                      {availableClasses.map((classOption) => (
                        <SelectItem key={classOption.id} value={classOption.id}>
                          {classOption.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>Tonalität</Label>
                  <Select value={form.tone ?? "neutral"} onValueChange={(next) => setForm((current) => ({ ...current, tone: next as AiReportTone }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {toneOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Länge</Label>
                  <Select value={form.length ?? "medium"} onValueChange={(next) => setForm((current) => ({ ...current, length: next as AiReportLength }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {lengthOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Formate</Label>
                  <div className="flex flex-wrap gap-2">
                    {(["website", "short_summary"] as AiReportFormat[]).map((format) => {
                      const selected = form.formats.includes(format);
                      return (
                        <Button
                          key={format}
                          type="button"
                          variant={selected ? "default" : "outline"}
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              formats: selected
                                ? current.formats.length === 1
                                  ? current.formats
                                  : current.formats.filter((item) => item !== format)
                                : [...current.formats, format].slice(0, 2)
                            }))
                          }
                        >
                          {format}
                        </Button>
                      );
                    })}
                  </div>
                </div>
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
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Mock-Kontext</div>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {(selectedEvent?.contextFacts ?? []).map((fact) => (
                    <li key={fact} className="rounded-md bg-white px-3 py-2">
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1.5">
                <CardTitle>Generierter Bericht</CardTitle>
                <CardDescription>Contract-nahes Mock-Ergebnis mit `result.variants[]` und sichtbarer `basis`.</CardDescription>
              </div>
              <Button type="button" variant="outline" onClick={() => void handleGenerate()} disabled={!form.eventId || status === "loading"}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Neu erzeugen
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {status === "idle" ? <EmptyState message="Noch kein Bericht erzeugt. Links Eingaben setzen und Generierung starten." /> : null}
              {status === "loading" ? <LoadingState label="Erstelle Berichtsentwurf..." /> : null}
              {status === "error" ? <ErrorState message={error} /> : null}

              {status === "success" && result ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {result.result.variants.map((variant) => (
                      <Button key={variant.format} type="button" variant={activeFormat === variant.format ? "default" : "outline"} onClick={() => setActiveFormat(variant.format)}>
                        {variant.format}
                      </Button>
                    ))}
                  </div>

                  {activeVariant ? (
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{activeVariant.format}</div>
                      {activeVariant.title ? <div className="mt-2 text-base font-semibold text-slate-900">{activeVariant.title}</div> : null}
                      {activeVariant.teaser ? <div className="mt-2 text-sm text-slate-600">{activeVariant.teaser}</div> : null}
                      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-800">{activeVariant.text}</p>
                    </div>
                  ) : null}

                  <AiWarningsPanel warnings={result.warnings} title="Hinweise zur Verwendung" />
                  <AiReviewPanel review={result.review} />

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Basis</div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <div className="space-y-2 text-sm text-slate-700">
                        <div className="rounded-md bg-white px-3 py-2">Scope: {result.basis.scope}</div>
                        <div className="rounded-md bg-white px-3 py-2">Event: {result.basis.event.name || "—"}</div>
                        <div className="rounded-md bg-white px-3 py-2">Klasse: {result.basis.class?.name || "—"}</div>
                      </div>
                      <div className="space-y-2 text-sm text-slate-700">
                        <div className="rounded-md bg-white px-3 py-2">Entries: {result.basis.facts.entriesTotal}</div>
                        <div className="rounded-md bg-white px-3 py-2">Accepted: {result.basis.facts.acceptedTotal}</div>
                        <div className="rounded-md bg-white px-3 py-2">Paid: {result.basis.facts.paidTotal}</div>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-slate-700">
                      {result.basis.highlights.map((highlight) => (
                        <li key={highlight} className="rounded-md bg-white px-3 py-2">
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <AiMetaPanel meta={result.meta} />
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </AiCommunicationShell>
  );
}
