import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  GraduationCap,
  List,
  Map,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminMarshalsService } from "@/services/admin-marshals.service";
import { getApiErrorMessage } from "@/services/api/http-client";
import type {
  MarshalCommitmentStatus,
  MarshalImportPreview,
  MarshalPerson,
  MarshalWorkspace,
} from "@/types/admin-marshals";
import { cn } from "@/lib/utils";
import {
  getPostMapCoordinates,
  MarshalPlanningMap,
  type PlanningTargetMode,
} from "@/components/features/admin/marshal-planning-map";

type View =
  | "people"
  | "saturday"
  | "sunday"
  | "prints"
  | "training"
  | "config"
  | "import";
type MarshalEvent = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: string;
  isCurrent: boolean;
};
const statusLabels: Record<MarshalCommitmentStatus, string> = {
  not_asked: "Nicht angefragt",
  pending: "Offen",
  accepted: "Zugesagt",
  declined: "Abgesagt",
  tentative: "Vielleicht",
};
const inputClass = "h-11 w-full rounded-md border bg-white px-3 text-sm";

const emptyPerson = {
  helperNumber: "",
  firstName: "",
  lastName: "",
  street: "",
  zip: "",
  city: "",
  birthdate: "",
  phone: "",
  email: "",
  shirtSize: "",
  licenseNumber: "",
  activityAreas: "Strecke",
  note: "",
};

export function AdminMarshalsPage() {
  const { roles } = useAuth();
  const canWrite = hasPermission(roles, "marshals.write");
  const canExport = hasPermission(roles, "marshals.export");
  const [events, setEvents] = useState<MarshalEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const [workspace, setWorkspace] = useState<MarshalWorkspace | null>(null);
  const [view, setView] = useState<View>("people");
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("Strecke");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [personDraft, setPersonDraft] = useState(emptyPerson);
  const [editingPerson, setEditingPerson] = useState<MarshalPerson | null>(
    null,
  );
  const [selectedTrainingId, setSelectedTrainingId] = useState("");
  const [trainingDraft, setTrainingDraft] = useState({
    sessionType: "training" as "training" | "briefing",
    title: "",
    sessionDate: "",
    location: "",
  });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState("");
  const [importPreview, setImportPreview] =
    useState<MarshalImportPreview | null>(null);
  const [postTargets, setPostTargets] = useState<Record<string, number>>({});
  const [emergencyPostTargets, setEmergencyPostTargets] = useState<
    Record<string, number>
  >({});
  const [planningDisplay, setPlanningDisplay] = useState<"map" | "list">(
    "map",
  );
  const [planningTargetMode, setPlanningTargetMode] =
    useState<PlanningTargetMode>("normal");

  const load = useCallback(async () => {
    if (!eventId) return;
    setBusy(true);
    setError("");
    try {
      const data = await adminMarshalsService.getWorkspace(
        eventId,
        view === "people" ? search || undefined : undefined,
        view === "people" && area !== "all" ? area : undefined,
      );
      setWorkspace(data);
      setPostTargets(
        Object.fromEntries(
          data.posts.map((post) => [post.id, post.targetStaff]),
        ),
      );
      setEmergencyPostTargets(
        Object.fromEntries(
          data.posts.map((post) => [
            post.id,
            Math.min(
              post.targetStaff,
              typeof post.emergencyTargetStaff === "number"
                ? post.emergencyTargetStaff
                : post.targetStaff,
            ),
          ]),
        ),
      );
      if (!selectedTrainingId && data.trainings[0])
        setSelectedTrainingId(data.trainings[0].id);
    } catch (cause) {
      setError(
        getApiErrorMessage(
          cause,
          "Streckenposten konnten nicht geladen werden.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }, [area, eventId, search, selectedTrainingId, view]);

  useEffect(() => {
    adminMarshalsService
      .listEvents()
      .then(({ events: items }) => {
        setEvents(items);
        const stored = localStorage.getItem("msc_marshal_event_id");
        const selected =
          items.find((item) => item.id === stored) ??
          items.find((item) => item.isCurrent) ??
          items[0];
        if (selected) setEventId(selected.id);
      })
      .catch((cause) =>
        setError(
          getApiErrorMessage(
            cause,
            "Veranstaltungen konnten nicht geladen werden.",
          ),
        ),
      );
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (eventId) localStorage.setItem("msc_marshal_event_id", eventId);
  }, [eventId]);

  const day = workspace?.days.find(
    (item) => item.dayKey === (view === "sunday" ? "sunday" : "saturday"),
  );
  const currentTraining = workspace?.trainings.find(
    (item) => item.id === selectedTrainingId,
  );
  const people = workspace?.people ?? [];

  async function saveDay(
    person: MarshalPerson,
    commitmentStatus: MarshalCommitmentStatus,
    assignmentValue: string,
  ) {
    if (!day) return;
    const clearedAssignmentValue =
      commitmentStatus === "declined" || commitmentStatus === "not_asked"
        ? ""
        : assignmentValue;
    const post = workspace?.posts.find(
      (item) => `post:${item.id}` === clearedAssignmentValue,
    );
    const section = workspace?.sections.find(
      (item) => `leader:${item.id}` === clearedAssignmentValue,
    );
    setBusy(true);
    setError("");
    try {
      await adminMarshalsService.saveAssignment(person.id, {
        eventId,
        contactOwner: person.participation.contactOwner,
        wish: person.participation.wish,
        note: person.participation.note,
        shirtSizeSnapshot:
          person.participation.shirtSizeSnapshot ?? person.shirtSize,
        days: [
          {
            dayId: day.id,
            commitmentStatus,
            role: post
              ? "marshal"
              : section
                ? "section_leader"
                : clearedAssignmentValue
                  ? "special"
                  : null,
            sectionId: post?.sectionId ?? section?.id ?? null,
            postId: post?.id ?? null,
            functionCode: section?.leaderCode ?? null,
          },
        ],
      });
      setNotice("Einsatz gespeichert.");
      await load();
    } catch (cause) {
      setError(
        getApiErrorMessage(cause, "Einsatz konnte nicht gespeichert werden."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function savePerson() {
    const draft = editingPerson
      ? {
          firstName: editingPerson.firstName,
          lastName: editingPerson.lastName,
          street: editingPerson.street,
          zip: editingPerson.zip,
          city: editingPerson.city,
          birthdate: editingPerson.birthdate,
          phone: editingPerson.phone,
          email: editingPerson.email,
          shirtSize: editingPerson.shirtSize,
          licenseNumber: editingPerson.licenseNumber,
          activityAreas: editingPerson.activityAreas,
          note: editingPerson.note,
          isActive: editingPerson.isActive,
        }
      : {
          helperNumber: Number(personDraft.helperNumber),
          firstName: personDraft.firstName,
          lastName: personDraft.lastName,
          street: personDraft.street || null,
          zip: personDraft.zip || null,
          city: personDraft.city || null,
          birthdate: personDraft.birthdate || null,
          phone: personDraft.phone || null,
          email: personDraft.email || null,
          shirtSize: personDraft.shirtSize || null,
          licenseNumber: personDraft.licenseNumber || null,
          activityAreas: personDraft.activityAreas
            .split(/[;,]/)
            .map((value) => value.trim())
            .filter(Boolean),
          note: personDraft.note || null,
        };
    setBusy(true);
    setError("");
    try {
      if (editingPerson)
        await adminMarshalsService.updatePerson(editingPerson.id, draft);
      else await adminMarshalsService.createPerson(draft);
      setNotice("Helferstammdaten gespeichert.");
      setEditingPerson(null);
      setPersonDraft(emptyPerson);
      await load();
    } catch (cause) {
      setError(
        getApiErrorMessage(cause, "Helfer konnte nicht gespeichert werden."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function createTraining() {
    setBusy(true);
    setError("");
    try {
      await adminMarshalsService.createTraining({
        eventId,
        ...trainingDraft,
        location: trainingDraft.location || null,
      });
      setTrainingDraft({
        sessionType: "training",
        title: "",
        sessionDate: "",
        location: "",
      });
      setNotice("Termin angelegt.");
      await load();
    } catch (cause) {
      setError(
        getApiErrorMessage(cause, "Termin konnte nicht angelegt werden."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function previewImport() {
    if (!importFile) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await adminMarshalsService.previewImport(
        eventId,
        importFile,
      );
      setImportPreview(result.response);
      setImportData(result.dataBase64);
    } catch (cause) {
      setError(
        getApiErrorMessage(
          cause,
          "Excel-Vorschau konnte nicht erstellt werden.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function commitImport() {
    if (!importFile || !importPreview || !importData) return;
    setBusy(true);
    setError("");
    try {
      await adminMarshalsService.commitImport(
        eventId,
        importFile.name,
        importData,
        importPreview.sha256,
      );
      setNotice("Excel-Import vollständig übernommen.");
      setImportPreview(null);
      setImportData("");
      await load();
    } catch (cause) {
      setError(
        getApiErrorMessage(
          cause,
          "Excel-Import konnte nicht übernommen werden.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveConfig() {
    if (!workspace) return;
    setBusy(true);
    setError("");
    try {
      await adminMarshalsService.saveConfig({
        eventId,
        sections: workspace.sections.map(
          ({ code, name, leaderCode, sortOrder }) => ({
            code,
            name,
            leaderCode,
            sortOrder,
          }),
        ),
        posts: workspace.posts.map((post) => ({
          sectionCode:
            workspace.sections.find((section) => section.id === post.sectionId)
              ?.code ?? "4",
          code: post.code,
          description: post.description,
          targetStaff: Math.max(
            1,
            postTargets[post.id] ?? post.targetStaff,
          ),
          emergencyTargetStaff: Math.min(
            Math.max(1, postTargets[post.id] ?? post.targetStaff),
            Math.max(
              1,
              emergencyPostTargets[post.id] ??
                post.emergencyTargetStaff ??
                post.targetStaff,
            ),
          ),
          ...getPostMapCoordinates(post),
          isActive: post.isActive,
          sortOrder: post.sortOrder,
        })),
      });
      setNotice("Postenkonfiguration gespeichert.");
      await load();
    } catch (cause) {
      setError(
        getApiErrorMessage(
          cause,
          "Konfiguration konnte nicht gespeichert werden.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  const tabs = useMemo(
    () =>
      [
        {
          key: "people",
          label: "Personen",
          detail: "Stammdaten",
          icon: UserRound,
        },
        {
          key: "saturday",
          label: "Samstag",
          detail: "Zusagen & Einsatz",
          icon: CalendarDays,
        },
        {
          key: "sunday",
          label: "Sonntag",
          detail: "Zusagen & Einsatz",
          icon: CalendarDays,
        },
        {
          key: "prints",
          label: "Drucklisten",
          detail: "Anwesenheit & Abschnitte",
          icon: ClipboardCheck,
        },
        {
          key: "training",
          label: "Schulungen",
          detail: "Termine & Lizenzen",
          icon: GraduationCap,
        },
        {
          key: "config",
          label: "Posten",
          detail: "Besetzung & Hinweise",
          icon: Settings2,
        },
        {
          key: "import",
          label: "Import",
          detail: "Excel",
          icon: FileSpreadsheet,
        },
      ] as Array<{
        key: View;
        label: string;
        detail: string;
        icon: typeof UserRound;
      }>,
    [],
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 pb-8">
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="bg-gradient-to-br from-slate-50 to-white p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <UsersRound className="h-5 w-5" />
                </span>
                Streckenposten
              </CardTitle>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Helfer, Einsätze, Abschnittsleiter, Schulungen und Drucklisten
                an einem Ort.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger className="h-11 w-full bg-white sm:min-w-72">
                  <SelectValue placeholder="Veranstaltung wählen" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.startsAt.slice(0, 4)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="h-11 shrink-0"
                variant="outline"
                onClick={() => void load()}
                disabled={busy}
              >
                <RefreshCw
                  className={cn("mr-2 h-4 w-4", busy && "animate-spin")}
                />
                Aktualisieren
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}
      <div
        className="sticky top-2 z-20 -mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Bereiche der Streckenpostenverwaltung"
      >
        <div className="flex min-w-max gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur md:grid md:min-w-0 md:grid-cols-4 xl:grid-cols-7">
          {tabs.map(({ key, label, detail, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={cn(
                "group flex min-w-[132px] items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition md:min-w-0",
                view === key
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-4">
                  {label}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block truncate text-[11px]",
                    view === key
                      ? "text-primary-foreground/75"
                      : "text-slate-400",
                  )}
                >
                  {detail}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {view === "people" && (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle>Helferstammdaten</CardTitle>
                <p className="mt-1 text-sm text-slate-600">
                  {people.length} Datensätze in der gewählten Veranstaltung
                </p>
              </div>
              <div className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_180px] lg:w-auto lg:min-w-[480px]">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name oder Helfernummer"
                  className="h-11"
                />
                <Select value={area} onValueChange={setArea}>
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Strecke">Strecke</SelectItem>
                    <SelectItem value="all">Alle Bereiche</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            {canWrite && (
              <details className="group rounded-lg border bg-slate-50/60 p-3 sm:p-4">
                <summary className="flex cursor-pointer list-none items-center font-medium">
                  <Plus className="mr-2 h-4 w-4" />
                  Neuen Helfer anlegen
                  <span className="ml-auto text-xs text-slate-400 group-open:hidden">
                    Öffnen
                  </span>
                </summary>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {Object.entries(personDraft).map(([key, value]) => (
                    <Input
                      className="h-11"
                      key={key}
                      type={
                        key === "birthdate"
                          ? "date"
                          : key === "helperNumber"
                            ? "number"
                            : "text"
                      }
                      value={value}
                      placeholder={key}
                      onChange={(event) =>
                        setPersonDraft((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                    />
                  ))}
                  <Button
                    className="h-11 sm:col-span-2 xl:col-span-1"
                    onClick={() => void savePerson()}
                    disabled={
                      busy ||
                      !personDraft.helperNumber ||
                      !personDraft.firstName ||
                      !personDraft.lastName
                    }
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Speichern
                  </Button>
                </div>
              </details>
            )}
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="p-3">Nr.</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Anschrift</th>
                    <th className="p-3">Kontakt</th>
                    <th className="p-3">Geburtstag</th>
                    <th className="p-3">Shirt</th>
                    <th className="p-3">Bereiche</th>
                    <th className="p-3">Lizenz</th>
                    <th className="p-3">Hinweis</th>
                    <th className="p-3">Status</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => (
                    <tr
                      key={person.id}
                      className={cn(
                        "border-b align-top transition hover:bg-slate-50/70",
                        !person.isActive && "bg-red-50 text-red-900 hover:bg-red-100/70",
                      )}
                    >
                      <td className="p-3 text-slate-500">
                        {person.helperNumber}
                      </td>
                      <td className="p-3 font-medium">
                        {person.firstName} {person.lastName}
                      </td>
                      <td className="p-3">
                        {person.street}
                        <br />
                        {person.zip} {person.city}
                      </td>
                      <td className="p-3">
                        {person.phone}
                        <br />
                        <span className="break-all">{person.email}</span>
                      </td>
                      <td className="p-3">{person.birthdate ?? "–"}</td>
                      <td className="p-3">{person.shirtSize ?? "–"}</td>
                      <td className="p-3">{person.activityAreas.join(", ")}</td>
                      <td className="p-3">{person.licenseNumber ?? "–"}</td>
                      <td className="max-w-64 whitespace-pre-wrap p-3 text-slate-600">
                        {person.note ?? "–"}
                      </td>
                      <td className="p-3">
                        {person.isActive ? (
                          <Badge className="bg-emerald-100 text-emerald-900">Aktiv</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-900">Inaktiv · kein Einsatz mehr</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        {canWrite && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingPerson(person)}
                          >
                            Bearbeiten
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 md:hidden">
              {people.map((person) => (
                <div
                  key={person.id}
                  className={cn(
                    "rounded-xl border bg-white p-4 shadow-sm",
                    !person.isActive && "border-red-300 bg-red-50 text-red-900",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-950">
                        {person.firstName} {person.lastName}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        Helfernummer {person.helperNumber}
                      </div>
                    </div>
                    {person.shirtSize && (
                      <Badge variant="secondary">
                        Shirt {person.shirtSize}
                      </Badge>
                    )}
                    {!person.isActive && (
                      <Badge className="bg-red-100 text-red-900">Inaktiv</Badge>
                    )}
                  </div>
                  <dl className="mt-3 grid gap-2 text-sm">
                    <MobileField
                      label="Anschrift"
                      value={[
                        person.street,
                        `${person.zip ?? ""} ${person.city ?? ""}`.trim(),
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    />
                    <MobileField
                      label="Kontakt"
                      value={[person.phone, person.email]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <MobileField
                        label="Bereiche"
                        value={person.activityAreas.join(", ")}
                      />
                      <MobileField
                        label="Lizenz"
                        value={person.licenseNumber}
                      />
                    </div>
                    <MobileField label="Hinweis" value={person.note} />
                  </dl>
                  {!person.isActive && (
                    <p className="mt-3 text-sm font-semibold text-red-800">
                      Kein Einsatz mehr
                    </p>
                  )}
                  {canWrite && (
                    <Button
                      className="mt-4 w-full"
                      variant="outline"
                      onClick={() => setEditingPerson(person)}
                    >
                      Bearbeiten
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {editingPerson && (
              <div className="rounded-xl border bg-slate-50 p-4 sm:p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <strong>
                      {editingPerson.firstName} {editingPerson.lastName}
                    </strong>
                    <p className="text-xs text-slate-500">
                      Stammdaten bearbeiten
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingPerson(null)}
                  >
                    Schließen
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <Input
                    className="h-11"
                    value={editingPerson.firstName}
                    onChange={(event) =>
                      setEditingPerson({
                        ...editingPerson,
                        firstName: event.target.value,
                      })
                    }
                    placeholder="Vorname"
                  />
                  <Input
                    className="h-11"
                    value={editingPerson.lastName}
                    onChange={(event) =>
                      setEditingPerson({
                        ...editingPerson,
                        lastName: event.target.value,
                      })
                    }
                    placeholder="Nachname"
                  />
                  <Input
                    className="h-11"
                    value={editingPerson.street ?? ""}
                    onChange={(event) =>
                      setEditingPerson({
                        ...editingPerson,
                        street: event.target.value,
                      })
                    }
                    placeholder="Straße"
                  />
                  <Input
                    className="h-11"
                    value={editingPerson.zip ?? ""}
                    onChange={(event) =>
                      setEditingPerson({
                        ...editingPerson,
                        zip: event.target.value,
                      })
                    }
                    placeholder="PLZ"
                  />
                  <Input
                    className="h-11"
                    value={editingPerson.city ?? ""}
                    onChange={(event) =>
                      setEditingPerson({
                        ...editingPerson,
                        city: event.target.value,
                      })
                    }
                    placeholder="Ort"
                  />
                  <Input
                    className="h-11"
                    value={editingPerson.phone ?? ""}
                    onChange={(event) =>
                      setEditingPerson({
                        ...editingPerson,
                        phone: event.target.value,
                      })
                    }
                    placeholder="Telefon"
                  />
                  <Input
                    className="h-11"
                    value={editingPerson.email ?? ""}
                    onChange={(event) =>
                      setEditingPerson({
                        ...editingPerson,
                        email: event.target.value,
                      })
                    }
                    placeholder="E-Mail"
                  />
                  <Input
                    className="h-11"
                    value={editingPerson.shirtSize ?? ""}
                    onChange={(event) =>
                      setEditingPerson({
                        ...editingPerson,
                        shirtSize: event.target.value,
                      })
                    }
                    placeholder="Shirt"
                  />
                  <Input
                    className="h-11"
                    value={editingPerson.licenseNumber ?? ""}
                    onChange={(event) =>
                      setEditingPerson({
                        ...editingPerson,
                        licenseNumber: event.target.value,
                      })
                    }
                    placeholder="DMSB-Lizenz"
                  />
                  <label className="grid gap-1 text-xs font-medium text-slate-500 sm:col-span-2">
                    Hinweis zur Person
                    <textarea
                      className="min-h-24 rounded-md border bg-white px-3 py-2 text-sm text-slate-900"
                      value={editingPerson.note ?? ""}
                      onChange={(event) =>
                        setEditingPerson({
                          ...editingPerson,
                          note: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-md border bg-white px-3 text-sm",
                      !editingPerson.isActive && "border-red-300 bg-red-50 text-red-900",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={editingPerson.isActive}
                      onChange={(event) =>
                        setEditingPerson({
                          ...editingPerson,
                          isActive: event.target.checked,
                        })
                      }
                    />
                    Aktiv und für Einsätze verfügbar
                  </label>
                  <Button
                    className="h-11 sm:col-span-2 xl:col-span-1"
                    onClick={() => void savePerson()}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Änderungen speichern
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(view === "saturday" || view === "sunday") && (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle>
                  {day?.label ?? "Tag"}: Zusagen und Einsatzplanung
                </CardTitle>
                <p className="mt-1 text-sm text-slate-600">
                  Bestätigte Besetzung und vorläufig geplante Helfer im Blick.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row" aria-label="Planungsansicht">
                <div className="inline-flex rounded-lg border bg-slate-50 p-1" role="group" aria-label="Darstellung">
                  <PlanningToggleButton
                    active={planningDisplay === "map"}
                    onClick={() => setPlanningDisplay("map")}
                  >
                    <Map className="mr-1.5 h-4 w-4" /> Karte
                  </PlanningToggleButton>
                  <PlanningToggleButton
                    active={planningDisplay === "list"}
                    onClick={() => setPlanningDisplay("list")}
                  >
                    <List className="mr-1.5 h-4 w-4" /> Liste
                  </PlanningToggleButton>
                </div>
                <div className="inline-flex rounded-lg border bg-slate-50 p-1" role="group" aria-label="Sollbesetzung">
                  <PlanningToggleButton
                    active={planningTargetMode === "normal"}
                    onClick={() => setPlanningTargetMode("normal")}
                  >
                    Normal
                  </PlanningToggleButton>
                  <PlanningToggleButton
                    active={planningTargetMode === "emergency"}
                    onClick={() => setPlanningTargetMode("emergency")}
                  >
                    Notfall
                  </PlanningToggleButton>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {planningDisplay === "map" && workspace && day ? (
              <MarshalPlanningMap
                workspace={workspace}
                day={day}
                targetMode={planningTargetMode}
                canWrite={canWrite}
                busy={busy}
                onAssign={(person, status, assignmentValue) =>
                  void saveDay(person, status, assignmentValue)
                }
              />
            ) : (
              <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="p-3">Nr.</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">PLZ / Wohnort</th>
                    <th className="p-3">Shirt</th>
                    <th className="p-3">Zusage</th>
                    <th className="p-3">Posten / Funktion</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => {
                    const assignment = person.assignments.find(
                      (item) => item.dayId === day?.id,
                    );
                    const selected = getAssignmentValue(assignment);
                    return (
                      <tr
                        key={person.id}
                        className={cn(
                          "border-b transition hover:bg-slate-50/70",
                          !person.isActive && "bg-red-50 text-red-900 hover:bg-red-100/70",
                        )}
                      >
                        <td className="p-3 text-slate-500">
                          {person.helperNumber}
                        </td>
                        <td className="p-3 font-medium">
                          {person.firstName} {person.lastName}
                          {!person.isActive && (
                            <span className="mt-1 block text-xs font-semibold text-red-700">
                              Inaktiv · kein Einsatz mehr
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {person.zip} {person.city}
                        </td>
                        <td className="p-3">
                          {person.participation.shirtSizeSnapshot ??
                            person.shirtSize ??
                            "–"}
                        </td>
                        <td className="p-3">
                          <CommitmentSelect
                            value={assignment?.commitmentStatus ?? "not_asked"}
                            disabled={!canWrite || busy || !person.isActive}
                            onChange={(value) =>
                              void saveDay(
                                person,
                                value,
                                selected === "none" ? "" : selected,
                              )
                            }
                          />
                        </td>
                        <td className="p-3">
                          <AssignmentSelect
                            value={selected}
                            workspace={workspace}
                            disabled={
                              !canWrite ||
                              busy ||
                              !person.isActive ||
                              !assignment ||
                              assignment.commitmentStatus === "declined" ||
                              assignment.commitmentStatus === "not_asked"
                            }
                            onChange={(value) =>
                              void saveDay(
                                person,
                                assignment?.commitmentStatus ?? "accepted",
                                value === "none" ? "" : value,
                              )
                            }
                          />
                          {selected !== "none" &&
                            (assignment?.commitmentStatus === "pending" ||
                              assignment?.commitmentStatus === "tentative") && (
                              <p className="mt-1.5 text-xs font-semibold text-amber-700">
                                Vorläufig – zählt nicht zur bestätigten Besetzung
                              </p>
                            )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 md:hidden">
              {people.map((person) => {
                const assignment = person.assignments.find(
                  (item) => item.dayId === day?.id,
                );
                const selected = getAssignmentValue(assignment);
                return (
                  <div
                    key={person.id}
                    className={cn(
                      "rounded-xl border bg-white p-4 shadow-sm",
                      !person.isActive && "border-red-300 bg-red-50 text-red-900",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">
                          {person.firstName} {person.lastName}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          Nr. {person.helperNumber} · {person.zip} {person.city}
                        </div>
                        {!person.isActive && (
                          <div className="mt-1 text-xs font-semibold text-red-700">
                            Inaktiv · kein Einsatz mehr
                          </div>
                        )}
                      </div>
                      <Badge variant="secondary">
                        {person.participation.shirtSizeSnapshot ??
                          person.shirtSize ??
                          "ohne Shirt"}
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-3">
                      <label className="grid gap-1.5 text-xs font-medium text-slate-500">
                        Zusage
                        <CommitmentSelect
                          value={assignment?.commitmentStatus ?? "not_asked"}
                          disabled={!canWrite || busy || !person.isActive}
                          onChange={(value) =>
                            void saveDay(
                              person,
                              value,
                              selected === "none" ? "" : selected,
                            )
                          }
                        />
                      </label>
                      <label className="grid gap-1.5 text-xs font-medium text-slate-500">
                        Posten / Funktion
                        <AssignmentSelect
                          value={selected}
                          workspace={workspace}
                          disabled={
                            !canWrite ||
                            busy ||
                            !person.isActive ||
                            !assignment ||
                            assignment.commitmentStatus === "declined" ||
                            assignment.commitmentStatus === "not_asked"
                          }
                          onChange={(value) =>
                            void saveDay(
                              person,
                              assignment?.commitmentStatus ?? "accepted",
                              value === "none" ? "" : value,
                            )
                          }
                        />
                        {selected !== "none" &&
                          (assignment?.commitmentStatus === "pending" ||
                            assignment?.commitmentStatus === "tentative") && (
                            <span className="text-xs font-semibold text-amber-700">
                              Vorläufig – zählt nicht zur bestätigten Besetzung
                            </span>
                          )}
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {view === "prints" && (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>Drucklisten</CardTitle>
            <p className="mt-1 text-sm text-slate-600">
              Anwesenheits- und Abschnittslisten für jeden Veranstaltungstag.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 p-4 pt-0 sm:p-6 sm:pt-0 lg:grid-cols-2">
            {workspace?.days.map((printDay) => (
              <div
                key={printDay.id}
                className="rounded-xl border bg-slate-50/50 p-4"
              >
                <strong className="text-base">{printDay.label}</strong>
                <div className="text-xs text-slate-500">
                  {printDay.eventDate}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Button
                    className="justify-start"
                    variant="outline"
                    disabled={!canExport}
                    onClick={() =>
                      void adminMarshalsService.downloadPrint({
                        eventId,
                        type: "attendance",
                        dayId: printDay.id,
                      })
                    }
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Anwesenheitsliste
                  </Button>
                  {workspace.sections.map((section) => (
                    <Button
                      className="justify-start"
                      key={section.id}
                      variant="outline"
                      disabled={!canExport}
                      onClick={() =>
                        void adminMarshalsService.downloadPrint({
                          eventId,
                          type: "section",
                          dayId: printDay.id,
                          sectionId: section.id,
                        })
                      }
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {section.name}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {view === "training" && (
        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle>Schulung / Einweisung</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
              <Select
                value={selectedTrainingId}
                onValueChange={setSelectedTrainingId}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Termin wählen" />
                </SelectTrigger>
                <SelectContent>
                  {workspace?.trainings.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.sessionDate} – {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentTraining && canExport && (
                <Button
                  className="h-11 w-full"
                  variant="outline"
                  onClick={() =>
                    void adminMarshalsService.downloadPrint({
                      eventId,
                      type: "training",
                      trainingId: currentTraining.id,
                    })
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Teilnehmerliste
                </Button>
              )}
              {canWrite && (
                <div className="space-y-2 border-t pt-4">
                  <Label>Neuer Termin</Label>
                  <Select
                    value={trainingDraft.sessionType}
                    onValueChange={(value: "training" | "briefing") =>
                      setTrainingDraft({ ...trainingDraft, sessionType: value })
                    }
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="training">Lizenzschulung</SelectItem>
                      <SelectItem value="briefing">Einweisung</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-11"
                    value={trainingDraft.title}
                    onChange={(event) =>
                      setTrainingDraft({
                        ...trainingDraft,
                        title: event.target.value,
                      })
                    }
                    placeholder="Titel"
                  />
                  <Input
                    className="h-11"
                    type="date"
                    value={trainingDraft.sessionDate}
                    onChange={(event) =>
                      setTrainingDraft({
                        ...trainingDraft,
                        sessionDate: event.target.value,
                      })
                    }
                  />
                  <Input
                    className="h-11"
                    value={trainingDraft.location}
                    onChange={(event) =>
                      setTrainingDraft({
                        ...trainingDraft,
                        location: event.target.value,
                      })
                    }
                    placeholder="Ort"
                  />
                  <Button
                    className="h-11 w-full"
                    onClick={() => void createTraining()}
                    disabled={
                      !trainingDraft.title || !trainingDraft.sessionDate
                    }
                  >
                    Anlegen
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle>Teilnehmer und Lizenzstatus</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="p-3">Name</th>
                      <th className="p-3">DMSB-Lizenz</th>
                      <th className="p-3">Anwesenheit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((person) => {
                      const participant = workspace?.trainingParticipants.find(
                        (item) =>
                          item.sessionId === selectedTrainingId &&
                          item.personId === person.id,
                      );
                      return (
                        <tr key={person.id} className="border-b">
                          <td className="p-3 font-medium">
                            {person.firstName} {person.lastName}
                          </td>
                          <td className="p-3">
                            {getLicense(person, workspace)}
                          </td>
                          <td className="p-3">
                            <AttendanceSelect
                              value={
                                participant?.attendanceStatus ?? "registered"
                              }
                              disabled={!canWrite || !selectedTrainingId}
                              onChange={(value) =>
                                void adminMarshalsService
                                  .saveTrainingParticipant(
                                    selectedTrainingId,
                                    person.id,
                                    value,
                                  )
                                  .then(load)
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3 md:hidden">
                {people.map((person) => {
                  const participant = workspace?.trainingParticipants.find(
                    (item) =>
                      item.sessionId === selectedTrainingId &&
                      item.personId === person.id,
                  );
                  return (
                    <div key={person.id} className="rounded-xl border p-4">
                      <div className="font-semibold">
                        {person.firstName} {person.lastName}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        DMSB-Lizenz: {getLicense(person, workspace)}
                      </div>
                      <label className="mt-3 grid gap-1.5 text-xs font-medium text-slate-500">
                        Anwesenheit
                        <AttendanceSelect
                          value={participant?.attendanceStatus ?? "registered"}
                          disabled={!canWrite || !selectedTrainingId}
                          onChange={(value) =>
                            void adminMarshalsService
                              .saveTrainingParticipant(
                                selectedTrainingId,
                                person.id,
                                value,
                              )
                              .then(load)
                          }
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {view === "config" && (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Abschnitte und Posten</CardTitle>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                  Vier organisatorische Abschnitte; 5/1–5/3 bleiben historisch
                  Abschnitt 4 zugeordnet. Besetzung wird als Ist/Soll gezeigt.
                </p>
              </div>
              {canWrite && (
                <Button
                  className="h-11 shrink-0"
                  onClick={() => void saveConfig()}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Konfiguration speichern
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-4 pt-0 sm:p-6 sm:pt-0 xl:grid-cols-2">
            {workspace?.sections.map((section) => (
              <div key={section.id} className="rounded-xl border p-4">
                <div className="mb-3 flex justify-between">
                  <strong>{section.name}</strong>
                  <Badge>{section.leaderCode}</Badge>
                </div>
                <div className="divide-y">
                  {workspace.posts
                    .filter((post) => post.sectionId === section.id)
                    .map((post) => {
                      const target = postTargets[post.id] ?? post.targetStaff;
                      const emergencyTarget = Math.min(
                        target,
                        emergencyPostTargets[post.id] ??
                          post.emergencyTargetStaff ??
                          target,
                      );
                      const counts = workspace.days.map(
                        (configDay) =>
                          people.filter((person) =>
                            person.assignments.some(
                              (assignment) =>
                                assignment.dayId === configDay.id &&
                                assignment.postId === post.id &&
                                assignment.commitmentStatus === "accepted",
                            ),
                          ).length,
                      );
                      return (
                        <div
                          key={post.id}
                          className="grid gap-3 py-3 sm:grid-cols-[64px_minmax(0,1fr)_auto_176px] sm:items-center"
                        >
                          <span className="font-semibold">{post.code}</span>
                          <span className="text-sm text-slate-600">
                            {post.description || "Streckenposten"}
                          </span>
                          <span className="flex flex-wrap gap-1 text-xs">
                            {workspace.days.map((configDay, index) => (
                              <Badge
                                key={configDay.id}
                                className={
                                  counts[index] < target
                                    ? "bg-amber-100 text-amber-900"
                                    : counts[index] > target
                                      ? "bg-red-100 text-red-900"
                                      : "bg-emerald-100 text-emerald-900"
                                }
                              >
                                {configDay.label.slice(0, 2)} {counts[index]}/
                                {target}
                              </Badge>
                            ))}
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="grid gap-1 text-xs text-slate-500">
                              Normal
                              <Input
                                className="h-10 w-full"
                                aria-label={`Normale Sollbesetzung ${post.code}`}
                                type="number"
                                min={1}
                                max={20}
                                value={target}
                                disabled={!canWrite}
                                onChange={(event) => {
                                  const value = Math.max(
                                    1,
                                    Number(event.target.value) || 1,
                                  );
                                  setPostTargets((current) => ({
                                    ...current,
                                    [post.id]: value,
                                  }));
                                  setEmergencyPostTargets((current) => ({
                                    ...current,
                                    [post.id]: Math.min(
                                      current[post.id] ?? emergencyTarget,
                                      value,
                                    ),
                                  }));
                                }}
                              />
                            </label>
                            <label className="grid gap-1 text-xs text-slate-500">
                              Notfall
                              <Input
                                className="h-10 w-full"
                                aria-label={`Notfall-Sollbesetzung ${post.code}`}
                                type="number"
                                min={1}
                                max={target}
                                value={emergencyTarget}
                                disabled={!canWrite}
                                onChange={(event) =>
                                  setEmergencyPostTargets((current) => ({
                                    ...current,
                                    [post.id]: Math.min(
                                      target,
                                      Math.max(
                                        1,
                                        Number(event.target.value) || 1,
                                      ),
                                    ),
                                  }))
                                }
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {view === "import" && (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Einmaliger Excel-Import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
              Die Arbeitsmappe wird zuerst nur analysiert. Erst nach Prüfung der
              Zusammenfassung wird sie idempotent übernommen. Nach dem
              erfolgreichen Erstimport wird dieser Bereich wieder entfernt.
            </div>
            <Input
              className="h-auto min-h-11 py-2"
              type="file"
              accept=".xlsx"
              onChange={(event) => {
                setImportFile(event.target.files?.[0] ?? null);
                setImportPreview(null);
                setImportData("");
              }}
            />
            {canWrite && (
              <Button
                className="h-11 w-full sm:w-auto"
                onClick={() => void previewImport()}
                disabled={!importFile || busy}
              >
                Dry-run starten
              </Button>
            )}
            {importPreview && (
              <div className="rounded-xl border bg-slate-50 p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  <Metric
                    label="Personen"
                    value={importPreview.summary.people}
                  />
                  <Metric label="Neu" value={importPreview.summary.newPeople} />
                  <Metric
                    label="Aktualisiert"
                    value={importPreview.summary.updatedPeople}
                  />
                  <Metric
                    label="Teilnahmen"
                    value={importPreview.summary.eventParticipations}
                  />
                  <Metric
                    label="Termine"
                    value={importPreview.summary.trainings}
                  />
                  <Metric
                    label="Prüffälle"
                    value={importPreview.summary.conflicts}
                  />
                </div>
                {importPreview.conflicts.length > 0 && (
                  <ul className="mt-4 max-h-48 space-y-1 overflow-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    {importPreview.conflicts.map((item, index) => (
                      <li key={`${item.sheet}-${item.row}-${index}`}>
                        {item.sheet}, Zeile {item.row}: {item.message}
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  className="mt-4 h-11 w-full sm:w-auto"
                  onClick={() => void commitImport()}
                  disabled={busy}
                >
                  Geprüften Import übernehmen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border bg-white p-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function PlanningToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center justify-center rounded-md px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active
          ? "bg-white text-slate-950 shadow-sm"
          : "text-slate-500 hover:text-slate-900",
      )}
    >
      {children}
    </button>
  );
}

function MobileField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-words text-slate-700">{value || "–"}</dd>
    </div>
  );
}

function getAssignmentValue(
  assignment: MarshalPerson["assignments"][number] | undefined,
) {
  if (assignment?.postId) return `post:${assignment.postId}`;
  if (assignment?.role === "section_leader" && assignment.sectionId)
    return `leader:${assignment.sectionId}`;
  return "none";
}

function CommitmentSelect({
  value,
  disabled,
  onChange,
}: {
  value: MarshalCommitmentStatus;
  disabled: boolean;
  onChange: (value: MarshalCommitmentStatus) => void;
}) {
  return (
    <select
      className={inputClass}
      value={value}
      disabled={disabled}
      onChange={(event) =>
        onChange(event.target.value as MarshalCommitmentStatus)
      }
    >
      {Object.entries(statusLabels).map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}

function AssignmentSelect({
  value,
  workspace,
  disabled,
  onChange,
}: {
  value: string;
  workspace: MarshalWorkspace | null;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <select
      className={cn(inputClass, "min-w-52")}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="none">Noch nicht zugewiesen</option>
      {workspace?.sections.map((section) => (
        <option key={`leader:${section.id}`} value={`leader:${section.id}`}>
          {section.leaderCode} – {section.name}
        </option>
      ))}
      {workspace?.posts.map((post) => (
        <option
          key={`post:${post.id}`}
          value={`post:${post.id}`}
          disabled={!post.isActive}
        >
          {post.code}
          {post.description ? ` – ${post.description}` : ""}
          {!post.isActive ? " (inaktiv)" : ""}
        </option>
      ))}
    </select>
  );
}

type AttendanceStatus = "registered" | "attended" | "absent" | "excused";

function AttendanceSelect({
  value,
  disabled,
  onChange,
}: {
  value: AttendanceStatus;
  disabled: boolean;
  onChange: (value: AttendanceStatus) => void;
}) {
  return (
    <select
      className={inputClass}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as AttendanceStatus)}
    >
      <option value="registered">Angemeldet</option>
      <option value="attended">Anwesend</option>
      <option value="absent">Nicht anwesend</option>
      <option value="excused">Entschuldigt</option>
    </select>
  );
}

function getLicense(person: MarshalPerson, workspace: MarshalWorkspace | null) {
  return (
    person.licenseNumber ??
    workspace?.qualifications.find((item) => item.personId === person.id)
      ?.number ??
    "–"
  );
}
