import { useEffect, useMemo, useState } from "react";
import { Newspaper, RefreshCcw, Sparkles } from "lucide-react";
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
import { adminMetaService, type AdminClassOption } from "@/services/admin-meta.service";
import { ApiError } from "@/services/api/http-client";
import { aiCommunicationService } from "@/services/ai-communication.service";
import type { AiEventReportEnvelope, AiEventReportRequest, AiReportFormat, AiReportLength, AiReportTone, AiTaskStatus } from "@/types/ai-communication";

const initialForm: AiEventReportRequest = {
  eventId: "",
  scope: "event",
  formats: ["website", "short_summary"],
  tone: "neutral",
  length: "medium",
  highlights: []
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

export function AdminAiReportGeneratorPage() {
  const [event, setEvent] = useState<{ id: string; name: string } | null>(null);
  const [classOptions, setClassOptions] = useState<AdminClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<AiEventReportRequest>(initialForm);
  const [highlightsInput, setHighlightsInput] = useState("");
  const [result, setResult] = useState<AiEventReportEnvelope | null>(null);
  const [status, setStatus] = useState<AiTaskStatus>("idle");
  const [error, setError] = useState("");
  const [activeFormat, setActiveFormat] = useState<AiReportFormat>("website");

  useEffect(() => {
    Promise.all([adminMetaService.getCurrentEvent(), adminMetaService.listClassOptions()])
      .then(([currentEvent, nextClassOptions]) => {
        setEvent(currentEvent);
        setClassOptions(nextClassOptions);
        setForm((current) => ({
          ...current,
          eventId: currentEvent.id,
          classId: undefined
        }));
        setLoadError("");
      })
      .catch((loadErrorValue) => {
        setLoadError(toUiErrorMessage(loadErrorValue, "Der Bericht-Kontext"));
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedClass = useMemo(() => classOptions.find((item) => item.id === form.classId) ?? null, [classOptions, form.classId]);
  const activeVariant = result?.result.variants.find((item) => item.format === activeFormat) ?? result?.result.variants[0] ?? null;

  const handleGenerate = async () => {
    setStatus("loading");
    setError("");

    try {
      const response = await aiCommunicationService.generateReport({
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
      setError(toUiErrorMessage(generationError, "Die Berichtsgenerierung"));
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
      title="Event-Bericht"
      description="Prüfbarer Textentwurf für die aktuelle Event-Kommunikation. Varianten, Warnungen, Review und Quellenbasis bleiben klar voneinander getrennt."
      actions={
        <Button
          type="button"
          variant="outline"
          className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20"
          onClick={() => void handleGenerate()}
          disabled={!form.eventId || status === "loading"}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Bericht generieren
        </Button>
      }
    >
      <AiNotice title="Quellenbasierte Textassistenz">
        Der Bericht wird für das aktuell aktive Admin-Event erzeugt. Die Ausgabe ist ein prüfbarer Entwurf und keine automatische Veröffentlichung.
      </AiNotice>

      {loading ? <LoadingState label="Lade Event- und Klassenkontext..." /> : null}
      {!loading && loadError ? <ErrorState message={loadError} /> : null}

      {!loading && !loadError ? (
        <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
          <Card className="rounded-2xl border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">Eingaben und Fokus</CardTitle>
              <CardDescription>Generierung für das aktuelle Event mit optionalem Klassenfokus und mehreren Textformaten.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                    <Newspaper className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Aktuelles Event</div>
                    <div className="mt-2 text-base font-medium text-slate-950">{event?.name || "—"}</div>
                    <div className="mt-2 text-sm text-slate-600">Das aktive Admin-Event wird automatisch als Kontextquelle verwendet.</div>
                  </div>
                </div>
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
                        classId: next === "class" ? classOptions[0]?.id : undefined
                      }))
                    }
                  >
                    <SelectTrigger className="rounded-full">
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
                    disabled={form.scope !== "class"}
                  >
                    <SelectTrigger className="rounded-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Keine Klasse</SelectItem>
                      {classOptions.map((classOption) => (
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
                    <SelectTrigger className="rounded-full">
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
                    <SelectTrigger className="rounded-full">
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
                          className="rounded-full"
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
                  placeholder="Je Zeile ein Highlight oder Schwerpunkt"
                  onChange={(event) => setHighlightsInput(event.target.value)}
                />
              </div>

              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Aktueller Fokus</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-slate-300 bg-white text-slate-600">
                    Event: {event?.name || "—"}
                  </Badge>
                  <Badge variant="outline" className="border-slate-300 bg-white text-slate-600">
                    Scope: {form.scope}
                  </Badge>
                  {selectedClass ? (
                    <Badge variant="outline" className="border-slate-300 bg-white text-slate-600">
                      Klasse: {selectedClass.name}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200">
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1.5">
                <CardTitle className="text-lg">Generierter Bericht</CardTitle>
                <CardDescription>Varianten, Warnungen, Review und Basis bleiben getrennt lesbar.</CardDescription>
              </div>
              <Button type="button" variant="outline" className="rounded-full" onClick={() => void handleGenerate()} disabled={!form.eventId || status === "loading"}>
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
                      <Button
                        key={variant.format}
                        type="button"
                        variant={activeFormat === variant.format ? "default" : "outline"}
                        className="rounded-full"
                        onClick={() => setActiveFormat(variant.format)}
                      >
                        {variant.format}
                      </Button>
                    ))}
                  </div>

                  {activeVariant ? (
                    <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{activeVariant.format}</div>
                      {activeVariant.title ? <div className="mt-2 text-base font-semibold text-slate-950">{activeVariant.title}</div> : null}
                      {activeVariant.teaser ? <div className="mt-2 text-sm text-slate-600">{activeVariant.teaser}</div> : null}
                      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-800">{activeVariant.text}</p>
                    </div>
                  ) : null}

                  <AiWarningsPanel warnings={result.warnings} title="Hinweise zur Verwendung" />
                  <AiReviewPanel review={result.review} />

                  <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Basis</div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <div className="space-y-2 text-sm text-slate-700">
                        <div className="rounded-xl bg-white px-3 py-2">Scope: {result.basis.scope}</div>
                        <div className="rounded-xl bg-white px-3 py-2">Event: {result.basis.event.name || "—"}</div>
                        <div className="rounded-xl bg-white px-3 py-2">Klasse: {result.basis.class?.name || "—"}</div>
                      </div>
                      <div className="space-y-2 text-sm text-slate-700">
                        <div className="rounded-xl bg-white px-3 py-2">Entries: {result.basis.facts.entriesTotal}</div>
                        <div className="rounded-xl bg-white px-3 py-2">Accepted: {result.basis.facts.acceptedTotal}</div>
                        <div className="rounded-xl bg-white px-3 py-2">Paid: {result.basis.facts.paidTotal}</div>
                      </div>
                    </div>
                    {result.basis.highlights.length ? (
                      <div className="mt-3 grid gap-2">
                        {result.basis.highlights.map((highlight) => (
                          <div key={highlight} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                            {highlight}
                          </div>
                        ))}
                      </div>
                    ) : null}
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
