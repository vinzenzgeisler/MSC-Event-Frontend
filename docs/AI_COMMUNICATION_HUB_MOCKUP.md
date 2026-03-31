# AI Communication Hub Mock-up / Integrationsstand

## Einordnung im Frontend
- Neuer Admin-Hauptmenüpunkt: `KI-Kommunikation`
- Routen:
  - `/admin/ai-communication`
  - `/admin/ai-communication/mail-assistant`
  - `/admin/ai-communication/report-generator`
  - `/admin/ai-communication/speaker-assistant`
- Für das Mock-up wird bewusst die bestehende Berechtigung `communication.read` genutzt, damit keine zusätzliche Backend-/IAM-Abstimmung nötig ist.

## Gebaute Seiten und Bausteine
- Dashboard als Einstieg mit Einordnung, drei Einstiegskarten und einer echten Draft-/History-Vorschau aus `GET /admin/ai/drafts`
- Anfrage- und Mail-Assistent mit:
  - echter Nachrichtenliste aus `GET /admin/ai/messages`
  - Detailansicht aus `GET /admin/ai/messages/{messageId}`
  - Antwortvorschlag aus `POST /admin/ai/messages/{messageId}/suggest-reply`
  - explizitem Draft-Save über `POST /admin/ai/drafts`
- Event-Bericht-Generator mit:
  - Event-, Klassen-, Format-, Tonalitäts- und Längenauswahl
  - `formats[]`-basiertem Request-Modell
  - Variantenansicht entlang `result.variants[]`
- Sprecherassistenz mit:
  - contract-naher `result.text`-/`result.facts`-Darstellung
  - sichtbarer `basis.context`-Ansicht
- Gemeinsame Shell-Komponente für Header, Subnavigation und Mock-up-Kontext
- Gemeinsame Contract-Panels fuer `warnings`, `review` und `meta`
- Typisierte Service-Schicht fuer echte AI-Endpunkte plus separater Mock-Service fuer noch nicht echt integrierte Flows

## UX-Entscheidungen
- Kein Chatbot-Look: alle drei Use Cases sind als strukturierte Arbeitsflächen mit klaren Eingaben, Quellen und Ergebnissen angelegt.
- Eigener Hauptmenüpunkt: für das Projekt und die Vorführung ist die neue Funktion dadurch klar sichtbar, ohne die bestehende Kommunikationsseite umzubauen.
- Transparenz über Assistenzcharakter: alle Seiten zeigen Hinweise, dass Ergebnisse Entwürfe sind und vor Nutzung geprüft werden müssen.
- `basis`, `warnings` und `review.required` werden explizit gerendert; `modelId` und `promptVersion` bleiben rein informativ.
- Keine Tabs-Komponente eingeführt: das Projekt nutzt bisher überwiegend Karten, Link-Leisten und Form-Grids; der neue Bereich bleibt diesem Pattern treu.

## Annahmen
- Mail-Assistent und Draft-Historie sind mit dem aktuellen Backend-Contract ausreichend definierbar.
- Für Bericht-Generator und Sprecherassistenz fehlen noch belastbare Read-Quellen fuer Auswahl- und Kontextdaten.
- Deshalb bleibt die UI dort vorläufig auf Demo-Daten, rendert aber bereits das Ziel-Envelope-Modell.

## Bewusst noch Mock
- Bericht-Generator und Sprecherassistenz laufen weiterhin über `ai-communication-mock.service.ts`.
- Für diese beiden Flows gibt es noch keinen echten Save-Flow.
- Die Auswahl fuer Event-/Entry-Kontext in diesen Bereichen ist noch nicht an echte Read-Endpunkte gekoppelt.

## Nächste Schritte für volle Integration
- Zusätzliche Read-Endpunkte oder verbindliche Datenquellen fuer Bericht- und Sprecher-Formulare festlegen.
- Danach `POST /admin/ai/reports/generate` und `POST /admin/ai/speaker/generate` von Mock auf echte Requests umstellen.
- Optional spaeter eigene Berechtigungen wie `aiCommunication.read` / `aiCommunication.write` ergänzen.
