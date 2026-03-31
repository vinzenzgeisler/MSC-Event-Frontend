# AI Communication Hub Frontend Handover

Stand: 2026-03-24

Verwende fuer die Frontend-Integration zuerst diese beiden Dateien als Quelle:

- Contract-Draft: `C:\Users\VinzenzGeisler\source\MSC-Event-Backend\docs\ai\api-draft.md`
- OpenAPI: `C:\Users\VinzenzGeisler\source\MSC-Event-Frontend\api\openapi.json`

Wichtige Integrationsregeln:

- Die KI ist taskbasiert, nicht chatbasiert.
- Fuer Generate-Responses immer mit den Bloecken `result`, `basis`, `warnings`, `review`, `meta` arbeiten.
- `warnings` sind Objekte mit `code`, `severity`, `message`.
- `review.required` ist fuer die UI ein fester Hinweis, dass keine automatische Freigabe oder kein automatischer Versand stattfindet.
- Die Mail-Assistenz soll `GET /admin/ai/messages` fuer die Liste und `GET /admin/ai/messages/{id}` fuer die Detailansicht verwenden.
- Der Bericht-Generator soll `formats[]` senden und `result.variants[]` rendern.
- Die Sprecherassistenz soll `result.text` und `result.facts` rendern und die `basis.context` sichtbar machen.
- Draft-Historie kommt aus `GET /admin/ai/drafts`.
- Nur explizit uebernommene Inhalte werden via `POST /admin/ai/drafts` gespeichert.

Empfohlene Frontend-Mappings:

- Dashboard:
  - `GET /admin/ai/drafts`
- Anfrage-/Mail-Assistent:
  - Listenansicht: `GET /admin/ai/messages`
  - Detailansicht: `GET /admin/ai/messages/{id}`
  - Generieren/Neu generieren: `POST /admin/ai/messages/{id}/suggest-reply`
- Event-Bericht-Generator:
  - `POST /admin/ai/reports/generate`
- Sprecherassistenz:
  - `POST /admin/ai/speaker/generate`
- Draft speichern:
  - `POST /admin/ai/drafts`

Hinweis zu den Daten:

- `basis` ist absichtlich fuer Transparenz gedacht und soll im UI sichtbar bleiben.
- `meta.modelId` und `meta.promptVersion` sind rein informativ und sollten keine UI-Logik steuern.
- Das Frontend sollte gegen `review.confidence` und `warnings[]` designen, nicht gegen freie LLM-Texte.
