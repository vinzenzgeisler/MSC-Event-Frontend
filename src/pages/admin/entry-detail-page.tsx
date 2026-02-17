import { useEffect, useState } from "react";
import { Bike, Car } from "lucide-react";
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

const tabs = ["Überblick", "Person", "Startmeldungen/Fahrzeuge", "Zahlung", "Dokumente", "Historie"] as const;

type TabValue = (typeof tabs)[number];

function asEuro(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function VehicleThumb({ src, label }: { src: string | null; label: string }) {
  if (src) {
    return <img className="h-16 w-16 rounded-md border object-cover" src={src} alt={`Fahrzeug: ${label}`} />;
  }
  const isMoto = label.toLowerCase().includes("yamaha") || label.toLowerCase().includes("moto");
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-md border bg-slate-100 text-slate-500">
      {isMoto ? <Bike className="h-6 w-6" /> : <Car className="h-6 w-6" />}
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

  useEffect(() => {
    adminEntriesService.getEntryDetail(entryId).then((result) => {
      setResolvedDetail(result);
      if (result) {
        setStatus(result.status);
        setPaid(result.payment.status === "paid");
        setCheckinDone(result.checkinVerified);
      }
    });
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
      <CardContent className="grid gap-2 sm:flex sm:flex-wrap">
        <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setStatus("accepted")}>
          Status auf Zugelassen
        </Button>
        <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setPaid(true)}>
          Als bezahlt markieren
        </Button>
          <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setCheckinDone(true)}>
            Einchecken bestätigen
          </Button>
        <Button
          className="w-full sm:w-auto"
          type="button"
          variant="outline"
          onClick={async () => {
            await communicationService.queuePaymentReminderForEntry(resolvedDetail.id);
            setActionMessage("Zahlungserinnerung wurde in die Mail-Queue gelegt.");
          }}
        >
          Zahlungserinnerung senden
        </Button>
        <Button
          className="w-full sm:w-auto"
          type="button"
          variant="outline"
          onClick={async () => {
            await communicationService.queueRegistrationConfirmationForEntry(resolvedDetail.id);
            setActionMessage("Anmeldebestätigung wurde in die Mail-Queue gelegt.");
          }}
        >
          Anmeldebestätigung senden
        </Button>
        {actionMessage && <div className="w-full rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{actionMessage}</div>}
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
        <div>Hinweise: {resolvedDetail.notes}</div>
      </CardContent>
    </Card>
  );

  const sectionVehicle = (
    <Card>
      <CardHeader>
        <CardTitle>Startmeldungen / Fahrzeuge</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-700">
        <div className="flex items-start gap-3">
          <VehicleThumb src={resolvedDetail.vehicle.thumbUrl} label={resolvedDetail.vehicle.label} />
          <div>
            <div className="font-medium">{resolvedDetail.vehicle.label}</div>
            <div className="text-xs text-slate-500">Startnummer: {resolvedDetail.startNumber}</div>
          </div>
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

  const desktopSections: Record<TabValue, JSX.Element> = {
    Überblick: sectionOverview,
    Person: sectionPerson,
    "Startmeldungen/Fahrzeuge": sectionVehicle,
    Zahlung: sectionPayment,
    Dokumente: sectionDocuments,
    Historie: sectionHistory
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

      {quickActions}

      <div className="space-y-3 md:hidden">
        {sectionOverview}
        {sectionPerson}
        {sectionVehicle}
        {sectionPayment}
        {sectionDocuments}
        {sectionHistory}
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
    </div>
  );
}
