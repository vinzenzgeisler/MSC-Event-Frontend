import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublicEventClass, StartRegistrationForm } from "@/types/registration";

type StartEntriesStepProps = {
  classes: PublicEventClass[];
  starts: StartRegistrationForm[];
  draft: StartRegistrationForm;
  editingId: string | null;
  error: string;
  onDraftChange: <K extends keyof StartRegistrationForm>(field: K, value: StartRegistrationForm[K]) => void;
  onVehicleFieldChange: (field: keyof StartRegistrationForm["vehicle"], value: string) => void;
  onCodriverFieldChange: (field: keyof StartRegistrationForm["codriver"], value: string) => void;
  onBackupFieldChange: (field: keyof StartRegistrationForm["backupVehicle"], value: string) => void;
  onSave: () => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
};

function classLabel(classId: string, classes: PublicEventClass[]) {
  return classes.find((item) => item.id === classId)?.name ?? "-";
}

export function StartEntriesStep({
  classes,
  starts,
  draft,
  editingId,
  error,
  onDraftChange,
  onVehicleFieldChange,
  onCodriverFieldChange,
  onBackupFieldChange,
  onSave,
  onEdit,
  onRemove
}: StartEntriesStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900">Startmeldungen</h3>
        <p className="text-sm text-slate-600">
          Ein Fahrer kann mehrere Startmeldungen erfassen. Jede Meldung enthält Klasse, Startnummer und Fahrzeugdaten.
        </p>
      </div>

      <div className="space-y-3">
        {starts.length === 0 && <div className="rounded-lg border border-dashed p-4 text-sm text-slate-500">Noch keine Startmeldung erfasst.</div>}
        {starts.map((item, index) => (
          <div key={item.id} className="rounded-lg border bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-900">
                  #{index + 1} {item.classLabel || classLabel(item.classId, classes)} · {item.startNumber || "-"}
                </div>
                <div className="text-xs text-slate-600">
                  {item.vehicle.make || "-"} {item.vehicle.model || ""} · {item.vehicleType}
                </div>
              </div>
              <div className="flex gap-2">
                {item.codriverEnabled && <Badge variant="outline">Beifahrer</Badge>}
                {item.backupVehicleEnabled && <Badge variant="outline">Ersatzfahrzeug</Badge>}
                <Button size="sm" variant="outline" onClick={() => onEdit(item.id)}>
                  Editieren
                </Button>
                <Button size="sm" variant="outline" onClick={() => onRemove(item.id)}>
                  Entfernen
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-white p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-semibold text-slate-900">{editingId ? "Startmeldung bearbeiten" : "Startmeldung hinzufügen"}</h4>
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Klasse</Label>
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
              <option value="">Bitte wählen</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Fahrzeugtyp</Label>
            <Input value={draft.vehicleType === "moto" ? "Motorrad" : "Auto"} readOnly />
          </div>

          <div className="space-y-2">
            <Label>Startnummer</Label>
            <Input value={draft.startNumber} onChange={(event) => onDraftChange("startNumber", event.target.value.toUpperCase())} placeholder="z. B. 21A" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Hersteller / Marke</Label>
            <Input value={draft.vehicle.make} onChange={(event) => onVehicleFieldChange("make", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Modell</Label>
            <Input value={draft.vehicle.model} onChange={(event) => onVehicleFieldChange("model", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Baujahr</Label>
            <Input value={draft.vehicle.year} onChange={(event) => onVehicleFieldChange("year", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Hubraum (ccm)</Label>
            <Input value={draft.vehicle.displacementCcm} onChange={(event) => onVehicleFieldChange("displacementCcm", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Motor-Hersteller</Label>
            <Input value={draft.vehicle.engineType} onChange={(event) => onVehicleFieldChange("engineType", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Zylinder</Label>
            <Input value={draft.vehicle.cylinders} onChange={(event) => onVehicleFieldChange("cylinders", event.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Bremsen</Label>
            <Input value={draft.vehicle.brakes} onChange={(event) => onVehicleFieldChange("brakes", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Besitzer (optional, falls abweichend vom Fahrer)</Label>
            <Input value={draft.vehicle.ownerName} onChange={(event) => onVehicleFieldChange("ownerName", event.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label>Fahrzeughistorie / Besonderheiten</Label>
            <textarea
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={draft.vehicle.vehicleHistory}
              onChange={(event) => onVehicleFieldChange("vehicleHistory", event.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label>Fahrzeugbild Upload (UI-only)</Label>
            <Input
              value={draft.vehicle.imageFileName}
              onChange={(event) => onVehicleFieldChange("imageFileName", event.target.value)}
              placeholder="Dateiname oder Platzhalter"
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
            Beifahrer hinzufügen
          </label>
          {draft.codriverEnabled && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Vorname</Label>
                <Input value={draft.codriver.firstName} onChange={(event) => onCodriverFieldChange("firstName", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nachname</Label>
                <Input value={draft.codriver.lastName} onChange={(event) => onCodriverFieldChange("lastName", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>E-Mail</Label>
                <Input value={draft.codriver.email} onChange={(event) => onCodriverFieldChange("email", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input value={draft.codriver.phone} onChange={(event) => onCodriverFieldChange("phone", event.target.value)} />
              </div>
            </div>
          )}
        </div>

        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-900">Optional: Ersatzfahrzeug in gleicher Klasse</summary>
          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={draft.backupVehicleEnabled}
                onChange={(event) => onDraftChange("backupVehicleEnabled", event.target.checked)}
              />
              Ersatzfahrzeug erfassen
            </label>
            {draft.backupVehicleEnabled && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Marke</Label>
                  <Input value={draft.backupVehicle.make} onChange={(event) => onBackupFieldChange("make", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Modell</Label>
                  <Input value={draft.backupVehicle.model} onChange={(event) => onBackupFieldChange("model", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Hubraum (ccm)</Label>
                  <Input value={draft.backupVehicle.displacementCcm} onChange={(event) => onBackupFieldChange("displacementCcm", event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Motor-Hersteller</Label>
                  <Input value={draft.backupVehicle.engineType} onChange={(event) => onBackupFieldChange("engineType", event.target.value)} />
                </div>
              </div>
            )}
          </div>
        </details>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Nach dem Hinzufügen kannst du weitere Fahrzeuge erfassen oder direkt zur Zusammenfassung gehen.</p>
          <Button type="button" variant="secondary" onClick={onSave}>
            {editingId ? "Startmeldung aktualisieren" : "Startmeldung hinzufügen"}
          </Button>
        </div>
      </div>
    </div>
  );
}
