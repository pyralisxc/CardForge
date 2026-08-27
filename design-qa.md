# Home Spatial Desk Design QA

## Evidence

- Source visual truth: `C:\My Files\CardForge\assets\brand\cardforge-studio\concepts\home-current.webp` (1024 × 512 reference board; desktop and phone shown together).
- Final desktop overview: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\home-spatial-revision\03-overview-sized.png` (1280 × 720 screenshot at a 1280 × 720 CSS viewport, 1× browser density).
- Final desktop focus: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\home-spatial-revision\02-focused-desktop.png` (1280 × 720 at the same viewport).
- Final mobile overview: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\home-spatial-revision\05-overview-mobile-fixed.png` (390 × 844 screenshot at a 390 × 844 CSS viewport, 1× browser density).
- Final mobile focus: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\home-spatial-revision\06-focused-mobile.png` (390 × 844 at the same viewport).
- Narrow implementation: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\home-spatial-revision\07-overview-320.png` (320 × 800 screenshot at a 320 × 800 CSS viewport, 1× browser density).
- Superseded first mobile pass: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\home-spatial-revision\04-overview-mobile.png` (390 × 844; retained as the pre-fix comparison).

The reference board contains authored card imagery and multiple populated work objects. The local browser evidence uses three safe, empty browser-only Sets created solely to exercise the spatial composition without altering provider data. Fidelity judgments therefore compare shell, hierarchy, density, spatial behavior, responsive composition, and focus/return behavior. Populated `CardPreview` combinations remain a hosted-data check rather than being simulated with fake imagery.

## Full-view comparison

The reference establishes a dark brass creative environment, stable zone navigation, one dominant working surface, asymmetrical authored-object emphasis, and a compact mobile translation. The implementation preserves that grammar with the existing CardForge serif/body typography, tokens, brand mark, Lucide action family, restrained dividers, and a constrained Desk. Home no longer reads as a stack of account cards or an equal-tile file manager. Sets occupy deliberately different footprints and positions on one surface; utilities remain a compact lower strip.

The overview gives current/first work greater visual weight and staggers secondary work without introducing a freeform infinite canvas. When cards exist, each Set renders up to three canonical `CardPreview` images; empty work uses a source-owned packet treatment only as a semantic fallback. Mobile translates the same model to a horizontal snap desk with the next Set peeking into view.

## Focused comparison

- Typography: display and UI type reuse the approved CardForge font tokens. Heading, supporting copy, filter labels, object titles, and utility text retain clear optical hierarchy at desktop, 390 px, and 320 px widths.
- Spacing/layout: desktop keeps orientation, organization controls, work surface, and quiet utilities within one application viewport. Selecting a Set expands it beside a compact nearby-work rail instead of replacing Home. Mobile rearranges the desk into horizontal object browsing and the focused state into a nearby-work strip over the expanded Set. At both 390 px and 320 px, document scroll width equals viewport width.
- Colors/tokens: the implementation uses existing canvas/surface/brass/border/status tokens and no gradients or decorative palette additions. Contrast remains consistent with the Environment foundation.
- Image quality/assets: real authored cards use the canonical `CardPreview` renderer. The existing CardForge brand mark and approved Lucide icons are reused. No fake product image, CSS illustration, handcrafted SVG, emoji, or placeholder art was introduced.
- Copy/content: Home uses outcome language—“Your creative desk,” “Open work,” and “Everything here is one work container”—instead of architecture labels. Set remains the current creation label while Project remains a provider/package synonym, not a second hierarchy.
- Interactions: search, source filters, sort, pinning, details, creation, work focus/back, nearby-work switching, rename, duplicate, confirmed delete, card search/select/move/edit/confirmed removal, and Studio/source handoff are wired. Focused work preserves neighboring Sets and the Desk as the return context.
- Accessibility: controls have semantic labels, pressed/selected state where needed, 44 px-class compact targets, keyboard-native buttons/inputs/selects, destructive confirmations, reduced-motion handling, and responsive inspector/sheet behavior from the shared Environment shell.

No additional crop comparison was needed: the desktop and mobile full-view captures make the important navigation, controls, typography, object/empty surface, and fixed mobile navigation readable. The focused-work capture separately verifies the second scale of the interaction.

## Comparison history

### Pass 1 — blocked

- [P2] The desktop work surface used a large bordered panel with a 28 rem minimum height, so the account utility strip fell below the initial viewport and the Desk still read like a page-sized card.
- [P2] At 390 px the featured work object was forced into the same half-width column as secondary work, making the primary object cramped and unlike the reference’s mobile hierarchy.
- [P2] The untouched bootstrap `Untitled Set` appeared as resumable authored work even though it contained no cards or user intent.

Fixes: removed the surrounding dashboard-card treatment, reduced forced height, introduced the constrained Desk, improved mobile hierarchy, quieted the empty surface, and filtered only the exact untouched bootstrap Set.

### Pass 2 — blocked

The first constrained implementation remained too regular: equal rectangular work tiles read as a catalog, and focus replaced the overview with another full-width page. Direct source/implementation comparison therefore still found a [P1] mismatch in the core spatial behavior.

Fixes: made Set objects uneven in scale and placement, removed tile-container dominance, kept nearby work visibly present during focus, expanded the active Set within the same plane, and made mobile browsing horizontally spatial rather than a stacked grid.

### Pass 3 — passed

The final desktop comparison shows three Sets occupying one bounded plane with clear primary/secondary weight. The focused comparison shows the selected Set expanded while neighboring Sets remain visible and actionable. The 390 px and 320 px evidence shows the same model translated to swipeable work objects and a compact nearby-work strip without page overflow. Direct source/implementation comparison found no remaining actionable Home P0, P1, or P2 mismatch. Populated Preview data remains the appropriate release-level proof for exact `CardPreview` balance.

## Browser and behavior checks

- Verified the Home overview structure, filter/sort controls, safe browser-only Set creation/rename, and account utility destinations in the in-app browser.
- Verified overview → focused Set → nearby Set switch → Back to desk while preserving spatial context.
- Verified responsive layout at 1280 × 720, 390 × 844, and 320 × 800 requested CSS viewports.
- Browser/server console was checked. Localhost reports expected production-Clerk origin rejection and unavailable live-provider fetches; the route falls back through existing boundaries and no Home compile/runtime error was observed.
- Focused tests cover Home ownership/composition and Set/card mutations; the complete repository gate is recorded separately by the implementation handoff.

## Follow-up polish

- [P3] Recheck the exact spatial balance on Preview with several real Sets, mixed card aspect ratios, a Drive project, and a temporary draft. The safe local fixtures cannot visually prove every populated combination.
- [P3] Choose the final public noun for the one work container after using Set/Project language with real users; do not change the schema or create a parent object merely to settle copy.

final result: passed
