# Home Spatial Desk Design QA

## Evidence

- Source visual truth: `C:\My Files\CardForge\assets\brand\cardforge-studio\concepts\home-current.webp` (1024 × 512 reference board; desktop and phone shown together).
- Final desktop implementation: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\home-spatial-desk-desktop.png` (1280 × 720 screenshot at a 1280 × 720 CSS viewport, 1× browser density).
- Final mobile implementation: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\home-spatial-desk-mobile.png` (390 × 844 screenshot at a 390 × 844 CSS viewport, 1× browser density).
- Narrow implementation: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\home-spatial-desk-320.png` (305 × 541 captured content after setting a 320 × 568 in-app-browser viewport; browser scroll chrome accounts for the captured-pixel difference).
- Focused-work desktop state: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\home-spatial-desk-focused-desktop.png` (1280 × 720).
- First-pass compact state: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\home-spatial-desk-mobile-before.png` (390 × 844).

The reference board contains authored card imagery and multiple populated work objects. The browser evidence deliberately uses the authentic signed-out local state, which contains only the untouched bootstrap Set. The final implementation correctly treats that bootstrap record as no meaningful work. Fidelity judgments therefore compare shell, hierarchy, density, spatial behavior, responsive composition, and empty-state quality rather than pretending the two artifacts show identical content.

## Full-view comparison

The reference establishes a dark brass creative environment, stable zone navigation, one dominant working surface, asymmetrical authored-object emphasis, and a compact mobile translation. The implementation preserves that grammar with the existing CardForge serif/body typography, tokens, brand mark, Lucide action family, restrained dividers, and a constrained Desk. Home no longer reads as a stack of account cards or a file manager. Authored work receives the only substantial object treatment; utilities remain a compact lower strip.

The final empty state occupies the working surface without enclosing the entire page in another bordered card. When real work exists, the grid gives the first/pinned/current object greater weight, renders up to three canonical `CardPreview` images, and uses source imagery only as a semantic fallback. The mobile featured object spans the available width instead of becoming a cramped half tile.

## Focused comparison

- Typography: display and UI type reuse the approved CardForge font tokens. Heading, supporting copy, filter labels, object titles, and utility text retain clear optical hierarchy at desktop, 390 px, and 320 px widths.
- Spacing/layout: desktop keeps the command band, orientation line, organization controls, work surface, and quiet utilities within one application viewport. Mobile rearranges the same hierarchy without horizontal content overflow; the 320 px state wraps source filters to two rows and retains reachable fixed navigation.
- Colors/tokens: the implementation uses existing canvas/surface/brass/border/status tokens and no gradients or decorative palette additions. Contrast remains consistent with the Environment foundation.
- Image quality/assets: real authored cards use the canonical `CardPreview` renderer. The existing CardForge brand mark and approved Lucide icons are reused. No fake product image, CSS illustration, handcrafted SVG, emoji, or placeholder art was introduced.
- Copy/content: Home uses outcome language—“Your creative desk,” “Open work,” and “Everything here is one work container”—instead of architecture labels. Set remains the current creation label while Project remains a provider/package synonym, not a second hierarchy.
- Interactions: search, source filters, sort, pinning, details, creation, work focus/back, rename, duplicate, confirmed delete, card search/select/move/edit/confirmed removal, and Studio/source handoff are wired. Focused work preserves the Desk as the return context.
- Accessibility: controls have semantic labels, pressed/selected state where needed, 44 px-class compact targets, keyboard-native buttons/inputs/selects, destructive confirmations, reduced-motion handling, and responsive inspector/sheet behavior from the shared Environment shell.

No additional crop comparison was needed: the desktop and mobile full-view captures make the important navigation, controls, typography, object/empty surface, and fixed mobile navigation readable. The focused-work capture separately verifies the second scale of the interaction.

## Comparison history

### Pass 1 — blocked

- [P2] The desktop work surface used a large bordered panel with a 28 rem minimum height, so the account utility strip fell below the initial viewport and the Desk still read like a page-sized card.
- [P2] At 390 px the featured work object was forced into the same half-width column as secondary work, making the primary object cramped and unlike the reference’s mobile hierarchy.
- [P2] The untouched bootstrap `Untitled Set` appeared as resumable authored work even though it contained no cards or user intent.

Fixes: removed the surrounding work-surface border, reduced forced height, changed the work layout to an asymmetric constrained grid, made the mobile featured object full-width, quieted the empty surface, and filtered only the exact untouched bootstrap Set. Product copy and living docs were also consolidated around one authored-work container.

### Pass 2 — passed

The final desktop, 390 px, and 320 px evidence shows the utility strip returning to the desktop viewport, full-width featured/empty hierarchy on mobile, no bootstrap false-resume object, and no surrounding dashboard-card frame. Direct source/implementation comparison found no remaining actionable P0, P1, or P2 mismatch. The populated reference remains an intentional content-state difference; the implementation path for populated work uses canonical previews and is protected by focused component/store tests.

## Browser and behavior checks

- Verified the Home overview structure, filter/sort controls, authentic empty state, and account utility destinations in the in-app browser.
- Verified the work-focus → contained-card view → Back to desk interaction before suppressing the untouched bootstrap object.
- Verified responsive layout at 1280 × 720, 390 × 844, and 320 × 568 requested CSS viewports.
- Browser/server console was checked. Localhost reports expected production-Clerk origin rejection and unavailable live-provider fetches; the route falls back through existing boundaries and no Home compile/runtime error was observed.
- Focused tests cover Home ownership/composition and Set/card mutations; the complete repository gate is recorded separately by the implementation handoff.

## Follow-up polish

- [P3] Recheck the exact masonry balance on Preview with several real Sets, mixed card aspect ratios, a Drive project, and a temporary draft. The authentic local empty state cannot visually prove every populated combination.
- [P3] Choose the final public noun for the one work container after using Set/Project language with real users; do not change the schema or create a parent object merely to settle copy.

final result: passed
