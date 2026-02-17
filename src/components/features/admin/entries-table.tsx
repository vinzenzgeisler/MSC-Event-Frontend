import { Bike, Car } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  acceptanceStatusClasses,
  acceptanceStatusLabel,
  acceptanceStatusRowAccentClasses,
  checkinClasses,
  checkinLabel,
  paymentStatusClasses,
  paymentStatusLabel
} from "@/lib/admin-status";
import type { AdminEntryListItem } from "@/types/admin";

type EntriesTableProps = {
  rows: AdminEntryListItem[];
  onSetShortlist: (entryId: string) => void;
  onSetAccepted: (entryId: string) => void;
};

function VehicleThumb({ src, label }: { src: string | null; label: string }) {
  if (src) {
    return <img className="h-12 w-12 rounded-md border object-cover" src={src} alt={`Fahrzeug: ${label}`} />;
  }
  const isMoto = label.toLowerCase().includes("yamaha") || label.toLowerCase().includes("moto");
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-slate-100 text-slate-500">
      {isMoto ? <Bike className="h-5 w-5" /> : <Car className="h-5 w-5" />}
    </div>
  );
}

export function EntriesTable({ rows, onSetShortlist, onSetAccepted }: EntriesTableProps) {
  if (!rows.length) {
    return <div className="rounded-lg border border-dashed p-6 text-sm text-slate-500">Keine Nennungen für die aktuelle Filterung.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <div key={row.id} className={`border bg-white p-3 ${acceptanceStatusRowAccentClasses(row.status)}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <VehicleThumb src={row.vehicleThumbUrl} label={row.vehicleLabel} />
                <div>
                  <div className="font-medium text-slate-900">{row.name}</div>
                  <div className="text-xs text-slate-600">
                    {row.classLabel} · #{row.startNumber}
                  </div>
                  <div className="text-xs text-slate-500">{row.vehicleLabel}</div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/admin/entries/${row.id}`}>Details</Link>
                </Button>
                <Button size="sm" variant="outline" onClick={() => onSetShortlist(row.id)}>
                  Vorauswahl
                </Button>
                <Button
                  size="sm"
                  onClick={() => onSetAccepted(row.id)}
                >
                  Zulassen
                </Button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge className={acceptanceStatusClasses(row.status)} variant="outline">
                {acceptanceStatusLabel(row.status)}
              </Badge>
              <Badge className={paymentStatusClasses(row.payment)} variant="outline">
                Zahlung: {paymentStatusLabel(row.payment)}
              </Badge>
              <Badge className={checkinClasses(row.checkin === "bestätigt")} variant="outline">
                Einchecken: {checkinLabel(row.checkin === "bestätigt")}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-slate-500">Erstellt: {row.createdAt}</div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border bg-white md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nennung</th>
                <th className="px-4 py-3 font-medium">Klasse</th>
                <th className="px-4 py-3 font-medium">Startnummer</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Zahlung</th>
                <th className="px-4 py-3 font-medium">Einchecken</th>
                <th className="px-4 py-3 font-medium">Erstellt am</th>
                <th className="px-4 py-3 font-medium">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={`border-t align-middle ${acceptanceStatusRowAccentClasses(row.status)}`}>
                  <td className="px-4 py-3">
                    <div className={`flex items-center gap-3 rounded-md px-2 py-1 ${acceptanceStatusRowAccentClasses(row.status)}`}>
                      <VehicleThumb src={row.vehicleThumbUrl} label={row.vehicleLabel} />
                      <div>
                        <div className="font-medium text-slate-900">{row.name}</div>
                        <div className="text-xs text-slate-500">{row.vehicleLabel}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{row.classLabel}</td>
                  <td className="px-4 py-3">{row.startNumber}</td>
                  <td className="px-4 py-3">
                    <Badge className={acceptanceStatusClasses(row.status)} variant="outline">
                      {acceptanceStatusLabel(row.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={paymentStatusClasses(row.payment)} variant="outline">
                      {paymentStatusLabel(row.payment)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={checkinClasses(row.checkin === "bestätigt")} variant="outline">
                      {checkinLabel(row.checkin === "bestätigt")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{row.createdAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/admin/entries/${row.id}`}>Details</Link>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onSetShortlist(row.id)}>
                        Vorauswahl
                      </Button>
                      <Button size="sm" onClick={() => onSetAccepted(row.id)}>
                        Zulassen
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
