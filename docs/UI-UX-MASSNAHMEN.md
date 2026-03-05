# UI/UX Maßnahmenliste

## Component Patterns
- Single shared select pattern for all dropdown fields (`SelectField`) with consistent focus, error, and disabled states.
- Consistent form field rhythm: label, control, help/error text, same spacing scale.
- Unified action button hierarchy (`primary`, `outline`, `destructive`) without ad-hoc variants.

## Accessibility
- Keyboard support for all selects and dialogs.
- Screenreader labels and `aria-invalid`/`aria-describedby` wired consistently.
- Error messages announced (`aria-live`) where needed.
- Touch targets remain usable on mobile.

## Responsiveness
- Mobile-first: form controls >= 16px to prevent iOS auto-zoom.
- Stable sticky bottom action area in registration on mobile, respecting safe-area insets.
- Admin table-to-card behavior remains semantically clear and action controls remain reachable.

## Content & i18n Readiness
- New UI copy kept neutral and easy to extract for i18n.
- Avoid hardcoded dynamic mail/document copy in components where service-driven text is expected.

## Consistency & Cleanup
- Replace duplicated native-select styles with shared component usage.
- Remove dead/duplicate style fragments while touching related files.
- Keep Tailwind utility usage predictable and avoid inline quick fixes.
