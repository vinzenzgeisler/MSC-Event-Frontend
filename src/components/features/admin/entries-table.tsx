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
    <div className="overflow-hidden rounded-xl border bg-white">
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
  );
}
