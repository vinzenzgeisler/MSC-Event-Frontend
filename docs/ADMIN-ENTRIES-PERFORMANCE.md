# Admin Nennungen: Performance-Konzept

## Ziel
Die Nennungsseite (`/admin/entries`) soll auch bei 250+ Einträgen reaktionsschnell bleiben.

## Was umgesetzt wurde

### 1. Cursor-Pagination statt Voll-Reload
- Daten werden seitenweise geladen (`limit=25`, Cursor-basiert).
- Initial werden nur die ersten Einträge geladen.
- Weitere Einträge werden über Endlos-Scroll plus Fallback-Button nachgeladen.

### 2. Debounced Suche
- Das Suchfeld triggert Requests erst nach kurzer Pause (`450ms`).
- Filter-Dropdowns bleiben sofort aktiv.

### 3. Refresh-Strategie
- Manueller Refresh-Button in der Filterbar.
- Zusätzlich Auto-Refresh alle **5 Minuten** (nur bei sichtbarem Tab).
- Refresh lädt mindestens die bereits sichtbare Datenmenge nach (Snapshot-Refresh).

### 4. Session-Cache für Zurück-Navigation
- Letzte Liste wird für denselben Filter in `sessionStorage` zwischengespeichert.
- Beim Zurück aus der Detailseite wird die Liste sofort aus Cache angezeigt (wenn gültig).
- Cache-TTL: 10 Minuten.

### 5. Kein Voll-Reload nach Statusänderung
- Statusaktionen (`Vorauswahl`, `Zulassen`, `Ablehnen`) patchen die betroffene Zeile lokal.
- Falls die Zeile nicht mehr zum aktiven Filter passt, wird sie direkt aus der Liste entfernt.

## Technische Eckdaten
- Page-Size: `25`
- Auto-Refresh: `300000 ms` (5 Minuten)
- Debounce Suche: `450 ms`
- Deduplizierung bei Mehrfachladevorgängen über `entry.id`
- Schutz vor Race Conditions via Request-Sequence

## Erwarteter Effekt
- Schnellere Initialanzeige
- Deutlich weniger API-Last beim Tippen
- Besserer Arbeitsfluss beim Wechsel Liste <-> Detail
- Stabileres Verhalten bei wachsender Datenmenge

## Hinweise für Betrieb / Tuning
- Bei sehr langsamer API kann `limit` auf `15` reduziert werden (weniger Payload pro Request).
- Bei sehr schneller API und vielen Scroll-Aktionen kann `limit` auf `40` erhöht werden (weniger Requests).
- Falls häufigere Live-Daten benötigt werden, kann Auto-Refresh auf 2 Minuten gesenkt werden.
