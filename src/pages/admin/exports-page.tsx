import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { exportsService } from "@/services/exports.service";
import type { ExportCreateForm, ExportJob } from "@/types/admin";

const initialForm: ExportCreateForm = {
  type: "entries_csv",
  classId: "all",
  acceptanceStatus: "all",
  format: "csv"
};

export function AdminExportsPage() {
  const [form, setForm] = useState<ExportCreateForm>(initialForm);
  const [jobs, setJobs] = useState<ExportJob[]>([]);

  useEffect(() => {
    exportsService.listExports().then(setJobs);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Exporte</h1>

      <Card>
        <CardHeader>
          <CardTitle>Export erstellen</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <Label>Typ</Label>
            <select className="h-10 w-full rounded-md border px-3 text-sm" value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as ExportCreateForm["type"] }))}>
              <option value="entries_csv">entries_csv</option>
              <option value="startlist_csv">startlist_csv</option>
              <option value="participants_csv">participants_csv</option>
              <option value="payments_open_csv">payments_open_csv</option>
              <option value="checkin_status_csv">checkin_status_csv</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Klasse (optional)</Label>
            <select className="h-10 w-full rounded-md border px-3 text-sm" value={form.classId} onChange={(event) => setForm((prev) => ({ ...prev, classId: event.target.value }))}>
              <option value="all">Alle</option>
              <option value="Auto Elite">Auto Elite</option>
              <option value="Auto Pro">Auto Pro</option>
              <option value="Moto Open">Moto Open</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Status (optional)</Label>
            <select className="h-10 w-full rounded-md border px-3 text-sm" value={form.acceptanceStatus} onChange={(event) => setForm((prev) => ({ ...prev, acceptanceStatus: event.target.value as ExportCreateForm["acceptanceStatus"] }))}>
              <option value="all">Alle</option>
              <option value="pending">pending</option>
              <option value="shortlist">shortlist</option>
              <option value="accepted">accepted</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Format</Label>
            <select className="h-10 w-full rounded-md border px-3 text-sm" value={form.format} onChange={(event) => setForm((prev) => ({ ...prev, format: event.target.value as "csv" }))}>
              <option value="csv">csv</option>
            </select>
          </div>
          <div>
            <Button
              type="button"
              onClick={async () => {
                await exportsService.createExport(form);
              }}
            >
              Export erstellen
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exportliste</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Typ</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Erstellt am</th>
                  <th className="px-3 py-2">Download</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-t">
                    <td className="px-3 py-2">{job.id}</td>
                    <td className="px-3 py-2">{job.type}</td>
                    <td className="px-3 py-2">
                      <Badge variant={job.status === "succeeded" ? "secondary" : "outline"}>{job.status}</Badge>
                    </td>
                    <td className="px-3 py-2">{job.createdAt}</td>
                    <td className="px-3 py-2">
                      {job.status === "succeeded" ? <Button size="sm" variant="outline">Download</Button> : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
