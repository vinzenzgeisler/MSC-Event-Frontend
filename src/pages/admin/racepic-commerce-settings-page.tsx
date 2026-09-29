import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { bpToPercent, formatEuro, percentToBp, previewSale, type CommerceSettingsValues, type CommerceSettingsVersion, type ShareBasis } from "@/lib/commerce-settings";
import { adminRacepicService } from "@/services/admin-racepic.service";
import { ApiError, getApiErrorMessage } from "@/services/api/http-client";

/**
 * RacePic: Steuer- und Provisionseinstellungen (Marketplace-Plan, AP12). Das Steuermodell ist noch offen, deshalb
 * sind alle Werte Einstellungen. Jede Speicherung erzeugt eine neue, unveraenderliche Version; Quotes und
 * Bestellungen halten ihre Version fest. Solange kein Verkaufssteuersatz gesetzt ist, gibt es keine Preise.
 * Die Vorschau spiegelt die Formeln des Servers nur zur Orientierung.
 */

const PREVIEW_PRICES = [500, 1000, 2000];

export function AdminRacepicCommerceSettingsPage() {
  const [current, setCurrent] = useState<CommerceSettingsVersion | null>(null);
  const [history, setHistory] = useState<CommerceSettingsVersion[]>([]);
  const [saleTax, setSaleTax] = useState("");
  const [commission, setCommission] = useState("20");
  const [basis, setBasis] = useState<ShareBasis>("NET");
  const [sellerVat, setSellerVat] = useState("");
  const [levy, setLevy] = useState("0");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const applyToForm = (version: CommerceSettingsVersion) => {
    setSaleTax(bpToPercent(version.saleTaxRateBp));
    setCommission(bpToPercent(version.commissionBp));
    setBasis(version.sellerShareBasis);
    setSellerVat(bpToPercent(version.sellerVatRateBp));
    setLevy(bpToPercent(version.artistSocialLevyBp));
  };

  const load = useCallback(() => {
    setLoading(true);
    adminRacepicService
      .getCommerceSettings()
      .then((result) => {
        setCurrent(result.current);
        setHistory(result.history);
        applyToForm(result.current);
        setError("");
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const parsed = useMemo(() => {
    const saleTaxRateBp = percentToBp(saleTax);
    const commissionBp = percentToBp(commission);
    const sellerVatRateBp = percentToBp(sellerVat);
    const artistSocialLevyBp = percentToBp(levy);
    if (saleTaxRateBp === undefined || sellerVatRateBp === undefined || commissionBp === undefined || commissionBp === null || artistSocialLevyBp === undefined || artistSocialLevyBp === null) {
      return null;
    }
    if (saleTaxRateBp !== null && saleTaxRateBp > 3000) return null;
    if (sellerVatRateBp !== null && sellerVatRateBp > 3000) return null;
    if (commissionBp > 10000 || artistSocialLevyBp > 1000) return null;
    const values: CommerceSettingsValues = { saleTaxRateBp, commissionBp, sellerShareBasis: basis, sellerVatRateBp, artistSocialLevyBp };
    return values;
  }, [saleTax, commission, sellerVat, levy, basis]);

  const dirty =
    current !== null &&
    parsed !== null &&
    (parsed.saleTaxRateBp !== current.saleTaxRateBp ||
      parsed.commissionBp !== current.commissionBp ||
      parsed.sellerShareBasis !== current.sellerShareBasis ||
      parsed.sellerVatRateBp !== current.sellerVatRateBp ||
      parsed.artistSocialLevyBp !== current.artistSocialLevyBp);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!current || !parsed || !dirty || note.trim().length === 0) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await adminRacepicService.saveCommerceSettings(parsed, current.version, note.trim());
      setNote("");
      setMessage(`Version ${saved.version} gespeichert.`);
      load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("Die Einstellungen wurden inzwischen geändert. Die aktuelle Version wurde neu geladen; bitte erneut prüfen.");
        load();
      } else {
        setError(getApiErrorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading && !current) return <p className="text-sm text-slate-400">Lädt…</p>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Diese Werte bestimmen, wie ein Verkaufspreis aufgeteilt wird. Sie sind bewusst einstellbar, weil das Steuermodell noch mit der Steuerberatung geklärt wird.
        Jede Änderung erzeugt eine neue Version, bestehende Bestellungen behalten ihre.
      </p>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">{message}</p>}
      {current && current.saleTaxRateBp === null && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          Es ist noch kein Umsatzsteuersatz für den Verkauf gesetzt. Ohne ihn werden keine Preise berechnet und es kann nichts gekauft werden.
        </p>
      )}

      <form onSubmit={save} className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
        <div>
          <Label htmlFor="sale-tax" className="text-xs">Umsatzsteuersatz auf den Verkauf (%)</Label>
          <Input id="sale-tax" inputMode="decimal" placeholder="leer = noch nicht entschieden" value={saleTax} onChange={(e) => setSaleTax(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">z. B. 19 oder 7. Leer lassen, solange nicht entschieden.</p>
        </div>
        <div>
          <Label htmlFor="commission" className="text-xs">Provision des MSC (%)</Label>
          <Input id="commission" inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">Die Fotograf:innen erhalten den Rest.</p>
        </div>
        <div>
          <Label htmlFor="basis" className="text-xs">Bezugsgröße des Fotografenanteils</Label>
          <select id="basis" className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={basis} onChange={(e) => setBasis(e.target.value as ShareBasis)}>
            <option value="NET">Netto – Umsatzsteuer der Fotograf:innen kommt hinzu (empfohlen)</option>
            <option value="GROSS">Brutto – Umsatzsteuer ist im Anteil enthalten</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">Bei Netto ist der MSC-Anteil unabhängig vom Steuerstatus der Fotograf:innen.</p>
        </div>
        <div>
          <Label htmlFor="seller-vat" className="text-xs">Umsatzsteuersatz der Fotograf:innen (%)</Label>
          <Input id="seller-vat" inputMode="decimal" placeholder="leer = wie beim Verkauf" value={sellerVat} onChange={(e) => setSellerVat(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">Gilt nur für regelbesteuerte Fotograf:innen in der Gutschrift.</p>
        </div>
        <div>
          <Label htmlFor="levy" className="text-xs">Künstlersozialabgabe (%)</Label>
          <Input id="levy" inputMode="decimal" value={levy} onChange={(e) => setLevy(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">Reine Kostenposition des MSC (2026: 4,9 %), wird nicht von den Fotograf:innen abgezogen. 0, solange nicht geklärt.</p>
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="settings-note" className="text-xs">Vermerk zur Änderung (Pflicht)</Label>
          <Textarea id="settings-note" className="min-h-16" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Grund, z. B. Auskunft der Steuerberatung vom …" />
        </div>
        {parsed === null && <p className="text-sm text-red-700 md:col-span-2">Bitte gültige Prozentwerte eingeben (Steuersätze bis 30 %, Provision bis 100 %, Künstlersozialabgabe bis 10 %).</p>}
        <div className="md:col-span-2">
          <Button type="submit" disabled={busy || !dirty || note.trim().length === 0}>Als neue Version speichern</Button>
        </div>
      </form>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Vorschau (mit den Werten im Formular)</h2>
        {parsed && parsed.saleTaxRateBp === null && <p className="text-sm text-slate-500">Ohne Umsatzsteuersatz keine Vorschau.</p>}
        {parsed && parsed.saleTaxRateBp !== null && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs uppercase">Preis brutto</TableHead>
                <TableHead className="text-xs uppercase">Netto / USt</TableHead>
                <TableHead className="text-xs uppercase">Auszahlung regelbesteuert</TableHead>
                <TableHead className="text-xs uppercase">Auszahlung Kleinunternehmer</TableHead>
                <TableHead className="text-xs uppercase">MSC (regelbesteuert / Kleinunternehmer)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PREVIEW_PRICES.map((price) => {
                const preview = previewSale(price, parsed);
                if (!preview) return null;
                return (
                  <TableRow key={price}>
                    <TableCell className="font-medium">{formatEuro(price)}</TableCell>
                    <TableCell>{formatEuro(preview.netCents)} / {formatEuro(preview.taxCents)}</TableCell>
                    <TableCell>{formatEuro(preview.regularPayoutCents)}</TableCell>
                    <TableCell>{formatEuro(preview.smallBusinessPayoutCents)}</TableCell>
                    <TableCell>{formatEuro(preview.regularMscCents)} / {formatEuro(preview.smallBusinessMscCents)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <p className="text-xs text-slate-500">Ohne Zahlungsgebühren und Künstlersozialabgabe. Der Server rechnet verbindlich.</p>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Verlauf</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs uppercase">Version</TableHead>
              <TableHead className="text-xs uppercase">Steuersatz</TableHead>
              <TableHead className="text-xs uppercase">Provision</TableHead>
              <TableHead className="text-xs uppercase">Bezug</TableHead>
              <TableHead className="text-xs uppercase">Fotograf USt</TableHead>
              <TableHead className="text-xs uppercase">KSA</TableHead>
              <TableHead className="text-xs uppercase">Vermerk</TableHead>
              <TableHead className="text-xs uppercase">Von / am</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((version) => (
              <TableRow key={version.id}>
                <TableCell>
                  v{version.version} {version.version === current?.version && <Badge variant="default">aktuell</Badge>}
                </TableCell>
                <TableCell>{version.saleTaxRateBp === null ? "offen" : `${bpToPercent(version.saleTaxRateBp)} %`}</TableCell>
                <TableCell>{bpToPercent(version.commissionBp)} %</TableCell>
                <TableCell>{version.sellerShareBasis === "NET" ? "Netto" : "Brutto"}</TableCell>
                <TableCell>{version.sellerVatRateBp === null ? "wie Verkauf" : `${bpToPercent(version.sellerVatRateBp)} %`}</TableCell>
                <TableCell>{bpToPercent(version.artistSocialLevyBp)} %</TableCell>
                <TableCell>{version.note ?? ""}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {version.createdBy.slice(0, 12)} · {new Date(version.createdAt).toLocaleString("de-DE")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
