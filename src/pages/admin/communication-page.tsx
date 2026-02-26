import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { outboxStatusClasses, outboxStatusLabel, paymentStatusLabel } from "@/lib/admin-status";
import { getApiErrorMessage } from "@/services/api/http-client";
import { communicationService } from "@/services/communication.service";
import { adminMetaService, type AdminClassOption } from "@/services/admin-meta.service";
import type { BroadcastForm, OutboxItem } from "@/types/admin";

const initialForm: BroadcastForm = {
  classId: "all",
  acceptanceStatus: "all",
  paymentStatus: "all",
  templateKey: "",
  subjectOverride: ""
};
const OUTBOX_PREVIEW_LIMIT = 10;

export function AdminCommunicationPage() {
  const { roles } = useAuth();
  const canManageCommunication = hasPermission(roles, "communication.write");
  const [form, setForm] = useState<BroadcastForm>(initialForm);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [classOptions, setClassOptions] = useState<AdminClassOption[]>([]);
  const [eventName, setEventName] = useState("");
  const [outboxExpanded, setOutboxExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [loadingOutbox, setLoadingOutbox] = useState(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 2600);
  };

  const loadOutbox = async (options?: { silentError?: boolean }) => {
    if (!options?.silentError) {
      setLoadingOutbox(true);
    }
    try {
      setOutbox(await communicationService.listOutbox());
    } catch (error) {
      if (!options?.silentError) {
        showToast(getApiErrorMessage(error, "Postausgang konnte nicht geladen werden."));
      }
    } finally {
      if (!options?.silentError) {
        setLoadingOutbox(false);
      }
    }
  };

  const resolveSubject = (subject: string) => {
    if (!subject.includes("{{")) {
      return subject;
    }
    const fallback = eventName.trim() || "Aktuelles Event";
    return subject.replace(/\{\{\s*eventName\s*\}\}/gi, fallback);
  };
  const hiddenOutboxCount = Math.max(outbox.length - OUTBOX_PREVIEW_LIMIT, 0);
  const visibleOutbox = outboxExpanded ? outbox : outbox.slice(0, OUTBOX_PREVIEW_LIMIT);

  useEffect(() => {
    void loadOutbox();
    const refreshTimer = window.setInterval(() => {
      void loadOutbox({ silentError: true });
    }, 15000);

    adminMetaService
      .getCurrentEvent()
      .then((event) => setEventName(event.name ?? ""))
      .catch(() => setEventName(""));

    adminMetaService
      .listClassOptions()
      .then(setClassOptions)
      .catch((error) => showToast(getApiErrorMessage(error, "Klassen konnten nicht geladen werden.")));

    return () => {
      window.clearInterval(refreshTimer);
    };
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Kommunikation</h1>

      <Card>
        <CardHeader>
          <CardTitle>Broadcast</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label>Klasse</Label>
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={form.classId}
              onChange={(event) => setForm((prev) => ({ ...prev, classId: event.target.value }))}
            >
              <option value="all">Alle</option>
              {classOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={form.acceptanceStatus}
              onChange={(event) => setForm((prev) => ({ ...prev, acceptanceStatus: event.target.value as BroadcastForm["acceptanceStatus"] }))}
            >
              <option value="all">Alle</option>
              <option value="pending">Offen</option>
              <option value="shortlist">Vorauswahl</option>
              <option value="accepted">Zugelassen</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Zahlung</Label>
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={form.paymentStatus}
              onChange={(event) => setForm((prev) => ({ ...prev, paymentStatus: event.target.value as BroadcastForm["paymentStatus"] }))}
            >
              <option value="all">Alle</option>
              <option value="due">{paymentStatusLabel("due")}</option>
              <option value="paid">{paymentStatusLabel("paid")}</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Template Key</Label>
            <Input value={form.templateKey} onChange={(event) => setForm((prev) => ({ ...prev, templateKey: event.target.value }))} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Betreff (optional)</Label>
            <Input value={form.subjectOverride} onChange={(event) => setForm((prev) => ({ ...prev, subjectOverride: event.target.value }))} />
          </div>
          <div className="md:col-span-3">
            {canManageCommunication ? (
              <Button
                className="w-full md:w-auto"
                type="button"
                onClick={async () => {
                  try {
                    await communicationService.queueBroadcast(form);
                    showToast("Broadcast wurde in die Warteschlange gelegt.");
                    await loadOutbox();
                  } catch (error) {
                    showToast(getApiErrorMessage(error, "Broadcast konnte nicht gestartet werden."));
                  }
                }}
              >
                Broadcast in Warteschlange legen
              </Button>
            ) : (
              <div className="text-sm text-slate-500">Nur Admin-Rollen dürfen Broadcasts starten.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Postausgang</CardTitle>
            <Button type="button" size="sm" variant="outline" disabled={loadingOutbox} onClick={() => void loadOutbox()}>
              {loadingOutbox ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Lädt…
                </>
              ) : (
                "Aktualisieren"
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 md:hidden">
            {visibleOutbox.map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="font-medium text-slate-900">{resolveSubject(item.subject)}</div>
                <div className="text-xs text-slate-600">{item.recipient}</div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Badge className={outboxStatusClasses(item.status)} variant="outline">
                    {outboxStatusLabel(item.status)}
                  </Badge>
                  {item.status === "failed" && canManageCommunication ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await communicationService.retryOutbox(item.id);
                          showToast("Outbox-Eintrag wurde erneut eingeplant.");
                          await loadOutbox();
                        } catch (error) {
                          showToast(getApiErrorMessage(error, "Retry fehlgeschlagen."));
                        }
                      }}
                    >
                      Erneut senden
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-500">{item.createdAt}</span>
                  )}
                </div>
                {item.error && <div className="mt-2 text-xs text-destructive">{item.error}</div>}
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">Empfänger</th>
                  <th className="px-3 py-2">Betreff</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Erstellt</th>
                  <th className="px-3 py-2">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {visibleOutbox.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-3 py-2">{item.recipient}</td>
                    <td className="px-3 py-2">{resolveSubject(item.subject)}</td>
                    <td className="px-3 py-2">
                      <Badge className={outboxStatusClasses(item.status)} variant="outline">
                        {outboxStatusLabel(item.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{item.createdAt}</td>
                    <td className="px-3 py-2">
                      {item.status === "failed" && canManageCommunication ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await communicationService.retryOutbox(item.id);
                              showToast("Outbox-Eintrag wurde erneut eingeplant.");
                              await loadOutbox();
                            } catch (error) {
                              showToast(getApiErrorMessage(error, "Retry fehlgeschlagen."));
                            }
                          }}
                        >
                          Erneut senden
                        </Button>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hiddenOutboxCount > 0 && !outboxExpanded && (
            <Button type="button" variant="outline" onClick={() => setOutboxExpanded(true)}>
              Weitere {hiddenOutboxCount} Einträge anzeigen
            </Button>
          )}
          {outboxExpanded && outbox.length > OUTBOX_PREVIEW_LIMIT && (
            <Button type="button" variant="outline" onClick={() => setOutboxExpanded(false)}>
              Auf letzte {OUTBOX_PREVIEW_LIMIT} Einträge reduzieren
            </Button>
          )}
        </CardContent>
      </Card>

      {toastMessage && (
        <div className="fixed right-4 top-4 z-40 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 shadow-sm">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
