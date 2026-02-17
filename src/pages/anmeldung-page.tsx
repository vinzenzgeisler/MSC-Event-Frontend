import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createPublicEntry,
  finalizeVehicleImageUpload,
  getPublicCurrentEvent,
  initVehicleImageUpload,
  validateStartNumber
} from "@/api/client";
import { vehicleTypes } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/components/state/error-state";
import { LoadingState } from "@/components/state/loading-state";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { getErrorMessage, parseApiError } from "@/lib/http/api-error";

const personSchema = z.object({
  email: z.string().email("Ungültige E-Mail"),
  firstName: z.string().min(1, "Vorname ist erforderlich"),
  lastName: z.string().min(1, "Nachname ist erforderlich"),
  birthdate: z.string().optional(),
  nationality: z.string().optional(),
  street: z.string().optional(),
  zip: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional()
});

const vehicleSchema = z.object({
  vehicleType: z.enum(vehicleTypes),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().min(1900).max(2100).optional(),
  imageS3Key: z.string().optional()
});

const registrationSchema = z.object({
  classId: z.string().min(1, "Klasse ist erforderlich"),
  startNumber: z
    .string()
    .optional()
    .transform((value) => (value ? value.toUpperCase() : value)),
  isBackupVehicle: z.boolean().optional(),
  driver: personSchema,
  codriver: personSchema.optional(),
  vehicle: vehicleSchema
});

type RegistrationValues = z.infer<typeof registrationSchema>;

function getEventId(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const obj = payload as Record<string, unknown>;
  return (
    (obj.event && typeof obj.event === "object" && ((obj.event as Record<string, unknown>).id as string)) ||
    (obj.event && typeof obj.event === "object" && ((obj.event as Record<string, unknown>).eventId as string)) ||
    (obj.eventId as string) ||
    (obj.id as string) ||
    ""
  );
}

function getClassId(item: Record<string, unknown>) {
  return (item.id as string) || (item.classId as string) || (item.uuid as string) || "";
}

function getClassLabel(item: Record<string, unknown>) {
  return (
    (item.name as string) ||
    (item.title as string) ||
    (item.label as string) ||
    (item.code as string) ||
    getClassId(item)
  );
}

export function AnmeldungPage() {
  const [includeCodriver, setIncludeCodriver] = useState(false);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const form = useForm<RegistrationValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      classId: "",
      startNumber: "",
      isBackupVehicle: false,
      driver: {
        email: "",
        firstName: "",
        lastName: "",
        birthdate: "",
        nationality: "",
        street: "",
        zip: "",
        city: "",
        phone: ""
      },
      codriver: {
        email: "",
        firstName: "",
        lastName: "",
        birthdate: "",
        nationality: "",
        street: "",
        zip: "",
        city: "",
        phone: ""
      },
      vehicle: {
        vehicleType: "auto",
        make: "",
        model: "",
        year: undefined,
        imageS3Key: ""
      }
    }
  });

  const currentEventQuery = useQuery({
    queryKey: ["public", "currentEvent"],
    queryFn: getPublicCurrentEvent
  });

  const eventId = useMemo(() => getEventId(currentEventQuery.data), [currentEventQuery.data]);
  const classes = (currentEventQuery.data?.classes || []) as Record<string, unknown>[];
  const registrationInfo = currentEventQuery.data?.registration;

  const startNumber = form.watch("startNumber") || "";
  const classId = form.watch("classId") || "";
  const debouncedStartNumber = useDebouncedValue(startNumber, 500);
  const errors = form.formState.errors;

  const validateMutation = useMutation({
    mutationFn: (payload: { classId: string; startNumber: string }) =>
      validateStartNumber(eventId, payload)
  });

  const submitMutation = useMutation({
    mutationFn: (payload: RegistrationValues) =>
      createPublicEntry(eventId, {
        ...payload,
        codriver: includeCodriver ? payload.codriver : undefined
      })
  });

  const validationStatus = validateMutation.data;

  if (currentEventQuery.isLoading) {
    return <LoadingState />;
  }

  if (currentEventQuery.error) {
    return <ErrorState message={getErrorMessage(currentEventQuery.error)} />;
  }

  const handleUpload = async (file: File | null) => {
    if (!file || !eventId) {
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadState("error");
      setUploadMessage("Datei ist größer als 8MB.");
      return;
    }

    try {
      setUploadState("uploading");
      setUploadMessage(null);
      const initResponse = await initVehicleImageUpload({
        eventId,
        contentType: file.type,
        fileSizeBytes: file.size,
        fileName: file.name
      });
      await fetch(initResponse.uploadUrl, {
        method: "PUT",
        headers: initResponse.requiredHeaders,
        body: file
      });
      const finalizeResponse = await finalizeVehicleImageUpload({ uploadId: initResponse.uploadId });
      form.setValue("vehicle.imageS3Key", finalizeResponse.imageS3Key);
      setUploadState("done");
      setUploadMessage("Upload abgeschlossen");
    } catch (error) {
      setUploadState("error");
      setUploadMessage(getErrorMessage(error, "Upload fehlgeschlagen"));
    }
  };

  const onSubmit = async (values: RegistrationValues) => {
    setSubmitSuccess(false);
    try {
      await submitMutation.mutateAsync(values);
      setSubmitSuccess(true);
    } catch (error) {
      const apiError = parseApiError(error);
      if (apiError?.fieldErrors?.length) {
        apiError.fieldErrors.forEach((fieldError) => {
          form.setError(fieldError.field as never, { message: fieldError.message });
        });
      }
    }
  };

  useEffect(() => {
    if (!eventId || !classId) {
      return;
    }
    const normalized = debouncedStartNumber.trim();
    if (normalized.length === 0) {
      return;
    }
    if (!validateMutation.isPending) {
      validateMutation.mutate({ classId, startNumber: normalized });
    }
  }, [eventId, classId, debouncedStartNumber, validateMutation]);

  const canSubmit = registrationInfo?.isOpen !== false && !!eventId;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anmeldung</CardTitle>
        <CardDescription>Öffentliche Anmeldung für das aktuelle Event.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Event ID: {eventId || "unbekannt"}</Badge>
          <Badge variant={registrationInfo?.isOpen ? "secondary" : "outline"}>
            Registrierung {registrationInfo?.isOpen ? "offen" : "geschlossen"}
          </Badge>
          {registrationInfo?.reason && <Badge variant="outline">Grund: {registrationInfo.reason}</Badge>}
        </div>

        {submitSuccess && (
          <div className="rounded-md border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
            Eingang bestätigt. Bitte E-Mail-Bestätigung abwarten.
          </div>
        )}

        <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="classId">Klasse</Label>
            <select
              id="classId"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...form.register("classId")}
            >
              <option value="">Bitte wählen</option>
              {classes.map((entry) => (
                <option key={getClassId(entry)} value={getClassId(entry)}>
                  {getClassLabel(entry)}
                </option>
              ))}
            </select>
            {errors.classId?.message && <div className="text-xs text-destructive">{errors.classId.message}</div>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="startNumber">Startnummer</Label>
            <Input
              id="startNumber"
              {...form.register("startNumber")}
              onBlur={(event) => form.setValue("startNumber", event.target.value.toUpperCase())}
            />
            {errors.startNumber?.message && <div className="text-xs text-destructive">{errors.startNumber.message}</div>}
          </div>

          <div className="space-y-2">
            <Label>Startnummer prüfen</Label>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              {validateMutation.isPending && "Prüfe..."}
              {!validateMutation.isPending && validationStatus && (
                <span>
                  {validationStatus.available ? "Verfügbar" : "Bereits vergeben"} · Format{" "}
                  {validationStatus.validFormat ? "ok" : "ungültig"}
                </span>
              )}
              {!validateMutation.isPending && !validationStatus && "Noch nicht geprüft"}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicleType">Fahrzeugtyp</Label>
            <select
              id="vehicleType"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...form.register("vehicle.vehicleType")}
            >
              {vehicleTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicleMake">Marke</Label>
            <Input id="vehicleMake" {...form.register("vehicle.make")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicleModel">Modell</Label>
            <Input id="vehicleModel" {...form.register("vehicle.model")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicleYear">Baujahr</Label>
            <Input id="vehicleYear" type="number" {...form.register("vehicle.year")} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="vehicleImage">Fahrzeugbild</Label>
            <Input
              id="vehicleImage"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => handleUpload(event.target.files?.[0] ?? null)}
            />
            {uploadState !== "idle" && (
              <div className="text-xs text-muted-foreground">
                {uploadState === "uploading" && "Upload läuft..."}
                {uploadState === "done" && uploadMessage}
                {uploadState === "error" && uploadMessage}
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center gap-2 text-sm">
              <input id="backupVehicle" type="checkbox" {...form.register("isBackupVehicle")} />
              <Label htmlFor="backupVehicle">Ersatzfahrzeug</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="driverFirstName">Fahrer Vorname</Label>
            <Input id="driverFirstName" {...form.register("driver.firstName")} />
            {errors.driver?.firstName?.message && (
              <div className="text-xs text-destructive">{errors.driver.firstName.message}</div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="driverLastName">Fahrer Nachname</Label>
            <Input id="driverLastName" {...form.register("driver.lastName")} />
            {errors.driver?.lastName?.message && (
              <div className="text-xs text-destructive">{errors.driver.lastName.message}</div>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="driverEmail">Fahrer E-Mail</Label>
            <Input id="driverEmail" type="email" {...form.register("driver.email")} />
            {errors.driver?.email?.message && (
              <div className="text-xs text-destructive">{errors.driver.email.message}</div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="driverBirthdate">Geburtsdatum</Label>
            <Input id="driverBirthdate" placeholder="YYYY-MM-DD" {...form.register("driver.birthdate")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="driverPhone">Telefon</Label>
            <Input id="driverPhone" {...form.register("driver.phone")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="driverStreet">Straße</Label>
            <Input id="driverStreet" {...form.register("driver.street")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="driverZip">PLZ</Label>
            <Input id="driverZip" {...form.register("driver.zip")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="driverCity">Ort</Label>
            <Input id="driverCity" {...form.register("driver.city")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="driverNationality">Nationalität</Label>
            <Input id="driverNationality" {...form.register("driver.nationality")} />
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center gap-2 text-sm">
              <input
                id="hasCodriver"
                type="checkbox"
                checked={includeCodriver}
                onChange={(event) => setIncludeCodriver(event.target.checked)}
              />
              <Label htmlFor="hasCodriver">Beifahrer hinzufügen</Label>
            </div>
          </div>

          {includeCodriver && (
            <>
              <div className="space-y-2">
                <Label htmlFor="codriverFirstName">Beifahrer Vorname</Label>
                <Input id="codriverFirstName" {...form.register("codriver.firstName")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codriverLastName">Beifahrer Nachname</Label>
                <Input id="codriverLastName" {...form.register("codriver.lastName")} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="codriverEmail">Beifahrer E-Mail</Label>
                <Input id="codriverEmail" type="email" {...form.register("codriver.email")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codriverBirthdate">Beifahrer Geburtsdatum</Label>
                <Input id="codriverBirthdate" placeholder="YYYY-MM-DD" {...form.register("codriver.birthdate")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codriverPhone">Beifahrer Telefon</Label>
                <Input id="codriverPhone" {...form.register("codriver.phone")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codriverStreet">Beifahrer Straße</Label>
                <Input id="codriverStreet" {...form.register("codriver.street")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codriverZip">Beifahrer PLZ</Label>
                <Input id="codriverZip" {...form.register("codriver.zip")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codriverCity">Beifahrer Ort</Label>
                <Input id="codriverCity" {...form.register("codriver.city")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codriverNationality">Beifahrer Nationalität</Label>
                <Input id="codriverNationality" {...form.register("codriver.nationality")} />
              </div>
            </>
          )}

          {submitMutation.isError && (
            <div className="md:col-span-2">
              <ErrorState message={getErrorMessage(submitMutation.error)} />
            </div>
          )}

          <div className="md:col-span-2">
            <Button type="submit" className="w-full" disabled={!canSubmit || submitMutation.isPending}>
              {submitMutation.isPending ? "Sende..." : "Anmeldung absenden"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
