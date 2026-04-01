import type { AiDashboardTool } from "@/types/ai-communication";

export const aiDashboardTools: AiDashboardTool[] = [
  {
    key: "mail-assistant",
    title: "Mail-Assistent",
    description: "Bearbeitet eingehende Anfragen mit sichtbar getrennter Quellenbasis, Entwurf, Rückfragen und Wissensreview.",
    href: "/admin/ai-communication/mail-assistant",
    statLabel: "Inbox + Reply",
    bulletPoints: ["Posteingang mit Detailansicht", "Antwortentwürfe mit Fakten und Unknowns", "Kontext-Chat und Wissensreview"]
  },
  {
    key: "report-generator",
    title: "Event-Bericht",
    description: "Erstellt prüfbare Event-Texte aus dem aktuellen Event-Kontext und rendert Varianten, Warnungen und Review-Hinweise klar getrennt.",
    href: "/admin/ai-communication/report-generator",
    statLabel: "Mehrvarianten",
    bulletPoints: ["Scope für Event oder Klasse", "Varianten für Web und Kurzfassung", "Review, Warnings und Basis sichtbar"]
  },
  {
    key: "speaker-assistant",
    title: "Sprecherassistenz",
    description: "Generiert moderationsnahe Sprechertexte auf Basis realer Event-, Klassen- und Entry-Kontexte.",
    href: "/admin/ai-communication/speaker-assistant",
    statLabel: "On-track",
    bulletPoints: ["Fokus auf Fahrer oder Klasse", "Echte Entry-Auswahl", "Faktenblock und Review-Hinweise"]
  }
];
