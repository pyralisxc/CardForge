# Preset Quality Audit

Date: 2026-05-24

Live sanity checkpoint: 2026-05-25

## Implementation Checkpoint

The first consolidation pass now separates Shape Studio into two lanes:

- **Blank Primitives** are local editor tools. They create/reset rectangle, ellipse, capsule, diamond, hexagon, banner, notch-panel, bracket-frame, corner-frame, and line shapes without contributor or voting metadata.
- **Pipeline Recipes** are typed `ElementPresetRecipe` seeds in `src/lib/elementPresetRecipes.ts`. Current shape role recipes are owner-seeded, published, official presets with applicability metadata, contributor display, and tier/status fields.

This is the pattern to reuse for text frames, borders, icon styles, divider recipes, and frame kits.

The second consolidation pass applies that pattern across the high-visibility preset families:

- **Text frame, border, icon, divider, and frame-kit offerings** now flow through typed `ElementPresetRecipe` records instead of raw button-local update blobs.
- **Registry appearance styles** from `/api/styles` are converted into typed recipe records, so database-backed `elementPreset` style payloads can show in the same UI language as owner-seeded recipes.
- **Recipe controls now expose status and tier badges** in the maker, with simple visual swatches/previews where the source data supports it.
- **Text elements can use texture assets** because the text capability set now includes `texture`, matching the texture asset metadata that already allowed text targets.
- **Icon recipes preserve uploaded/custom icon art** and only apply style treatment when a custom icon source is already selected.
- **Image and icon elements now expose real pipeline asset pickers** and render relative `/card-assets/...` URLs in both the maker and preview surfaces.
- **The extra left-rail parts catalog was removed** because image-like parts are source assets, not another element category.
- **Registry appearance styles now require exact element targets** in the active Appearance Studio lane, so broad `element` tags no longer make unrelated controls appear on icon/divider workflows.
- **Seeded and registry-backed recipes dedupe by kind and label**, preferring registry-backed versions when both represent the same offering.
- **File-backed part assets now flow into the normal Image Assets picker**, keeping the left rail focused on primitives and the inspector focused on selected-element sources.
- **Appearance Studio has been renamed Material & Effects**, and the selected-element inspector now flows from source/content to style, material, frame/border, and layout.

## Summary

The Layout Studio preset system is useful, but it is not yet the seamless developer makerspace model CardForge is aiming for. The editor has a good capability gate in `src/lib/elementCapabilities.ts`, and the asset registry now supports database-backed textures, dividers, icons, images, parts, templates, and `elementPreset` records. The weak spot is that most visible maker presets still come from hardcoded `Partial<FreeformCardElement>` arrays in `src/components/card-forge/makerConstants.tsx`.

That hardcoded shape makes the UI feel powerful but fuzzy: a preset can mutate any element field without declaring what role, surface, asset kind, contributor, tier, preview, or review status it belongs to. For a professional developer pipeline, every offered preset needs to be either a local primitive control or a pipeline-backed recipe with clear applicability metadata.

Overall grade: B-

## Development Grades

| Area | Grade | Evidence | Target |
| --- | --- | --- | --- |
| Pipeline centralization | C | `/api/assets`, `/api/templates`, and `/api/styles` are registry-aware, and image-like part assets now flow through the image source picker. Some maker presets remain hardcoded constants. | Pipeline should own all offerable creative recipes, with hardcoded seeds only as offline fallback. |
| Element applicability | C | Panels are gated by element capabilities, but preset records do not declare element type, role, surface, or conflict behavior. | Presets should be filtered by `elementType`, `role`, `surface`, and `assetKind/styleKind`. |
| Visible user value | B- | Text frames, divider assets, symbol presets, and shape role presets visibly change cards. Generic style and shape presets are weaker. | Keep high-signal recipes; remove or demote presets that only resize/recolor without a clear element-specific purpose. |
| Developer ownership | D+ | Registry supports `elementPreset`, but Layout Studio preset buttons do not load from developer submissions yet. | Developer-created, owner-seeded, and archived presets should all live in the same review/voting model. |
| UX clarity | B- | The inspector now follows Source & Content, element builder/style, Material & Effects, Frame & Border, and Layout & Layer. Some panel internals still mix source and styling. | Keep splitting source assets, style recipes, material editing, and layout controls into clearer lanes. |
| Render correctness | B | Recent border and structured-row work improved real output. The remaining issue is less "does it render" and more "does the control belong here." | Add applicability tests and visual QA for each preset family. |

## Preset Family Findings

| Preset family | Current source | Appears on | Actual effect | Quality grade | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Element kits | `CONSOLIDATED_ELEMENT_KITS` in `makerConstants.tsx` | New element library | Creates basic text, image, icon, shape, and divider elements. | B | Keep primitive element creation local; source assets belong in the relevant inspector picker. |
| Appearance quick styles | `ELEMENT_STYLE_PRESETS` in `makerConstants.tsx` | Text and shape Material & Effects | Applies broad color, fill, background image, border, and radius values. | C | Demote or replace with pipeline-backed material recipes. Broad "element" styling is too vague for the main workflow. |
| Appearance style library | `DEFAULT_APPEARANCE_LIBRARY`, `data/styles/`, `/api/styles` | Text, shape, divider, icon where exact targets match | Applies structured `FreeformAppearance` objects. | B+ | Primary filtering now requires exact targets; next pass should improve labels/previews and contributor provenance. |
| Border presets | `BORDER_PRESET_RECIPES` in `src/lib/elementPresetRecipes.ts` plus registry styles | Text, image, icon, shape | Applies border width/color/radius and sometimes background image. | B | Typed recipe lane is in place with badges/previews; next step is richer registry provenance. |
| Shape presets | Retired from primary UI | Shape Studio no longer shows this lane | Previously changed primitive geometry, width, height, and a few colors. | C- | Replaced by local Blank Primitives plus typed Pipeline Recipes. |
| Shape role presets | `SHAPE_ROLE_PRESET_RECIPES` in `src/lib/elementPresetRecipes.ts` | Shape Studio Pipeline Recipes | Applies semantic roles plus structured appearance recipes. | B+ | First typed seed lane is in place. Next step is loading registry-backed developer recipes into the same model. |
| Divider quick presets | `DIVIDER_PRESET_RECIPES` in `src/lib/elementPresetRecipes.ts` plus registry styles | Divider Studio | Applies gradient divider bars to divider-shaped elements. | B | Typed divider recipes now explicitly preserve divider role and show status/tier badges. |
| Divider assets | `/api/assets` plus local uploads | Divider Appearance Studio | Applies real uploaded/shipped divider art to divider elements. | A- | This is closest to the desired model. Add source/tier/status badges and voting provenance in picker UI. |
| Symbol presets | `ICON_STYLE_PRESET_RECIPES` in `src/lib/elementPresetRecipes.ts` plus registry styles | Icon Inspector | Sets icon palette/backplate; Lucide icon recipes no longer wipe uploaded icon art. | B | Typed icon recipes are in place with conflict-safe application for custom uploads. |
| Icon assets | `/api/assets` plus local uploads | Icon Inspector | Applies uploaded/shipped icon art and renders relative shipped asset URLs. | A- | Needs clearer source/tier/status and developer contributor badges in the picker. |
| Image assets | `/api/assets` plus local uploads | Image Inspector | Applies shipped/pipeline image assets to image elements and updates the rendered preview source. | A- | Add upload controls and contributor/tier/status badges matching the icon picker. |
| Text frame presets | `TEXT_FRAME_PRESET_RECIPES` in `src/lib/elementPresetRecipes.ts` plus registry styles | Typography Inspector | Applies useful text-panel backgrounds, borders, padding, and typography. | B+ | Typed recipe lane is in place; next step is richer live thumbnails and contributor provenance from registry rows. |
| Frame kits | `createFrameKitPresetRecipes` over `CARD_FRAME_KITS` | Template-level frame updates | Applies full-template frame art and card-level colors. | B+ | Now uses the same recipe/badge pattern; next step is a dedicated registry-backed `frameKit` or template-canvas recipe payload. |
| Global frame styles | `FRAME_STYLES` and template visual properties | Template style controls | Applies older whole-card theme values. | C | Keep only as advanced/legacy until frame kits and template presets fully replace it. |
| Texture asset picker | `/api/assets` plus local uploads | Text and shape Material & Effects | Applies registry texture assets to supported element appearance. | B | Text now has the `texture` capability; next pass should split decorative material recipes from raw texture asset selection more clearly. |

## Main Bugs And Friction

1. Panel organization still overlaps too much

   Text is improved but still has the most confusing surface area: typography, text frame recipes, Material & Effects, and border recipes can all affect what feels like "the text box." The next UX pass should split source, text style, text box, and material details inside the panels themselves.

2. Broad recipe semantics still need product decisions

   Exact target matching is now in place for Appearance Studio, but some official registry rows still carry broad targets such as `text`, `shape`, and `element`. Those assets should be reviewed as product offerings: either split them into role-specific recipes or keep them as material recipes with clearer names.

3. Registry provenance is still generic

   Hydrated registry recipes currently display `Registry Pipeline` instead of a real contributor profile. The UI has status/tier/source fields, but the API still needs contributor display names and review/voting metadata for professional developer ownership.

4. Local primitive tools and pipeline recipes still need clearer separation

   Shape primitives are now separated from Pipeline Recipes, and the left rail is back to primitives instead of acting like another asset browser. The remaining work is to apply that same language everywhere: local controls are tools, offerable creative defaults are pipeline assets.

5. Current site defaults are only partly honored as developer assets in the maker

   Many default-feeling options now hydrate through recipe records or registry styles, but the owner/default status is not yet visible as a true developer profile with vote/archive/recovery behavior in every picker.

## Live Testing Notes

The latest browser-driven sanity check verified:

- The left element rail is primitives-only; `Library Components`, `Card Part Catalog`, and `Asset Catalog` labels are gone.
- Image-like part assets appear through the selected image element's Image Assets picker instead of clogging the element rail.
- A selected text element shows Source & Content, Text Style, Material & Effects, Frame & Border, and Layout & Layer; the old `Appearance Studio` label is gone.
- Image elements expose `Image Assets`; selecting `Arcane Landscape` renders `/card-assets/images/arcane-landscape.svg`.
- Icon elements expose `Icon Assets`; selecting `Arcane Star` renders `/card-assets/icons/arcane-star.svg`.
- Icon Appearance Studio still shows relevant icon-targeted styles such as `Fire Relic Icon` and `Purple Foil`, while broad text-frame styles such as `Gilded Relic Frame` and `TTRPG Vellum Frame` no longer appear on icon selection.

## Recommended Makerspace Model

Use three lanes, not one pile of buttons:

| Lane | Owned by | Examples | Voting/pipeline |
| --- | --- | --- | --- |
| Local editor controls | Product code | position, size, z-index, primitive shape, raw colors, font family, alignment, padding, border width | No voting. These are tools, not assets. |
| Pipeline recipes | Developer asset registry | text frames, icon styles, divider recipes, shape roles, border treatments, frame kits | Yes. Owner defaults and developer uploads use the same voting, archive, and recovery loop. |
| User-local assets | Browser/project storage | paid/free user uploads that are not submitted to developer program | No public voting unless explicitly submitted into the developer pipeline. |

## Element Preset Contract Target

Every pipeline-backed preset should carry at least:

```ts
type ElementPresetKind =
  | 'textFrame'
  | 'borderTreatment'
  | 'iconStyle'
  | 'dividerRecipe'
  | 'shapeRole'
  | 'frameKit'
  | 'cardPart'
  | 'material';

type ElementPresetApplicability = {
  elementTypes: Array<'text' | 'image' | 'icon' | 'shape' | 'template'>;
  roles?: string[];
  surfaces?: Array<'textPanel' | 'shapeFill' | 'shapeStroke' | 'iconGlyph' | 'iconBackplate' | 'dividerRail' | 'imageFrame' | 'templateCanvas'>;
  requiredCapabilities?: string[];
};
```

The applied payload can still be a `Partial<FreeformCardElement>` or `Partial<TCGCardTemplate>` at first, but it needs metadata around it so the UI can filter, explain, preview, badge, and vote on it.

## Next Implementation Slice

1. Add contributor/status/tier provenance to `/api/styles` payloads so hydrated registry recipes can show the real developer name instead of `Registry Pipeline`.
2. Replace broad `ELEMENT_STYLE_PRESETS` with typed material recipes, or keep them only as a legacy fallback.
3. Add live thumbnail rendering for text, border, icon, divider, and frame-kit recipes.
4. Hydrate dedicated registry-backed frame-kit/card-part recipes instead of adapting local frame kit constants.
5. Expand smoke coverage for recipe application in the rendered Layout Studio.

## Decision

The professional direction is to keep local primitive controls local, but make every offered creative recipe a developer-pipeline asset. A default asset should not get special treatment; it should simply be an owner-seeded, published, voteable asset with the same badges, archive behavior, and recovery path as everything else.
