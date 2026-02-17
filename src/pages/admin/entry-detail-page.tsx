import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  generateTechCheck,
  generateWaiver,
  getAdminEntryDetail,
  getAdminEventsCurrent,
  patchCheckinIdVerify,
  patchEntryStatus,
  patchTechStatus,
  recordPayment
} from "@/api/client";
import { acceptanceStatuses, lifecycleEventTypes, paymentMethods, techStatuses } from "@/api/types";
import { ErrorState } from "@/components/state/error-state";
import { LoadingState } from "@/components/state/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function AdminEntryDetailPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const [acceptanceStatus, setAcceptanceStatus] = useState(acceptanceStatuses[0]);
  const [sendLifecycleMail, setSendLifecycleMail] = useState(false);
  const [lifecycleEventType, setLifecycleEventType] = useState(lifecycleEventTypes[0]);
  const [techStatus, setTechStatus] = useState(techStatuses[0]);
  const [payment, setPayment] = useState({ amountCents: "", paidAt: "", method: paymentMethods[0], note: "" });

  const detailQuery = useQuery({
    queryKey: ["admin", "entry", entryId],
    queryFn: () => getAdminEntryDetail(entryId || ""),
    enabled: !!entryId
  });

  const currentEventQuery = useQuery({
    queryKey: ["admin", "currentEvent"],
    queryFn: getAdminEventsCurrent
  });

  const entry = detailQuery.data?.entry as Record<string, unknown> | undefined;
  const history = detailQuery.data?.history ?? [];

  const eventId = useMemo(() => entry?.eventId || extractEventId(currentEventQuery.data), [entry, currentEventQuery.data]);

  const invoiceId = (entry?.invoiceId as string) || (entry?.invoice as Record<string, unknown>)?.id || "";

  const statusMutation = useMutation({
    mutationFn: () => patchEntryStatus(entryId || "", { acceptanceStatus, sendLifecycleMail, lifecycleEventType })
  });

  const techMutation = useMutation({
    mutationFn: () => patchTechStatus(entryId || "", { techStatus })
  });

  const checkinMutation = useMutation({
    mutationFn: () => patchCheckinIdVerify(entryId || "")
  });

  const paymentMutation = useMutation({
    mutationFn: () =>
      recordPayment(invoiceId, {
        amountCents: Number(payment.amountCents),
        paidAt: payment.paidAt ? new Date(payment.paidAt).toISOString() : new Date().toISOString(),
        method: payment.method,
        note: payment.note || undefined
      })
  });

  const waiverMutation = useMutation({
    mutationFn: () => generateWaiver({ eventId, entryId: entryId || "" })
  });

  const techCheckMutation = useMutation({
    mutationFn: () => generateTechCheck({ eventId, entryId: entryId || "" })
  });

  if (detailQuery.isLoading) {
    return <LoadingState />;
  }

  if (detailQuery.error) {
    return <ErrorState message={getErrorMessage(detailQuery.error)} />;
  }

  if (!entry) {
    return <ErrorState message="Eintrag nicht gefunden." />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nennungsdetail</CardTitle>
          <CardDescription>ID: {entryId}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {entry.acceptanceStatus && <Badge variant="secondary">Status: {String(entry.acceptanceStatus)}</Badge>}
            {entry.registrationStatus && <Badge variant="outline">Registrierung: {String(entry.registrationStatus)}</Badge>}
            {entry.paymentStatus && <Badge variant="outline">Zahlung: {String(entry.paymentStatus)}</Badge>}
            {entry.techStatus && <Badge variant="outline">Technik: {String(entry.techStatus)}</Badge>}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase text-muted-foreground">Fahrer</div>
              <div className="text-sm">
                {(entry.driver as Record<string, unknown>)?.firstName} {(entry.driver as Record<string, unknown>)?.lastName}
              </div>
              <div className="text-xs text-muted-foreground">{(entry.driver as Record<string, unknown>)?.email}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Fahrzeug</div>
              <div className="text-sm">
                {(entry.vehicle as Record<string, unknown>)?.make} {(entry.vehicle as Record<string, unknown>)?.model}
              </div>
              <div className="text-xs text-muted-foreground">
                Startnummer: {(entry.startNumber as string) || (entry.vehicle as Record<string, unknown>)?.startNumber || "-"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status & Check-in</CardTitle>
          <CardDescription>Statusänderungen und ID-Check.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Status</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={acceptanceStatus}
              onChange={(event) => setAcceptanceStatus(event.target.value)}
            >
              {acceptanceStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 text-sm">
              <input
                id="sendLifecycleMail"
                type="checkbox"
                checked={sendLifecycleMail}
                onChange={(event) => setSendLifecycleMail(event.target.checked)}
              />
              <Label htmlFor="sendLifecycleMail">Lifecycle-Mail senden</Label>
            </div>
            {sendLifecycleMail && (
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={lifecycleEventType}
                onChange={(event) => setLifecycleEventType(event.target.value)}
              >
                {lifecycleEventTypes.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            )}
            <Button onClick={() => statusMutation.mutate()} disabled={statusMutation.isPending}>
              {statusMutation.isPending ? "Speichere..." : "Status speichern"}
            </Button>
            {statusMutation.isError && <ErrorState message={getErrorMessage(statusMutation.error)} />}
          </div>

          <div className="space-y-2">
            <Label>Technikstatus</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={techStatus}
              onChange={(event) => setTechStatus(event.target.value)}
            >
              {techStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <Button onClick={() => techMutation.mutate()} disabled={techMutation.isPending}>
              {techMutation.isPending ? "Speichere..." : "Tech-Status speichern"}
            </Button>
            {techMutation.isError && <ErrorState message={getErrorMessage(techMutation.error)} />}

            <Button variant="outline" onClick={() => checkinMutation.mutate()} disabled={checkinMutation.isPending}>
              ID geprüft markieren
            </Button>
            {checkinMutation.isError && <ErrorState message={getErrorMessage(checkinMutation.error)} />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zahlung</CardTitle>
          <CardDescription>Erfassung von Zahlungen (falls Rechnung vorhanden).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!invoiceId && <div className="text-sm text-muted-foreground">Keine Rechnung verknüpft.</div>}
          {invoiceId && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Betrag (Cent)</Label>
                <Input
                  id="amount"
                  value={payment.amountCents}
                  onChange={(event) => setPayment((prev) => ({ ...prev, amountCents: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paidAt">Zahlungsdatum</Label>
                <Input
                  id="paidAt"
                  type="datetime-local"
                  value={payment.paidAt}
                  onChange={(event) => setPayment((prev) => ({ ...prev, paidAt: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="method">Methode</Label>
                <select
                  id="method"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={payment.method}
                  onChange={(event) => setPayment((prev) => ({ ...prev, method: event.target.value }))}
                >
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Notiz</Label>
                <Input
                  id="note"
                  value={payment.note}
                  onChange={(event) => setPayment((prev) => ({ ...prev, note: event.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Button onClick={() => paymentMutation.mutate()} disabled={paymentMutation.isPending}>
                  Zahlung speichern
                </Button>
                {paymentMutation.isError && <ErrorState message={getErrorMessage(paymentMutation.error)} />}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dokumente</CardTitle>
          <CardDescription>Haftverzicht und Tech-Check erstellen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!eventId && <div className="text-sm text-muted-foreground">Event ID fehlt.</div>}
          {eventId && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => waiverMutation.mutate()} disabled={waiverMutation.isPending}>
                Haftverzicht erzeugen
              </Button>
              <Button variant="outline" onClick={() => techCheckMutation.mutate()} disabled={techCheckMutation.isPending}>
                Tech-Check erzeugen
              </Button>
            </div>
          )}
          {waiverMutation.isError && <ErrorState message={getErrorMessage(waiverMutation.error)} />}
          {techCheckMutation.isError && <ErrorState message={getErrorMessage(techCheckMutation.error)} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>Audit/History-Einträge.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 && <div className="text-sm text-muted-foreground">Keine Einträge vorhanden.</div>}
          {history.map((item, index) => (
            <div key={index} className="rounded-md border p-3 text-sm">
              <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{JSON.stringify(item, null, 2)}</pre>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
