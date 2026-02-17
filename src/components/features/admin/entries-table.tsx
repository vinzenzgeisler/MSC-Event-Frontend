import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminEntryListItem } from "@/types/admin";

type EntriesTableProps = {
  rows: AdminEntryListItem[];
};

export function EntriesTable({ rows }: EntriesTableProps) {
  if (!rows.length) {
    return <div className="rounded-lg border border-dashed p-6 text-sm text-slate-500">Keine Nennungen für die aktuelle Filterung.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <div key={row.id} className="rounded-lg border bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-slate-900">{row.name}</div>
                <div className="text-xs text-slate-600">{row.classLabel} · #{row.startNumber}</div>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to={`/admin/entries/${row.id}`}>Details</Link>
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={row.status === "accepted" ? "secondary" : "outline"}>{row.status}</Badge>
              <Badge variant={row.payment === "paid" ? "secondary" : "outline"}>{row.payment}</Badge>
              <Badge variant={row.checkin === "bestätigt" ? "secondary" : "outline"}>{row.checkin}</Badge>
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
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Klasse</th>
              <th className="px-4 py-3 font-medium">Startnummer</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Zahlung</th>
              <th className="px-4 py-3 font-medium">Check-in</th>
              <th className="px-4 py-3 font-medium">Erstellt am</th>
              <th className="px-4 py-3 font-medium">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t align-middle">
                <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                <td className="px-4 py-3">{row.classLabel}</td>
                <td className="px-4 py-3">{row.startNumber}</td>
                <td className="px-4 py-3">
                  <Badge variant={row.status === "accepted" ? "secondary" : "outline"}>{row.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={row.payment === "paid" ? "secondary" : "outline"}>{row.payment}</Badge>
                </td>
                <td className="px-4 py-3">{row.checkin}</td>
                <td className="px-4 py-3">{row.createdAt}</td>
                <td className="px-4 py-3">
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/admin/entries/${row.id}`}>Details</Link>
                  </Button>
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
