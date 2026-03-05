# Frontend Implementation Plan

## Summary
- Goal: raise product quality across registration and admin with consistent UI patterns, robust responsiveness, and stable admin workflows.
- Order: unblock UX foundation first (selects + mobile input behavior), then context restore, then communication/doc UX, then settings/detail wiring.
- Working principle: small atomic commits, no risky rewrites, keep existing useful local changes.

## Repo Analysis Snapshot
- Stack: React 18 + TypeScript + Vite + Tailwind.
- Routing: React Router (`/anmeldung`, `/admin/*`) with role-protected admin routes.
- State: local component state + URL query params + `sessionStorage`/`localStorage`; no global store.
- UI system: shadcn-style primitives (`Button`, `Input`, `Card`, `Label`) + many native selects.
- Forms: registration wizard is custom stateful flow (not full react-hook-form usage).
- Email/doc flows: queue/outbox/download endpoints exist; template editor + preview UI is minimal today.

## Epics, Tickets, Order

### E1. Form Controls Quality (highest priority)
1. Introduce one shared accessible `Select` component (`Radix Select` based).
2. Migrate registration selects (driver + start + codriver + backup vehicle).
3. Migrate admin selects (entries filters, communication filters, settings class/event controls).
4. Keep i18n-ready labels/placeholders and consistent error states.

### E2. Mobile Stability + Responsiveness
1. Fix iOS zoom traps by enforcing mobile form-control font-size >= 16px.
2. Verify sticky action bars and safe-area spacing in registration.
3. Improve admin mobile/tablet usability (filter grid/action button wrap/overflow behavior).

### E3. Admin List-to-Detail Context Restore
1. Persist list context on navigate-to-detail: query/filter/sort plus scroll position.
2. Restore context on back-to-list reliably after data hydration.
3. Keep compatibility with current URL-based filter persistence and session cache.

### E4. Communication Menu Expansion
1. Add template email editor shell (subject/body draft UI).
2. Add preview pane with placeholder rendering and verification-link visibility checks.
3. Add recipient filtering UX enhancements and `additional emails` input.
4. Wire what current backend supports; keep unsupported capabilities clearly marked.

### E5. Documents (Waiver/Tech-Check) Preview UX
1. Add in-app preview flow for waiver/tech-check documents from existing download URLs.
2. Distinguish Auto vs Motorrad presentation and show document metadata clearly.
3. Keep download action unchanged and reliable.

### E6. Settings: Restore Archived Event
1. Wire `activateEvent` into settings operations UI.
2. Show button only for `archived` state, with confirm + success/error feedback.

### E7. Detail View: Class Change UX
1. Add class-change controls for admin/editor in entry detail (incl. backup relation awareness).
2. Wire to backend if endpoint is available; otherwise ship guarded UI and define exact backend contract.

## Risks & Dependencies
- No dedicated template CRUD/preview endpoint in current frontend service layer; communication editor will be frontend-first where backend support is missing.
- No class-change endpoint currently exposed in service layer/OpenAPI path usage; requires backend contract.
- PDF source templates are not present in repo; preview relies on backend-rendered document output.

## Backend Requests
1. **Template CRUD + versioning**
   - Endpoints to list/create/update templates and versions.
   - Acceptance: frontend can persist edited subject/body and select versions.
2. **Mail render preview endpoint**
   - Input: template + sample context/entry.
   - Output: rendered subject/body + missing placeholders.
   - Acceptance: verification mails can be validated for clickable verify link before queueing.
3. **Broadcast recipient resolution with additional emails**
   - Input: existing filters + `additionalEmails[]`.
   - Output: resolved recipients + invalid/duplicate diagnostics.
   - Acceptance: frontend can show final recipient count and send with extras.
4. **Entry class-change endpoint**
   - Input: entryId + classId (+ backup handling policy).
   - Acceptance: admin/editor can update class with clear conflict errors.
5. **Document preview metadata**
   - Optional endpoint for preview payload/variant details (auto/moto).
   - Acceptance: frontend can present exact template variant before download.

## Validation Checklist
- `npm run typecheck`
- `npm run build`
- Manual smoke flows:
  - registration (desktop + mobile),
  - admin entries list/detail/back,
  - communication queue/outbox,
  - settings archive/restore actions,
  - document preview/download.
