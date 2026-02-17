import { CheckCircle2, Loader2 } from "lucide-react";
import { useAnmeldungI18n } from "@/app/i18n/anmeldung-i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublicEventClass, StartRegistrationForm } from "@/types/registration";

type StartNumberState = "idle" | "checking" | "available" | "invalid" | "taken";
type StartFieldKey =
  | "classId"
  | "startNumber"
  | "make"
  | "model"
  | "year"
  | "displacementCcm"
  | "engineType"
  | "cylinders"
  | "brakes"
  | "vehicleHistory"
  | "codriverFirstName"
  | "codriverLastName"
  | "codriverEmail";

type StartEntriesStepProps = {
  classes: PublicEventClass[];
  starts: StartRegistrationForm[];
  draft: StartRegistrationForm;
  editingId: string | null;
  error: string;
  fieldErrors: Partial<Record<StartFieldKey, string>>;
  startNumberState: StartNumberState;
  startNumberHint: string;
  onDraftChange: <K extends keyof StartRegistrationForm>(field: K, value: StartRegistrationForm[K]) => void;
  onVehicleFieldChange: (field: keyof StartRegistrationForm["vehicle"], value: string) => void;
  onCodriverFieldChange: (field: keyof StartRegistrationForm["codriver"], value: string) => void;
  onBackupFieldChange: (field: keyof StartRegistrationForm["backupVehicle"], value: string) => void;
  onStartNumberBlur: () => void;
  onSave: () => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
};

function classLabel(classId: string, classes: PublicEventClass[]) {
  return classes.find((item) => item.id === classId)?.name ?? "-";
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <p className="text-xs text-destructive">{message}</p>;
}

export function StartEntriesStep({
  classes,
  starts,
  draft,
  editingId,
  error,
  fieldErrors,
  startNumberState,
  startNumberHint,
  onDraftChange,
  onVehicleFieldChange,
  onCodriverFieldChange,
  onBackupFieldChange,
  onStartNumberBlur,
  onSave,
  onEdit,
  onRemove
}: StartEntriesStepProps) {
  const { m } = useAnmeldungI18n();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900">{m.start.title}</h3>
        <p className="text-sm text-slate-600">{m.start.intro}</p>
      </div>

      <div className="space-y-3">
        {starts.length === 0 && <div className="rounded-lg border border-dashed p-4 text-sm text-slate-500">{m.start.empty}</div>}
        {starts.map((item, index) => (
          <div key={item.id} className="rounded-lg border bg-slate-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold text-slate-900">
                  #{index + 1} {item.classLabel || classLabel(item.classId, classes)} · {item.startNumber || "-"}
                </div>
                <div className="text-xs text-slate-600">
                  {item.vehicle.make || "-"} {item.vehicle.model || ""} · {item.vehicleType}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {item.codriverEnabled && <Badge variant="outline">{m.start.codriverBadge}</Badge>}
                {item.backupVehicleEnabled && <Badge variant="outline">{m.start.backupBadge}</Badge>}
                <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => onEdit(item.id)}>
                  {m.start.edit}
                </Button>
                <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => onRemove(item.id)}>
                  {m.start.remove}
                </Button>
              </div>
            </div>
            {item.codriverEnabled && (
              <details className="mt-3 rounded-md border bg-white p-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-900">{m.start.codriverDetails}</summary>
                <div className="mt-2 grid gap-1 text-sm text-slate-700">
                  <div>
                    {item.codriver.firstName} {item.codriver.lastName}
                  </div>
                  <div>{item.codriver.email || "-"}</div>
                  <div>{item.codriver.phone || "-"}</div>
                </div>
              </details>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-4 rounded-xl border bg-white p-4 md:p-6">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-semibold text-slate-900">{editingId ? m.start.editTitle : m.start.addTitle}</h4>
        </div>
        {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{m.start.classLabel}</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={draft.classId}
              onChange={(event) => {
                const selected = classes.find((item) => item.id === event.target.value);
                onDraftChange("classId", event.target.value);
                onDraftChange("classLabel", selected?.name ?? "");
                if (selected) {
                  onDraftChange("vehicleType", selected.vehicleType);
                }
              }}
            >
              <option value="">{m.start.classPlaceholder}</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.classId} />
          </div>

          <div className="space-y-2">
            <Label>{m.start.startNumber}</Label>
            <div className="relative">
              <Input
                value={draft.startNumber}
                onChange={(event) => onDraftChange("startNumber", event.target.value.toUpperCase())}
                onBlur={onStartNumberBlur}
                placeholder={m.start.startNumberPlaceholder}
                className="pr-9"
              />
              {startNumberState === "checking" && (
                <Loader2 className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-slate-400" />
              )}
              {startNumberState === "available" && (
                <span title={startNumberHint || m.start.startAvailable}>
                  <CheckCircle2 className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-emerald-600" />
                </span>
              )}
            </div>
            <FieldError message={fieldErrors.startNumber} />
            {startNumberState === "available" && <p className="text-xs text-emerald-700">{m.start.startAvailable}</p>}
            {startNumberState === "taken" && <p className="text-xs text-destructive">{m.start.startTaken}</p>}
            {startNumberState === "invalid" && <p className="text-xs text-destructive">{m.start.startInvalid}</p>}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>{m.start.make}</Label>
            <Input value={draft.vehicle.make} onChange={(event) => onVehicleFieldChange("make", event.target.value)} />
            <FieldError message={fieldErrors.make} />
          </div>
          <div className="space-y-2">
            <Label>{m.start.model}</Label>
            <Input value={draft.vehicle.model} onChange={(event) => onVehicleFieldChange("model", event.target.value)} />
            <FieldError message={fieldErrors.model} />
          </div>
          <div className="space-y-2">
            <Label>{m.start.year}</Label>
            <Input value={draft.vehicle.year} onChange={(event) => onVehicleFieldChange("year", event.target.value.replace(/\D/g, "").slice(0, 4))} />
            <FieldError message={fieldErrors.year} />
          </div>
          <div className="space-y-2">
            <Label>{m.start.displacement}</Label>
            <Input
              value={draft.vehicle.displacementCcm}
              onChange={(event) => onVehicleFieldChange("displacementCcm", event.target.value.replace(/\D/g, "").slice(0, 5))}
            />
            <FieldError message={fieldErrors.displacementCcm} />
          </div>
          <div className="space-y-2">
            <Label>{m.start.engine}</Label>
            <Input value={draft.vehicle.engineType} onChange={(event) => onVehicleFieldChange("engineType", event.target.value)} />
            <FieldError message={fieldErrors.engineType} />
          </div>
          <div className="space-y-2">
            <Label>{m.start.cylinders}</Label>
            <Input
              value={draft.vehicle.cylinders}
              placeholder={m.start.cylindersPlaceholder}
              onChange={(event) => onVehicleFieldChange("cylinders", event.target.value.toUpperCase())}
            />
            <FieldError message={fieldErrors.cylinders} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>{m.start.brakes}</Label>
            <Input value={draft.vehicle.brakes} onChange={(event) => onVehicleFieldChange("brakes", event.target.value)} />
            <FieldError message={fieldErrors.brakes} />
          </div>
          <div className="space-y-2">
            <Label>{m.start.owner}</Label>
            <Input value={draft.vehicle.ownerName} onChange={(event) => onVehicleFieldChange("ownerName", event.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label>{m.start.history}</Label>
            <textarea
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={draft.vehicle.vehicleHistory}
              onChange={(event) => onVehicleFieldChange("vehicleHistory", event.target.value)}
            />
            <p className="text-xs text-slate-500">{m.start.historyHint}</p>
            <FieldError message={fieldErrors.vehicleHistory} />
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label>{m.start.upload}</Label>
            <Input
              value={draft.vehicle.imageFileName}
              onChange={(event) => onVehicleFieldChange("imageFileName", event.target.value)}
              placeholder={m.start.uploadPlaceholder}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <input
              type="checkbox"
              checked={draft.codriverEnabled}
              onChange={(event) => onDraftChange("codriverEnabled", event.target.checked)}
            />
            {m.start.codriverAdd}
          </label>
          {draft.codriverEnabled && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{m.start.codriverFirstName}</Label>
                <Input value={draft.codriver.firstName} onChange={(event) => onCodriverFieldChange("firstName", event.target.value)} />
                <FieldError message={fieldErrors.codriverFirstName} />
              </div>
              <div className="space-y-2">
                <Label>{m.start.codriverLastName}</Label>
                <Input value={draft.codriver.lastName} onChange={(event) => onCodriverFieldChange("lastName", event.target.value)} />
                <FieldError message={fieldErrors.codriverLastName} />
              </div>
              <div className="space-y-2">
                <Label>{m.start.codriverEmail}</Label>
                <Input value={draft.codriver.email} onChange={(event) => onCodriverFieldChange("email", event.target.value)} />
                <FieldError message={fieldErrors.codriverEmail} />
              </div>
              <div className="space-y-2">
                <Label>{m.start.codriverPhone}</Label>
                <Input
                  value={draft.codriver.phone}
                  onChange={(event) => onCodriverFieldChange("phone", event.target.value)}
                  inputMode="tel"
                  placeholder={m.start.codriverPhonePlaceholder}
                />
              </div>
            </div>
          )}
        </div>

        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-900">{m.start.backupSummary}</summary>
          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={draft.backupVehicleEnabled}
                onChange={(event) => onDraftChange("backupVehicleEnabled", event.target.checked)}
              />
              {m.start.backupToggle}
            </label>
            {draft.backupVehicleEnabled && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{m.start.backupMake}</Label>
                  <Input value={draft.backupVehicle.make} onChange={(event) => onBackupFieldChange("make", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{m.start.backupModel}</Label>
                  <Input value={draft.backupVehicle.model} onChange={(event) => onBackupFieldChange("model", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{m.start.backupDisplacement}</Label>
                  <Input
                    value={draft.backupVehicle.displacementCcm}
                    onChange={(event) => onBackupFieldChange("displacementCcm", event.target.value.replace(/\D/g, "").slice(0, 5))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{m.start.backupEngine}</Label>
                  <Input value={draft.backupVehicle.engineType} onChange={(event) => onBackupFieldChange("engineType", event.target.value)} />
                </div>
              </div>
            )}
          </div>
        </details>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">{m.start.footerHint}</p>
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onSave}>
            {editingId ? m.start.saveEdit : m.start.saveAdd}
          </Button>
        </div>
      </div>
    </div>
  );
}
