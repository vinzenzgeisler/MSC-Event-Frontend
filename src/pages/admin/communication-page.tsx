import { useEffect, useState } from "react";
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

export function AdminCommunicationPage() {
  const { roles } = useAuth();
  const canManageCommunication = hasPermission(roles, "communication.write");
  const [form, setForm] = useState<BroadcastForm>(initialForm);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [classOptions, setClassOptions] = useState<AdminClassOption[]>([]);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 2600);
  };

  const loadOutbox = async () => {
    try {
      setOutbox(await communicationService.listOutbox());
    } catch (error) {
      showToast(getApiErrorMessage(error, "Postausgang konnte nicht geladen werden."));
    }
  };

  useEffect(() => {
    void loadOutbox();

    adminMetaService
      .listClassOptions()
      .then(setClassOptions)
      .catch((error) => showToast(getApiErrorMessage(error, "Klassen konnten nicht geladen werden.")));
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
          <CardTitle>Postausgang</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 md:hidden">
            {outbox.map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="font-medium text-slate-900">{item.subject}</div>
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
                {outbox.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-3 py-2">{item.recipient}</td>
                    <td className="px-3 py-2">{item.subject}</td>
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
