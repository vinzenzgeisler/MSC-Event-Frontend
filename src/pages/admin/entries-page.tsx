import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAdminEntries, getAdminEventClasses, getAdminEventsCurrent } from "@/api/client";
import { acceptanceStatuses, paymentStatuses, registrationStatuses, techStatuses } from "@/api/types";
import { EmptyState } from "@/components/state/empty-state";
import { ErrorState } from "@/components/state/error-state";
import { LoadingState } from "@/components/state/loading-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { getErrorMessage } from "@/lib/http/api-error";

function extractEventId(payload: unknown) {
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

function getEntryLabel(entry: Record<string, unknown>) {
  const driver = entry.driver as Record<string, unknown> | undefined;
  const firstName = (driver?.firstName as string) || (entry.firstName as string);
  const lastName = (driver?.lastName as string) || (entry.lastName as string);
  const startNumber = (entry.startNumber as string) || (entry.vehicle as Record<string, unknown>)?.startNumber;
  const parts = [firstName, lastName].filter(Boolean).join(" ");
  return parts || (startNumber as string) || (entry.id as string) || "Unbekannte Nennung";
}

export function AdminEntriesPage() {
  const [filters, setFilters] = useState({
    q: "",
    classId: "",
    acceptanceStatus: "",
    registrationStatus: "",
    paymentStatus: "",
    techStatus: "",
    checkinIdVerified: ""
  });

  const debouncedQuery = useDebouncedValue(filters.q, 400);

  const currentEventQuery = useQuery({
    queryKey: ["admin", "currentEvent"],
    queryFn: getAdminEventsCurrent
  });

  const eventId = useMemo(() => extractEventId(currentEventQuery.data), [currentEventQuery.data]);

  const classQuery = useQuery({
    queryKey: ["admin", "classes", eventId],
    queryFn: () => getAdminEventClasses(eventId),
    enabled: !!eventId
  });

  const entriesQuery = useQuery({
    queryKey: [
      "admin",
      "entries",
      eventId,
      debouncedQuery,
      filters.classId,
      filters.acceptanceStatus,
      filters.registrationStatus,
      filters.paymentStatus,
      filters.techStatus,
      filters.checkinIdVerified
    ],
    queryFn: () =>
      getAdminEntries({
        eventId,
        q: debouncedQuery || undefined,
        classId: filters.classId || undefined,
        acceptanceStatus: filters.acceptanceStatus || undefined,
        registrationStatus: filters.registrationStatus || undefined,
        paymentStatus: filters.paymentStatus || undefined,
        techStatus: filters.techStatus || undefined,
        checkinIdVerified: filters.checkinIdVerified ? filters.checkinIdVerified === "true" : undefined
      }),
    enabled: !!eventId
  });

  if (currentEventQuery.isLoading) {
    return <LoadingState />;
  }

  if (currentEventQuery.error) {
    return <ErrorState message={getErrorMessage(currentEventQuery.error)} />;
  }

  const entries = entriesQuery.data?.entries ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nennungen</CardTitle>
        <CardDescription>Übersicht aller Einträge für das aktuelle Event.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Event ID: {eventId || "unbekannt"}</Badge>
          {entriesQuery.data?.meta && (
            <Badge variant="outline">
              {entriesQuery.data.meta.total} Einträge · Seite {entriesQuery.data.meta.page}
            </Badge>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="search">Suche</Label>
            <Input
              id="search"
              value={filters.q}
              onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
              placeholder="Name oder Startnummer"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="classId">Klasse</Label>
            <select
              id="classId"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={filters.classId}
              onChange={(event) => setFilters((prev) => ({ ...prev, classId: event.target.value }))}
            >
              <option value="">Alle</option>
              {(classQuery.data?.classes ?? []).map((entry) => (
                <option key={getClassId(entry)} value={getClassId(entry)}>
                  {getClassLabel(entry)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="acceptanceStatus">Status</Label>
            <select
              id="acceptanceStatus"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={filters.acceptanceStatus}
              onChange={(event) => setFilters((prev) => ({ ...prev, acceptanceStatus: event.target.value }))}
            >
              <option value="">Alle</option>
              {acceptanceStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="registrationStatus">Registrierung</Label>
            <select
              id="registrationStatus"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={filters.registrationStatus}
              onChange={(event) => setFilters((prev) => ({ ...prev, registrationStatus: event.target.value }))}
            >
              <option value="">Alle</option>
              {registrationStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentStatus">Zahlung</Label>
            <select
              id="paymentStatus"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={filters.paymentStatus}
              onChange={(event) => setFilters((prev) => ({ ...prev, paymentStatus: event.target.value }))}
            >
              <option value="">Alle</option>
              {paymentStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="techStatus">Technik</Label>
            <select
              id="techStatus"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={filters.techStatus}
              onChange={(event) => setFilters((prev) => ({ ...prev, techStatus: event.target.value }))}
            >
              <option value="">Alle</option>
              {techStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkinIdVerified">ID geprüft</Label>
            <select
              id="checkinIdVerified"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={filters.checkinIdVerified}
              onChange={(event) => setFilters((prev) => ({ ...prev, checkinIdVerified: event.target.value }))}
            >
              <option value="">Alle</option>
              <option value="true">Ja</option>
              <option value="false">Nein</option>
            </select>
          </div>
        </div>

        {entriesQuery.isLoading && <LoadingState />}
        {entriesQuery.error && <ErrorState message={getErrorMessage(entriesQuery.error)} />}

        {!entriesQuery.isLoading && entries.length === 0 && <EmptyState message="Keine Einträge gefunden." />}

        {entries.length > 0 && (
          <div className="space-y-2">
            {entries.map((entry, index) => (
              <div key={index} className="rounded-md border p-3">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div className="font-medium">{getEntryLabel(entry)}</div>
                  <Link className="text-sm text-primary underline" to={`/admin/entries/${entry.id || index}`}>
                    Details
                  </Link>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Startnummer: {(entry.startNumber as string) || (entry.vehicle as Record<string, unknown>)?.startNumber || "-"} ·
                  Klasse: {(entry.className as string) || (entry.classId as string) || "-"} · Status:{" "}
                  {(entry.acceptanceStatus as string) || "-"}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
