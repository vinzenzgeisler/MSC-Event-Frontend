import { useEffect, useState } from "react";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { acceptanceStatusLabel, exportStatusClasses, exportStatusLabel } from "@/lib/admin-status";
import { getApiErrorMessage } from "@/services/api/http-client";
import { adminMetaService, type AdminClassOption } from "@/services/admin-meta.service";
import { exportsService } from "@/services/exports.service";
import type { ExportCreateForm, ExportJob } from "@/types/admin";

const initialForm: ExportCreateForm = {
  type: "entries_csv",
  classId: "all",
  acceptanceStatus: "all",
  format: "csv"
};

export function AdminExportsPage() {
  const { roles } = useAuth();
  const canCreateExports = hasPermission(roles, "exports.write");
  const [form, setForm] = useState<ExportCreateForm>(initialForm);
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [classOptions, setClassOptions] = useState<AdminClassOption[]>([]);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 2600);
  };

  const loadExports = async () => {
    try {
      setJobs(await exportsService.listExports());
    } catch (error) {
      showToast(getApiErrorMessage(error, "Exportliste konnte nicht geladen werden."));
    }
  };

  useEffect(() => {
    void loadExports();

    adminMetaService
      .listClassOptions()
      .then(setClassOptions)
      .catch((error) => showToast(getApiErrorMessage(error, "Klassen konnten nicht geladen werden.")));
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
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={form.type}
              onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as ExportCreateForm["type"] }))}
            >
              <option value="entries_csv">entries_csv</option>
              <option value="startlist_csv">startlist_csv</option>
              <option value="participants_csv">participants_csv</option>
              <option value="payments_open_csv">payments_open_csv</option>
              <option value="checkin_status_csv">checkin_status_csv</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Klasse (optional)</Label>
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={form.classId}
              onChange={(event) => setForm((prev) => ({ ...prev, classId: event.target.value }))}
            >
              <option value="all">Alle</option>
              {classOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Status (optional)</Label>
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={form.acceptanceStatus}
              onChange={(event) => setForm((prev) => ({ ...prev, acceptanceStatus: event.target.value as ExportCreateForm["acceptanceStatus"] }))}
            >
              <option value="all">Alle</option>
              <option value="pending">{acceptanceStatusLabel("pending")}</option>
              <option value="shortlist">{acceptanceStatusLabel("shortlist")}</option>
              <option value="accepted">{acceptanceStatusLabel("accepted")}</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Format</Label>
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={form.format}
              onChange={(event) => setForm((prev) => ({ ...prev, format: event.target.value as "csv" }))}
            >
              <option value="csv">csv</option>
            </select>
          </div>
          <div className="md:col-span-4">
            {canCreateExports ? (
              <Button
                className="w-full md:w-auto"
                type="button"
                onClick={async () => {
                  try {
                    await exportsService.createExport(form);
                    showToast("Export wurde erstellt.");
                    await loadExports();
                  } catch (error) {
                    showToast(getApiErrorMessage(error, "Export konnte nicht erstellt werden."));
                  }
                }}
              >
                Export erstellen
              </Button>
            ) : (
              <div className="text-sm text-slate-500">Nur Admin-Rollen dürfen Exporte erstellen.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exportliste</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 md:hidden">
            {jobs.map((job) => (
              <div key={job.id} className="rounded-lg border p-3">
                <div className="font-medium text-slate-900">{job.type}</div>
                <div className="text-xs text-slate-600">{job.id}</div>
                <div className="mt-2 flex items-center justify-between">
                  <Badge className={exportStatusClasses(job.status)} variant="outline">
                    {exportStatusLabel(job.status)}
                  </Badge>
                  {job.status === "succeeded" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          const url = await exportsService.getExportDownloadUrl(job.id);
                          if (url) {
                            window.open(url, "_blank", "noopener,noreferrer");
                          }
                        } catch (error) {
                          showToast(getApiErrorMessage(error, "Export konnte nicht heruntergeladen werden."));
                        }
                      }}
                    >
                      Download
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-500">-</span>
                  )}
                </div>
                <div className="mt-2 text-xs text-slate-500">{job.createdAt}</div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
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
                      <Badge className={exportStatusClasses(job.status)} variant="outline">
                        {exportStatusLabel(job.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{job.createdAt}</td>
                    <td className="px-3 py-2">
                      {job.status === "succeeded" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              const url = await exportsService.getExportDownloadUrl(job.id);
                              if (url) {
                                window.open(url, "_blank", "noopener,noreferrer");
                              }
                            } catch (error) {
                              showToast(getApiErrorMessage(error, "Export konnte nicht heruntergeladen werden."));
                            }
                          }}
                        >
                          Download
                        </Button>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {toastMessage && (
        <div className="fixed right-4 top-4 z-40 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 shadow-sm">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
