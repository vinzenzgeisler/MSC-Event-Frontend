import { useEffect, useState, useCallback } from "react";
import { adminSigningService, type SigningSessionListItem } from "@/services/admin-signing.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Download, RefreshCw } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  pending: "Warten",
  displayed: "Angezeigt",
  completed: "Abgeschlossen",
  cancelled: "Abgebrochen",
  failed: "Fehler",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  pending: "secondary",
  displayed: "secondary",
  completed: "default",
  cancelled: "outline",
  failed: "outline",
};

const STATUS_CLASS: Record<string, string> = {
  failed: "border-red-300 bg-red-50 text-red-800",
  completed: "",
};

export function AdminSigningPage() {
  const [sessions, setSessions] = useState<SigningSessionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminSigningService.listSessions({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        status: statusFilter === "all" ? undefined : statusFilter,
      });
      setSessions(result.sessions);
      setTotal(result.total);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDownload = async (session: SigningSessionListItem) => {
    if (!session.sourceEntryId || !session.documentId) return;
    try {
      const blob = await adminSigningService.downloadSignedWaiver(session.sourceEntryId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Haftverzicht-${session.signerName ?? session.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Haftverzichte</h1>
          <p className="mt-1 text-sm text-slate-500">Übersicht aller digital unterzeichneten Haftverzichtserklärungen</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Aktualisieren
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="completed">Abgeschlossen</SelectItem>
            <SelectItem value="pending">Wartend</SelectItem>
            <SelectItem value="cancelled">Abgebrochen</SelectItem>
            <SelectItem value="failed">Fehler</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500">{total} Einträge</span>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Unterzeichner</th>
              <th className="px-4 py-3 text-left">Rolle</th>
              <th className="px-4 py-3 text-left">Gerät</th>
              <th className="px-4 py-3 text-left">Operator</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Zeitpunkt</th>
              <th className="px-4 py-3 text-right">PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Laden …
                </td>
              </tr>
            )}
            {!loading && sessions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Keine Sessions gefunden.
                </td>
              </tr>
            )}
            {sessions.map((session) => (
              <tr key={session.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{session.signerName ?? "–"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {session.signerRole === "driver"
                    ? "Fahrer"
                    : session.signerRole === "codriver"
                      ? "Beifahrer"
                      : "–"}
                </td>
                <td className="px-4 py-3 text-slate-600">{session.deviceName ?? "–"}</td>
                <td className="px-4 py-3 text-slate-600">{session.operatorDisplay ?? "–"}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant={STATUS_VARIANTS[session.status] ?? "outline"}
                    className={STATUS_CLASS[session.status] ?? ""}
                  >
                    {STATUS_LABELS[session.status] ?? session.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {new Date(session.signedAt ?? session.createdAt).toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                </td>
                <td className="px-4 py-3 text-right">
                  {session.documentId && session.sourceEntryId && (
                    <Button variant="ghost" size="sm" onClick={() => void handleDownload(session)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} von {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Zurück
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Weiter
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
