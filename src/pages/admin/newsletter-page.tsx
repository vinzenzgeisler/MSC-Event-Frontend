import { useCallback, useEffect, useState } from "react";
import { MailCheck, RefreshCw, Search } from "lucide-react";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission } from "@/app/auth/iam";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminNewsletterService } from "@/services/admin-newsletter.service";
import { getApiErrorMessage } from "@/services/api/http-client";
import type { NewsletterOverview, NewsletterSubscriber, NewsletterSubscriberStatus } from "@/types/admin-newsletter";

const statusLabel: Record<NewsletterSubscriberStatus, string> = { pending: "Bestätigung offen", active: "Aktiv", unsubscribed: "Abgemeldet", bounced: "Unzustellbar", complained: "Beschwerde" };

export function AdminNewsletterPage() {
  const { roles } = useAuth();
  const canWrite = hasPermission(roles, "newsletter.write");
  const [overview, setOverview] = useState<NewsletterOverview | null>(null);
  const [items, setItems] = useState<NewsletterSubscriber[]>([]);
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [overviewResult, listResult] = await Promise.all([
        adminNewsletterService.overview(),
        adminNewsletterService.list({ status: status === "all" ? undefined : status as NewsletterSubscriberStatus, search: search || undefined, pageSize: 100 })
      ]);
      setOverview(overviewResult.overview); setItems(listResult.items);
    } catch (cause) { setError(getApiErrorMessage(cause)); } finally { setLoading(false); }
  }, [search, status]);
  useEffect(() => { void load(); }, [load]);

  const act = async (action: () => Promise<unknown>) => { try { await action(); await load(); } catch (cause) { setError(getApiErrorMessage(cause)); } };
  return <div className="space-y-6">
    <div><h1 className="text-xl font-semibold text-slate-900">Newsletter</h1><p className="mt-1 text-sm text-slate-500">Double-Opt-in-Anmeldungen und Abmeldungen verwalten</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {([['Gesamt','total'],['Aktiv','active'],['Offen','pending'],['Abgemeldet','unsubscribed'],['Gesperrt','suppressed']] as const).map(([label,key]) => <Card key={key}><CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">{label}</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{overview?.[key] ?? '–'}</CardContent></Card>)}
    </div>
    <Card><CardContent className="pt-6"><div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="E-Mail suchen" value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select value={status} onValueChange={setStatus}><SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle Status</SelectItem>{Object.entries(statusLabel).map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Aktualisieren</Button></div></CardContent></Card>
    {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="overflow-hidden rounded-lg border bg-white shadow-sm"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">E-Mail</th><th className="px-4 py-3">Sprache</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Angelegt</th><th className="px-4 py-3 text-right">Aktionen</th></tr></thead><tbody className="divide-y">{items.map((item) => <tr key={item.id}><td className="px-4 py-3 font-medium">{item.email}</td><td className="px-4 py-3 uppercase">{item.locale}</td><td className="px-4 py-3"><Badge variant="secondary">{statusLabel[item.status]}</Badge></td><td className="px-4 py-3 text-slate-500">{new Date(item.createdAt).toLocaleString('de-DE')}</td><td className="px-4 py-3 text-right">{canWrite && item.status === 'pending' && <Button size="sm" variant="outline" onClick={() => void act(() => adminNewsletterService.resend(item.id))}><MailCheck className="mr-2 h-4 w-4" />Erneut senden</Button>} {canWrite && item.status === 'active' && <Button size="sm" variant="outline" onClick={() => confirm('Adresse wirklich abmelden?') && void act(() => adminNewsletterService.unsubscribe(item.id))}>Abmelden</Button>}</td></tr>)}{!loading && items.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Keine Einträge gefunden.</td></tr>}</tbody></table>{loading && <div className="p-4 text-center text-sm text-slate-400">Lade…</div>}</div>
  </div>;
}
