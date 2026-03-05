import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
const TEMPLATE_DRAFTS_STORAGE_KEY = "msc.communication.template-drafts.v1";

type TemplatePreset = {
  key: string;
  label: string;
  defaultSubject: string;
  defaultBody: string;
  requiresVerificationLink?: boolean;
};

const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    key: "registration_received",
    label: "Verifizierungs-Mail",
    defaultSubject: "Bitte E-Mail verifizieren: {{eventName}}",
    defaultBody:
      "Hallo {{firstName}} {{lastName}},\n\nbitte bestaetige deine Anmeldung ueber diesen Link:\n{{verificationUrl}}\n\nDanach wird deine Nennung weiter verarbeitet.\n\nViele Gruesse\n{{eventName}}",
    requiresVerificationLink: true
  },
  {
    key: "preselection",
    label: "Vorauswahl",
    defaultSubject: "Vorauswahl fuer {{eventName}}",
    defaultBody:
      "Hallo {{firstName}} {{lastName}},\n\ndeine Nennung ist aktuell in der Vorauswahl. Wir melden uns mit dem finalen Status.\n\nViele Gruesse\n{{eventName}}"
  },
  {
    key: "accepted_open_payment",
    label: "Zulassung",
    defaultSubject: "Zulassung: {{eventName}}",
    defaultBody:
      "Hallo {{firstName}} {{lastName}},\n\ndeine Nennung wurde zugelassen. Offener Betrag: {{amountOpen}}.\n\nViele Gruesse\n{{eventName}}"
  },
  {
    key: "rejected",
    label: "Ablehnung",
    defaultSubject: "Statusupdate: {{eventName}}",
    defaultBody:
      "Hallo {{firstName}} {{lastName}},\n\nleider koennen wir deine Nennung fuer {{eventName}} nicht zulassen.\n\nViele Gruesse\n{{eventName}}"
  },
  {
    key: "payment_reminder",
    label: "Zahlungserinnerung",
    defaultSubject: "Erinnerung Zahlung: {{eventName}}",
    defaultBody:
      "Hallo {{firstName}} {{lastName}},\n\nbitte begleiche den offenen Betrag von {{amountOpen}} fuer deine Nennung.\n\nViele Gruesse\n{{eventName}}"
  }
];

type TemplateDrafts = Record<string, { subject: string; body: string }>;

type PlaceholderHelpItem = {
  token: string;
  description: string;
  usedIn: string[];
  requiredIn?: string[];
};

const PLACEHOLDER_HELP: PlaceholderHelpItem[] = [
  {
    token: "eventName",
    description: "Name des aktuellen Events",
    usedIn: ["registration_received", "preselection", "accepted_open_payment", "rejected", "payment_reminder"]
  },
  {
    token: "firstName",
    description: "Vorname des Fahrers",
    usedIn: ["registration_received", "preselection", "accepted_open_payment", "rejected", "payment_reminder"]
  },
  {
    token: "lastName",
    description: "Nachname des Fahrers",
    usedIn: ["registration_received", "preselection", "accepted_open_payment", "rejected", "payment_reminder"]
  },
  {
    token: "driverName",
    description: "Vollständiger Name des Fahrers",
    usedIn: ["accepted_open_payment", "payment_reminder"]
  },
  {
    token: "className",
    description: "Klassenname der Nennung",
    usedIn: ["accepted_open_payment", "rejected"]
  },
  {
    token: "startNumber",
    description: "Startnummer der Nennung",
    usedIn: ["accepted_open_payment", "rejected"]
  },
  {
    token: "amountOpen",
    description: "Offener Zahlungsbetrag",
    usedIn: ["accepted_open_payment", "payment_reminder"]
  },
  {
    token: "verificationUrl",
    description: "Verifizierungs-Link aus Backend",
    usedIn: ["registration_received"],
    requiredIn: ["registration_received"]
  }
];

function parseEmailList(value: string) {
  const parts = value
    .split(/[\n,;]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const unique: string[] = [];
  const seen = new Set<string>();
  parts.forEach((email) => {
    if (seen.has(email)) {
      return;
    }
    seen.add(email);
    unique.push(email);
  });

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return {
    valid: unique.filter((email) => emailPattern.test(email)),
    invalid: unique.filter((email) => !emailPattern.test(email))
  };
}

function extractTemplateTokens(value: string) {
  const tokens = new Set<string>();
  value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_full, token: string) => {
    tokens.add(token);
    return "";
  });
  return Array.from(tokens.values());
}

function renderTemplate(value: string, data: Record<string, string>) {
  return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_full, token: string) => data[token] ?? `{{${token}}}`);
}

export function AdminCommunicationPage() {
  const { roles } = useAuth();
  const canManageCommunication = hasPermission(roles, "communication.write");
  const [form, setForm] = useState<BroadcastForm>(initialForm);
  const [templateBody, setTemplateBody] = useState("");
  const [templateDrafts, setTemplateDrafts] = useState<TemplateDrafts>({});
  const [additionalEmailsInput, setAdditionalEmailsInput] = useState("");
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [classOptions, setClassOptions] = useState<AdminClassOption[]>([]);
  const [eventName, setEventName] = useState("");
  const [outboxExpanded, setOutboxExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [loadingOutbox, setLoadingOutbox] = useState(false);
  const [queueing, setQueueing] = useState(false);

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

  const selectedPreset = useMemo(() => TEMPLATE_PRESETS.find((item) => item.key === form.templateKey), [form.templateKey]);

  const previewData = useMemo(
    () => ({
      eventName: eventName.trim() || "12. Oberlausitzer Dreieck",
      firstName: "Max",
      lastName: "Mustermann",
      driverName: "Max Mustermann",
      className: "Historische Klasse A",
      startNumber: "42",
      amountOpen: "89,00 EUR",
      verificationUrl: "https://example.org/anmeldung/verify?token=abc123"
    }),
    [eventName]
  );

  const renderedSubject = useMemo(() => renderTemplate(form.subjectOverride || "", previewData), [form.subjectOverride, previewData]);
  const renderedBody = useMemo(() => renderTemplate(templateBody || "", previewData), [templateBody, previewData]);

  const unresolvedTokens = useMemo(() => {
    const allTokens = [...extractTemplateTokens(form.subjectOverride), ...extractTemplateTokens(templateBody)];
    const unique = Array.from(new Set(allTokens));
    return unique.filter((token) => !(token in previewData));
  }, [form.subjectOverride, previewData, templateBody]);

  const verificationLinkMissing = useMemo(() => {
    const requiresVerification = selectedPreset?.requiresVerificationLink || /registration|verify|verification/i.test(form.templateKey);
    if (!requiresVerification) {
      return false;
    }
    return !/\{\{\s*verificationUrl\s*\}\}/i.test(templateBody) && !/https?:\/\//i.test(templateBody);
  }, [form.templateKey, selectedPreset?.requiresVerificationLink, templateBody]);

  const additionalRecipients = useMemo(() => parseEmailList(additionalEmailsInput), [additionalEmailsInput]);
  const visiblePlaceholderHelp = useMemo(() => {
    if (!form.templateKey) {
      return PLACEHOLDER_HELP;
    }
    return PLACEHOLDER_HELP.filter((item) => item.usedIn.includes(form.templateKey));
  }, [form.templateKey]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TEMPLATE_DRAFTS_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as TemplateDrafts;
      if (parsed && typeof parsed === "object") {
        setTemplateDrafts(parsed);
      }
    } catch {
      setTemplateDrafts({});
    }
  }, []);

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

  useEffect(() => {
    if (!form.templateKey.trim()) {
      return;
    }

    const fromDraft = templateDrafts[form.templateKey];
    if (fromDraft) {
      if (fromDraft.subject === form.subjectOverride && fromDraft.body === templateBody) {
        return;
      }
      setForm((prev) => ({ ...prev, subjectOverride: fromDraft.subject }));
      setTemplateBody(fromDraft.body);
      return;
    }

    const preset = TEMPLATE_PRESETS.find((item) => item.key === form.templateKey);
    if (!preset) {
      return;
    }
    setForm((prev) => ({ ...prev, subjectOverride: preset.defaultSubject }));
    setTemplateBody(preset.defaultBody);
  }, [form.subjectOverride, form.templateKey, templateBody, templateDrafts]);

  useEffect(() => {
    const key = form.templateKey.trim();
    if (!key) {
      return;
    }
    setTemplateDrafts((prev) => {
      const next: TemplateDrafts = {
        ...prev,
        [key]: {
          subject: form.subjectOverride,
          body: templateBody
        }
      };
      window.localStorage.setItem(TEMPLATE_DRAFTS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [form.subjectOverride, form.templateKey, templateBody]);

  const queueBroadcast = async () => {
    if (!canManageCommunication) {
      return;
    }
    const templateKey = form.templateKey.trim();
    if (!templateKey) {
      showToast("Template Key ist erforderlich.");
      return;
    }

    if (additionalRecipients.invalid.length > 0) {
      showToast("Zusätzliche E-Mails enthalten ungültige Adressen.");
      return;
    }

    setQueueing(true);
    try {
      await communicationService.queueBroadcast({
        ...form,
        templateKey,
        subjectOverride: form.subjectOverride.trim()
      });

      let directSendFailures = 0;
      for (const email of additionalRecipients.valid) {
        try {
          await communicationService.queueDirectMail({
            toEmail: email,
            templateKey,
            subjectOverride: form.subjectOverride.trim(),
            bodyOverride: templateBody.trim()
          });
        } catch {
          directSendFailures += 1;
        }
      }

      if (additionalRecipients.valid.length > 0 && directSendFailures > 0) {
        showToast(`Broadcast geplant, ${directSendFailures} zusätzliche E-Mails konnten nicht eingeplant werden.`);
      } else if (additionalRecipients.valid.length > 0) {
        showToast(`Broadcast geplant, ${additionalRecipients.valid.length} zusätzliche E-Mails ergänzt.`);
      } else {
        showToast("Broadcast wurde in die Warteschlange gelegt.");
      }

      await loadOutbox();
    } catch (error) {
      showToast(getApiErrorMessage(error, "Broadcast konnte nicht gestartet werden."));
    } finally {
      setQueueing(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Kommunikation</h1>

      <Card>
        <CardHeader>
          <CardTitle>Template Emails & Broadcast</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <Label>Klasse</Label>
              <Select value={form.classId} onValueChange={(next) => setForm((prev) => ({ ...prev, classId: next }))}>
                <SelectTrigger className="text-base md:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  {classOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={form.acceptanceStatus}
                onValueChange={(next) => setForm((prev) => ({ ...prev, acceptanceStatus: next as BroadcastForm["acceptanceStatus"] }))}
              >
                <SelectTrigger className="text-base md:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="pending">Offen</SelectItem>
                  <SelectItem value="shortlist">Vorauswahl</SelectItem>
                  <SelectItem value="accepted">Zugelassen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Zahlung</Label>
              <Select
                value={form.paymentStatus}
                onValueChange={(next) => setForm((prev) => ({ ...prev, paymentStatus: next as BroadcastForm["paymentStatus"] }))}
              >
                <SelectTrigger className="text-base md:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="due">{paymentStatusLabel("due")}</SelectItem>
                  <SelectItem value="paid">{paymentStatusLabel("paid")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Template</Label>
              <Select
                value={form.templateKey || "__none__"}
                onValueChange={(next) => setForm((prev) => ({ ...prev, templateKey: next === "__none__" ? "" : next }))}
              >
                <SelectTrigger className="text-base md:text-sm">
                  <SelectValue placeholder="Template wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Template wählen</SelectItem>
                  {TEMPLATE_PRESETS.map((preset) => (
                    <SelectItem key={preset.key} value={preset.key}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Template Key</Label>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {form.templateKey || "Bitte oben ein Template wählen"}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Betreff</Label>
                <Input
                  value={form.subjectOverride}
                  onChange={(event) => setForm((prev) => ({ ...prev, subjectOverride: event.target.value }))}
                  placeholder="Betreff mit Platzhaltern, z. B. {{eventName}}"
                />
              </div>
              <div className="space-y-1">
                <Label>Text</Label>
                <textarea
                  className="min-h-48 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={templateBody}
                  onChange={(event) => setTemplateBody(event.target.value)}
                  placeholder="Mailtext, z. B. mit {{firstName}}, {{verificationUrl}}"
                />
              </div>
              <div className="space-y-1">
                <Label>Zusätzliche E-Mails trotz Filter</Label>
                <textarea
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={additionalEmailsInput}
                  onChange={(event) => setAdditionalEmailsInput(event.target.value)}
                  placeholder="mail1@example.com, mail2@example.com"
                />
                <p className="text-xs text-slate-500">
                  Zusätzlich gültig: {additionalRecipients.valid.length}
                  {additionalRecipients.invalid.length > 0 ? ` · Ungültig: ${additionalRecipients.invalid.length}` : ""}
                </p>
              </div>
              <details className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <summary className="cursor-pointer font-medium text-slate-900">Hilfe: Dynamische Platzhalter</summary>
                <div className="mt-3 space-y-2">
                  {!form.templateKey && (
                    <div className="text-xs text-slate-500">Kein Template gewählt: es werden alle verfügbaren Platzhalter angezeigt.</div>
                  )}
                  {form.templateKey && (
                    <div className="text-xs text-slate-500">Template gewählt: es werden nur relevante Platzhalter angezeigt.</div>
                  )}
                  {visiblePlaceholderHelp.map((item) => {
                    return (
                      <div key={item.token} className="rounded border border-slate-200 bg-white px-2 py-1.5">
                        <div className="font-mono text-xs text-slate-900">{`{{${item.token}}}`}</div>
                        <div className="text-xs text-slate-600">{item.description}</div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          Verwendet in: {item.usedIn.join(", ")}
                          {item.requiredIn?.length ? ` · Pflicht in: ${item.requiredIn.join(", ")}` : ""}
                        </div>
                      </div>
                    );
                  })}
                  {form.templateKey && visiblePlaceholderHelp.length === 0 && (
                    <div className="text-xs text-slate-500">Für dieses Template sind aktuell keine Platzhalter hinterlegt.</div>
                  )}
                </div>
              </details>
              {verificationLinkMissing && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Verifizierungs-Mail ohne Link erkannt. Bitte <code>{"{{verificationUrl}}"}</code> oder eine URL einfügen.
                </div>
              )}
              {unresolvedTokens.length > 0 && (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  Nicht auflösbare Platzhalter in der Preview: {unresolvedTokens.join(", ")}
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-md border bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Mail-Preview</div>
              <div className="rounded-md border bg-white p-3">
                <div className="text-xs uppercase text-slate-500">Betreff</div>
                <div className="mt-1 font-medium text-slate-900">{renderedSubject || "-"}</div>
              </div>
              <div className="rounded-md border bg-white p-3">
                <div className="text-xs uppercase text-slate-500">Text</div>
                <pre className="mt-1 whitespace-pre-wrap font-sans text-sm text-slate-800">{renderedBody || "-"}</pre>
              </div>
            </div>
          </div>

          <div>
            {canManageCommunication ? (
              <Button className="w-full md:w-auto" type="button" disabled={queueing} onClick={() => void queueBroadcast()}>
                {queueing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird eingeplant...
                  </>
                ) : (
                  "Broadcast in Warteschlange legen"
                )}
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
                  Lädt...
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
