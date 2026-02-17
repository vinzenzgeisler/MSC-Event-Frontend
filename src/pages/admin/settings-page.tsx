import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AdminSettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Einstellungen</h1>
      <Card>
        <CardHeader>
          <CardTitle>System</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">UI-only Platzhalter für Einstellungen, Rollen und Event-Defaults.</CardContent>
      </Card>
    </div>
  );
}
