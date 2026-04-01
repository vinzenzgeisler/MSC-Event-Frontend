import { useEffect, useMemo, useState } from "react";
import { Copy, Newspaper, RefreshCcw, Save, Sparkles } from "lucide-react";
import { AiCommunicationShell, textareaClassName } from "@/components/features/admin/ai-communication/ai-communication-shell";
import { aiActiveOutlineButtonClass, aiPrimaryButtonClass } from "@/components/features/admin/ai-communication/ai-button-styles";
import { EmptyState } from "@/components/state/empty-state";
import { ErrorState } from "@/components/state/error-state";
import { LoadingState } from "@/components/state/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminMetaService, type AdminClassOption } from "@/services/admin-meta.service";
import { ApiError } from "@/services/api/http-client";
import { aiCommunicationService } from "@/services/ai-communication.service";
import { cn } from "@/lib/utils";
import type {
  AiDraftDetail,
  AiEventReportEnvelope,
  AiEventReportRequest,
  AiEventReportVariant,
  AiKnowledgeSuggestion,
  AiReportFormat,
  AiReportLength,
  AiReportTone,
  AiTaskStatus
} from "@/types/ai-communication";

const initialForm: AiEventReportRequest = {
  eventId: "",
  scope: "event",
  formats: ["website", "short_summary"],
  tone: "neutral",
  length: "medium",
  highlights: [],
  mustMention: [],
  mustAvoid: []
};

function toUiErrorMessage(error: unknown, label: string) {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return `${label} ist aktuell nicht freigegeben. Bitte Anmeldung und Berechtigungen prüfen.`;
    if (error.status === 404) return `${label} wurde nicht gefunden.`;
    if (error.status === 503) return `${label} ist aktuell backendseitig nicht verfügbar.`;
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

function linesToList(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("de-DE");
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
      <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-[340px] rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm leading-6 text-slate-700 shadow-xl group-hover:block group-focus-within:block">
        {props.children}
      </div>
    </div>
  );
}

function hydrateReportFromDraft(draft: AiDraftDetail): AiEventReportEnvelope | null {
  if (draft.taskType !== "event_report") {
    return null;
  }

  const payload = draft.outputPayload as Partial<AiEventReportEnvelope["result"]> & {
    basis?: AiEventReportEnvelope["basis"];
    review?: AiEventReportEnvelope["review"];
    meta?: AiEventReportEnvelope["meta"];
    variants?: AiEventReportVariant[];
    highlights?: string[];
  };

  if (!Array.isArray(payload.variants) || payload.variants.length === 0) {
    return null;
  }

  return {
    ok: true,
    task: "event_report",
    eventId: draft.eventId ?? "",
    result: {
      variants: payload.variants,
      variantReview: Array.isArray(payload.variantReview) ? payload.variantReview : [],
      blockingIssues: Array.isArray(payload.blockingIssues) ? payload.blockingIssues.filter((item): item is string => typeof item === "string") : [],
      uncertainClaims: Array.isArray(payload.uncertainClaims) ? payload.uncertainClaims.filter((item): item is string => typeof item === "string") : []
    },
    basis: payload.basis ?? {
      scope: "event",
      event: { id: draft.eventId ?? "", name: null },
      class: null,
      facts: { entriesTotal: 0, acceptedTotal: 0, paidTotal: 0 },
      highlights: Array.isArray(payload.highlights) ? payload.highlights.filter((item): item is string => typeof item === "string") : [],
      factBlocks: [],
      usedKnowledge: [],
      operatorInput: {
        mustMention: [],
        mustAvoid: []
      },
      sourceSummary: {
        factBlockCount: 0,
        factCount: 0,
        approvedKnowledgeCount: 0,
        manualHighlightsCount: 0,
        missingDataCount: 0,
        operatorInputPresent: false
      },
      missingData: []
    },
    warnings: Array.isArray(draft.warnings)
      ? draft.warnings.flatMap((item) =>
          typeof item === "string"
            ? [{ code: "draft_warning", severity: "low" as const, message: item, displayMessage: item }]
            : [item]
        )
      : [],
    review: draft.review ?? payload.review ?? { required: false, status: "draft", confidence: "medium" },
    meta: payload.meta ?? {
      modelId: draft.modelId ?? "—",
      promptVersion: draft.promptVersion ?? "—",
      generatedAt: draft.updatedAt
    }
  };
}

export function AdminAiReportGeneratorPage() {
  const [event, setEvent] = useState<{ id: string; name: string } | null>(null);
  const [classOptions, setClassOptions] = useState<AdminClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<AiEventReportRequest>(initialForm);
  const [highlightsInput, setHighlightsInput] = useState("");
  const [mustMentionInput, setMustMentionInput] = useState("");
  const [mustAvoidInput, setMustAvoidInput] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [audience, setAudience] = useState("");
  const [publishChannel, setPublishChannel] = useState("");
  const [showOperatorInputs, setShowOperatorInputs] = useState(false);
  const [report, setReport] = useState<AiEventReportEnvelope | null>(null);
  const [editableVariants, setEditableVariants] = useState<AiEventReportVariant[]>([]);
  const [status, setStatus] = useState<AiTaskStatus>("idle");
  const [error, setError] = useState("");
  const [activeFormat, setActiveFormat] = useState<AiReportFormat>("website");
  const [copyState, setCopyState] = useState("");
  const [activeDraftId, setActiveDraftId] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [regeneratingFormat, setRegeneratingFormat] = useState<AiReportFormat | "">("");
  const [reportKnowledgeStatus, setReportKnowledgeStatus] = useState<AiTaskStatus>("idle");
  const [reportKnowledgeSuggestions, setReportKnowledgeSuggestions] = useState<AiKnowledgeSuggestion[]>([]);

  useEffect(() => {
    Promise.all([adminMetaService.getCurrentEvent(), adminMetaService.listClassOptions()])
      .then(async ([currentEvent, nextClassOptions]) => {
        setEvent(currentEvent);
        setClassOptions(nextClassOptions);
        setForm((current) => ({
          ...current,
          eventId: currentEvent.id,
          classId: undefined
        }));
        setLoadError("");
        setDraftLoading(true);
        try {
          const drafts = await aiCommunicationService.listDrafts({
            taskType: "event_report",
            eventId: currentEvent.id,
            limit: 20
          });
          const latestDraft = drafts[0];
          if (latestDraft) {
            const detail = await aiCommunicationService.getDraft(latestDraft.id);
            const hydrated = hydrateReportFromDraft(detail);
            if (hydrated) {
              setReport(hydrated);
              setEditableVariants(hydrated.result.variants);
              setActiveFormat(hydrated.result.variants[0]?.format ?? "website");
              setActiveDraftId(detail.id);
              const draftInput = (detail.inputSnapshot ?? {}) as Partial<AiEventReportRequest>;
              setForm((current) => ({
                ...current,
                eventId: currentEvent.id,
                scope: draftInput.scope === "class" ? "class" : "event",
                classId: typeof draftInput.classId === "string" ? draftInput.classId : undefined,
                formats: Array.isArray(draftInput.formats) && draftInput.formats.length ? draftInput.formats as AiReportFormat[] : hydrated.result.variants.map((variant) => variant.format),
                tone: draftInput.tone ?? current.tone,
                length: draftInput.length ?? current.length
              }));
              setHighlightsInput(Array.isArray(draftInput.highlights) ? draftInput.highlights.join("\n") : hydrated.basis.highlights.join("\n"));
              setMustMentionInput(Array.isArray(draftInput.mustMention) ? draftInput.mustMention.join("\n") : hydrated.basis.operatorInput.mustMention.join("\n"));
              setMustAvoidInput(Array.isArray(draftInput.mustAvoid) ? draftInput.mustAvoid.join("\n") : hydrated.basis.operatorInput.mustAvoid.join("\n"));
              setAdditionalContext(draftInput.additionalContext ?? hydrated.basis.operatorInput.additionalContext ?? "");
              setAudience(draftInput.audience ?? hydrated.basis.operatorInput.audience ?? "");
              setPublishChannel(draftInput.publishChannel ?? hydrated.basis.operatorInput.publishChannel ?? "");
              setStatus("success");
            }
          }
        } catch {
          setActiveDraftId("");
        } finally {
          setDraftLoading(false);
        }
      })
      .catch((loadErrorValue) => {
        setLoadError(toUiErrorMessage(loadErrorValue, "Der Bericht-Kontext"));
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedClass = useMemo(() => classOptions.find((item) => item.id === form.classId) ?? null, [classOptions, form.classId]);
  const activeVariant = useMemo(
    () => editableVariants.find((item) => item.format === activeFormat) ?? editableVariants[0] ?? null,
    [editableVariants, activeFormat]
  );
  const activeVariantReview = useMemo(
    () => report?.result.variantReview.find((item) => item.format === activeFormat) ?? null,
    [report, activeFormat]
  );

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

  const applyGeneratedReport = (nextReport: AiEventReportEnvelope, draftId = activeDraftId) => {
    setReport(nextReport);
    setEditableVariants(nextReport.result.variants);
    setActiveFormat(nextReport.result.variants[0]?.format ?? "website");
    setActiveDraftId(draftId);
    setStatus("success");
    setError("");
  };

  const currentRequestPayload = (): AiEventReportRequest => ({
    ...form,
    highlights: linesToList(highlightsInput),
    additionalContext: additionalContext.trim() || undefined,
    mustMention: linesToList(mustMentionInput),
    mustAvoid: linesToList(mustAvoidInput),
    audience: audience.trim() || undefined,
    publishChannel: publishChannel.trim() || undefined
  });

  const handleGenerate = async () => {
    setStatus("loading");
    setError("");
    try {
      const response = await aiCommunicationService.generateReport(currentRequestPayload());
      applyGeneratedReport(response);
      setReportKnowledgeSuggestions([]);
      setReportKnowledgeStatus("idle");
    } catch (generationError) {
      setStatus("error");
      setError(toUiErrorMessage(generationError, "Die Berichtsgenerierung"));
    }
  };

  const handleSaveDraft = async () => {
    if (!report || editableVariants.length === 0) return;
    setSavingDraft(true);
    setError("");
    try {
      if (activeDraftId) {
        const updated = await aiCommunicationService.updateDraft(activeDraftId, {
          variants: editableVariants,
          highlights: linesToList(highlightsInput),
          operatorEdits: { source: "frontend-edit" }
        });
        const detail = await aiCommunicationService.getDraft(updated.id);
        const hydrated = hydrateReportFromDraft(detail);
        if (hydrated) applyGeneratedReport(hydrated, detail.id);
      } else {
        const saved = await aiCommunicationService.saveDraft({
          taskType: "event_report",
          status: report.review.status,
          eventId: report.eventId || form.eventId,
          entryId: undefined,
          title: editableVariants[0]?.title || event?.name || "Event-Bericht",
          promptVersion: report.meta.promptVersion,
          modelId: report.meta.modelId,
          inputSnapshot: currentRequestPayload(),
          outputPayload: {
            variants: editableVariants,
            variantReview: report.result.variantReview,
            blockingIssues: report.result.blockingIssues,
            uncertainClaims: report.result.uncertainClaims,
            basis: report.basis,
            review: report.review,
            meta: report.meta,
            highlights: linesToList(highlightsInput)
          },
          warnings: report.warnings
        });
        const detail = await aiCommunicationService.getDraft(saved.id);
        const hydrated = hydrateReportFromDraft(detail);
        if (hydrated) applyGeneratedReport(hydrated, detail.id);
      }
    } catch (saveError) {
      setError(toUiErrorMessage(saveError, "Das Speichern des Berichtsdrafts"));
    } finally {
      setSavingDraft(false);
    }
  };

  const handleRegenerateVariant = async () => {
    if (!activeDraftId || !activeVariant) return;
    setRegeneratingFormat(activeVariant.format);
    setError("");
    try {
      const response = await aiCommunicationService.regenerateReportVariant(activeDraftId, {
        format: activeVariant.format,
        additionalContext: additionalContext.trim() || undefined,
        mustMention: linesToList(mustMentionInput),
        mustAvoid: linesToList(mustAvoidInput),
        audience: audience.trim() || undefined,
        publishChannel: publishChannel.trim() || undefined
      });
      const hydrated = hydrateReportFromDraft(response.draft);
      if (hydrated) applyGeneratedReport(hydrated, response.draft.id);
    } catch (regenerateError) {
      setError(toUiErrorMessage(regenerateError, "Die Regenerierung der Berichtsvariante"));
    } finally {
      setRegeneratingFormat("");
    }
  };

  const handleCreateKnowledgeSuggestions = async () => {
    if (!activeDraftId) return;
    setReportKnowledgeStatus("loading");
    setError("");
    try {
      const response = await aiCommunicationService.createReportKnowledgeSuggestions(activeDraftId, {
        additionalContext: additionalContext.trim() || undefined
      });
      setReportKnowledgeSuggestions(response.result.suggestions);
      setReportKnowledgeStatus("success");
    } catch (knowledgeError) {
      setReportKnowledgeStatus("error");
      setError(toUiErrorMessage(knowledgeError, "Die Erzeugung von Wissensvorschlägen aus dem Bericht"));
    }
  };

  return (
    <AiCommunicationShell
      title="Event-Bericht"
      actions={
        <Button type="button" variant="outline" className={aiPrimaryButtonClass} onClick={() => void handleGenerate()} disabled={!form.eventId || status === "loading"}>
          <Sparkles className="mr-2 h-4 w-4" />
          Bericht generieren
        </Button>
      }
    >
      {loading ? <LoadingState label="Lade Event- und Klassenkontext..." /> : null}
      {!loading && loadError ? <ErrorState message={loadError} /> : null}

      {!loading && !loadError ? (
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="rounded-3xl border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">Berichts-Fokus</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                    <Newspaper className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Aktuelles Event</div>
                    <div className="mt-1.5 text-base font-medium text-slate-950">{event?.name || "—"}</div>
                    {activeDraftId ? <div className="mt-2 text-xs text-slate-500">Gespeicherter Berichtsdraft geladen.</div> : null}
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
                        classId: next === "class" ? current.classId ?? classOptions[0]?.id : undefined
                      }))
                    }
                  >
                    <SelectTrigger className="rounded-md">
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
                    <SelectTrigger className="rounded-md">
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
                    <SelectTrigger className="rounded-md">
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
                    <SelectTrigger className="rounded-md">
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
                          className={selected ? aiActiveOutlineButtonClass : "h-9 rounded-md"}
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
                <textarea className={textareaClassName} value={highlightsInput} placeholder="Je Zeile ein Highlight oder Schwerpunkt" onChange={(event) => setHighlightsInput(event.target.value)} />
              </div>

              <details className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70" open={showOperatorInputs} onToggle={(event) => setShowOperatorInputs((event.target as HTMLDetailsElement).open)}>
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-900">Operator-Hinweise</summary>
                <div className="grid gap-4 border-t border-slate-200 p-4 lg:grid-cols-2">
                  <div className="space-y-1 lg:col-span-2">
                    <Label>Zusätzlicher Kontext</Label>
                    <textarea className={textareaClassName} value={additionalContext} onChange={(event) => setAdditionalContext(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Muss erwähnt werden</Label>
                    <textarea className={textareaClassName} value={mustMentionInput} onChange={(event) => setMustMentionInput(event.target.value)} placeholder="Eine Zeile pro Punkt" />
                  </div>
                  <div className="space-y-1">
                    <Label>Muss vermieden werden</Label>
                    <textarea className={textareaClassName} value={mustAvoidInput} onChange={(event) => setMustAvoidInput(event.target.value)} placeholder="Eine Zeile pro Punkt" />
                  </div>
                  <div className="space-y-1">
                    <Label>Audience</Label>
                    <Input value={audience} onChange={(event) => setAudience(event.target.value)} className="rounded-md" />
                  </div>
                  <div className="space-y-1">
                    <Label>Publish Channel</Label>
                    <Input value={publishChannel} onChange={(event) => setPublishChannel(event.target.value)} className="rounded-md" />
                  </div>
                </div>
              </details>

              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Aktueller Fokus</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-slate-300 bg-white text-slate-600">Event: {event?.name || "—"}</Badge>
                  <Badge variant="outline" className="border-slate-300 bg-white text-slate-600">Scope: {form.scope}</Badge>
                  {selectedClass ? <Badge variant="outline" className="border-slate-300 bg-white text-slate-600">Klasse: {selectedClass.name}</Badge> : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-200">
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1.5">
                <CardTitle className="text-lg">Berichtsentwurf</CardTitle>
                {report ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={cn("border px-3 py-1", report.review.confidence === "high" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : report.review.confidence === "medium" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-rose-200 bg-rose-50 text-rose-800")}>
                      {report.review.confidence === "high" ? "Hohe Sicherheit" : report.review.confidence === "medium" ? "Mittlere Sicherheit" : "Niedrige Sicherheit"}
                    </Badge>
                    {activeDraftId ? <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">Server-Draft aktiv</Badge> : null}
                    {copyState ? <span className="text-xs text-slate-500">{copyState}</span> : null}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" className="h-9 rounded-md" onClick={() => void handleGenerate()} disabled={!form.eventId || status === "loading"}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Neu erzeugen
                </Button>
                <Button type="button" variant="outline" className="h-9 rounded-md" disabled={!activeVariant?.text} onClick={async () => {
                  if (!activeVariant?.text) return;
                  try {
                    await copyText(activeVariant.text);
                    setCopyState("Text kopiert");
                    window.setTimeout(() => setCopyState(""), 1200);
                  } catch (copyError) {
                    setError(toUiErrorMessage(copyError, "Das Kopieren des Berichtstexts"));
                  }
                }}>
                  <Copy className="mr-2 h-4 w-4" />
                  Kopieren
                </Button>
                <Button type="button" className={aiPrimaryButtonClass} disabled={!report || savingDraft} onClick={() => void handleSaveDraft()}>
                  <Save className="mr-2 h-4 w-4" />
                  {savingDraft ? "Speichert..." : "Entwurf speichern"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {draftLoading && status === "idle" ? <LoadingState label="Lade letzten Berichtsdraft..." /> : null}
              {status === "idle" && !draftLoading ? <EmptyState message="Noch kein Bericht erzeugt. Links Fokus setzen und Generierung starten." /> : null}
              {status === "loading" ? <LoadingState label="Erstelle Berichtsentwurf..." /> : null}
              {status === "error" ? <ErrorState message={error} /> : null}

              {status === "success" && report ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {editableVariants.map((variant) => (
                      <Button
                        key={variant.format}
                        type="button"
                        variant={activeFormat === variant.format ? "default" : "outline"}
                        className={activeFormat === variant.format ? aiActiveOutlineButtonClass : "h-9 rounded-md"}
                        onClick={() => setActiveFormat(variant.format)}
                      >
                        {variant.format}
                      </Button>
                    ))}
                  </div>

                  {activeVariant ? (
                    <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{activeVariant.format}</div>
                      <div className="mt-4 grid gap-4">
                        <div className="space-y-1">
                          <Label>Titel</Label>
                          <Input
                            className="rounded-md"
                            value={activeVariant.title ?? ""}
                            onChange={(event) =>
                              setEditableVariants((current) =>
                                current.map((variant) => (variant.format === activeVariant.format ? { ...variant, title: event.target.value || null } : variant))
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Teaser</Label>
                          <Input
                            className="rounded-md"
                            value={activeVariant.teaser ?? ""}
                            onChange={(event) =>
                              setEditableVariants((current) =>
                                current.map((variant) => (variant.format === activeVariant.format ? { ...variant, teaser: event.target.value || null } : variant))
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Text</Label>
                          <textarea
                            className={cn(textareaClassName, "min-h-[260px]")}
                            value={activeVariant.text}
                            onChange={(event) =>
                              setEditableVariants((current) =>
                                current.map((variant) => (variant.format === activeVariant.format ? { ...variant, text: event.target.value } : variant))
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {report.review.required ? (
                        <InfoPill label="Menschliche Prüfung erforderlich" tone="critical">
                          <div className="space-y-3">
                            <div>{report.review.reason || "Bitte Bericht vor der Veröffentlichung manuell prüfen."}</div>
                            {report.review.recommendedChecks?.length ? (
                              <ul className="space-y-1">
                                {report.review.recommendedChecks.map((check) => (
                                  <li key={check}>• {check}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        </InfoPill>
                      ) : null}
                      {report.warnings.length ? (
                        <InfoPill label={`Warnungen (${report.warnings.length})`} tone="warning">
                          <div className="space-y-3">
                            {report.warnings.map((warning) => (
                              <div key={`${warning.code}:${warning.message}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                                <div className="font-medium text-slate-900">{warning.displayMessage || warning.message}</div>
                                {warning.recommendation ? <div className="mt-2 text-slate-600">{warning.recommendation}</div> : null}
                              </div>
                            ))}
                          </div>
                        </InfoPill>
                      ) : null}
                      {activeVariantReview ? (
                        <InfoPill label={`Variantenprüfung ${activeVariantReview.format}`} tone="warning">
                          <div className="space-y-3">
                            {activeVariantReview.uncertainClaims.length ? (
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Unsichere Aussagen</div>
                                <ul className="mt-2 space-y-1">
                                  {activeVariantReview.uncertainClaims.map((claim) => (
                                    <li key={claim}>• {claim}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            {activeVariantReview.blockingIssues.length ? (
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Blocking Issues</div>
                                <ul className="mt-2 space-y-1">
                                  {activeVariantReview.blockingIssues.map((issue) => (
                                    <li key={issue}>• {issue}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        </InfoPill>
                      ) : null}
                      <details className="min-w-[220px] rounded-full border border-slate-200 bg-white">
                        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-slate-700">Basis und Quellen</summary>
                        <div className="border-t border-slate-200 p-4 text-sm text-slate-700">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">Scope: {report.basis.scope}</Badge>
                            <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">Event: {report.basis.event.name || "—"}</Badge>
                            <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">Klasse: {report.basis.class?.name || "—"}</Badge>
                            <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">Entries: {report.basis.facts.entriesTotal}</Badge>
                            <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">Accepted: {report.basis.facts.acceptedTotal}</Badge>
                            <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">Paid: {report.basis.facts.paidTotal}</Badge>
                          </div>
                          {report.basis.factBlocks.length ? (
                            <div className="mt-3 grid gap-3">
                              {report.basis.factBlocks.map((block) => (
                                <div key={block.key} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                                  <div className="font-medium text-slate-950">{block.label}</div>
                                  <div className="mt-1 text-xs text-slate-500">{block.source}</div>
                                  <ul className="mt-2 space-y-1">
                                    {block.facts.map((fact) => (
                                      <li key={fact}>• {fact}</li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {report.basis.usedKnowledge.length ? (
                            <div className="mt-3">
                              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Verwendete Wissensbasis</div>
                              <div className="mt-2 grid gap-2">
                                {report.basis.usedKnowledge.map((item) => (
                                  <div key={`${item.id ?? item.title}-${item.content}`} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                                    <div className="font-medium text-slate-950">{item.title}</div>
                                    <div className="mt-1 text-slate-600">{item.content}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {report.basis.missingData.length ? (
                            <div className="mt-3">
                              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fehlende Daten</div>
                              <ul className="mt-2 space-y-1">
                                {report.basis.missingData.map((item) => (
                                  <li key={item}>• {item}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          <div className="mt-3 text-xs text-slate-500">
                            Modell {report.meta.modelId} · Prompt {report.meta.promptVersion} · Generiert {formatDateTime(report.meta.generatedAt)}
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="h-9 rounded-md" disabled={!activeDraftId || regeneratingFormat === activeFormat} onClick={() => void handleRegenerateVariant()}>
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      {regeneratingFormat === activeFormat ? "Regeneriert..." : "Aktive Variante regenerieren"}
                    </Button>
                    <Button type="button" variant="outline" className="h-9 rounded-md" disabled={!activeDraftId || reportKnowledgeStatus === "loading"} onClick={() => void handleCreateKnowledgeSuggestions()}>
                      {reportKnowledgeStatus === "loading" ? "Leitet ab..." : "Wissensvorschläge ableiten"}
                    </Button>
                  </div>

                  {reportKnowledgeSuggestions.length ? (
                    <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Neue Wissensvorschläge aus dem Bericht</div>
                      <div className="mt-3 grid gap-3">
                        {reportKnowledgeSuggestions.map((item) => (
                          <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-600">{item.topic}</Badge>
                              <div className="font-medium text-slate-950">{item.title}</div>
                            </div>
                            <div className="mt-2 text-sm leading-6 text-slate-700">{item.content}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </AiCommunicationShell>
  );
}
