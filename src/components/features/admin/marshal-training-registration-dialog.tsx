import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MarshalPerson, MarshalTraining } from "@/types/admin-marshals";
import type { BulkTrainingRegistrationResult } from "@/components/features/admin/marshal-schulung-view";

type SkippedPerson = {
  person: MarshalPerson;
  trainingTitles: string[];
};

type Props = {
  training: MarshalTraining;
  groupLabel: string;
  candidates: MarshalPerson[];
  alreadyAssignedElsewhere: SkippedPerson[];
  protectedCount: number;
  busy: boolean;
  onConfirm: (people: MarshalPerson[]) => Promise<BulkTrainingRegistrationResult>;
  onClose: () => void;
};

export function MarshalTrainingRegistrationDialog({
  training,
  groupLabel,
  candidates,
  alreadyAssignedElsewhere,
  protectedCount,
  busy,
  onConfirm,
  onClose,
}: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  const [selectedIds, setSelectedIds] = useState(() => new Set(candidates.map((person) => person.id)));
  const [result, setResult] = useState<BulkTrainingRegistrationResult | null>(null);
  onCloseRef.current = onClose;
  busyRef.current = busy;

  const [candidateById] = useState(() => new Map(candidates.map((person) => [person.id, person])));
  const selectedPeople = candidates.filter((person) => selectedIds.has(person.id));

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) event.preventDefault();
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  async function register(people: MarshalPerson[]) {
    const nextResult = await onConfirm(people);
    setResult(nextResult);
  }

  const retryPeople = result?.failed.flatMap((failure) => {
    const person = candidateById.get(failure.personId);
    return person ? [person] : [];
  }) ?? [];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b p-4 sm:p-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-slate-950">Sammelzuordnung prüfen</h2>
            <p id={descriptionId} className="mt-1 break-words text-sm text-slate-600">
              {groupLabel} werden dem Termin „{training.title}“ zugeordnet.
            </p>
          </div>
          <Button ref={closeButtonRef} type="button" size="sm" variant="ghost" className="shrink-0" disabled={busy} aria-label="Vorschau schließen" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {result ? (
            <RegistrationResult result={result} candidateById={candidateById} />
          ) : (
            <>
              <section>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium text-slate-900">Neu anmelden ({selectedPeople.length})</h3>
                  {selectedPeople.length !== candidates.length && <span className="text-xs text-slate-500">{candidates.length - selectedPeople.length} aus der Auswahl entfernt</span>}
                </div>
                {selectedPeople.length > 0 ? (
                  <ul className="divide-y rounded-lg border">
                    {selectedPeople.map((person) => (
                      <li key={person.id} className="flex min-w-0 items-center gap-3 px-3 py-2.5">
                        <span className="min-w-0 flex-1 break-words text-sm font-medium text-slate-900">{person.lastName}, {person.firstName}<span className="ml-2 font-normal text-slate-500">Nr. {person.helperNumber}</span></span>
                        <span className="hidden shrink-0 text-sm text-slate-600 sm:block">DMSB: {person.licenseNumber || "—"}</span>
                        <Button type="button" size="sm" variant="ghost" className="shrink-0 text-slate-500 hover:text-red-700" aria-label={`${person.firstName} ${person.lastName} aus der Sammelauswahl entfernen`} onClick={() => setSelectedIds((current) => { const next = new Set(current); next.delete(person.id); return next; })}>
                          <X className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="rounded-lg border border-dashed p-4 text-sm text-slate-500">Keine Person ist für die Neuanmeldung ausgewählt.</p>}
              </section>

              {alreadyAssignedElsewhere.length > 0 && (
                <section className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
                  <h3 className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4" />Bereits einem anderen Termin zugeordnet ({alreadyAssignedElsewhere.length})</h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {alreadyAssignedElsewhere.map(({ person, trainingTitles }) => <li key={person.id}><strong>{person.lastName}, {person.firstName}</strong>: {trainingTitles.join(", ")}</li>)}
                  </ul>
                </section>
              )}

              {protectedCount > 0 && <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">{protectedCount} Personen haben beim gewählten Termin bereits einen Status. Diese Einträge bleiben unverändert.</p>}
            </>
          )}
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t bg-slate-50 p-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{result ? "Schließen" : "Abbrechen"}</Button>
          {!result && <Button type="button" disabled={busy || selectedPeople.length === 0} onClick={() => void register(selectedPeople)}>{busy ? "Anmeldung läuft …" : `${selectedPeople.length} Personen anmelden`}</Button>}
          {result && retryPeople.length > 0 && <Button type="button" disabled={busy} onClick={() => void register(retryPeople)}>{busy ? "Wiederholung läuft …" : `${retryPeople.length} fehlgeschlagene erneut versuchen`}</Button>}
        </footer>
      </section>
    </div>
  );
}

function RegistrationResult({ result, candidateById }: { result: BulkTrainingRegistrationResult; candidateById: Map<string, MarshalPerson> }) {
  return <div className="space-y-4" aria-live="polite">
    {result.succeededPersonIds.length > 0 && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950"><p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />{result.succeededPersonIds.length} Personen wurden angemeldet.</p></div>}
    {result.skipped.length > 0 && <section className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950"><h3 className="font-semibold">Zwischenzeitlich übersprungen ({result.skipped.length})</h3><ul className="mt-2 space-y-1">{result.skipped.map((item) => <li key={item.personId}><strong>{personName(candidateById.get(item.personId))}</strong>: {item.message}</li>)}</ul></section>}
    {result.failed.length > 0 && <section className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-950"><h3 className="font-semibold">Nicht abgeschlossen ({result.failed.length})</h3><ul className="mt-2 space-y-1">{result.failed.map((item) => <li key={item.personId}><strong>{personName(candidateById.get(item.personId))}</strong>: {item.message}</li>)}</ul></section>}
    {result.succeededPersonIds.length === 0 && result.skipped.length === 0 && result.failed.length === 0 && <p className="rounded-lg border border-dashed p-4 text-sm text-slate-500">Es waren keine Änderungen erforderlich.</p>}
  </div>;
}

function personName(person?: MarshalPerson) {
  return person ? `${person.lastName}, ${person.firstName}` : "Unbekannte Person";
}
