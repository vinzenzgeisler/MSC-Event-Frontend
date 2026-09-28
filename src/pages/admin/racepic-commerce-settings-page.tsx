import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <div>
        <h1 className="text-2xl font-semibold">RacePic: Steuer &amp; Provision</h1>
        <p className="text-sm text-slate-600">
          Diese Werte bestimmen, wie ein Verkaufspreis aufgeteilt wird. Sie sind bewusst einstellbar, weil das Steuermodell noch mit der Steuerberatung geklärt wird.
          Jede Änderung erzeugt eine neue Version, bestehende Bestellungen behalten ihre.
        </p>
      </div>

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
          <textarea id="settings-note" className="min-h-16 w-full rounded-md border bg-white p-2 text-sm" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Grund, z. B. Auskunft der Steuerberatung vom …" />
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
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Preis brutto</th>
                  <th className="p-3">Netto / USt</th>
                  <th className="p-3">Auszahlung regelbesteuert</th>
                  <th className="p-3">Auszahlung Kleinunternehmer</th>
                  <th className="p-3">MSC (regelbesteuert / Kleinunternehmer)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {PREVIEW_PRICES.map((price) => {
                  const preview = previewSale(price, parsed);
                  if (!preview) return null;
                  return (
                    <tr key={price}>
                      <td className="p-3 font-medium">{formatEuro(price)}</td>
                      <td className="p-3">{formatEuro(preview.netCents)} / {formatEuro(preview.taxCents)}</td>
                      <td className="p-3">{formatEuro(preview.regularPayoutCents)}</td>
                      <td className="p-3">{formatEuro(preview.smallBusinessPayoutCents)}</td>
                      <td className="p-3">{formatEuro(preview.regularMscCents)} / {formatEuro(preview.smallBusinessMscCents)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-500">Ohne Zahlungsgebühren und Künstlersozialabgabe. Der Server rechnet verbindlich.</p>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Verlauf</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Version</th>
                <th className="p-3">Steuersatz</th>
                <th className="p-3">Provision</th>
                <th className="p-3">Bezug</th>
                <th className="p-3">Fotograf USt</th>
                <th className="p-3">KSA</th>
                <th className="p-3">Vermerk</th>
                <th className="p-3">Von / am</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.map((version) => (
                <tr key={version.id}>
                  <td className="p-3">
                    v{version.version} {version.version === current?.version && <Badge variant="default">aktuell</Badge>}
                  </td>
                  <td className="p-3">{version.saleTaxRateBp === null ? "offen" : `${bpToPercent(version.saleTaxRateBp)} %`}</td>
                  <td className="p-3">{bpToPercent(version.commissionBp)} %</td>
                  <td className="p-3">{version.sellerShareBasis === "NET" ? "Netto" : "Brutto"}</td>
                  <td className="p-3">{version.sellerVatRateBp === null ? "wie Verkauf" : `${bpToPercent(version.sellerVatRateBp)} %`}</td>
                  <td className="p-3">{bpToPercent(version.artistSocialLevyBp)} %</td>
                  <td className="p-3">{version.note ?? ""}</td>
                  <td className="p-3 whitespace-nowrap">
                    {version.createdBy.slice(0, 12)} · {new Date(version.createdAt).toLocaleString("de-DE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
