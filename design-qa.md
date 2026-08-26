# CardForge Account Environment Design QA

## Evidence

- Selected Environment Foundation: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\local-foundation-source.png`
- Account Home comparison: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\account-home-design-comparison.png`
- Library desktop implementation at 1488 × 1058: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\account-environment-library-desktop.png`
- Profile desktop implementation at 1488 × 1058: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\account-environment-profile-desktop.png`
- Home, Library, locations, Profile, and billing mobile implementations at 390 × 844: `account-environment-{home,library,storage,profile,billing}-mobile.png` in the same evidence directory.
- Mobile storage detail layer at 390 × 844: `C:\Users\Pyralis\.codex\visualizations\2026\08\23\01a02f7b-56c7-7613-b5f0-d700030ea6a2\account-environment-storage-detail-mobile.png`
- Smallest checked CSS viewport: 320 × 568 at 1× browser density.

The visual alphas are hierarchy and interaction-direction references. Live screenshots use authentic signed-out/local workspace data; protected zones, personalized identity, and provider-native account controls require the signed-in Preview owner state.

## Full-view comparison

Home, Library, and Profile now share one Environment composition: a stable zone rail or compact bottom navigation, one command band, one dominant surface, aligned row/ledger groups, and a low-chrome status footer. Library locations and Profile utilities are focused layers inside their owning zone rather than peer account tabs or nested dashboard shells. The implementation keeps the dark brass product language while replacing the former long card stack with fine dividers and progressive disclosure.

## Focused comparison

- Home keeps current work, four account truths, and more work as compact rows.
- Library keeps search, source, type, and sort controls above one inventory ledger. Object metadata and actions move into the inspector or mobile sheet.
- Storage is a Library tool. Seven source owners remain comparable in one row group, while exact provider/browser actions render only for the selected owner.
- Profile rows open identity, billing, storage, Developer, and Owner destinations directly. They do not require a second pseudo-card selection step.
- Clerk and Stripe remain the native owners of sensitive identity and billing operations inside focused Profile views.
- Mobile preserves the same object hierarchy. Rows remain dense, filters collapse to two useful lines, and details sit above the fixed zone navigation.

## Required fidelity surfaces

- Typography and tokens: all zones reuse the selected Environment display/body scale, brass accent, dark surfaces, fine borders, and semantic status colors.
- Density: informational values are aligned in rows instead of isolated cards. The 390 × 844 Home and Profile overviews fit their primary groups without horizontal overflow.
- Navigation: Home, Library, Studio, and Profile remain in a stable order for guest and signed-in states. Developer and Owner remain permission-separated.
- Assets: the existing CardForge brand mark and Lucide icon family are reused. No placeholder or approximate visual asset was introduced.
- Boundary language: unavailable account/provider state is distinct from Free, signed-out, disconnected, empty, or deleted state.

## Interaction and browser checks

- Verified Home, Library, Library locations, Profile, identity, and billing routes at desktop and compact viewports.
- Verified Library filtering controls expose visible current values and accessible names.
- Verified Profile utility rows open the real focused utility directly and retain linkable URL state.
- Verified storage selection exposes exact browser/provider lifecycle children without moving or flattening their actions.
- Verified the 390 × 844 storage detail sheet sits above the fixed bottom navigation and restores the selected row as its return target.
- Verified 390 × 844 and 320 × 568 layouts have no horizontal document overflow.
- Local browser errors were limited to expected production-domain Clerk restrictions and unavailable provider-backed allowances/settings. Those hosted states must be checked on the exact Preview deployment.
- Verified the READY stable Preview with the signed-in owner account: all six permission-aware zones resolve, Google Drive reports its connected account and real project revision, billing reports Owner access without inventing a Stripe action, and the native Clerk profile/security surface renders inside the focused Profile utility.
- Rechecked Preview at 390 × 844: Home, Profile, the protected-zone overflow entry, Library locations, and the storage detail sheet preserve the same hierarchy with no horizontal overflow. The only site-origin warning is the expected Clerk development-key notice for this test lane; observed extension warnings are outside CardForge.

## Comparison history

### Account Home foundation

- [P2] The selected disclosure style targeted the retired `aria-pressed` state.
- Fix: rows and styling now share `aria-expanded`, `aria-controls`, inspector/sheet, and focus-return semantics.
- [P2] Mobile exposed desktop-only object type cells as orphaned lines.
- Fix: compact ledgers retain source context inline and hide desktop-only cells.

### Full Account environment

- [P2] Library filters rendered as four tall mobile rows and their Radix-selected text was absent in visual capture.
- Fix: source/type share one compact row, sort uses the next row, and each trigger renders an explicit current label.
- [P2] Locations and billing repeated the same back action inside the command band and content surface; locations also repeated its heading.
- Fix: the command band is the single back owner and each focused surface has one title hierarchy.
- [P2] Profile utilities behaved like selectable information cards before exposing the real action.
- Fix: compact utility rows now open their owning focused view or zone directly; Profile has no redundant detail inspector.
- [P1] The storage mobile sheet used a lower stacking layer than the fixed Environment bottom navigation.
- Fix: the sheet and overlay now sit above navigation with safe-area-aware bottom padding.

## Findings

No actionable P0, P1, or P2 visual or interaction difference remains in the verified Preview candidate.

final result: passed
