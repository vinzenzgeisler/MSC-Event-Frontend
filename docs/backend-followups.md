# Backend Follow-ups for Frontend Phase 2

1. Add success response schemas for all `200` admin/public endpoints used by UI.
2. Add public read endpoint for current event and available classes for `/anmeldung`.
3. Define field-level validation error format for public entry submit.
4. Add documented endpoint for reading single entry details (`/admin/entries/{entryId}` or equivalent).
5. Add pagination/sorting response metadata for list endpoints.
6. Add documented outbox endpoints (`queued/sent/failed`) and retry action for mail.
7. Document audit/history payload shape for entry status changes.
8. Add presigned upload contract for vehicle image upload, if supported.
9. Add operationIds for stable Orval naming.
10. Clarify auth bootstrap contract (token source/claims) until Cognito Hosted UI integration.
