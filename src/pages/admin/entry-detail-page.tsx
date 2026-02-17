import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminEntriesService } from "@/services/admin-entries.service";

const tabs = ["Überblick", "Person", "Startmeldungen/Fahrzeuge", "Zahlung", "Dokumente", "Historie"] as const;

type TabValue = (typeof tabs)[number];

function asEuro(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function AdminEntryDetailPage() {
  const { entryId = "" } = useParams();
  const [activeTab, setActiveTab] = useState<TabValue>("Überblick");
  const [resolvedDetail, setResolvedDetail] = useState<Awaited<ReturnType<typeof adminEntriesService.getEntryDetail>>>(null);
  const [status, setStatus] = useState("accepted");
  const [paid, setPaid] = useState(false);
  const [checkinDone, setCheckinDone] = useState(false);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{resolvedDetail.headline}</h1>
          <p className="text-sm text-slate-600">
            {resolvedDetail.classLabel} · Startnummer {resolvedDetail.startNumber}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{status}</Badge>
          <Badge variant={paid ? "secondary" : "outline"}>{paid ? "paid" : "due"}</Badge>
          <Badge variant={checkinDone ? "secondary" : "outline"}>{checkinDone ? "checkin ok" : "checkin offen"}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-slate-600">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setStatus("accepted")}>
            Status ändern
          </Button>
          <Button type="button" variant="outline" onClick={() => setPaid(true)}>
            Bezahlt setzen
          </Button>
          <Button type="button" variant="outline" onClick={() => setCheckinDone(true)}>
            Check-in bestätigen
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button key={tab} type="button" size="sm" variant={activeTab === tab ? "default" : "outline"} onClick={() => setActiveTab(tab)}>
            {tab}
          </Button>
        ))}
      </div>

      {activeTab === "Überblick" && (
        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase text-slate-500">Fahrer</div>
              <div className="font-medium">{resolvedDetail.driver.name}</div>
              <div className="text-sm text-slate-600">{resolvedDetail.driver.email}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-500">Status</div>
              <div className="font-medium">{status}</div>
              <div className="text-sm text-slate-600">Registrierung: {resolvedDetail.registrationStatus}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "Person" && (
        <Card>
          <CardContent className="space-y-2 p-4 text-sm text-slate-700">
            <div>Name: {resolvedDetail.driver.name}</div>
            <div>E-Mail: {resolvedDetail.driver.email}</div>
            <div>Hinweise: {resolvedDetail.notes}</div>
          </CardContent>
        </Card>
      )}

      {activeTab === "Startmeldungen/Fahrzeuge" && (
        <Card>
          <CardContent className="space-y-2 p-4 text-sm text-slate-700">
            <div className="font-medium">{resolvedDetail.vehicle.label}</div>
            {resolvedDetail.vehicle.facts.map((fact) => (
              <div key={fact}>{fact}</div>
            ))}
            {resolvedDetail.relatedEntryIds.length > 1 && <div>Verknüpfte Nennungen: {resolvedDetail.relatedEntryIds.join(", ")}</div>}
          </CardContent>
        </Card>
      )}

      {activeTab === "Zahlung" && (
        <Card>
          <CardContent className="space-y-2 p-4 text-sm text-slate-700">
            <div>Gesamt: {asEuro(resolvedDetail.payment.totalCents)}</div>
            <div>Bezahlt: {asEuro(resolvedDetail.payment.paidAmountCents)}</div>
            <div>Offen: {asEuro(resolvedDetail.payment.amountOpenCents)}</div>
            <div>Status: {resolvedDetail.payment.status}</div>
          </CardContent>
        </Card>
      )}

      {activeTab === "Dokumente" && (
        <Card>
          <CardContent className="space-y-2 p-4 text-sm text-slate-700">
            {resolvedDetail.documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded border p-2">
                <span>{doc.type}</span>
                <span>{doc.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {activeTab === "Historie" && (
        <Card>
          <CardContent className="space-y-2 p-4 text-sm text-slate-700">
            {resolvedDetail.history.map((item) => (
              <div key={item.id} className="rounded border p-2">
                <div className="font-medium">{item.action}</div>
                <div>{item.details}</div>
                <div className="text-xs text-slate-500">
                  {new Date(item.timestamp).toLocaleString("de-DE")} · {item.actor}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
