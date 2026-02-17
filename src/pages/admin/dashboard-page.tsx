import { BarChart3, BellRing, ClipboardCheck, FileDown, Filter, Mail, MessageSquareWarning, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const kpis = [
  { label: "Nennungen gesamt", value: "240", icon: BarChart3 },
  { label: "Offene Zahlungen", value: "42", icon: Wallet },
  { label: "Nicht eingecheckt", value: "78", icon: ClipboardCheck },
  { label: "Mail-Fehler", value: "3", icon: MessageSquareWarning }
];

const queueItems = [
  { area: "Mail-Outbox", status: "In Warteschlange", count: 18 },
  { area: "Mail-Outbox", status: "Fehlgeschlagen", count: 3 },
  { area: "Exporte", status: "In Bearbeitung", count: 2 },
  { area: "Exporte", status: "In Warteschlange", count: 4 }
];

const classDistribution = [
  { className: "Auto Elite", value: 64 },
  { className: "Auto Pro", value: 72 },
  { className: "Moto Open", value: 58 },
  { className: "Moto Legend", value: 46 }
];

const recentChanges = [
  { text: "Lena Berger auf Vorauswahl gesetzt", time: "vor 9 Min" },
  { text: "Rashid Khan eingecheckt", time: "vor 16 Min" },
  { text: "Export startlist_csv abgeschlossen", time: "vor 31 Min" }
];

export function AdminDashboardPage() {
  const maxClass = Math.max(...classDistribution.map((item) => item.value));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/entries">
              <Filter className="mr-1 h-4 w-4" />
              Offene Fälle
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/communication">
              <Mail className="mr-1 h-4 w-4" />
              Broadcast
            </Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="text-xs uppercase text-slate-500">{item.label}</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">{item.value}</div>
                </div>
                <div className="rounded-md border bg-slate-50 p-2 text-slate-600">
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operative Warteschlangen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {queueItems.map((item) => (
              <div key={`${item.area}-${item.status}`} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <div>
                  <div className="font-medium text-slate-900">{item.area}</div>
                  <div className="text-xs text-slate-600">{item.status}</div>
                </div>
                <Badge variant="outline">{item.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Letzte Änderungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentChanges.map((item) => (
              <div key={item.text} className="rounded-md border p-2 text-sm">
                <div className="font-medium text-slate-900">{item.text}</div>
                <div className="text-xs text-slate-500">{item.time}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reporting: Klassenverteilung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {classDistribution.map((item) => (
              <div key={item.className} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{item.className}</span>
                  <span className="font-medium">{item.value}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-2 bg-primary" style={{ width: `${Math.round((item.value / maxClass) * 100)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <Button asChild variant="outline" className="justify-start">
              <Link to="/admin/entries">
                <Filter className="mr-2 h-4 w-4" />
                Zahlungen offen filtern
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/admin/entries">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Eincheck-Liste öffnen
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/admin/communication">
                <BellRing className="mr-2 h-4 w-4" />
                Broadcast starten
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/admin/exports">
                <FileDown className="mr-2 h-4 w-4" />
                Startliste exportieren
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
