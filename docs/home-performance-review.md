# Home interaction refinement — 4.5.2

## Requested behavior

Address severe drag lag, especially when panels overlap; reduce the bottom dock to important Home tools plus Backgrounds; keep module navigation in the sidebar; give search a visible field; refine the main workspace.

## Dragging and resizing

The old pointer handler updated React state for every pointer sample. That rerendered the window registry and triggered synchronous JSON/localStorage writes containing the entire saved layout and potentially a large custom background. Sorting the actual panel elements on raise also moved mounted DOM nodes. Overlapping translucent panels required repeated backdrop blur.

The new handler retains gesture geometry in refs and schedules at most one transform or size update per animation frame. Desktop panel DOM order stays stable; visual stacking uses z-index. Final geometry enters React and storage once at release. Focus/clock state can keep updating while panel content elements are reused during the gesture. Mobile reordering continues to use ordered DOM because direct dragging is disabled there.

Glass blur, shadows and active animations are suspended during the gesture. Escape and pointer cancellation restore the original geometry; lost pointer capture commits the final available geometry. The pending animation frame is canceled at completion/unmount. Responsive/workspace changes cancel an active gesture without applying its coordinates to another workspace.

A measured 60-step overlap drag on the cloud Chromium browser changed from 58 in-gesture layout writes (59 total) to **zero in-gesture writes and one final write**. This is evidence of removing synchronous work, not a claim of a specific frame rate on Joe’s Mac.

The dedicated interaction regression uses a large locally generated background and a running Focus timer. It verifies no layout writes or panel-body mutations during a 90-step overlap drag, stable element identity/order, composited translation, one drop save, reload persistence, Escape and pointer cancellation.

## Navigation and presentation

- Default dock: Priorities, Focus, Spotify, Notes, Ambient and Backgrounds. Optional minimized windows can appear temporarily for restoration; the dock no longer lists all sidebar modules by default. All optional panels remain available through Widgets.
- Background selection stays in Home’s dock/library; it is absent from the application sidebar.
- Search now has a visible border, background, label and keyboard shortcut. It remains available at desktop, tablet and mobile widths.
- The compact dock fits small screens; mobile Up Next and Focus panels use less vertical space. Screenshots in `docs/previews` are updated.

## Validation

Production build and 73 unit/API checks pass. The interaction test, scene acceptance, Home window test, 25-case 4.5 acceptance and all four historical browser suites pass locally. CI includes the new interaction test. Private provider configuration and stored user records are unchanged; actual Mac graphics performance is not measured from the cloud.
