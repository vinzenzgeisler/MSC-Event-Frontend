import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/hooks/use-confirm";
import { CONVERSION_STATUS_LABELS as STATUS_LABEL, VISIBILITY_LABELS } from "@/lib/racepic-labels";
import { adminRacepicService } from "@/services/admin-racepic.service";
import { ApiError, getApiErrorMessage } from "@/services/api/http-client";
import type { RacepicConversionDetail, RacepicConversionStatus, RacepicConversionSummary } from "@/types/admin-racepic";

/**
 * RacePic: Pruefung der FREE->PAID-Antraege (Marketplace-Plan, Abschnitt 5, AP09).
 * Die Freigabe wirkt nur auf kuenftige Zugriffe: bereits heruntergeladene FREE-Dateien sind nicht rueckrufbar.
 * Die Routen antworten mit 404/COMMERCE_DISABLED, solange das Backend-Flag commerceFreeToPaidConversion aus ist.
 */

const FILTERS: { value: RacepicConversionStatus | ""; label: string }[] = [
  { value: "READY_FOR_REVIEW", label: "Zur Prüfung" },
  { value: "PREPARING_ASSETS", label: "In Vorbereitung" },
  { value: "APPROVED", label: "Freigegeben" },
  { value: "REJECTED", label: "Abgelehnt" },
  { value: "FAILED", label: "Fehlgeschlagen" },
  { value: "", label: "Alle" },
];

const formatPrice = (cents: number) => `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`;
const formatDate = (value: string) => new Date(value).toLocaleString("de-DE");

const isDisabledError = (error: unknown) => error instanceof ApiError && error.code === "COMMERCE_DISABLED";

export function AdminRacepicConversionsPage() {
  const [filter, setFilter] = useState<RacepicConversionStatus | "">("READY_FOR_REVIEW");
  const [items, setItems] = useState<RacepicConversionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RacepicConversionDetail | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [disabled, setDisabled] = useState(false);
  const { confirm, node: confirmDialog } = useConfirm();
  // Ein Idempotency-Key pro Entscheidungsversuch: bei Wiederholung nach einem Fehler derselbe Key, nach Erfolg neu.
  const attemptKey = useRef<{ scope: string; key: string } | null>(null);

  const keyFor = (scope: string) => {
    if (!attemptKey.current || attemptKey.current.scope !== scope) {
      attemptKey.current = { scope, key: crypto.randomUUID() };
    }
    return attemptKey.current.key;
  };

  const loadList = useCallback(() => {
    setLoading(true);
    setError("");
    adminRacepicService
      .listConversions(filter || undefined)
      .then(setItems)
      .catch((err) => (isDisabledError(err) ? setDisabled(true) : setError(getApiErrorMessage(err))))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(loadList, [loadList]);

  const loadDetail = useCallback((conversionId: string) => {
    setSelectedId(conversionId);
    setDetail(null);
    setNote("");
    setError("");
    adminRacepicService
      .getConversion(conversionId)
      .then(setDetail)
      .catch((err) => setError(getApiErrorMessage(err)));
  }, []);

  const decide = async (decision: "approve" | "reject") => {
    if (!detail) return;
    const question =
      decision === "approve"
        ? `Umstellung für ${detail.items.length} Bild(er) auf ${formatPrice(detail.priceCents)} wirklich freigeben? Die kostenlose Ausgabe endet für künftige Zugriffe.`
        : "Antrag wirklich ablehnen? Die Veröffentlichung bleibt unverändert.";
    if (!(await confirm(question, { title: decision === "approve" ? "Umstellung freigeben?" : "Antrag ablehnen?", confirmLabel: decision === "approve" ? "Freigeben" : "Ablehnen" }))) return;
    setBusy(true);
    setError("");
    try {
      await adminRacepicService.decideConversion(detail.id, decision, note.trim(), keyFor(`${detail.id}:${decision}`));
      attemptKey.current = null;
      loadList();
      loadDetail(detail.id);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const finalize = async () => {
    if (!detail) return;
    setBusy(true);
    setError("");
    try {
      await adminRacepicService.finalizeConversion(detail.id, keyFor(`${detail.id}:finalize`));
      attemptKey.current = null;
      loadList();
      loadDetail(detail.id);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (disabled) {
    return (
      <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">
        Die Umstellung von kostenlosen auf kostenpflichtige Bilder ist noch nicht aktiviert (Backend-Flag <code>commerceFreeToPaidConversion</code>).
      </p>
    );
  }

  const canDecide = detail?.status === "READY_FOR_REVIEW";
  const noteMissing = note.trim().length === 0;

  return (
    <div className="space-y-4">
      {confirmDialog}
      <p className="text-sm text-slate-600">
        Anträge von Fotograf:innen, veröffentlichte kostenlose Bilder kostenpflichtig anzubieten. Geprüft werden Eigentum, Rechtebestätigung, Preis, Lizenz und
        wasserzeichenbehaftete Vorschau.
      </p>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <Button
            key={option.value || "all"}
            size="sm"
            variant={filter === option.value ? "default" : "outline"}
            onClick={() => {
              setFilter(option.value);
              setSelectedId(null);
              setDetail(null);
            }}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="space-y-2">
          {loading && <p className="text-sm text-slate-400">Lädt…</p>}
          {!loading && items.length === 0 && <p className="rounded-lg border p-4 text-center text-sm text-slate-400">Keine Anträge in dieser Ansicht.</p>}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => loadDetail(item.id)}
              className={`w-full rounded-lg border p-3 text-left text-sm transition hover:bg-slate-50 ${selectedId === item.id ? "border-primary bg-slate-50" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <strong>{item.photographer.displayName}</strong>
                <Badge variant={item.status === "READY_FOR_REVIEW" ? "default" : "secondary"}>{STATUS_LABEL[item.status]}</Badge>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {item.imageCount} Bild(er) · {formatPrice(item.priceCents)} · {formatDate(item.createdAt)}
              </div>
            </button>
          ))}
        </div>

        <div>
          {!selectedId && <p className="rounded-lg border p-6 text-center text-sm text-slate-400">Antrag auswählen.</p>}
          {selectedId && !detail && !error && <p className="text-sm text-slate-400">Lädt…</p>}
          {detail && (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{detail.photographer.displayName}</h2>
                  <p className="text-xs text-slate-500">{detail.photographer.email}</p>
                </div>
                <Badge variant={detail.status === "READY_FOR_REVIEW" ? "default" : "secondary"}>{STATUS_LABEL[detail.status]}</Badge>
              </div>

              <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">Preis (brutto)</dt>
                  <dd className="font-medium">{formatPrice(detail.priceCents)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Lizenz</dt>
                  <dd className="font-medium">
                    {detail.license.code} v{detail.license.version}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Rechte bestätigt</dt>
                  <dd>
                    {formatDate(detail.rightsConfirmedAt)} (Text {detail.rightsConfirmationVersion})
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Beantragt</dt>
                  <dd>{formatDate(detail.createdAt)}</dd>
                </div>
                {detail.decidedAt && (
                  <div>
                    <dt className="text-xs text-slate-500">Entschieden</dt>
                    <dd>
                      {formatDate(detail.decidedAt)} · {detail.reviewer}
                    </dd>
                  </div>
                )}
                {detail.reviewNote && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500">Vermerk</dt>
                    <dd>{detail.reviewNote}</dd>
                  </div>
                )}
                {detail.failureReason && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500">Fehler</dt>
                    <dd className="text-red-700">{detail.failureReason}</dd>
                  </div>
                )}
              </dl>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {detail.items.map((item) => (
                  <figure key={item.imageId} className="space-y-1 rounded-md border p-2 text-xs">
                    {item.previewUrl ? (
                      <img src={item.previewUrl} alt={item.title ?? "Vorschau"} className="aspect-[4/3] w-full rounded object-cover" loading="lazy" />
                    ) : (
                      <div className="flex aspect-[4/3] w-full items-center justify-center rounded bg-slate-100 text-slate-400">Keine Vorschau</div>
                    )}
                    <figcaption className="space-y-0.5">
                      <div className="truncate font-medium">{item.title || item.imageId}</div>
                      <div className="text-slate-500">
                        {VISIBILITY_LABELS[item.visibility] ?? item.visibility} · {item.offerMode} · Dateien: {item.artifactStatus}
                      </div>
                      {!item.ownedByRequester && <div className="font-medium text-red-700">Gehört nicht der antragstellenden Person!</div>}
                      {item.artifactError && <div className="text-red-700">{item.artifactError}</div>}
                    </figcaption>
                  </figure>
                ))}
              </div>

              {canDecide && (
                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="conversion-note" className="text-xs">
                    Bearbeitungsvermerk (Pflicht)
                  </Label>
                  <Textarea
                    id="conversion-note"
                    className="min-h-20"
                    maxLength={1000}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Was wurde geprüft? Begründung bei Ablehnung."
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={busy || noteMissing || detail.items.some((item) => !item.ownedByRequester || item.artifactStatus !== "READY")} onClick={() => void decide("approve")}>
                      Freigeben
                    </Button>
                    <Button variant="outline" disabled={busy || noteMissing} onClick={() => void decide("reject")}>
                      Ablehnen
                    </Button>
                  </div>
                </div>
              )}

              {detail.status === "APPROVED" && !detail.finalized && (
                <div className="space-y-2 border-t pt-4">
                  <p className="text-sm text-amber-800">
                    Die Umstellung der öffentlichen Ausgabe ist noch nicht abgeschlossen (Manifeste/CDN). Erneut ausführen ist gefahrlos möglich.
                  </p>
                  <Button disabled={busy} onClick={() => void finalize()}>
                    Umstellung abschließen
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
