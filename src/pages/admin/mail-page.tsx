import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getAdminEventsCurrent, getAdminOutbox, queueBroadcastMail, queuePaymentReminder, retryOutbox } from "@/api/client";
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

export function AdminMailPage() {
  const [broadcast, setBroadcast] = useState({ templateKey: "", subjectOverride: "" });
  const [reminder, setReminder] = useState({ templateId: "", subject: "" });
  const [statusFilter, setStatusFilter] = useState("");

  const currentEventQuery = useQuery({
    queryKey: ["admin", "currentEvent"],
    queryFn: getAdminEventsCurrent
  });

  const eventId = useMemo(() => extractEventId(currentEventQuery.data), [currentEventQuery.data]);

  const outboxQuery = useQuery({
    queryKey: ["admin", "outbox", eventId, statusFilter],
    queryFn: () => getAdminOutbox({ eventId, status: statusFilter || undefined }),
    enabled: !!eventId
  });

  const broadcastMutation = useMutation({
    mutationFn: () => queueBroadcastMail({
      eventId,
      templateKey: broadcast.templateKey,
      subjectOverride: broadcast.subjectOverride || undefined
    })
  });

  const reminderMutation = useMutation({
    mutationFn: () => queuePaymentReminder({
      eventId,
      templateId: reminder.templateId,
      subject: reminder.subject || undefined
    })
  });

  const retryMutation = useMutation({
    mutationFn: (outboxId: string) => retryOutbox(outboxId)
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
          <CardTitle>Broadcast Mail</CardTitle>
          <CardDescription>Broadcast an Gruppen via Template-Key.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="templateKey">Template Key</Label>
            <Input
              id="templateKey"
              value={broadcast.templateKey}
              onChange={(event) => setBroadcast((prev) => ({ ...prev, templateKey: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subjectOverride">Subject Override (optional)</Label>
            <Input
              id="subjectOverride"
              value={broadcast.subjectOverride}
              onChange={(event) => setBroadcast((prev) => ({ ...prev, subjectOverride: event.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => broadcastMutation.mutate()} disabled={broadcastMutation.isPending || !eventId}>
              Broadcast queue
            </Button>
            {broadcastMutation.isError && <ErrorState message={getErrorMessage(broadcastMutation.error)} />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zahlungs-Reminder</CardTitle>
          <CardDescription>Payment reminders queue.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="templateId">Template ID</Label>
            <Input
              id="templateId"
              value={reminder.templateId}
              onChange={(event) => setReminder((prev) => ({ ...prev, templateId: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subject (optional)</Label>
            <Input
              id="subject"
              value={reminder.subject}
              onChange={(event) => setReminder((prev) => ({ ...prev, subject: event.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => reminderMutation.mutate()} disabled={reminderMutation.isPending || !eventId}>
              Reminder queue
            </Button>
            {reminderMutation.isError && <ErrorState message={getErrorMessage(reminderMutation.error)} />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outbox</CardTitle>
          <CardDescription>Queued / sending / sent / failed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="statusFilter">Status Filter</Label>
            <Input
              id="statusFilter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              placeholder="queued, sending, sent, failed"
            />
          </div>
          {outboxQuery.isLoading && <LoadingState />}
          {outboxQuery.error && <ErrorState message={getErrorMessage(outboxQuery.error)} />}
          {outboxQuery.data?.outbox?.length ? (
            <div className="space-y-2">
              {outboxQuery.data.outbox.map((item, index) => (
                <div key={index} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>{(item.subject as string) || (item.templateKey as string) || item.id || "Outbox"}</div>
                    {item.id && (
                      <Button
                        variant="outline"
                        onClick={() => retryMutation.mutate(String(item.id))}
                        disabled={retryMutation.isPending}
                      >
                        Retry
                      </Button>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">Status: {String(item.status || "-")}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Keine Outbox-Einträge.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
