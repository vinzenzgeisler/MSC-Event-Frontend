import { useEffect, useState } from "react";
import { Bike, Car, FileDown, Mail, ShieldCheck, Wrench } from "lucide-react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  acceptanceStatusClasses,
  acceptanceStatusLabel,
  checkinClasses,
  checkinLabel,
  paymentStatusClasses,
  paymentStatusLabel
} from "@/lib/admin-status";
import { adminEntriesService } from "@/services/admin-entries.service";
import { communicationService } from "@/services/communication.service";

const tabs = ["Überblick", "Person", "Startmeldungen/Fahrzeuge", "Zahlung", "Dokumente", "Historie", "Notizen"] as const;

type TabValue = (typeof tabs)[number];

function asEuro(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function VehicleThumb({ src, label, onOpen }: { src: string | null; label: string; onOpen: () => void }) {
  if (src) {
    return (
      <button type="button" className="group relative block" onClick={onOpen}>
        <img className="h-44 w-full rounded-md border object-cover md:h-64" src={src} alt={`Fahrzeug: ${label}`} />
        <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
          Bild öffnen
        </span>
      </button>
    );
  }
  const isMoto = label.toLowerCase().includes("yamaha") || label.toLowerCase().includes("moto");
  return (
    <div className="flex h-44 w-full items-center justify-center rounded-md border bg-slate-100 text-slate-500 md:h-64">
      {isMoto ? <Bike className="h-10 w-10" /> : <Car className="h-10 w-10" />}
    </div>
  );
}

export function AdminEntryDetailPage() {
  const { entryId = "" } = useParams();
  const [activeTab, setActiveTab] = useState<TabValue>("Überblick");
  const [resolvedDetail, setResolvedDetail] = useState<Awaited<ReturnType<typeof adminEntriesService.getEntryDetail>>>(null);
  const [status, setStatus] = useState<"pending" | "shortlist" | "accepted" | "rejected">("accepted");
  const [paid, setPaid] = useState(false);
  const [checkinDone, setCheckinDone] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const [internalNote, setInternalNote] = useState("");
  const [driverNote, setDriverNote] = useState("");

  const loadDetail = () => {
    adminEntriesService.getEntryDetail(entryId).then((result) => {
      setResolvedDetail(result);
      if (result) {
        setStatus(result.status);
        setPaid(result.payment.status === "paid");
        setCheckinDone(result.checkinVerified);
        setInternalNote(result.internalNote);
        setDriverNote(result.driverNote);
      }
    });
  };

  useEffect(() => {
    loadDetail();
  }, [entryId]);

  if (!resolvedDetail) {
    return <div className="rounded-xl border border-dashed p-6 text-sm text-slate-500">Nennung nicht gefunden.</div>;
  }

  const paymentState = paid ? "paid" : "due";
  const paidPercent = Math.max(0, Math.min(100, Math.round((resolvedDetail.payment.paidAmountCents / resolvedDetail.payment.totalCents) * 100)));

  const quickActions = (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-slate-600">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            await adminEntriesService.setEntryStatus(resolvedDetail.id, "to_shortlist");
            setStatus("shortlist");
            setActionMessage("Status auf Vorauswahl gesetzt.");
            loadDetail();
          }}
        >
          Auf Vorauswahl setzen
        </Button>

        <Button
          type="button"
          onClick={async () => {
            const confirmed = window.confirm(
              "Wirklich auf 'Zugelassen' setzen? Danach wird automatisch die Zulassungs-Mail versendet."
            );
            if (!confirmed) {
              return;
            }
            await adminEntriesService.setEntryStatus(resolvedDetail.id, "to_accepted");
            await communicationService.queueAcceptedMailForEntry(resolvedDetail.id);
            setStatus("accepted");
            setActionMessage("Status auf Zugelassen gesetzt. Zulassungs-Mail wurde angestoßen.");
            loadDetail();
          }}
        >
          Auf Zugelassen setzen
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            await adminEntriesService.setEntryPaymentPaid(resolvedDetail.id);
            setPaid(true);
            setActionMessage("Zahlung wurde als bezahlt markiert.");
            loadDetail();
          }}
        >
          Als bezahlt markieren
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            await adminEntriesService.setEntryCheckinVerified(resolvedDetail.id);
            setCheckinDone(true);
            setActionMessage("Einchecken wurde bestätigt.");
            loadDetail();
          }}
        >
          Einchecken bestätigen
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            await communicationService.queuePaymentReminderForEntry(resolvedDetail.id);
            setActionMessage("Zahlungserinnerung wurde in die Mail-Queue gelegt.");
          }}
        >
          <Mail className="mr-2 h-4 w-4" />
          Zahlungserinnerung senden
        </Button>

        <Button type="button" variant="outline" onClick={() => setActionMessage("PDF Haftverzicht bereitgestellt (UI-only).")}> 
          <ShieldCheck className="mr-2 h-4 w-4" />
          PDF Haftverzicht
        </Button>

        <Button type="button" variant="outline" onClick={() => setActionMessage("PDF Technische Abnahme bereitgestellt (UI-only).")}> 
          <Wrench className="mr-2 h-4 w-4" />
          PDF Technische Abnahme
        </Button>

        <Button type="button" variant="outline" onClick={() => setActionMessage("Dokumentenpaket vorbereitet (UI-only).")}> 
          <FileDown className="mr-2 h-4 w-4" />
          Dokumente bündeln
        </Button>
      </CardContent>
    </Card>
  );

  const sectionOverview = (
    <Card>
      <CardHeader>
        <CardTitle>Überblick</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="text-xs uppercase text-slate-500">Fahrer</div>
          <div className="font-medium">{resolvedDetail.driver.name}</div>
          <div className="text-sm text-slate-600">{resolvedDetail.driver.email}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-slate-500">Status</div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge className={acceptanceStatusClasses(status)} variant="outline">
              {acceptanceStatusLabel(status)}
            </Badge>
            <Badge className={paymentStatusClasses(paymentState)} variant="outline">
              Zahlung: {paymentStatusLabel(paymentState)}
            </Badge>
            <Badge className={checkinClasses(checkinDone)} variant="outline">
              Einchecken: {checkinLabel(checkinDone)}
            </Badge>
          </div>
          <div className="pt-2 text-sm text-slate-600">Registrierung: {resolvedDetail.registrationStatus === "submitted_verified" ? "Bestätigt" : "Unbestätigt"}</div>
        </div>
      </CardContent>
    </Card>
  );

  const sectionPerson = (
    <Card>
      <CardHeader>
        <CardTitle>Person</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-slate-700">
        <div>Name: {resolvedDetail.driver.name}</div>
        <div>E-Mail: {resolvedDetail.driver.email}</div>
        <div>Hinweise: {resolvedDetail.notes || "-"}</div>
      </CardContent>
    </Card>
  );

  const sectionVehicle = (
    <Card>
      <CardHeader>
        <CardTitle>Startmeldungen / Fahrzeuge</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-700">
        <VehicleThumb src={resolvedDetail.vehicle.thumbUrl} label={resolvedDetail.vehicle.label} onOpen={() => setImageOpen(true)} />
        <div>
          <div className="font-medium">{resolvedDetail.vehicle.label}</div>
          <div className="text-xs text-slate-500">Startnummer: {resolvedDetail.startNumber}</div>
        </div>
        {resolvedDetail.vehicle.facts.map((fact) => (
          <div key={fact}>{fact}</div>
        ))}
        {resolvedDetail.relatedEntryIds.length > 1 && <div>Verknüpfte Nennungen: {resolvedDetail.relatedEntryIds.join(", ")}</div>}
      </CardContent>
    </Card>
  );

  const sectionPayment = (
    <Card>
      <CardHeader>
        <CardTitle>Zahlung</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-700">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border bg-slate-50 p-3">Gesamt: {asEuro(resolvedDetail.payment.totalCents)}</div>
          <div className="rounded-md border bg-slate-50 p-3">Bezahlt: {asEuro(resolvedDetail.payment.paidAmountCents)}</div>
          <div className="rounded-md border bg-slate-50 p-3">Offen: {asEuro(resolvedDetail.payment.amountOpenCents)}</div>
        </div>
        <div>
          <div className="mb-1 text-xs text-slate-500">Zahlungsfortschritt</div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-2 bg-emerald-500" style={{ width: `${paidPercent}%` }} />
          </div>
          <div className="mt-1 text-xs text-slate-600">{paidPercent}% bezahlt</div>
        </div>
      </CardContent>
    </Card>
  );

  const sectionDocuments = (
    <Card>
      <CardHeader>
        <CardTitle>Dokumente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-slate-700">
        {resolvedDetail.documents.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between rounded border p-2">
            <span>{doc.type}</span>
            <span>{doc.status}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  const sectionHistory = (
    <Card>
      <CardHeader>
        <CardTitle>Historie</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-700">
        {resolvedDetail.history.map((item) => (
          <div key={item.id} className="relative rounded border p-3">
            <div className="mb-1 font-medium">{item.action}</div>
            <div>{item.details}</div>
            <div className="mt-1 text-xs text-slate-500">
              {new Date(item.timestamp).toLocaleString("de-DE")} · {item.actor}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  const sectionNotes = (
    <Card>
      <CardHeader>
        <CardTitle>Notizen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900">Interne Notiz (nur Team)</label>
          <textarea
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={internalNote}
            onChange={(event) => setInternalNote(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900">Notiz für Fahrer (geht mit Zulassungs-Mail raus)</label>
          <textarea
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={driverNote}
            onChange={(event) => setDriverNote(event.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            await adminEntriesService.saveEntryNotes(resolvedDetail.id, { internalNote, driverNote });
            setActionMessage("Notizen gespeichert.");
          }}
        >
          Notizen speichern
        </Button>
      </CardContent>
    </Card>
  );

  const desktopSections: Record<TabValue, JSX.Element> = {
    Überblick: sectionOverview,
    Person: sectionPerson,
    "Startmeldungen/Fahrzeuge": sectionVehicle,
    Zahlung: sectionPayment,
    Dokumente: sectionDocuments,
    Historie: sectionHistory,
    Notizen: sectionNotes
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{resolvedDetail.headline}</h1>
          <p className="text-sm text-slate-600">
            {resolvedDetail.classLabel} · Startnummer {resolvedDetail.startNumber}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={acceptanceStatusClasses(status)} variant="outline">
            {acceptanceStatusLabel(status)}
          </Badge>
          <Badge className={paymentStatusClasses(paymentState)} variant="outline">
            Zahlung: {paymentStatusLabel(paymentState)}
          </Badge>
          <Badge className={checkinClasses(checkinDone)} variant="outline">
            Einchecken: {checkinLabel(checkinDone)}
          </Badge>
        </div>
      </div>

      {actionMessage && <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{actionMessage}</div>}

      {quickActions}

      <div className="space-y-3 md:hidden">
        {sectionOverview}
        {sectionPerson}
        {sectionVehicle}
        {sectionPayment}
        {sectionDocuments}
        {sectionHistory}
        {sectionNotes}
      </div>

      <div className="hidden space-y-3 md:block">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <Button key={tab} type="button" size="sm" variant={activeTab === tab ? "default" : "outline"} onClick={() => setActiveTab(tab)}>
              {tab}
            </Button>
          ))}
        </div>
        {desktopSections[activeTab]}
      </div>

      {imageOpen && resolvedDetail.vehicle.thumbUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setImageOpen(false)}>
          <img className="max-h-[90vh] max-w-[90vw] rounded-md border border-white/20 object-contain" src={resolvedDetail.vehicle.thumbUrl} alt={resolvedDetail.vehicle.label} />
        </div>
      )}
    </div>
  );
}
