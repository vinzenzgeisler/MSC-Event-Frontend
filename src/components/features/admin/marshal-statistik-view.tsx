import { Download, Shirt } from "lucide-react";
import { buildMarshalShirtStatistics } from "@/components/features/admin/marshal-shirt-statistics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MarshalWorkspace } from "@/types/admin-marshals";

type Props = {
  workspace: MarshalWorkspace;
  canExport: boolean;
  onPrint: (areaId: string) => Promise<void>;
};

export function MarshalStatistikView({ workspace, canExport, onPrint }: Props) {
  const statistics = buildMarshalShirtStatistics(workspace);
  const total = statistics.reduce((sum, item) => sum + item.peopleCount, 0);

  return (
    <div className="space-y-4">
      <div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">T-Shirt-Statistik</h1>
          <p className="mt-1 text-sm text-slate-600">Helfer werden veranstaltungsweit genau einmal gezählt. Im Aufbau zählt bereits die Bereichszuordnung als Shirtbedarf; Streckenposten haben bei Überschneidungen Vorrang.</p>
        </div>
      </div>
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center justify-between gap-3 text-lg"><span className="flex items-center gap-2"><Shirt className="h-5 w-5 text-blue-600" />Bedarf nach Bereich</span><span className="text-sm font-normal text-slate-500">{total} T-Shirts</span></CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 pt-0 sm:grid-cols-2 sm:p-6 sm:pt-0 xl:grid-cols-3">
          {statistics.map((item) => (
            <section key={item.areaId} className="rounded-xl border bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-3"><h2 className="font-semibold text-slate-900">{item.areaName}</h2><span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">{item.peopleCount}</span></div>
              <ul className="mt-3 flex flex-wrap gap-2">
                {item.sizes.map(({ size, count }) => <li key={size} className="rounded-md border bg-white px-3 py-2 text-sm"><strong>{count}×</strong> {size}</li>)}
                {item.sizes.length === 0 && <li className="text-sm text-slate-500">0 T-Shirts</li>}
              </ul>
              {item.issues.length > 0 && <details className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm"><summary className="cursor-pointer font-medium text-amber-900">{item.issues.length} Größenangabe{item.issues.length === 1 ? "" : "n"} prüfen</summary><ul className="mt-2 space-y-1 text-xs text-amber-950">{item.issues.map((issue) => <li key={issue.personId}>#{issue.helperNumber} {issue.name}: {issue.reason === "missing" ? "kein Eintrag" : `ungültig „${issue.rawValue}“`}</li>)}</ul></details>}
              <Button type="button" variant="outline" size="sm" className="mt-4 w-full" disabled={!canExport} onClick={() => void onPrint(item.areaId)}><Download className="mr-2 h-4 w-4" />Bereich als PDF</Button>
            </section>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
