import { Badge } from "@/components/ui/badge";
import { AiNotice } from "@/components/features/admin/ai-communication/ai-notice";
import type { AiMeta, AiReview, AiWarning } from "@/types/ai-communication";

function confidenceLabel(value: AiReview["confidence"]) {
  if (value === "high") return "Hohe Sicherheit";
  if (value === "medium") return "Mittlere Sicherheit";
  return "Niedrige Sicherheit";
}

function severityClass(value: AiWarning["severity"]) {
  if (value === "high") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  if (value === "medium") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-sky-200 bg-sky-50 text-sky-800";
}

function severityLabel(value: AiWarning["severity"]) {
  if (value === "high") return "Wichtig";
  if (value === "medium") return "Prüfen";
  return "Hinweis";
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("de-DE");
}

export function AiWarningsPanel(props: { warnings: AiWarning[]; title?: string }) {
  if (!props.warnings.length) {
    return null;
  }

  return (
    <AiNotice tone="warning" title={props.title ?? "Warnhinweise"}>
      <div className="space-y-2">
        {props.warnings.map((warning) => (
          <div key={`${warning.code}:${warning.message}`} className="rounded-md border border-amber-200/70 bg-white/70 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={severityClass(warning.severity)}>
                {severityLabel(warning.severity)}
              </Badge>
              <span className="text-xs text-slate-500">{warning.code}</span>
            </div>
            <div className="mt-2 text-sm leading-6">{warning.displayMessage || warning.message}</div>
            {warning.recommendation ? <div className="mt-2 text-sm text-slate-600">Empfehlung: {warning.recommendation}</div> : null}
          </div>
        ))}
      </div>
    </AiNotice>
  );
}

export function AiReviewPanel(props: { review: AiReview; message?: string }) {
  if (!props.review.required) {
    return null;
  }

  return (
    <AiNotice tone="critical" title="Menschliche Prüfung erforderlich">
      {props.message ?? "Die KI liefert hier nur einen Entwurf. Bitte Inhalt vor Übernahme fachlich prüfen."}
      {props.review.reason ? <div className="mt-2 text-sm text-slate-700">Grund: {props.review.reason}</div> : null}
      {props.review.blockingIssues?.length ? (
        <div className="mt-3 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Vor Übernahme klären</div>
          <ul className="space-y-1 text-sm text-slate-700">
            {props.review.blockingIssues.map((issue) => (
              <li key={issue}>• {issue}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {props.review.recommendedChecks?.length ? (
        <div className="mt-3 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Empfohlene Prüfungen</div>
          <ul className="space-y-1 text-sm text-slate-700">
            {props.review.recommendedChecks.map((check) => (
              <li key={check}>• {check}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-2">
        <Badge variant="outline" className="border-destructive/30 bg-white/60 text-destructive">
          {confidenceLabel(props.review.confidence)}
        </Badge>
      </div>
    </AiNotice>
  );
}

export function AiMetaPanel(props: { meta: AiMeta }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
      <div className="font-semibold uppercase tracking-[0.18em] text-slate-500">Meta</div>
      <div className="mt-2 grid gap-2 md:grid-cols-3">
        <div>Generiert: {formatDateTime(props.meta.generatedAt)}</div>
        <div>Model: {props.meta.modelId}</div>
        <div>Prompt: {props.meta.promptVersion}</div>
      </div>
    </div>
  );
}
