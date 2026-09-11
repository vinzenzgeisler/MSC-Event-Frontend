import { useEffect, useState } from 'react';
import { Gavel, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminAuctionService, type AdminAuction, type AdminAuctionBid } from '@/services/admin-auction.service';

const euro = (cents: number | null) => cents === null ? '–' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const cents = (value: string) => Math.round(Number(value.replace(',', '.')) * 100);

export function AuctionAdminPanel({ eventId, canWrite }: { eventId: string; canWrite: boolean }) {
  const [auction, setAuction] = useState<AdminAuction | null>(null);
  const [bids, setBids] = useState<AdminAuctionBid[]>([]);
  const [error, setError] = useState('');
  const load = async () => {
    try { const [next, nextBids] = await Promise.all([adminAuctionService.get(eventId), adminAuctionService.bids(eventId)]); setAuction(next); setBids(nextBids); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Versteigerung konnte nicht geladen werden.'); }
  };
  useEffect(() => { void load(); }, [eventId]);
  if (!auction) return <div className="p-5 text-sm text-slate-500">Lade Helm-Versteigerung…</div>;
  const update = <K extends keyof AdminAuction>(key: K, value: AdminAuction[K]) => setAuction((current) => current ? { ...current, [key]: value } : current);
  const save = async () => {
    try { setAuction(await adminAuctionService.patch(eventId, auction)); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.'); }
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
      <label className="block space-y-1"><Label>Titel (DE)</Label><Input value={auction.titleI18n.de ?? ''} onChange={(e) => update('titleI18n', { ...auction.titleI18n, de: e.target.value })}/></label>
      <label className="block space-y-1"><Label>Beschreibung (DE)</Label><textarea className="min-h-24 w-full rounded-md border p-3 text-sm" value={auction.descriptionI18n.de ?? ''} onChange={(e) => update('descriptionI18n', { ...auction.descriptionI18n, de: e.target.value })}/></label>
      <label className="block space-y-1"><Label>Versteigerungsbedingungen (DE)</Label><textarea className="min-h-24 w-full rounded-md border p-3 text-sm" value={auction.termsI18n.de ?? ''} onChange={(e) => update('termsI18n', { ...auction.termsI18n, de: e.target.value })}/></label>
      <Button disabled={!canWrite} onClick={() => void save()}><Save className="mr-2 h-4 w-4"/>Speichern</Button>
    </div>
    <div className="overflow-hidden rounded-lg border bg-white shadow-sm"><div className="border-b px-5 py-4 font-medium">Gebote · {bids.length}</div><div className="divide-y">{bids.map((bid) => <div key={bid.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"><strong>{euro(bid.amountCents)}</strong><span>{bid.bidderName}</span><a className="text-blue-700" href={bid.contactType === 'email' ? `mailto:${bid.contactValue}` : `tel:${bid.contactValue}`}>{bid.contactValue}</a><Button className="ml-auto" size="sm" variant="outline" disabled={!canWrite} onClick={async () => setBids(await adminAuctionService.patchBid(eventId, bid.id, { status: bid.status === 'valid' ? 'invalid' : 'valid' }))}>{bid.status === 'valid' ? 'Ungültig setzen' : 'Wiederherstellen'}</Button></div>)}</div></div>
  </div>;
}
