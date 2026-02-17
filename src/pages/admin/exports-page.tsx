import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createExport, downloadExport, getAdminEventsCurrent, getAdminExports } from "@/api/client";
import { exportFormats, exportTypes } from "@/api/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/state/error-state";
import { LoadingState } from "@/components/state/loading-state";
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

export function AdminExportsPage() {
  const [form, setForm] = useState({
    type: exportTypes[0],
    classId: "",
    acceptanceStatus: "",
    paymentOpenOnly: false,
    checkinIdVerified: false,
    format: exportFormats[0]
  });

  const currentEventQuery = useQuery({
    queryKey: ["admin", "currentEvent"],
    queryFn: getAdminEventsCurrent
  });

  const eventId = useMemo(() => extractEventId(currentEventQuery.data), [currentEventQuery.data]);

  const exportsQuery = useQuery({
    queryKey: ["admin", "exports", eventId],
    queryFn: () => getAdminExports(eventId),
    enabled: !!eventId
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createExport({
        eventId,
        type: form.type,
        classId: form.classId || undefined,
        acceptanceStatus: form.acceptanceStatus || undefined,
        paymentOpenOnly: form.paymentOpenOnly || undefined,
        checkinIdVerified: form.checkinIdVerified || undefined,
        format: form.format
      })
  });

  const downloadMutation = useMutation({
    mutationFn: (exportJobId: string) => downloadExport(exportJobId)
  });

  if (currentEventQuery.isLoading) {
    return <LoadingState />;
  }

  if (currentEventQuery.error) {
    return <ErrorState message={getErrorMessage(currentEventQuery.error)} />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Export erstellen</CardTitle>
          <CardDescription>CSV-Export für das aktuelle Event.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="type">Export-Typ</Label>
            <select
              id="type"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.type}
              onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
            >
              {exportTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="classId">Klasse (optional)</Label>
            <Input
              id="classId"
              value={form.classId}
              onChange={(event) => setForm((prev) => ({ ...prev, classId: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acceptanceStatus">Status (optional)</Label>
            <Input
              id="acceptanceStatus"
              value={form.acceptanceStatus}
              onChange={(event) => setForm((prev) => ({ ...prev, acceptanceStatus: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="format">Format</Label>
            <select
              id="format"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.format}
              onChange={(event) => setForm((prev) => ({ ...prev, format: event.target.value }))}
            >
              {exportFormats.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <input
              id="paymentOpenOnly"
              type="checkbox"
              checked={form.paymentOpenOnly}
              onChange={(event) => setForm((prev) => ({ ...prev, paymentOpenOnly: event.target.checked }))}
            />
            <Label htmlFor="paymentOpenOnly">Nur offene Zahlungen</Label>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <input
              id="checkinIdVerified"
              type="checkbox"
              checked={form.checkinIdVerified}
              onChange={(event) => setForm((prev) => ({ ...prev, checkinIdVerified: event.target.checked }))}
            />
            <Label htmlFor="checkinIdVerified">Nur ID geprüft</Label>
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !eventId}>
              Export erstellen
            </Button>
            {createMutation.isError && <ErrorState message={getErrorMessage(createMutation.error)} />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exportliste</CardTitle>
          <CardDescription>Verfügbare Exporte.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {exportsQuery.isLoading && <LoadingState />}
          {exportsQuery.error && <ErrorState message={getErrorMessage(exportsQuery.error)} />}
          {exportsQuery.data?.exports?.length ? (
            <div className="space-y-2">
              {exportsQuery.data.exports.map((item, index) => (
                <div key={index} className="rounded-md border p-3 text-sm">
                  <div className="font-medium">{String(item.type || item.id || "Export")}</div>
                  <div className="text-xs text-muted-foreground">Status: {String(item.status || "-")}</div>
                  {item.id && (
                    <Button
                      className="mt-2"
                      variant="outline"
                      onClick={async () => {
                        const blob = await downloadMutation.mutateAsync(String(item.id));
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = `export-${item.id}.csv`;
                        link.click();
                        URL.revokeObjectURL(url);
                      }}
                      disabled={downloadMutation.isPending}
                    >
                      Download
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Keine Exporte vorhanden.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
