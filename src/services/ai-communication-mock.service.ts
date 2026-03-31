import type {
  AiDashboardTool,
  AiDriverOption,
  AiEventOption,
  AiEventReportEnvelope,
  AiEventReportRequest,
  AiSpeakerRequest,
  AiSpeakerTextEnvelope
} from "@/types/ai-communication";

export const aiDashboardTools: AiDashboardTool[] = [
  {
    key: "mail-assistant",
    title: "Anfrage- und Mail-Assistent",
    description: "Ordnet eingehende Nachrichten ein, fasst sie zusammen und erstellt prüfbare Antwortentwürfe.",
    href: "/admin/ai-communication/mail-assistant",
    statLabel: "Inbox + Reply",
    bulletPoints: ["Originalnachricht und Basis sichtbar", "Warnungen strukturiert rendern", "Explizites Speichern statt Autoversand"]
  },
  {
    key: "report-generator",
    title: "Event-Bericht-Generator",
    description: "Bereitet Event-Texte im Contract-Format auf, bleibt bis zu weiteren Read-Endpunkten aber bewusst mock-basiert.",
    href: "/admin/ai-communication/report-generator",
    statLabel: "Mock-Auswahl",
    bulletPoints: ["`formats[]` und `result.variants[]`", "Basis mit Scope und Fakten", "Kein echter Save/Publish-Flow"]
  },
  {
    key: "speaker-assistant",
    title: "Sprecherassistenz",
    description: "Zeigt die spätere Contract-Struktur bereits an, nutzt für die Auswahl derzeit aber noch Demo-Daten.",
    href: "/admin/ai-communication/speaker-assistant",
    statLabel: "Mock-Auswahl",
    bulletPoints: ["`result.text` und `result.facts`", "`basis.context` als Quellenblock", "Prüfhinweis immer sichtbar"]
  }
];

const events: AiEventOption[] = [
  {
    id: "classic-endurance-cup",
    name: "MSC Classic Endurance Cup 2026",
    dateLabel: "18. Juli 2026",
    location: "MSC-Ring Klettwitz",
    stageLabel: "Rennwochenende bestätigt",
    classes: [
      { id: "touring-pre-82", name: "Tourenwagen bis 1982" },
      { id: "gt-legends", name: "GT Legends" }
    ],
    contextFacts: ["76 gemeldete Fahrzeuge", "ausverkaufte Fahrerlagerführung", "leichter Regen im ersten Lauf"]
  },
  {
    id: "bergpokal-revival",
    name: "Bergpokal Revival 2026",
    dateLabel: "29. August 2026",
    location: "Bergring Finsterwalde",
    stageLabel: "Datenlage noch unvollständig",
    classes: [
      { id: "historic-single-seater", name: "Historische Einsitzer" },
      { id: "youngtimer-open", name: "Youngtimer Open" }
    ],
    contextFacts: ["Streckenfreigabe ausstehend", "Vorläufig 34 Starter", "Siegerehrung noch nicht terminiert"]
  }
];

const drivers: AiDriverOption[] = [
  {
    entryId: "entry-anna-keller",
    eventId: "classic-endurance-cup",
    classId: "gt-legends",
    name: "Anna Keller",
    vehicleLabel: "Porsche 911 RSR",
    hometown: "Dresden",
    startNumber: "27",
    achievements: ["Klassensieg Lausitz Historic 2025", "Pole Position beim Saisonauftakt 2026"]
  },
  {
    entryId: "entry-lukas-barth",
    eventId: "classic-endurance-cup",
    classId: "touring-pre-82",
    name: "Lukas Barth",
    vehicleLabel: "BMW 2002 ti",
    hometown: "Cottbus",
    startNumber: "14",
    achievements: ["Publikumsliebling 2025", "Bestzeit im freien Training"]
  },
  {
    entryId: "entry-mira-novak",
    eventId: "bergpokal-revival",
    classId: "youngtimer-open",
    name: "Mira Novak",
    vehicleLabel: "Opel Kadett GSi",
    hometown: "Leipzig",
    startNumber: "33",
    achievements: ["Debüt im Bergrennsport", "Top-3 im Youngtimer Sprint Cup"]
  }
];

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const aiCommunicationMockService = {
  async listEvents() {
    await wait(180);
    return clone(events);
  },

  async listDrivers() {
    await wait(180);
    return clone(drivers);
  },

  async generateReport(request: AiEventReportRequest): Promise<AiEventReportEnvelope> {
    await wait(850);

    const event = events.find((item) => item.id === request.eventId);
    const classOption = event?.classes.find((item) => item.id === request.classId);
    const highlights = request.highlights.filter((item) => item.trim());

    if (request.eventId === "bergpokal-revival" && highlights.length === 0) {
      throw new Error("Für das Bergpokal Revival fehlen im Mock-up noch belastbare Highlights.");
    }

    return {
      ok: true,
      eventId: request.eventId,
      task: "event_report",
      result: {
        variants: request.formats.map((format) => ({
          format,
          title: format === "website" ? `Starkes Feld bei ${event?.name ?? "dem Event"}` : null,
          teaser: format === "website" ? "Breites Teilnehmerfeld und intensive Rennatmosphäre." : null,
          text:
            format === "website"
              ? `Beim ${event?.name ?? "ausgewählten Event"} standen ${highlights.join(", ") || "sportliche Atmosphäre und Fahrerlager-Stimmung"} im Mittelpunkt. Dieser Mock-Text folgt bereits der späteren Envelope-Struktur.`
              : `${event?.name ?? "Event"} kompakt: ${highlights.join(", ") || "intensive Atmosphäre und gute Resonanz"}.`
        }))
      },
      basis: {
        scope: request.scope,
        event: {
          id: request.eventId,
          name: event?.name ?? null
        },
        class: request.scope === "class" && classOption ? { id: classOption.id, name: classOption.name } : null,
        facts: {
          entriesTotal: request.scope === "class" ? 24 : 76,
          acceptedTotal: request.scope === "class" ? 18 : 54,
          paidTotal: request.scope === "class" ? 14 : 39
        },
        highlights
      },
      warnings: [
        {
          code: "MOCK_SELECTION_SOURCE",
          severity: "medium",
          message: "Auswahl und Fakten stammen vorläufig aus Mock-Daten, bis zusätzliche Read-Endpunkte verfügbar sind."
        }
      ],
      review: {
        required: true,
        status: "draft",
        confidence: request.eventId === "bergpokal-revival" ? "low" : "medium"
      },
      meta: {
        modelId: "mock.local-ai-report",
        promptVersion: "mock-v2",
        generatedAt: new Date().toISOString()
      }
    };
  },

  async generateSpeakerText(request: AiSpeakerRequest): Promise<AiSpeakerTextEnvelope> {
    await wait(800);

    const driver = drivers.find((item) => item.entryId === request.entryId);
    const event = events.find((item) => item.id === request.eventId);
    const classOption =
      event?.classes.find((item) => item.id === request.classId) ??
      event?.classes.find((item) => item.id === driver?.classId);

    return {
      ok: true,
      eventId: request.eventId,
      task: "speaker_text",
      result: {
        text: driver
          ? `${driver.name} aus ${driver.hometown} kommt jetzt mit der Startnummer ${driver.startNumber} an den Vorstart. Im ${driver.vehicleLabel} bringt das Team heute viel Aufmerksamkeit mit.`
          : `Jetzt richtet sich der Blick auf die Klasse ${classOption?.name ?? "Unbekannt"}. Das Feld verspricht eine spannende Mischung aus Fahrzeugen und Fahrstilen.`,
        facts: driver
          ? [`Startnummer ${driver.startNumber}`, classOption?.name ?? "Klasse unbekannt", driver.vehicleLabel]
          : [classOption?.name ?? "Klasse unbekannt", event?.name ?? "Event unbekannt", "Moderation vor Live-Nutzung prüfen"]
      },
      basis: {
        focusType: request.entryId ? "entry" : "class",
        context: driver
          ? {
              eventName: event?.name ?? null,
              className: classOption?.name ?? null,
              startNumber: driver.startNumber,
              driverName: driver.name,
              vehicleLabel: driver.vehicleLabel
            }
          : {
              eventName: event?.name ?? null,
              className: classOption?.name ?? null
            },
        highlights: request.highlights
      },
      warnings: [
        {
          code: "MOCK_SELECTION_SOURCE",
          severity: "medium",
          message: "Die Sprecher-Auswahl nutzt vorläufig Demo-Daten, bis eine reale Entry-/Class-Quelle verbindlich ist."
        }
      ],
      review: {
        required: true,
        status: "draft",
        confidence: driver ? "medium" : "low"
      },
      meta: {
        modelId: "mock.local-speaker",
        promptVersion: "mock-v2",
        generatedAt: new Date().toISOString()
      }
    };
  }
};
