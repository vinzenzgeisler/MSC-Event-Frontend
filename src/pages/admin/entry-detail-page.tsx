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

function asEuro(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function VehiclePreview({ src, label, onOpen }: { src: string | null; label: string; onOpen: () => void }) {
  if (src) {
    return (
      <button type="button" className="group relative block w-full" onClick={onOpen}>
        <img className="h-52 w-full rounded-md border object-cover md:h-72" src={src} alt={`Fahrzeug: ${label}`} />
        <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
          Vergrößern
        </span>
      </button>
    );
  }
  const isMoto = label.toLowerCase().includes("yamaha") || label.toLowerCase().includes("moto");
  return (
    <div className="flex h-52 w-full items-center justify-center rounded-md border bg-slate-100 text-slate-500 md:h-72">
      {isMoto ? <Bike className="h-10 w-10" /> : <Car className="h-10 w-10" />}
    </div>
  );
}

export function AdminEntryDetailPage() {
  const { entryId = "" } = useParams();
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof adminEntriesService.getEntryDetail>>>(null);
  const [status, setStatus] = useState<"pending" | "shortlist" | "accepted" | "rejected">("accepted");
  const [paid, setPaid] = useState(false);
  const [checkinDone, setCheckinDone] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const [internalNote, setInternalNote] = useState("");
  const [driverNote, setDriverNote] = useState("");
  const [pendingAcceptConfirm, setPendingAcceptConfirm] = useState(false);

  const loadDetail = () => {
    adminEntriesService.getEntryDetail(entryId).then((result) => {
      setDetail(result);
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

  if (!detail) {
    return <div className="rounded-xl border border-dashed p-6 text-sm text-slate-500">Nennung nicht gefunden.</div>;
  }

  const paymentState = paid ? "paid" : "due";
  const paidPercent = Math.max(0, Math.min(100, Math.round((detail.payment.paidAmountCents / detail.payment.totalCents) * 100)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{detail.headline}</h1>
          <p className="text-sm text-slate-600">
            {detail.classLabel} · Startnummer {detail.startNumber}
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

      {actionMessage && (
        <div className="fixed right-4 top-4 z-40 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 shadow-sm">
          {actionMessage}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fahrerdaten</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase text-slate-500">Name</div>
                <div>{detail.driver.name}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">E-Mail</div>
                <div>{detail.driver.email}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">Telefon</div>
                <div>{detail.driver.phone}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">Geburtsdatum</div>
                <div>{detail.driver.birthdate}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs uppercase text-slate-500">Adresse</div>
                <div>{detail.driver.address}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs uppercase text-slate-500">Notfallkontakt</div>
                <div>{detail.driver.emergencyContact}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fahrzeug</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <VehiclePreview src={detail.vehicle.thumbUrl} label={detail.vehicle.label} onOpen={() => setImageOpen(true)} />
              <div>
                <div className="font-medium">{detail.vehicle.label}</div>
                <div className="text-xs text-slate-500">Startnummer: {detail.startNumber}</div>
              </div>
              {detail.vehicle.facts.map((fact) => (
                <div key={fact}>{fact}</div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Zahlung</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-md border bg-slate-50 p-3">Gesamt: {asEuro(detail.payment.totalCents)}</div>
                <div className="rounded-md border bg-slate-50 p-3">Bezahlt: {asEuro(detail.payment.paidAmountCents)}</div>
                <div className="rounded-md border bg-slate-50 p-3">Offen: {asEuro(detail.payment.amountOpenCents)}</div>
              </div>
              <div>
                <div className="mb-1 text-xs text-slate-500">Zahlungsfortschritt</div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-2 bg-emerald-500" style={{ width: `${paidPercent}%` }} />
                </div>
                <div className="mt-1 text-xs text-slate-600">{paidPercent}% bezahlt</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={paid ? "default" : "outline"}
                  onClick={async () => {
                    await adminEntriesService.setEntryPaymentStatus(detail.id, "paid");
                    setPaid(true);
                    setActionMessage("Zahlungsstatus auf Bezahlt gesetzt.");
                    setTimeout(() => setActionMessage(""), 2200);
                    loadDetail();
                  }}
                >
                  Bezahlt
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!paid ? "default" : "outline"}
                  onClick={async () => {
                    await adminEntriesService.setEntryPaymentStatus(detail.id, "due");
                    setPaid(false);
                    setActionMessage("Zahlungsstatus auf Offen gesetzt.");
                    setTimeout(() => setActionMessage(""), 2200);
                    loadDetail();
                  }}
                >
                  Offen
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historie</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {detail.history.map((item) => (
                <div key={item.id} className="rounded border p-3">
                  <div className="mb-1 font-medium">{item.action}</div>
                  <div>{item.details}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {new Date(item.timestamp).toLocaleString("de-DE")} · {item.actor}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await adminEntriesService.setEntryStatus(detail.id, "to_shortlist");
                  setStatus("shortlist");
                  setActionMessage("Status auf Vorauswahl gesetzt.");
                  setTimeout(() => setActionMessage(""), 2200);
                  loadDetail();
                }}
              >
                Auf Vorauswahl setzen
              </Button>
              <Button type="button" onClick={() => setPendingAcceptConfirm(true)}>
                Auf Zugelassen setzen
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await adminEntriesService.setEntryCheckinVerified(detail.id);
                  setCheckinDone(true);
                  setActionMessage("Einchecken wurde bestätigt.");
                  setTimeout(() => setActionMessage(""), 2200);
                  loadDetail();
                }}
              >
                Einchecken bestätigen
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await communicationService.queuePaymentReminderForEntry(detail.id);
                  setActionMessage("Zahlungserinnerung wurde in die Mail-Queue gelegt.");
                  setTimeout(() => setActionMessage(""), 2200);
                }}
              >
                Zahlungserinnerung senden
              </Button>
              <Button type="button" variant="outline" onClick={() => setActionMessage("PDF Haftverzicht bereitgestellt (UI-only).")}>PDF Haftverzicht</Button>
              <Button type="button" variant="outline" onClick={() => setActionMessage("PDF Technische Abnahme bereitgestellt (UI-only).")}>PDF Technische Abnahme</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notizen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Intern</label>
                <textarea
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={internalNote}
                  onChange={(event) => setInternalNote(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Für Fahrer (bei Zulassung)</label>
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
                  await adminEntriesService.saveEntryNotes(detail.id, { internalNote, driverNote });
                  setActionMessage("Notizen gespeichert.");
                  setTimeout(() => setActionMessage(""), 2200);
                }}
              >
                Notizen speichern
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {imageOpen && detail.vehicle.thumbUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setImageOpen(false)}>
          <img className="max-h-[90vh] max-w-[90vw] rounded-md border border-white/20 object-contain" src={detail.vehicle.thumbUrl} alt={detail.vehicle.label} />
        </div>
      )}

      {pendingAcceptConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border bg-white p-4 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Auf „Zugelassen“ setzen?</h2>
            <p className="mt-2 text-sm text-slate-600">Nach der Bestätigung wird automatisch die Zulassungs-Mail an den Fahrer angestoßen.</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPendingAcceptConfirm(false)}>
                Abbrechen
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  await adminEntriesService.setEntryStatus(detail.id, "to_accepted");
                  await communicationService.queueAcceptedMailForEntry(detail.id);
                  setStatus("accepted");
                  setPendingAcceptConfirm(false);
                  setActionMessage("Status auf Zugelassen gesetzt. Zulassungs-Mail wurde angestoßen.");
                  setTimeout(() => setActionMessage(""), 2400);
                  loadDetail();
                }}
              >
                Ja, zulassen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
