import { useEffect, useMemo, useRef, useState } from "react";
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
import { adminEntriesService } from "@/services/admin-entries.service";
import type {
  BroadcastForm,
  MailTemplate,
  MailTemplatePlaceholder,
  MailTemplatePreview,
  OutboxItem,
  ResolveRecipientsResult
} from "@/types/admin";

const initialForm: BroadcastForm = {
  classId: "all",
  acceptanceStatus: "all",
  paymentStatus: "all",
  templateKey: "",
  subjectOverride: ""
};

const OUTBOX_PREVIEW_LIMIT = 10;
const TEMPLATE_DRAFTS_STORAGE_KEY = "msc.communication.template-drafts.v1";

type TemplateDrafts = Record<string, { subject: string; body: string }>;
type StaticTemplateOption = { key: string; label: string };
type RecipientTarget = { id: string; label: string };
type RecipientSearchItem = {
  entryId: string;
  driverPersonId: string;
  driverLabel: string;
  entryLabel: string;
};

const FALLBACK_TEMPLATE_OPTIONS: StaticTemplateOption[] = [
  { key: "registration_received", label: "Verifizierungs-Mail" },
  { key: "preselection", label: "Vorauswahl" },
  { key: "accepted_open_payment", label: "Zulassung" },
  { key: "rejected", label: "Ablehnung" },
  { key: "payment_reminder", label: "Zahlungserinnerung" }
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

function normalizeTemplateOption(template: MailTemplate): StaticTemplateOption {
  return {
    key: template.key,
    label: template.label || template.key
  };
}

export function AdminCommunicationPage() {
  const { roles } = useAuth();
  const canManageCommunication = hasPermission(roles, "communication.write");
  const [form, setForm] = useState<BroadcastForm>(initialForm);
  const [templateBody, setTemplateBody] = useState("");
  const templateDraftsRef = useRef<TemplateDrafts>({});
  const [additionalEmailsInput, setAdditionalEmailsInput] = useState("");
  const [recipientSearchQuery, setRecipientSearchQuery] = useState("");
  const [recipientSearchResults, setRecipientSearchResults] = useState<RecipientSearchItem[]>([]);
  const [searchingRecipients, setSearchingRecipients] = useState(false);
  const [selectedDriverTargets, setSelectedDriverTargets] = useState<RecipientTarget[]>([]);
  const [selectedEntryTargets, setSelectedEntryTargets] = useState<RecipientTarget[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [classOptions, setClassOptions] = useState<AdminClassOption[]>([]);
  const [eventName, setEventName] = useState("");
  const [templateOptions, setTemplateOptions] = useState<Array<{ key: string; label: string }>>(FALLBACK_TEMPLATE_OPTIONS);
  const [templatesByKey, setTemplatesByKey] = useState<Map<string, MailTemplate>>(new Map());
  const [templatePlaceholders, setTemplatePlaceholders] = useState<MailTemplatePlaceholder[]>([]);
  const [backendPreview, setBackendPreview] = useState<MailTemplatePreview | null>(null);
  const [resolvedRecipients, setResolvedRecipients] = useState<ResolveRecipientsResult | null>(null);
  const [outboxExpanded, setOutboxExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [loadingOutbox, setLoadingOutbox] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingPlaceholders, setLoadingPlaceholders] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [resolvingRecipients, setResolvingRecipients] = useState(false);
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

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const templates = await communicationService.listTemplates();
      const mappedOptions = templates.map(normalizeTemplateOption);
      setTemplateOptions(mappedOptions.length > 0 ? mappedOptions : FALLBACK_TEMPLATE_OPTIONS);
      setTemplatesByKey(new Map(templates.map((item) => [item.key, item])));
    } catch (error) {
      showToast(getApiErrorMessage(error, "Mail-Templates konnten nicht geladen werden."));
      setTemplateOptions(FALLBACK_TEMPLATE_OPTIONS);
      setTemplatesByKey(new Map());
    } finally {
      setLoadingTemplates(false);
    }
  };

  const resolveSubject = (subject: string) => {
    if (!subject.includes("{{")) {
      return subject;
    }
    const fallback = eventName.trim() || "Aktuelles Event";
    return subject.replace(/\{\{\s*eventName\s*\}\}/gi, fallback);
  };

  const selectedTemplate = useMemo(() => {
    if (!form.templateKey) {
      return null;
    }
    return templatesByKey.get(form.templateKey) ?? null;
  }, [form.templateKey, templatesByKey]);

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

  const unresolvedTokens = useMemo(() => {
    if (!form.templateKey) {
      return [];
    }
    const allowed = new Set(templatePlaceholders.map((item) => item.name));
    if (allowed.size === 0) {
      return [];
    }
    const tokens = [...extractTemplateTokens(form.subjectOverride), ...extractTemplateTokens(templateBody)];
    const unique = Array.from(new Set(tokens));
    return unique.filter((token) => !allowed.has(token));
  }, [form.subjectOverride, form.templateKey, templateBody, templatePlaceholders]);

  const additionalRecipients = useMemo(() => parseEmailList(additionalEmailsInput), [additionalEmailsInput]);
  const selectedDriverPersonIds = useMemo(() => selectedDriverTargets.map((target) => target.id), [selectedDriverTargets]);
  const selectedEntryIds = useMemo(() => selectedEntryTargets.map((target) => target.id), [selectedEntryTargets]);
  const hasDirectTargets = selectedDriverPersonIds.length > 0 || selectedEntryIds.length > 0;
  const hasFilterTargets = useMemo(
    () => form.classId !== "all" || form.acceptanceStatus !== "all" || form.paymentStatus !== "all",
    [form.acceptanceStatus, form.classId, form.paymentStatus]
  );
  const sendBlockedByMissingPlaceholders = Boolean(
    backendPreview && backendPreview.missingPlaceholders && backendPreview.missingPlaceholders.length > 0
  );
  const hiddenOutboxCount = Math.max(outbox.length - OUTBOX_PREVIEW_LIMIT, 0);
  const visibleOutbox = outboxExpanded ? outbox : outbox.slice(0, OUTBOX_PREVIEW_LIMIT);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TEMPLATE_DRAFTS_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as TemplateDrafts;
      if (parsed && typeof parsed === "object") {
        templateDraftsRef.current = parsed;
      }
    } catch {
      templateDraftsRef.current = {};
    }
  }, []);

  useEffect(() => {
    void loadOutbox();
    void loadTemplates();

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
    if (!form.templateKey) {
      setTemplatePlaceholders([]);
      setBackendPreview(null);
      setResolvedRecipients(null);
      return;
    }

    let cancelled = false;
    setLoadingPlaceholders(true);
    communicationService
      .listTemplatePlaceholders(form.templateKey)
      .then((items) => {
        if (!cancelled) {
          setTemplatePlaceholders(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTemplatePlaceholders([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingPlaceholders(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [form.templateKey]);

  useEffect(() => {
    if (!form.templateKey) {
      setBackendPreview(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoadingPreview(true);
      communicationService
        .previewTemplate({
          templateKey: form.templateKey,
          sampleData: previewData,
          subjectOverride: form.subjectOverride.trim() || undefined,
          bodyOverride: templateBody.trim() || undefined,
          previewMode: "draft"
        })
        .then((result) => {
          if (!cancelled) {
            setBackendPreview(result);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setBackendPreview(null);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoadingPreview(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form.templateKey, form.subjectOverride, previewData, templateBody]);

  useEffect(() => {
    const key = form.templateKey.trim();
    if (!key) {
      return;
    }
    const existing = templateDraftsRef.current[key];
    if (existing && existing.subject === form.subjectOverride && existing.body === templateBody) {
      return;
    }
    const next: TemplateDrafts = {
      ...templateDraftsRef.current,
      [key]: {
        subject: form.subjectOverride,
        body: templateBody
      }
    };
    templateDraftsRef.current = next;
    window.localStorage.setItem(TEMPLATE_DRAFTS_STORAGE_KEY, JSON.stringify(next));
  }, [form.subjectOverride, form.templateKey, templateBody]);

  useEffect(() => {
    const query = recipientSearchQuery.trim();
    if (query.length < 2) {
      setRecipientSearchResults([]);
      setSearchingRecipients(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearchingRecipients(true);
      adminEntriesService
        .listEntriesPage(
          {
            query,
            classId: "all",
            acceptanceStatus: "all",
            paymentStatus: "all",
            checkinIdVerified: "all",
            sortBy: "createdAt",
            sortDir: "desc"
          },
          { limit: 20 }
        )
        .then((result) => {
          if (cancelled) {
            return;
          }

          const mapped = result.entries
            .map((entry): RecipientSearchItem | null => {
              if (!entry.driverPersonIdRaw) {
                return null;
              }
              return {
                entryId: entry.id,
                driverPersonId: entry.driverPersonIdRaw,
                driverLabel: `${entry.name}${entry.driverEmailRaw ? ` (${entry.driverEmailRaw})` : ""}`,
                entryLabel: `${entry.name} · ${entry.classLabel} · #${entry.startNumber}`
              };
            })
            .filter((item): item is RecipientSearchItem => item !== null);

          setRecipientSearchResults(mapped);
        })
        .catch(() => {
          if (!cancelled) {
            setRecipientSearchResults([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearchingRecipients(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [recipientSearchQuery]);

  const addDriverTarget = (candidate: RecipientSearchItem) => {
    setSelectedDriverTargets((prev) => {
      if (prev.some((item) => item.id === candidate.driverPersonId)) {
        return prev;
      }
      return [...prev, { id: candidate.driverPersonId, label: candidate.driverLabel }];
    });
  };

  const addEntryTarget = (candidate: RecipientSearchItem) => {
    setSelectedEntryTargets((prev) => {
      if (prev.some((item) => item.id === candidate.entryId)) {
        return prev;
      }
      return [...prev, { id: candidate.entryId, label: candidate.entryLabel }];
    });
  };

  const removeDriverTarget = (id: string) => {
    setSelectedDriverTargets((prev) => prev.filter((item) => item.id !== id));
  };

  const removeEntryTarget = (id: string) => {
    setSelectedEntryTargets((prev) => prev.filter((item) => item.id !== id));
  };

  const applyTemplateSelection = (nextTemplateKey: string) => {
    if (nextTemplateKey === form.templateKey) {
      return;
    }

    if (!nextTemplateKey) {
      setForm((prev) => ({ ...prev, templateKey: "", subjectOverride: "" }));
      setTemplateBody("");
      return;
    }

    const fromDraft = templateDraftsRef.current[nextTemplateKey];
    if (fromDraft) {
      setForm((prev) => ({ ...prev, templateKey: nextTemplateKey, subjectOverride: fromDraft.subject }));
      setTemplateBody(fromDraft.body);
      return;
    }

    const template = templatesByKey.get(nextTemplateKey);
    setForm((prev) => ({ ...prev, templateKey: nextTemplateKey, subjectOverride: template?.subject ?? "" }));
    setTemplateBody(template?.bodyText ?? "");
  };

  const resolveRecipients = async () => {
    if (!form.templateKey) {
      showToast("Bitte zuerst ein Template wählen.");
      return;
    }
    if (additionalRecipients.invalid.length > 0) {
      showToast("Zusätzliche E-Mails enthalten ungültige Adressen.");
      return;
    }

    setResolvingRecipients(true);
    try {
      const result = await communicationService.resolveBroadcastRecipients({
        classId: form.classId !== "all" ? form.classId : undefined,
        acceptanceStatus: form.acceptanceStatus !== "all" ? form.acceptanceStatus : undefined,
        paymentStatus: form.paymentStatus !== "all" ? form.paymentStatus : undefined,
        additionalEmails: additionalRecipients.valid,
        driverPersonIds: selectedDriverPersonIds,
        entryIds: selectedEntryIds
      });
      setResolvedRecipients(result);
      showToast(`Empfänger aufgelöst: ${result.finalCount}`);
    } catch (error) {
      setResolvedRecipients(null);
      showToast(getApiErrorMessage(error, "Empfänger konnten nicht aufgelöst werden."));
    } finally {
      setResolvingRecipients(false);
    }
  };

  const queueBroadcast = async () => {
    if (!canManageCommunication) {
      return;
    }
    const templateKey = form.templateKey.trim();
    if (!templateKey) {
      showToast("Template ist erforderlich.");
      return;
    }

    if (additionalRecipients.invalid.length > 0) {
      showToast("Zusätzliche E-Mails enthalten ungültige Adressen.");
      return;
    }
    if (sendBlockedByMissingPlaceholders) {
      showToast("Pflicht-Platzhalter fehlen im Preview. Versand ist blockiert.");
      return;
    }

    setQueueing(true);
    try {
      const result = await communicationService.sendMail({
        templateKey,
        subjectOverride: form.subjectOverride.trim() || undefined,
        bodyOverride: templateBody.trim() || undefined,
        additionalEmails: additionalRecipients.valid,
        driverPersonIds: selectedDriverPersonIds,
        entryIds: selectedEntryIds,
        filters: {
          classId: form.classId !== "all" ? form.classId : undefined,
          acceptanceStatus: form.acceptanceStatus !== "all" ? form.acceptanceStatus : undefined,
          paymentStatus: form.paymentStatus !== "all" ? form.paymentStatus : undefined
        }
      });

      showToast(`Mailversand eingeplant (${result.queued} Empfänger).`);
      await loadOutbox();
      if (!resolvedRecipients) {
        await resolveRecipients();
      }
    } catch (error) {
      showToast(getApiErrorMessage(error, "Mailversand konnte nicht gestartet werden."));
    } finally {
      setQueueing(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Kommunikation</h1>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Kampagne erstellen</CardTitle>
          <p className="text-sm text-slate-600">Schrittweise: Empfänger wählen, Template anpassen, Preview prüfen, senden.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <div className="text-sm font-semibold text-slate-900">1. Empfänger definieren</div>
            <div className="grid gap-3 md:grid-cols-3">
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
            </div>

            <div className="space-y-1">
              <Label>Zusätzliche E-Mails (optional)</Label>
              <textarea
                className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={additionalEmailsInput}
                onChange={(event) => setAdditionalEmailsInput(event.target.value)}
                placeholder="mail1@example.com, mail2@example.com"
              />
              <p className="text-xs text-slate-500">
                Zusätzlich gültig: {additionalRecipients.valid.length}
                {additionalRecipients.invalid.length > 0 ? ` · Ungültig: ${additionalRecipients.invalid.length}` : ""}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Gezielt Fahrer oder Nennung hinzufügen</Label>
              <Input
                value={recipientSearchQuery}
                onChange={(event) => setRecipientSearchQuery(event.target.value)}
                placeholder="Name, E-Mail, Klasse oder Startnummer suchen"
              />
              <div className="rounded-md border bg-white">
                {searchingRecipients ? (
                  <div className="px-3 py-2 text-xs text-slate-500">Suche läuft...</div>
                ) : recipientSearchQuery.trim().length < 2 ? (
                  <div className="px-3 py-2 text-xs text-slate-500">Mindestens 2 Zeichen eingeben.</div>
                ) : recipientSearchResults.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-500">Keine Treffer.</div>
                ) : (
                  <div className="max-h-56 overflow-y-auto">
                    {recipientSearchResults.map((item) => {
                      const driverSelected = selectedDriverPersonIds.includes(item.driverPersonId);
                      const entrySelected = selectedEntryIds.includes(item.entryId);
                      return (
                        <div key={`${item.entryId}-${item.driverPersonId}`} className="border-t px-3 py-2 first:border-t-0">
                          <div className="text-sm font-medium text-slate-900">{item.driverLabel}</div>
                          <div className="text-xs text-slate-600">{item.entryLabel}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={driverSelected ? "default" : "outline"}
                              disabled={driverSelected}
                              onClick={() => addDriverTarget(item)}
                            >
                              {driverSelected ? "Fahrer gewählt" : "Fahrer wählen"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={entrySelected ? "default" : "outline"}
                              disabled={entrySelected}
                              onClick={() => addEntryTarget(item)}
                            >
                              {entrySelected ? "Nennung gewählt" : "Nennung wählen"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border bg-white p-2">
                <div className="text-xs font-medium text-slate-700">Ausgewählte Fahrer ({selectedDriverTargets.length})</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedDriverTargets.length === 0 && <span className="text-xs text-slate-500">Keine</span>}
                  {selectedDriverTargets.map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() => removeDriverTarget(target.id)}
                      className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                      title="Entfernen"
                    >
                      {target.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-md border bg-white p-2">
                <div className="text-xs font-medium text-slate-700">Ausgewählte Nennungen ({selectedEntryTargets.length})</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedEntryTargets.length === 0 && <span className="text-xs text-slate-500">Keine</span>}
                  {selectedEntryTargets.map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() => removeEntryTarget(target.id)}
                      className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                      title="Entfernen"
                    >
                      {target.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              <span className="font-medium">Modus:</span>
              <Badge variant="outline">{hasFilterTargets ? "Filter aktiv" : "Kein Filter"}</Badge>
              <Badge variant="outline">{hasDirectTargets ? "Direktauswahl aktiv" : "Keine Direktauswahl"}</Badge>
              <Button type="button" size="sm" variant="outline" disabled={!form.templateKey || resolvingRecipients} onClick={() => void resolveRecipients()}>
                {resolvingRecipients ? "Prüfe Empfänger..." : "Empfänger prüfen"}
              </Button>
            </div>
            {resolvedRecipients && (
              <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-700">
                <div>Finale Empfänger: {resolvedRecipients.finalCount}</div>
                <div>Duplikate entfernt: {resolvedRecipients.duplicatesRemoved}</div>
                {resolvedRecipients.invalidEmails.length > 0 && (
                  <div className="mt-1 text-xs text-amber-700">Ungültige E-Mails: {resolvedRecipients.invalidEmails.join(", ")}</div>
                )}
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <div className="text-sm font-semibold text-slate-900">2. Vorlage & Inhalt</div>
            <div className="space-y-1">
              <Label>Template</Label>
              <Select value={form.templateKey || "__none__"} onValueChange={(next) => applyTemplateSelection(next === "__none__" ? "" : next)}>
                <SelectTrigger className="text-base md:text-sm">
                  <SelectValue placeholder={loadingTemplates ? "Templates laden..." : "Template wählen"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Template wählen</SelectItem>
                  {templateOptions.map((item) => (
                    <SelectItem key={item.key} value={item.key}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedTemplate && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-white px-3 py-2 text-xs text-slate-600">
                <span>{selectedTemplate.label}</span>
                <Badge variant="outline">{selectedTemplate.status}</Badge>
                <span>Version {selectedTemplate.version}</span>
              </div>
            )}
            <div className="space-y-1">
              <Label>Betreff</Label>
              <Input
                value={form.subjectOverride}
                onChange={(event) => setForm((prev) => ({ ...prev, subjectOverride: event.target.value }))}
                placeholder="Betreff mit Platzhaltern"
                disabled={!form.templateKey}
              />
            </div>
            <div className="space-y-1">
              <Label>Text</Label>
              <textarea
                className="min-h-44 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={templateBody}
                onChange={(event) => setTemplateBody(event.target.value)}
                placeholder="Mailinhalt"
                disabled={!form.templateKey}
              />
            </div>
            {unresolvedTokens.length > 0 && (
              <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                Nicht bekannte Platzhalter: {unresolvedTokens.join(", ")}
              </div>
            )}
            <details className="rounded-md border bg-white p-3 text-sm text-slate-700">
              <summary className="cursor-pointer font-medium text-slate-900">Platzhalter-Hilfe</summary>
              <div className="mt-3 space-y-2">
                {!form.templateKey && <div className="text-xs text-slate-500">Template wählen, um Platzhalter zu sehen.</div>}
                {form.templateKey && loadingPlaceholders && <div className="text-xs text-slate-500">Lade Platzhalter...</div>}
                {form.templateKey && !loadingPlaceholders && templatePlaceholders.length === 0 && (
                  <div className="text-xs text-slate-500">Keine Platzhalter hinterlegt.</div>
                )}
                {templatePlaceholders.map((item) => (
                  <div key={item.name} className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                    <div className="font-mono text-xs text-slate-900">{`{{${item.name}}}`}</div>
                    <div className="text-xs text-slate-600">{item.description}</div>
                    <div className="text-[11px] text-slate-500">
                      {item.required ? "Pflicht" : "Optional"} · Beispiel: <span className="font-mono">{item.example || "-"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </section>

          <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <div className="text-sm font-semibold text-slate-900">3. Preview prüfen (Backend-Rendering)</div>
            {loadingPreview ? (
              <div className="rounded-md border bg-white p-3 text-sm text-slate-500">Lade Preview...</div>
            ) : backendPreview ? (
              <>
                <div className="rounded-md border bg-white p-3">
                  <div className="text-xs uppercase text-slate-500">Betreff</div>
                  <div className="mt-1 font-medium text-slate-900">{backendPreview.subjectRendered || "-"}</div>
                </div>
                <div className="rounded-md border bg-white p-2">
                  <iframe
                    title="Mail HTML Preview"
                    srcDoc={backendPreview.htmlDocument}
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                    className="h-[520px] w-full rounded border-0"
                  />
                </div>
                {backendPreview.warnings.length > 0 && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                    Warnungen: {backendPreview.warnings.join(" | ")}
                  </div>
                )}
                {backendPreview.missingPlaceholders.length > 0 && (
                  <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
                    Pflicht-Platzhalter fehlen: {backendPreview.missingPlaceholders.join(", ")}. Versand ist blockiert.
                  </div>
                )}
                <div className="rounded-md border bg-white p-3 text-xs text-slate-600">
                  Verwendet: {backendPreview.usedPlaceholders.join(", ") || "-"}
                  <br />
                  Fehlend: {backendPreview.missingPlaceholders.join(", ") || "-"}
                  <br />
                  Unbekannt: {backendPreview.unknownPlaceholders.join(", ") || "-"}
                </div>
              </>
            ) : (
              <div className="rounded-md border bg-white p-3 text-sm text-slate-500">Keine Preview verfügbar.</div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-slate-900 p-4 text-slate-50">
            <div className="mb-3 text-sm font-semibold">4. Versand starten</div>
            {canManageCommunication ? (
              <Button
                className="w-full bg-white text-slate-900 hover:bg-slate-100 md:w-auto"
                type="button"
                disabled={queueing || !form.templateKey || sendBlockedByMissingPlaceholders}
                onClick={() => void queueBroadcast()}
              >
                {queueing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird eingeplant...
                  </>
                ) : (
                  "Mailversand einplanen"
                )}
              </Button>
            ) : (
              <div className="text-sm text-slate-300">Nur Admin-Rollen dürfen Broadcasts starten.</div>
            )}
          </section>
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
