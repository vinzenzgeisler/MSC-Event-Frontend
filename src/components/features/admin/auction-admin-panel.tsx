import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Download, Gavel, RefreshCw, Save, Upload, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminAuctionService, type AdminAuction, type AdminAuctionBid } from '@/services/admin-auction.service';

const euro = (cents: number | null) => cents === null ? '–' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const cents = (value: string) => Math.round(Number(value.replace(',', '.')) * 100);
const locales = [{ id: 'de', label: 'Deutsch' }, { id: 'en', label: 'English' }, { id: 'cz', label: 'Čeština' }, { id: 'pl', label: 'Polski' }] as const;
const textTemplate = {
  titleI18n: { de: 'Der Helm von Didier Grams', en: "Didier Grams' racing helmet", cz: 'Závodní helma Didiera Gramse', pl: 'Kask wyścigowy Didiera Gramsa' },
  descriptionI18n: { de: 'Sichere dir ein echtes Stück Motorsportgeschichte und biete auf den Helm von Didier Grams.', en: "Secure a genuine piece of motorsport history and bid on Didier Grams' helmet.", cz: 'Získejte skutečný kus historie motorsportu a přihazujte na helmu Didiera Gramse.', pl: 'Zdobądź prawdziwy fragment historii motorsportu i złóż ofertę na kask Didiera Gramsa.' },
  termsI18n: { de: 'Das abgegebene Gebot ist verbindlich. Nach Ende der Auktion wird die Person mit dem höchsten gültigen Gebot über die angegebene Kontaktmöglichkeit benachrichtigt und verpflichtet sich zur Zahlung des Gebotsbetrags.', en: 'The submitted bid is binding. After the auction ends, the person with the highest valid bid will be contacted using the provided details and agrees to pay the bid amount.', cz: 'Podaná nabídka je závazná. Po skončení aukce bude osoba s nejvyšší platnou nabídkou kontaktována prostřednictvím uvedených údajů a zavazuje se uhradit nabídnutou částku.', pl: 'Złożona oferta jest wiążąca. Po zakończeniu aukcji osoba z najwyższą ważną ofertą zostanie powiadomiona za pomocą podanych danych kontaktowych i zobowiązuje się do zapłaty zaoferowanej kwoty.' }
};

export function AuctionAdminPanel({ eventId, canWrite }: { eventId: string; canWrite: boolean }) {
  const [auction, setAuction] = useState<AdminAuction | null>(null);
  const [bids, setBids] = useState<AdminAuctionBid[]>([]);
  const [error, setError] = useState('');
  const [contentLocale, setContentLocale] = useState<(typeof locales)[number]['id']>('de');
  const [saving, setSaving] = useState(false);
  const [persistedStatus, setPersistedStatus] = useState<AdminAuction['status']>('draft');
  const [uploading, setUploading] = useState<'image' | 'video' | null>(null);
  const load = async () => {
    try { const [next, nextBids] = await Promise.all([adminAuctionService.get(eventId), adminAuctionService.bids(eventId)]); setAuction(next); setPersistedStatus(next.status); setBids(nextBids); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Versteigerung konnte nicht geladen werden.'); }
  };
  useEffect(() => {
    void load();
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void adminAuctionService.bids(eventId).then(setBids); }, 15_000);
    return () => window.clearInterval(interval);
  }, [eventId]);
  if (!auction) return <div className="p-5 text-sm text-slate-500">Lade Didier-Grams-Helmauktion…</div>;
  const checks = [
    { label: 'Helmbild hinterlegt', done: Boolean(auction.imageUrl) },
    { label: '11-Sekunden-Reel hinterlegt', done: Boolean(auction.videoUrl) },
    { label: 'Gebotswerte festgelegt', done: auction.startingBidCents >= 0 && auction.minIncrementCents > 0 },
    { label: 'Alle vier Titel gepflegt', done: locales.every(({ id }) => Boolean(auction.titleI18n[id]?.trim())) },
    { label: 'Alle vier Beschreibungen gepflegt', done: locales.every(({ id }) => Boolean(auction.descriptionI18n[id]?.trim())) },
    { label: 'Alle vier Bedingungen gepflegt', done: locales.every(({ id }) => Boolean(auction.termsI18n[id]?.trim())) }
  ];
  const ready = checks.every((check) => check.done);
  const applyTemplate = () => setAuction((current) => current ? {
    ...current,
    titleI18n: Object.fromEntries(locales.map(({ id }) => [id, current.titleI18n[id]?.trim() || textTemplate.titleI18n[id]])),
    descriptionI18n: Object.fromEntries(locales.map(({ id }) => [id, current.descriptionI18n[id]?.trim() || textTemplate.descriptionI18n[id]])),
    termsI18n: Object.fromEntries(locales.map(({ id }) => [id, current.termsI18n[id]?.trim() || textTemplate.termsI18n[id]]))
  } : current);
  const update = <K extends keyof AdminAuction>(key: K, value: AdminAuction[K]) => setAuction((current) => current ? { ...current, [key]: value } : current);
  const save = async () => {
    if (auction.status === 'open' && !ready) { setError('Vor dem Öffnen bitte alle Punkte der Veröffentlichungs-Checkliste vervollständigen.'); return; }
    if (auction.status === 'closed' && persistedStatus !== 'closed' && !window.confirm('Versteigerung jetzt manuell schließen und den aktuell höchsten gültigen Bieter als Gewinner festhalten?')) return;
    setSaving(true);
    try { setAuction(await adminAuctionService.patch(eventId, auction)); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.'); }
    finally { setSaving(false); }
  };
  const uploadMedia = async (kind: 'image' | 'video', file: File | undefined) => {
    if (!file || !canWrite) return;
    setUploading(kind); setError('');
    try { setAuction(await adminAuctionService.uploadMedia(eventId, kind, file)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Medien-Upload fehlgeschlagen.'); }
    finally { setUploading(null); }
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
      <div className="flex items-center gap-2"><Gavel className="h-5 w-5"/><h2 className="font-semibold">Didier-Grams-Helmauktion</h2><strong className="ml-auto">{euro(auction.currentHighestCents)}</strong></div>
      <div className={`rounded-md border p-4 ${ready ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">Veröffentlichungs-Check · {checks.filter((check) => check.done).length}/{checks.length}</strong><Button type="button" size="sm" variant="outline" className="ml-auto" disabled={!canWrite} onClick={applyTemplate}><WandSparkles className="mr-2 h-4 w-4"/>Fehlende Texte einsetzen</Button></div><div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">{checks.map((check) => <span key={check.label} className="flex items-center gap-2">{check.done ? <CheckCircle2 className="h-4 w-4 text-green-700"/> : <Circle className="h-4 w-4 text-amber-700"/>}{check.label}</span>)}</div></div>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1"><Label>Status</Label><select className="h-10 w-full rounded-md border px-3" value={auction.status} onChange={(e) => update('status', e.target.value as AdminAuction['status'])}><option value="draft">Entwurf</option><option value="open">Offen</option><option value="closed">Geschlossen</option></select></label>
        <label className="space-y-1"><Label>Startgebot (€)</Label><Input type="number" value={auction.startingBidCents / 100} onChange={(e) => update('startingBidCents', cents(e.target.value))}/></label>
        <label className="space-y-1"><Label>Mindestschritt (€)</Label><Input type="number" value={auction.minIncrementCents / 100} onChange={(e) => update('minIncrementCents', cents(e.target.value))}/></label>
      </div>
      <div className="grid gap-4 md:grid-cols-2"><label className="space-y-1"><Label>Helm-Bild URL</Label><Input value={auction.imageUrl ?? ''} onChange={(e) => update('imageUrl', e.target.value || null)}/></label><label className="space-y-1"><Label>11s-Reel URL</Label><Input value={auction.videoUrl ?? ''} onChange={(e) => update('videoUrl', e.target.value || null)}/></label></div>
      <div className="grid gap-4 rounded-md border border-dashed p-4 md:grid-cols-2"><label className="space-y-2"><span className="flex items-center gap-2 text-sm font-medium"><Upload className="h-4 w-4"/>Helmbild hochladen</span><Input type="file" accept="image/jpeg,image/png,image/webp" disabled={!canWrite || uploading !== null} className="h-auto py-2" onChange={(event) => void uploadMedia('image', event.target.files?.[0])}/><span className="block text-xs text-slate-500">JPG, PNG oder WebP · maximal 15 MB</span></label><label className="space-y-2"><span className="flex items-center gap-2 text-sm font-medium"><Upload className="h-4 w-4"/>11-Sekunden-Reel hochladen</span><Input type="file" accept="video/mp4,video/webm" disabled={!canWrite || uploading !== null} className="h-auto py-2" onChange={(event) => void uploadMedia('video', event.target.files?.[0])}/><span className="block text-xs text-slate-500">MP4 oder WebM · maximal 100 MB</span></label>{uploading && <p className="text-sm font-medium text-blue-700 md:col-span-2">{uploading === 'image' ? 'Helmbild' : 'Reel'} wird hochgeladen…</p>}</div>
      {(auction.imageUrl || auction.videoUrl) && <div className="grid max-w-2xl gap-3 sm:grid-cols-2">{auction.imageUrl && <img src={auction.imageUrl} alt="Vorschau des Didier-Grams-Helms" className="aspect-[4/3] w-full rounded-md bg-slate-100 object-cover"/>}{auction.videoUrl && <video src={auction.videoUrl} poster={auction.imageUrl ?? undefined} controls muted playsInline preload="metadata" className="aspect-[9/16] max-h-72 w-full rounded-md bg-black object-cover"/>}</div>}
      <div className="flex flex-wrap gap-2">{locales.map((item) => <Button key={item.id} type="button" size="sm" variant={contentLocale === item.id ? 'default' : 'outline'} onClick={() => setContentLocale(item.id)}>{item.label}{auction.titleI18n[item.id] ? ' ✓' : ''}</Button>)}</div>
      <label className="block space-y-1"><Label>Titel ({contentLocale.toUpperCase()})</Label><Input value={auction.titleI18n[contentLocale] ?? ''} onChange={(e) => update('titleI18n', { ...auction.titleI18n, [contentLocale]: e.target.value })}/></label>
      <label className="block space-y-1"><Label>Beschreibung ({contentLocale.toUpperCase()})</Label><textarea className="min-h-24 w-full rounded-md border p-3 text-sm" value={auction.descriptionI18n[contentLocale] ?? ''} onChange={(e) => update('descriptionI18n', { ...auction.descriptionI18n, [contentLocale]: e.target.value })}/></label>
      <label className="block space-y-1"><Label>Versteigerungsbedingungen ({contentLocale.toUpperCase()})</Label><textarea className="min-h-24 w-full rounded-md border p-3 text-sm" value={auction.termsI18n[contentLocale] ?? ''} onChange={(e) => update('termsI18n', { ...auction.termsI18n, [contentLocale]: e.target.value })}/></label>
      <Button disabled={!canWrite || saving} onClick={() => void save()}><Save className="mr-2 h-4 w-4"/>{saving ? 'Speichert…' : auction.status === 'closed' ? 'Versteigerung schließen' : 'Speichern'}</Button>
    </div>
    <div className="overflow-hidden rounded-lg border bg-white shadow-sm"><div className="flex flex-wrap items-center gap-2 border-b px-5 py-4"><strong>Gebote · {bids.length}</strong><Button className="ml-auto" size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4"/>Aktualisieren</Button><Button size="sm" variant="outline" onClick={exportBids}><Download className="mr-2 h-4 w-4"/>CSV</Button></div><div className="divide-y">{bids.map((bid) => <div key={bid.id} className={`grid gap-2 px-5 py-3 text-sm md:grid-cols-[7rem_1fr_1fr_1.4fr_auto] md:items-center ${bid.status === 'invalid' ? 'bg-slate-50 text-slate-500' : ''}`}><strong>{euro(bid.amountCents)}</strong><span>{bid.bidderName}</span><a className="text-blue-700" href={bid.contactType === 'email' ? `mailto:${bid.contactValue}` : `tel:${bid.contactValue}`}>{bid.contactValue}</a><Input aria-label={`Notiz zu ${bid.bidderName}`} placeholder="Interne Notiz" disabled={!canWrite} value={bid.adminNote ?? ''} onChange={(event) => setBids((current) => current.map((item) => item.id === bid.id ? { ...item, adminNote: event.target.value } : item))} onBlur={async (event) => setBids(await adminAuctionService.patchBid(eventId, bid.id, { adminNote: event.target.value || null }))}/><Button size="sm" variant="outline" disabled={!canWrite} onClick={async () => setBids(await adminAuctionService.patchBid(eventId, bid.id, { status: bid.status === 'valid' ? 'invalid' : 'valid' }))}>{bid.status === 'valid' ? 'Ungültig' : 'Wiederherstellen'}</Button></div>)}</div></div>
  </div>;
}
