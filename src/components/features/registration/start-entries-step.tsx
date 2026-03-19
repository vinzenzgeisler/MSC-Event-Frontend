import { CheckCircle2, Loader2 } from "lucide-react";
import { useAnmeldungI18n } from "@/app/i18n/anmeldung-i18n";
import { getCountrySelectOptions } from "@/lib/countries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PublicEventClass, StartRegistrationForm } from "@/types/registration";

type StartNumberState = "idle" | "checking" | "available" | "invalid" | "taken";
type StartFieldKey =
  | "classId"
  | "startNumber"
  | "make"
  | "model"
  | "year"
  | "displacementCcm"
  | "cylinders"
  | "vehicleHistory"
  | "vehicleImage"
  | "codriverFirstName"
  | "codriverLastName"
  | "codriverBirthdate"
  | "codriverNationality"
  | "codriverStreet"
  | "codriverZip"
  | "codriverCity"
  | "codriverEmail"
  | "codriverPhone"
  | "backupMake"
  | "backupModel"
  | "backupYear"
  | "backupDisplacementCcm"
  | "backupCylinders"
  | "backupVehicleHistory"
  | "backupVehicleImage";

type StartEntriesStepProps = {
  classes: PublicEventClass[];
  starts: StartRegistrationForm[];
  secondVehiclePriceHint?: string;
  draft: StartRegistrationForm;
  editingId: string | null;
  error: string;
  fieldErrors: Partial<Record<StartFieldKey, string>>;
  startNumberState: StartNumberState;
  startNumberHint: string;
  showDraftForm: boolean;
  addAnotherStart: boolean;
  onDraftChange: <K extends keyof StartRegistrationForm>(field: K, value: StartRegistrationForm[K]) => void;
  onAddAnotherStartChange: (checked: boolean) => void;
  onVehicleFieldChange: (field: keyof StartRegistrationForm["vehicle"], value: string) => void;
  onBackupVehicleImageSelect: (file: File | null) => void;
  onVehicleImageSelect: (file: File | null) => void;
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
  secondVehiclePriceHint,
  draft,
  editingId,
  error,
  fieldErrors,
  startNumberState,
  startNumberHint,
  showDraftForm,
  addAnotherStart,
  onDraftChange,
  onAddAnotherStartChange,
  onVehicleFieldChange,
  onBackupVehicleImageSelect,
  onVehicleImageSelect,
  onCodriverFieldChange,
  onBackupFieldChange,
  onStartNumberBlur,
  onSave,
  onEdit,
  onRemove
}: StartEntriesStepProps) {
  const { m, locale } = useAnmeldungI18n();
  const countryOptions = getCountrySelectOptions(locale);
  const usedClassIds = new Set(starts.filter((item) => item.id !== editingId).map((item) => item.classId));
  const ownerPlaceholder =
    locale === "en"
      ? "Team name / Owner name"
      : locale === "cz"
        ? "Název týmu / Jméno vlastníka"
        : locale === "pl"
          ? "Nazwa zespołu / Imię i nazwisko właściciela"
          : "Teamname / Haltername";
  const historyPlaceholder =
    locale === "en"
      ? "History, modifications, special technical features"
      : locale === "cz"
        ? "Historie, úpravy, zvláštní technické vlastnosti"
        : locale === "pl"
          ? "Historia, modyfikacje, szczególne cechy techniczne"
          : "Historie, Umbauten, besondere technische Merkmale";
  const uploadFileLabel = locale === "en" ? "File" : locale === "cz" ? "Soubor" : locale === "pl" ? "Plik" : "Datei";
  const uploadRunning = locale === "en" ? "Upload in progress..." : locale === "cz" ? "Nahrávání probíhá..." : locale === "pl" ? "Trwa przesyłanie..." : "Upload läuft...";
  const uploadDone = locale === "en" ? "Upload completed." : locale === "cz" ? "Nahrávání dokončeno." : locale === "pl" ? "Przesyłanie zakończone." : "Upload abgeschlossen.";
  const uploadFailed = locale === "en" ? "Upload failed." : locale === "cz" ? "Nahrávání se nezdařilo." : locale === "pl" ? "Przesyłanie nie powiodło się." : "Upload fehlgeschlagen.";

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

      {starts.length > 0 && !editingId && (
        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-900">
          <input
            type="checkbox"
            checked={addAnotherStart}
            onChange={(event) => onAddAnotherStartChange(event.target.checked)}
          />
          {m.start.addAnotherToggle}
        </label>
      )}

      {showDraftForm && (
        <div className="space-y-4 rounded-xl border bg-white p-4 md:p-6">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-slate-900">{editingId ? m.start.editTitle : m.start.addTitle}</h4>
          </div>
          {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{m.start.classLabel}</Label>
            <Select
              value={draft.classId || "__placeholder__"}
              onValueChange={(next) => {
                if (next === "__placeholder__") {
                  onDraftChange("classId", "");
                  onDraftChange("classLabel", "");
                  return;
                }
                const selected = classes.find((item) => item.id === next);
                onDraftChange("classId", next);
                onDraftChange("classLabel", selected?.name ?? "");
                if (selected) {
                  onDraftChange("vehicleType", selected.vehicleType);
                }
              }}
            >
              <SelectTrigger className="text-base md:text-sm">
                <SelectValue placeholder={m.start.classPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__placeholder__">{m.start.classPlaceholder}</SelectItem>
                {classes.map((item) => (
                  <SelectItem key={item.id} value={item.id} disabled={usedClassIds.has(item.id)}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>{m.start.make}</Label>
            <Input value={draft.vehicle.make} onChange={(event) => onVehicleFieldChange("make", event.target.value)} placeholder="BMW" />
            <FieldError message={fieldErrors.make} />
          </div>
          <div className="space-y-2">
            <Label>{m.start.model}</Label>
            <Input value={draft.vehicle.model} onChange={(event) => onVehicleFieldChange("model", event.target.value)} placeholder="M3 E30" />
            <FieldError message={fieldErrors.model} />
          </div>
          <div className="space-y-2">
            <Label>{m.start.year}</Label>
            <Input
              value={draft.vehicle.year}
              onChange={(event) => onVehicleFieldChange("year", event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1989"
            />
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
            <Label>{m.start.cylinders}</Label>
            <Input
              value={draft.vehicle.cylinders}
              placeholder={m.start.cylindersPlaceholder}
              onChange={(event) => onVehicleFieldChange("cylinders", event.target.value.toUpperCase())}
            />
            <FieldError message={fieldErrors.cylinders} />
          </div>
          <div className="space-y-2">
            <Label>{m.start.owner}</Label>
            <Input value={draft.vehicle.ownerName} onChange={(event) => onVehicleFieldChange("ownerName", event.target.value)} placeholder={ownerPlaceholder} />
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label>{m.start.history}</Label>
            <textarea
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={draft.vehicle.vehicleHistory}
              onChange={(event) => onVehicleFieldChange("vehicleHistory", event.target.value)}
              placeholder={historyPlaceholder}
            />
            <p className="text-xs text-slate-500">{m.start.historyHint}</p>
            <FieldError message={fieldErrors.vehicleHistory} />
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label>{m.start.upload}</Label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="block h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1"
              onClick={(event) => {
                (event.currentTarget as HTMLInputElement).value = "";
              }}
              onChange={(event) => onVehicleImageSelect(event.target.files?.[0] ?? null)}
            />
            {draft.vehicle.imageFileName && <p className="text-xs text-slate-600">{uploadFileLabel}: {draft.vehicle.imageFileName}</p>}
            {draft.vehicle.imageUploadState === "uploading" && <p className="text-xs text-slate-600">{uploadRunning}</p>}
            {draft.vehicle.imageUploadState === "uploaded" && <p className="text-xs text-emerald-700">{uploadDone}</p>}
            {draft.vehicle.imageUploadState === "error" && (
              <p className="text-xs text-destructive">{draft.vehicle.imageUploadError || uploadFailed}</p>
            )}
            <FieldError message={fieldErrors.vehicleImage} />
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
              <h5 className="md:col-span-2 text-sm font-semibold text-slate-900">{m.start.codriverTitle}</h5>
              <div className="space-y-2">
                <Label>{m.start.codriverFirstName}</Label>
                <Input value={draft.codriver.firstName} onChange={(event) => onCodriverFieldChange("firstName", event.target.value)} placeholder="Anna" />
                <FieldError message={fieldErrors.codriverFirstName} />
              </div>
              <div className="space-y-2">
                <Label>{m.start.codriverLastName}</Label>
                <Input value={draft.codriver.lastName} onChange={(event) => onCodriverFieldChange("lastName", event.target.value)} placeholder="Beispiel" />
                <FieldError message={fieldErrors.codriverLastName} />
              </div>
              <div className="space-y-2">
                <Label>{m.start.codriverBirthdate}</Label>
                <Input
                  value={draft.codriver.birthdate}
                  onChange={(event) => onCodriverFieldChange("birthdate", event.target.value)}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder={m.start.codriverBirthdatePlaceholder}
                />
                <FieldError message={fieldErrors.codriverBirthdate} />
              </div>
              <div className="space-y-2">
                <Label>{m.start.codriverNationality}</Label>
                <Select
                  value={draft.codriver.nationality || "__placeholder__"}
                  onValueChange={(next) => onCodriverFieldChange("nationality", next === "__placeholder__" ? "" : next)}
                >
                  <SelectTrigger className="text-base md:text-sm">
                    <SelectValue placeholder={m.start.codriverNationalityPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__placeholder__">{m.start.codriverNationalityPlaceholder}</SelectItem>
                    {countryOptions.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={fieldErrors.codriverNationality} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{m.start.codriverStreet}</Label>
                <Input value={draft.codriver.street} onChange={(event) => onCodriverFieldChange("street", event.target.value)} />
                <FieldError message={fieldErrors.codriverStreet} />
              </div>
              <div className="space-y-2">
                <Label>{m.start.codriverZip}</Label>
                <Input value={draft.codriver.zip} onChange={(event) => onCodriverFieldChange("zip", event.target.value)} />
                <FieldError message={fieldErrors.codriverZip} />
              </div>
              <div className="space-y-2">
                <Label>{m.start.codriverCity}</Label>
                <Input value={draft.codriver.city} onChange={(event) => onCodriverFieldChange("city", event.target.value)} />
                <FieldError message={fieldErrors.codriverCity} />
              </div>
              <div className="space-y-2">
                <Label>{m.start.codriverEmail}</Label>
                <Input value={draft.codriver.email} onChange={(event) => onCodriverFieldChange("email", event.target.value)} placeholder="anna@example.com" />
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
                <FieldError message={fieldErrors.codriverPhone} />
              </div>
            </div>
          )}
        </div>

        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-900">{m.start.backupSummary}</summary>
          <div className="mt-4 space-y-3">
            {secondVehiclePriceHint && <p className="text-xs text-slate-600">{secondVehiclePriceHint}</p>}
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
                  <Input value={draft.backupVehicle.make} onChange={(event) => onBackupFieldChange("make", event.target.value)} placeholder="BMW" />
                  <FieldError message={fieldErrors.backupMake} />
                </div>
                <div className="space-y-2">
                  <Label>{m.start.backupModel}</Label>
                  <Input value={draft.backupVehicle.model} onChange={(event) => onBackupFieldChange("model", event.target.value)} placeholder="2002 tii" />
                  <FieldError message={fieldErrors.backupModel} />
                </div>
                <div className="space-y-2">
                  <Label>{m.start.backupYear}</Label>
                  <Input
                    value={draft.backupVehicle.year}
                    onChange={(event) => onBackupFieldChange("year", event.target.value.replace(/\D/g, "").slice(0, 4))}
                    inputMode="numeric"
                  />
                  <FieldError message={fieldErrors.backupYear} />
                </div>
                <div className="space-y-2">
                  <Label>{m.start.backupDisplacement}</Label>
                  <Input
                    value={draft.backupVehicle.displacementCcm}
                    onChange={(event) => onBackupFieldChange("displacementCcm", event.target.value.replace(/\D/g, "").slice(0, 5))}
                  />
                  <FieldError message={fieldErrors.backupDisplacementCcm} />
                </div>
                <div className="space-y-2">
                  <Label>{m.start.backupCylinders}</Label>
                  <Input
                    value={draft.backupVehicle.cylinders}
                    onChange={(event) => onBackupFieldChange("cylinders", event.target.value.toUpperCase())}
                  />
                  <FieldError message={fieldErrors.backupCylinders} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{m.start.backupOwner}</Label>
                  <Input value={draft.backupVehicle.ownerName} onChange={(event) => onBackupFieldChange("ownerName", event.target.value)} placeholder={ownerPlaceholder} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{m.start.backupHistory}</Label>
                  <textarea
                    className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={draft.backupVehicle.vehicleHistory}
                    onChange={(event) => onBackupFieldChange("vehicleHistory", event.target.value)}
                    placeholder={historyPlaceholder}
                  />
                  <p className="text-xs text-slate-500">{m.start.backupHistoryHint}</p>
                  <FieldError message={fieldErrors.backupVehicleHistory} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{m.start.backupUpload}</Label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="block h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1"
                    onClick={(event) => {
                      (event.currentTarget as HTMLInputElement).value = "";
                    }}
                    onChange={(event) => onBackupVehicleImageSelect(event.target.files?.[0] ?? null)}
                  />
                  {draft.backupVehicle.imageFileName && <p className="text-xs text-slate-600">{uploadFileLabel}: {draft.backupVehicle.imageFileName}</p>}
                  {draft.backupVehicle.imageUploadState === "uploading" && <p className="text-xs text-slate-600">{uploadRunning}</p>}
                  {draft.backupVehicle.imageUploadState === "uploaded" && <p className="text-xs text-emerald-700">{uploadDone}</p>}
                  {draft.backupVehicle.imageUploadState === "error" && (
                    <p className="text-xs text-destructive">{draft.backupVehicle.imageUploadError || uploadFailed}</p>
                  )}
                  <FieldError message={fieldErrors.backupVehicleImage} />
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
      )}
    </div>
  );
}
