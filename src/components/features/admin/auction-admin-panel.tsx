import { useEffect, useState } from 'react';
import { Download, Gavel, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminAuctionService, type AdminAuction, type AdminAuctionBid } from '@/services/admin-auction.service';

const euro = (cents: number | null) => cents === null ? '–' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const cents = (value: string) => Math.round(Number(value.replace(',', '.')) * 100);
const locales = [{ id: 'de', label: 'Deutsch' }, { id: 'en', label: 'English' }, { id: 'cz', label: 'Čeština' }, { id: 'pl', label: 'Polski' }] as const;

export function AuctionAdminPanel({ eventId, canWrite }: { eventId: string; canWrite: boolean }) {
  const [auction, setAuction] = useState<AdminAuction | null>(null);
  const [bids, setBids] = useState<AdminAuctionBid[]>([]);
  const [error, setError] = useState('');
  const [contentLocale, setContentLocale] = useState<(typeof locales)[number]['id']>('de');
  const [saving, setSaving] = useState(false);
  const [persistedStatus, setPersistedStatus] = useState<AdminAuction['status']>('draft');
  const load = async () => {
    try { const [next, nextBids] = await Promise.all([adminAuctionService.get(eventId), adminAuctionService.bids(eventId)]); setAuction(next); setPersistedStatus(next.status); setBids(nextBids); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Versteigerung konnte nicht geladen werden.'); }
  };
  useEffect(() => {
    void load();
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void adminAuctionService.bids(eventId).then(setBids); }, 15_000);
    return () => window.clearInterval(interval);
  }, [eventId]);
  if (!auction) return <div className="p-5 text-sm text-slate-500">Lade Helm-Versteigerung…</div>;
  const update = <K extends keyof AdminAuction>(key: K, value: AdminAuction[K]) => setAuction((current) => current ? { ...current, [key]: value } : current);
  const save = async () => {
    if (auction.status === 'closed' && persistedStatus !== 'closed' && !window.confirm('Versteigerung jetzt manuell schließen und den aktuell höchsten gültigen Bieter als Gewinner festhalten?')) return;
    setSaving(true);
    try { setAuction(await adminAuctionService.patch(eventId, auction)); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.'); }
    finally { setSaving(false); }
  };
  const exportBids = () => {
    const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [['Betrag EUR', 'Name', 'Kontaktart', 'Kontakt', 'Status', 'Zeitpunkt', 'Notiz'], ...bids.map((bid) => [(bid.amountCents / 100).toFixed(2), bid.bidderName, bid.contactType, bid.contactValue, bid.status, bid.createdAt, bid.adminNote ?? ''])];
    const blob = new Blob([`\uFEFF${rows.map((row) => row.map(quote).join(';')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'helm-versteigerung-gebote.csv'; anchor.click(); URL.revokeObjectURL(url);
  };
  return <div className="space-y-5">
    {error && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="rounded-lg border bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2"><Gavel className="h-5 w-5"/><h2 className="font-semibold">Helm-Versteigerung</h2><strong className="ml-auto">{euro(auction.currentHighestCents)}</strong></div>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1"><Label>Status</Label><select className="h-10 w-full rounded-md border px-3" value={auction.status} onChange={(e) => update('status', e.target.value as AdminAuction['status'])}><option value="draft">Entwurf</option><option value="open">Offen</option><option value="closed">Geschlossen</option></select></label>
        <label className="space-y-1"><Label>Startgebot (€)</Label><Input type="number" value={auction.startingBidCents / 100} onChange={(e) => update('startingBidCents', cents(e.target.value))}/></label>
        <label className="space-y-1"><Label>Mindestschritt (€)</Label><Input type="number" value={auction.minIncrementCents / 100} onChange={(e) => update('minIncrementCents', cents(e.target.value))}/></label>
      </div>
      <div className="grid gap-4 md:grid-cols-2"><label className="space-y-1"><Label>Helm-Bild URL</Label><Input value={auction.imageUrl ?? ''} onChange={(e) => update('imageUrl', e.target.value || null)}/></label><label className="space-y-1"><Label>11s-Reel URL</Label><Input value={auction.videoUrl ?? ''} onChange={(e) => update('videoUrl', e.target.value || null)}/></label></div>
      <div className="flex flex-wrap gap-2">{locales.map((item) => <Button key={item.id} type="button" size="sm" variant={contentLocale === item.id ? 'default' : 'outline'} onClick={() => setContentLocale(item.id)}>{item.label}{auction.titleI18n[item.id] ? ' ✓' : ''}</Button>)}</div>
      <label className="block space-y-1"><Label>Titel ({contentLocale.toUpperCase()})</Label><Input value={auction.titleI18n[contentLocale] ?? ''} onChange={(e) => update('titleI18n', { ...auction.titleI18n, [contentLocale]: e.target.value })}/></label>
      <label className="block space-y-1"><Label>Beschreibung ({contentLocale.toUpperCase()})</Label><textarea className="min-h-24 w-full rounded-md border p-3 text-sm" value={auction.descriptionI18n[contentLocale] ?? ''} onChange={(e) => update('descriptionI18n', { ...auction.descriptionI18n, [contentLocale]: e.target.value })}/></label>
      <label className="block space-y-1"><Label>Versteigerungsbedingungen ({contentLocale.toUpperCase()})</Label><textarea className="min-h-24 w-full rounded-md border p-3 text-sm" value={auction.termsI18n[contentLocale] ?? ''} onChange={(e) => update('termsI18n', { ...auction.termsI18n, [contentLocale]: e.target.value })}/></label>
      <Button disabled={!canWrite || saving} onClick={() => void save()}><Save className="mr-2 h-4 w-4"/>{saving ? 'Speichert…' : auction.status === 'closed' ? 'Versteigerung schließen' : 'Speichern'}</Button>
    </div>
    <div className="overflow-hidden rounded-lg border bg-white shadow-sm"><div className="flex flex-wrap items-center gap-2 border-b px-5 py-4"><strong>Gebote · {bids.length}</strong><Button className="ml-auto" size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4"/>Aktualisieren</Button><Button size="sm" variant="outline" onClick={exportBids}><Download className="mr-2 h-4 w-4"/>CSV</Button></div><div className="divide-y">{bids.map((bid) => <div key={bid.id} className={`grid gap-2 px-5 py-3 text-sm md:grid-cols-[7rem_1fr_1fr_1.4fr_auto] md:items-center ${bid.status === 'invalid' ? 'bg-slate-50 text-slate-500' : ''}`}><strong>{euro(bid.amountCents)}</strong><span>{bid.bidderName}</span><a className="text-blue-700" href={bid.contactType === 'email' ? `mailto:${bid.contactValue}` : `tel:${bid.contactValue}`}>{bid.contactValue}</a><Input aria-label={`Notiz zu ${bid.bidderName}`} placeholder="Interne Notiz" disabled={!canWrite} value={bid.adminNote ?? ''} onChange={(event) => setBids((current) => current.map((item) => item.id === bid.id ? { ...item, adminNote: event.target.value } : item))} onBlur={async (event) => setBids(await adminAuctionService.patchBid(eventId, bid.id, { adminNote: event.target.value || null }))}/><Button size="sm" variant="outline" disabled={!canWrite} onClick={async () => setBids(await adminAuctionService.patchBid(eventId, bid.id, { status: bid.status === 'valid' ? 'invalid' : 'valid' }))}>{bid.status === 'valid' ? 'Ungültig' : 'Wiederherstellen'}</Button></div>)}</div></div>
  </div>;
}
