import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AdminDashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-600">Nennungen gesamt</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">240</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-600">Zahlung offen</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">42</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-600">Check-in offen</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">78</CardContent>
        </Card>
      </div>
    </div>
  );
}
