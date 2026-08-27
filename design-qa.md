# Home Spatial Desk Design QA

## Evidence

- Source visual truth: `C:\My Files\CardForge\assets\brand\cardforge-studio\concepts\home-current.webp` (1024 × 512 reference board containing desktop and phone compositions).
- Audited prior desktop overview: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\home-spatial-pass3\01-current-overview.png` (1280 × 720 screenshot at a 1280 × 720 CSS viewport, 1× browser density).
- Audited prior desktop focus: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\home-spatial-pass3\02-current-focus.png` (1280 × 720 at the same viewport).
- Final desktop overview: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\home-spatial-pass3\03-revised-overview.png` (1280 × 720 at a 1280 × 720 CSS viewport, 1× browser density).
- Final desktop focus: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\home-spatial-pass3\04-revised-focus.png` (1280 × 720 at the same viewport).
- Final mobile focus: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\home-spatial-pass3\05-revised-mobile-focus.png` (390 × 844 at a 390 × 844 CSS viewport, 1× browser density).
- Final mobile overview: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\home-spatial-pass3\06-revised-mobile-overview.png` (390 × 844 at the same viewport).

The reference uses populated authored cards while the safe local evidence uses four empty browser-only Sets. The comparison therefore judges hierarchy, spatial grouping, scale transition, responsive composition, and empty-state treatment. Populated Sets use the canonical `CardPreview` renderer; no fake card imagery was introduced to force a closer screenshot.

## Full-view comparison

The source makes authored work feel physically arranged: one dominant Set sits among smaller piles, and its contents remain visible as part of the Set object. The final overview now uses the same grammar. The active Set occupies the central, largest position; secondary Sets sit irregularly around it; the control dock stays compact at the work-surface edge; and account utilities remain outside the creative desk.

The final focus state changes scale without changing place. The selected Set becomes a bordered work board in the center of the same surface while neighboring Sets remain visible around its edges. “Pull back” returns to the overview. This replaces the prior master-detail/sidebar composition with a camera-like spatial transition.

## Required fidelity surfaces

- Fonts and typography: existing CardForge display and body tokens are preserved. The compact desk label, Set names, board title, metadata, and action labels remain readable at desktop and mobile sizes without introducing a new type system.
- Spacing and layout rhythm: the creative surface now dominates the viewport. Sets are arranged with unequal scale and position rather than equal grid cards. The focused Set is centered with surrounding work at the edges. At 390 px and 320 px, document width equals viewport width; internal Set browsing may scroll horizontally by design.
- Colors and visual tokens: the implementation reuses the existing canvas, inset surface, brass accent, border, status, and shadow tokens. No gradient or decorative palette was added.
- Image quality and asset fidelity: populated work renders real canonical `CardPreview` output. Empty Sets use the existing Lucide Set/source mark and a restrained stacked-paper surface. No fake product imagery, handwritten SVG, emoji, CSS illustration, or placeholder card art was added.
- Copy and content: Home speaks in user terms—“Your creative desk,” “Each pile is one Set,” “Inside this Set,” and “Pull back.” Provider and architecture details remain compact metadata rather than becoming the page model.
- Icons and actions: existing Lucide action icons remain consistent with the Environment. Search, source filter, ordering, pin, details, rename, duplicate, delete confirmation, card selection, move, edit, remove, and Studio handoff remain wired.
- Accessibility: the work objects and surrounding Sets are native buttons with explicit accessible names. Source and ordering controls are labeled. Destructive actions retain confirmation. Focus indicators, reduced-motion handling, and practical mobile action targets remain intact.

No focused crop comparison was needed beyond the dedicated focused-state screenshots: the full desktop overview, desktop focus, and mobile focus make the spatial transition, type hierarchy, controls, and surrounding Set context readable at inspection size.

## Comparison history

### Pass 1 — blocked

- [P2] The initial Home revision retained a large dashboard-card frame and forced utilities below the first viewport.
- [P2] Mobile treated the featured Set like an equal half-width tile.
- [P2] The untouched bootstrap Set appeared as meaningful resumable work.

Fixes: removed the dashboard frame, improved mobile hierarchy, quieted empty state, and filtered only the exact untouched bootstrap Set.

### Pass 2 — blocked

- [P1] The work surface still read as an equal rectangular catalog.
- [P1] Focusing a Set replaced the overview with another full-width page.

Fixes: introduced unequal Set footprints, retained nearby work during focus, and added horizontal mobile work browsing.

### Pass 3 — blocked

- [P1] Fresh source/Preview comparison showed that the unequal rectangles were still cards on a page rather than visible Set piles.
- [P1] Focus still reorganized neighboring work into a left navigation rail instead of changing camera scale.
- [P2] The large filter row consumed the spatial surface and weakened authored-object hierarchy.

Fixes: made each overview object a Set stack, centered the active Set among irregular surrounding piles, collapsed filters into a compact dock, made the focused Set a central board, and positioned neighboring Sets around its edges. Mobile now keeps a compact surrounding-work strip above the focused board.

### Pass 4 — passed

The final source/implementation comparison found no remaining actionable Home P0, P1, or P2 mismatch. The overview reads as one bounded creative desk, Set identity and visible contents share one object treatment, focus behaves like moving closer, and mobile preserves both scale and surrounding context without page overflow.

## Browser and behavior checks

- Verified local overview, compact search/source/order controls, focus, surrounding-Set switching, Pull back, creation, rename, and empty Set behavior in the in-app browser.
- Verified desktop at 1280 × 720, mobile at 390 × 844, and narrow overflow safety at 320 × 800.
- Browser console was checked. Localhost reports the expected production-Clerk origin rejection and unavailable live MCP allowance lookup; no Home compile, hydration, CSS, or runtime error was observed.
- Focused Home tests, type checking, and targeted lint passed. The complete repository gate and hosted Preview proof are recorded by the implementation handoff.

## Follow-up polish

- [P3] Judge exact pile balance on Preview with real populated Sets, mixed card aspect ratios, connected-provider work, and a temporary draft. Safe empty fixtures cannot prove every real `CardPreview` combination.
- [P3] Persist user-authored Set positions only when the drag/reorder interaction has a clear accessible keyboard equivalent; this visual correction deliberately does not invent a second ordering model.

final result: passed
