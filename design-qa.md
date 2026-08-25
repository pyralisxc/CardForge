# CardForge Account Home Design QA

## Evidence

- Source visual truth: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\local-foundation-source.png`
- Implementation: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\local-account-home-desktop.png`
- Combined comparison: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\account-home-design-comparison.png`
- Mobile implementation: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\local-account-home-mobile.png`
- Mobile detail state: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\local-account-home-mobile-detail.png`
- Post-fix selected-detail evidence: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\local-account-home-mobile-detail-final.png`
- Desktop source pixels: 1264 × 855. Desktop implementation pixels: 1264 × 768. Both were captured at the same default browser width and 1× browser density; the height difference is content-driven because the source includes a laboratory banner and simulated recent objects.
- Mobile implementation pixels and CSS viewport: 390 × 844 at 1× density.
- State: approved Home recipe with simulated owner data compared against the live local Account Home with real signed-out/local workspace data. Permission-specific zone count, greeting, and object content are expected data-state differences.

## Full-view comparison

The implementation preserves the selected Environment Foundation composition: narrow zone rail, compact command band, one primary surface, fine-divided current-work/account/more-work groups, low-chrome status footer, and the same dark brass product tokens. No major-region proportion, density, overflow, or hierarchy mismatch remains.

## Focused comparison

The compact current-work row, four account truth rows, selected-row treatment, desktop inspector, and mobile bottom sheet were inspected separately because their text and interaction state are too small to judge from the combined full view. Mobile keeps the same hierarchy in 48–55 px rows and does not turn status information into oversized cards.

## Required fidelity surfaces

- Fonts and typography: the implementation reuses the exact CardForge display/body tokens and Environment component weights, sizes, line heights, and tracking. Mobile headings and labels wrap without clipping.
- Spacing and layout rhythm: command, section, row, footer, inspector, and sheet spacing match the shared Foundation components. The real Home is shorter only because its real local state has no additional recent objects.
- Colors and visual tokens: implementation and source use the same canvas, inset surface, brass accent, border, success, warning, and muted-text tokens. Contrast and state meaning are not color-only.
- Image quality and asset fidelity: both use the existing CardForge brand-mark asset and Lucide icon set already selected for the Foundation. No placeholder, generated, CSS-drawn, or approximate logo asset was introduced.
- Copy and content: fixture language was replaced with authentic account, storage, source, and temporary-work wording. CardForge Cloud is explicitly labeled as retiring rather than presented as the long-term storage direction.

## Interaction and browser checks

- Opened and closed the current Set detail through the row.
- Confirmed `aria-expanded`, `aria-controls`, inspector visibility, close behavior, and focus-return target.
- Confirmed the real `Open in Studio` action resolves for the active device Set.
- Confirmed desktop inspector and mobile bottom-sheet composition.
- Checked browser logs. The only errors were expected localhost provider-environment failures from production Clerk/Supabase-backed settings and allowances; no new Account Home rendering or interaction exception appeared.

## Comparison history

### Iteration 1

- [P2] Selected disclosure styling still targeted the former `aria-pressed` attribute after the row semantics were corrected to `aria-expanded`.
- Fix: linked rows to `environment-detail-panel` with `aria-controls`, kept `aria-expanded` as the disclosure truth, and updated selected-row CSS selectors to the same state.
- Post-fix evidence: the selected Set retains the Foundation highlight while the desktop inspector/mobile sheet is open, and the state returns to false after close.

## Findings

No actionable P0, P1, or P2 visual or interaction differences remain in this cut.

## Follow-up polish

- [P3] Verify the personalized greeting and full Home/Library/Profile/Developer/Owner rail with the signed-in Preview owner identity; localhost intentionally cannot authenticate against the production Clerk domain.

final result: passed
