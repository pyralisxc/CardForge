# Environment Foundation Design QA

## Result

Final result: passed

## Sources and implementation evidence

- Home reference: `assets/brand/cardforge-studio/concepts/home-zone-alpha.png` — 1484 × 1060.
- Profile reference: `assets/brand/cardforge-studio/concepts/profile-zone-alpha.png` — 1487 × 1058.
- Studio reference: `assets/brand/cardforge-studio/concepts/studio-set-desk-alpha.png` — 1487 × 1058.
- Desktop implementation: `C:/Users/Pyralis/.codex/visualizations/2026/08/23/01a02f7b-56c7-7613-b5f0-d700030ea6a2/environment-lab-home-1484x1060-final.png` — 1484 × 877 captured browser area at the reference width.
- Tablet master/detail: `C:/Users/Pyralis/.codex/visualizations/2026/08/23/01a02f7b-56c7-7613-b5f0-d700030ea6a2/environment-lab-library-tablet-foundation.png` — 900 × 1024 requested viewport.
- Mobile Home: `C:/Users/Pyralis/.codex/visualizations/2026/08/23/01a02f7b-56c7-7613-b5f0-d700030ea6a2/environment-lab-home-mobile-320x568-verified.png` — 320 × 568 requested viewport; 305 × 541 browser content area.
- Mobile detail: `C:/Users/Pyralis/.codex/visualizations/2026/08/23/01a02f7b-56c7-7613-b5f0-d700030ea6a2/environment-lab-home-mobile-detail-320x568-verified.png` — 320 × 568.
- Guest Studio: `C:/Users/Pyralis/.codex/visualizations/2026/08/23/01a02f7b-56c7-7613-b5f0-d700030ea6a2/environment-lab-guest-studio-mobile-final.png` — 320 × 568 requested viewport.
- Short landscape: `C:/Users/Pyralis/.codex/visualizations/2026/08/23/01a02f7b-56c7-7613-b5f0-d700030ea6a2/environment-lab-home-landscape-844x390.png` — 844 × 390.

The source and implementation were opened together for direct comparison. The Home comparison used the exact reference width; the in-app browser capped the available capture height below the 1060-pixel reference height, so the focused density and navigation comparison uses the complete visible implementation plus the mobile captures.

## Compared state

- Owner-mode Home, default selection, command band visible.
- Library with a Google Drive project selected and the responsive detail surface open.
- Profile grouped settings.
- Studio Set Desk.
- Signed-out Guest Studio.
- Mobile account snapshot and Plan progressive-disclosure sheet.

## Five fidelity surfaces

1. Structure: passed. Zone rail, command band, primary surface, detail surface, and footer retain the concept hierarchy. Mobile transforms to a bottom zone bar and modal sheet.
2. Visual language: passed. Existing CardForge canvas, warm gold accent, serif headings, border rhythm, icon family, and real brand/card assets are preserved.
3. Density: passed. The concept's large Home hero is intentionally replaced by the approved compact-row direction. At 320 × 568, Account snapshot rows are 48 pixels high and grouped rather than presented as large cards.
4. Responsive behavior: passed. No horizontal overflow at 320 × 568, 900 × 1024, or 844 × 390. The mobile sheet contains the primary object action, layers above navigation, closes with Escape, and restores row focus.
5. Product semantics: passed. Provider/source labels remain visible; role-specific actions do not leak; Guest Studio exposes only Studio; boundary states preserve available work; simulation data is unmistakably labeled.

## Focused region comparison

The mobile Account snapshot was compared separately because it is the explicit correction target. The final layout shows compact Plan, Storage, Connections, and Security rows in one grouped ledger, with values visible inline and secondary explanation removed from the collapsed mobile row. Detail and customization are revealed in the bottom sheet.

## Comparison history

- P0: none.
- P1 resolved: large mobile information cards; overlapping navigation; command-band wrapping; mobile primary actions hidden behind detail; false recipe-wide actions; invented MCP tool names; authenticated MCP claims for Guest Studio; private Lab types leaking into reusable components; custom dialog/menu focus behavior; hidden/disabled action leakage; missing guest proof; missing context restoration; desktop page hidden by an always-open Radix modal.
- P2 resolved: simulation notice, preview-only route isolation, visible source location, 320-pixel overflow, protected-zone menu, boundary vocabulary sampler, tablet command layout, compact mobile values.
- Remaining intentional difference: this foundation follows the approved compact information model instead of recreating the alpha Home hero card. That difference is the purpose of this iteration, not a fidelity miss.

## Interaction and accessibility verification

- Zone navigation: Home, Library, Studio, Profile, Developer, and Owner.
- Protected mobile zones: Radix dropdown.
- Library search and partial-provider retry affordance.
- Object-specific and role-specific primary/supporting actions.
- Owner publication actions present only for Owner review objects.
- Guest/Owner laboratory switch and full-width single-destination Guest Studio mobile nav.
- Radix mobile sheet: focus containment, Escape close, primary action parity, row-focus restoration.
- Per-zone selection/detail restoration across zone switches.
- Boundary sampler: loading, empty, authentication, authorization, invalid, conflict, not found, limit, unavailable, and offline.
- Reduced-motion CSS and status text/icon redundancy.

## Console check

A clean browser tab showed no current Environment Lab runtime or component error. Localhost records the known Clerk production-key origin rejection because the repository uses `cardforges.com` production Clerk keys; this is outside the fixture-only Lab and must be checked again on Vercel Preview. Historical Fast Refresh errors from intermediate edits were excluded by using a clean verification tab. The dev-only Next issue badge seen in mobile screenshots is caused by that same localhost Clerk origin rejection and is not part of the product UI.
