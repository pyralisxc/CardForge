# Preset Quality Audit

Date: 2026-05-24

Live sanity checkpoint: 2026-05-25

## Implementation Checkpoint

The first consolidation pass now separates Shape Studio into two lanes:

- **Blank Primitives** are local editor tools. They create/reset rectangle, ellipse, capsule, diamond, hexagon, banner, notch-panel, bracket-frame, corner-frame, and line shapes without contributor or voting metadata.
- **Pipeline Recipes** are typed `ElementPresetRecipe` records in `src/lib/elementPresetRecipes.ts`. Current shape role recipes are starter pipeline recipes with applicability metadata, contributor display, and tier/status fields.

This is the pattern to reuse for text frames, borders, icon styles, divider recipes, and frame kits.

The second consolidation pass applies that pattern across the high-visibility preset families:

- **Text frame, border, icon, divider, and frame-kit offerings** now flow through typed `ElementPresetRecipe` records instead of raw button-local update blobs.
- **Registry appearance styles** from `/api/styles` are converted into typed recipe records, so database-backed `elementPreset` style payloads can show in the same UI language as starter recipes.
- **Recipe controls now expose status and tier badges** in the maker, with simple visual swatches/previews where the source data supports it.
- **Text elements can use texture assets** because the text capability set now includes `texture`, matching the texture asset metadata that already allowed text targets.
- **Icon recipes preserve uploaded/custom icon art** and only apply style treatment when a custom icon source is already selected.
- **Image and icon elements now expose real pipeline asset pickers** and render relative `/card-assets/...` URLs in both the maker and preview surfaces.
- **The extra left-rail image/overlay catalog was removed** because image-like overlays are source assets, not another element category.
- **Registry appearance styles now require exact element targets** in the active Appearance Studio lane, so broad `element` tags no longer make unrelated controls appear on icon/divider workflows.
- **Seeded and registry-backed recipes dedupe by kind and label**, preferring registry-backed versions when both represent the same offering.
- **File-backed image/overlay assets now flow into the normal Image & Overlay Source Assets picker**, keeping the left rail focused on primitives and the inspector focused on selected-element sources.
- **Appearance Studio has been renamed Material & Effects**, and the selected-element inspector now flows from source/content to style, material, frame/border, and layout.
- **Frame & Border has become Frame & Edge**, with element-specific language for text boxes, image frames, icon backplates, and shape strokes. Non-divider border controls no longer also live inside Material & Effects, so the edge workflow has one primary home.
- **Named edge styles now render distinctly**: etched, relic, and foil borders add real inset/outer visual treatment instead of collapsing to a plain solid line. Shape edges map to shape stroke, while icon backplate edges preserve icon glyph stroke.
- **The neighboring inspector cleanup pass reduced duplicate ownership**: image source controls now live together in Image Source, Text Style no longer owns text-box fill/edge colors, Shape Builder no longer owns fill/stroke controls, image frame color moved out of the image panel, and built-in icon glyph controls hide when an uploaded icon image is active.
- **The follow-up inspector pass made remaining controls more honest**: local material presets now update structured appearance material fields instead of overwriting text/edge fields, divider `Asset Fit` only appears for asset-backed dividers, and the transform panel now says `Layer` instead of `Z`.
- **Primitive shapes now render through shared inline SVG geometry** in both Layout Studio and generated previews. Developer-uploaded SVG files still flow through the normal asset pipeline as icon/image/divider assets; local primitive shape code remains an editor tool, not a separate asset folder.

## Summary

The Layout Studio preset system is useful, but it is not yet the seamless developer makerspace model CardForge is aiming for. The editor has a good capability gate in `src/lib/elementCapabilities.ts`, and the asset registry now supports database-backed textures, dividers, icons, images, image/overlay source assets, templates, and `elementPreset` records. The weak spot is that remaining legacy maker element kits and style presets still come from hardcoded `Partial<FreeformCardElement>` arrays in `src/features/template-editor/lib/elementKits.tsx` and `src/features/template-editor/lib/elementStylePresets.ts`.

That hardcoded shape makes the UI feel powerful but fuzzy: a preset can mutate any element field without declaring what role, surface, asset kind, contributor, tier, preview, or review status it belongs to. For a professional developer pipeline, every offered preset needs to be either a local primitive control or a pipeline-backed recipe with clear applicability metadata.

Overall grade: B-

## Development Grades

| Area | Grade | Evidence | Target |
| --- | --- | --- | --- |
| Pipeline centralization | B- | `/api/assets`, `/api/templates`, and `/api/styles` are registry-backed, and image/overlay source assets now flow through the image source picker. Some maker primitives/tool presets remain local constants. | Pipeline should own all offerable creative recipes; local constants should be primitives/tools, not hidden default catalogs. |
| Element applicability | C | Panels are gated by element capabilities, but preset records do not declare element type, role, surface, or conflict behavior. | Presets should be filtered by `elementType`, `role`, `surface`, and `assetKind/styleKind`. |
| Visible user value | B- | Text frames, divider assets, symbol presets, and shape role presets visibly change cards. Generic style and shape presets are weaker. | Keep high-signal recipes; remove or demote presets that only resize/recolor without a clear element-specific purpose. |
| Developer ownership | C | Registry supports `elementPreset`, pipeline starter content is imported as Cameron-owned submissions, and recipes expose status/tier/contributor metadata. Some recipe families still need richer registry hydration. | Developer-created, starter, and archived presets should all live in the same review/voting model. |
| UX clarity | B- | The inspector now follows Source & Content, element builder/style, Material & Effects, Frame & Border, and Layout & Layer. Some panel internals still mix source and styling. | Keep splitting source assets, style recipes, material editing, and layout controls into clearer lanes. |
| Render correctness | B | Recent border and structured-row work improved real output. The remaining issue is less "does it render" and more "does the control belong here." | Add applicability tests and visual QA for each preset family. |

## Preset Family Findings

| Preset family | Current source | Appears on | Actual effect | Quality grade | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Element kits | `CONSOLIDATED_ELEMENT_KITS` in `elementKits.tsx` | New element library | Creates basic text, image, icon, shape, and divider elements. | B | Keep primitive element creation local; source assets belong in the relevant inspector picker. |
| Appearance quick styles | `ELEMENT_STYLE_PRESETS` in `elementStylePresets.ts` | Text and shape Material & Effects | Applies broad color, fill, background image, border, and radius values. | C | Demote or replace with pipeline-backed material recipes. Broad "element" styling is too vague for the main workflow. |
| Appearance style library | `/api/styles` pipeline registry | Text, shape, divider, icon where exact targets match | Applies structured `FreeformAppearance` objects. | B+ | Primary filtering now requires exact targets; next pass should improve labels/previews and contributor provenance. |
| Border / edge presets | `BORDER_PRESET_RECIPES` in `src/lib/elementPresetRecipes.ts` plus registry styles | Text, image, icon, shape | Applies structured edge styles: text box edge, image frame, icon backplate, or shape stroke depending on element type. | B+ | Edge workflow now has one primary inspector home and distinct render treatments; next step is richer registry provenance and live recipe thumbnails. |
| Shape presets | Retired from primary UI | Shape Studio no longer shows this lane | Previously changed primitive geometry, width, height, and a few colors. | C- | Replaced by local Blank Primitives plus typed Pipeline Recipes. |
| Shape role presets | `SHAPE_ROLE_PRESET_RECIPES` in `src/lib/elementPresetRecipes.ts` | Reviewed Shape Recipes | Applies semantic roles plus structured appearance recipes. | B+ | First typed seed lane is in place. Next step is loading registry-backed developer recipes into the same model. |
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

   Exact target matching is now in place for Material & Effects, but some registry rows still carry broad targets such as `text`, `shape`, and `element`. Those assets should be reviewed as product offerings: either split them into role-specific recipes or keep them as material recipes with clearer names.

3. Registry provenance still needs richer review context

   Hydrated registry recipes now use pipeline contributor fields where available, but source asset pickers still need consistent status, tier, contributor, and vote badges.

4. Local primitive tools and pipeline recipes still need clearer separation

   Shape primitives are now separated from Pipeline Recipes, and the left rail is back to primitives instead of acting like another asset browser. The remaining work is to apply that same language everywhere: local controls are tools, offerable creative defaults are pipeline assets.

5. Starter library assets are only partly honored as developer assets in the maker

   Many starter-feeling options now hydrate through recipe records or registry styles, but vote/archive/recovery behavior is not yet visible in every picker.

## Tool Sanity Audit

Checkpoint: 2026-05-25

The Frame & Edge pass fixed the worst border mismatch, but nearby inspector tools still have overlapping responsibilities. The clearest product rule is:

- **Source tools** choose content or asset source.
- **Style tools** change glyph/text appearance.
- **Material tools** change fill, texture, glow, and surface treatment.
- **Frame & Edge tools** change container edges, image frames, icon backplates, and shape strokes.
- **Layout tools** change position, size, stacking, opacity, and lock state.

Findings from the sweep:

| Tool area | Finding | User expectation risk | Resolution / next |
| --- | --- | --- | --- |
| Text Style | Text frame recipes, material, and edge controls all touch the text-box look. | Users can change the same visible text box from multiple places and wonder which tool "won." | Done: Text Style no longer exposes panel fill or border color. Text frame recipes remain as reviewed presets. |
| Image Source | Image URL/data key, file upload, and reviewed assets were split across panels. | Users may not understand whether the URL field, file upload, or asset picker is the canonical image source. | Done: image source controls now live together in Image Source. |
| Image Inspector | `Frame Color` duplicated Frame & Edge. | Users expected frame color to affect the same thing as Frame & Edge. | Done: removed the local frame color control so Frame & Edge owns image frame color. |
| Icon Source & Symbol | Stroke/fill/line-weight controls only affect built-in Lucide icons. Uploaded icon images render as `<img>`, so those controls do not recolor them. | Users expect symbol color controls to affect uploaded symbols too. | Done: glyph style controls only appear for built-in icons. Later SVG recolor support could make uploaded vector icons editable too. |
| Icon Backplate | Backplate color overlapped Material & Effects base material and Frame & Edge backplate edge. | Users could change the same backplate through multiple panels. | Done: glyph controls stay in Icon Style, surface fill stays in Material, and edge stays in Frame & Edge. |
| Shape Studio | Shape fill/stroke/stroke width overlapped Material & Effects and Frame & Edge. | Users did not know whether Shape Studio was for primitive geometry, visual styling, or final border treatment. | Done: Shape Builder now focuses on primitive type, blank primitives, and reviewed shape recipes. |
| Shape Render | Diamond, hexagon, banner, notch, bracket, and corner shapes used CSS `clip-path`; border/stroke was not a true vector outline. | Non-rectangular shapes may not outline as a card maker expects. | Done: non-divider primitive shapes now use shared inline SVG definitions in editor and preview. |
| Local Materials | Hardcoded material buttons used to apply broad colors, fills, text colors, and border values. | Presets felt magical and could overwrite fields owned by other panels. | Done: local materials now update structured appearance surface/background fields without taking over text or edge ownership. |
| Divider Studio | Height, opacity, flip, and asset fit are useful. Asset fit only matters for asset-backed dividers, not gradient recipe dividers. | Users may change Stretch/Contain and see no effect on recipe dividers. | Done: `Asset Fit` only appears when the divider has a divider asset or appearance asset source. |
| Layout & Layer | Position, size, rotation, lock, opacity, duplicate, and delete behave as expected. The old `Z` label was accurate but terse. | New users may not know `Z` means layer order. | Done: the inspector now labels the stack-order field as `Layer`. |
| Alignment Buttons | Buttons align to the canvas, not to selected siblings or groups. Tooltips say this, so behavior is technically honest. | Users from Figma/Canva may expect multi-select alignment later. | Rename section/copy to `Align to Canvas`; add multi-select alignment only when selection model supports it. |
| Advanced Raw CSS | Powerful but developer-facing language. | Normal makers may feel they are in an implementation detail. | Rename to `Custom texture or gradient` and reserve raw CSS wording for an advanced/dev toggle. |

Cleanup pass completed: Text Style now stays focused on typography, Image Source owns URL/file/pipeline image selection, Shape Builder stays focused on primitive/role selection, and icon glyph styling only appears for built-in icons that can actually respond to those controls. The follow-up pass also made local material presets structured, divider asset fit conditional, layer wording clearer, and non-divider primitive shapes vector-rendered. Remaining quality work is richer developer-backed material recipes and replacing raw CSS language with a safer custom material control if that advanced field returns to the UI.

## Live Testing Notes

The latest browser-driven sanity check verified:

- The left element rail is primitives-only; `Library Components`, `Card Part Catalog`, and `Asset Catalog` labels are gone.
- Image-like overlay assets appear through the selected image element's Image & Overlay Source Assets picker instead of clogging the element rail.
- A selected text element shows Source & Content, Text Style, Material & Effects, Frame & Border, and Layout & Layer; the old `Appearance Studio` label is gone.
- Image elements expose `Image & Overlay Source Assets`; selecting `Arcane Landscape` renders `/card-assets/images/arcane-landscape.svg`.
- Icon elements expose `Icon Source Assets`; selecting `Arcane Star` renders `/card-assets/icons/arcane-star.svg`.
- Icon Appearance Studio still shows relevant icon-targeted styles such as `Fire Relic Icon` and `Purple Foil`, while broad text-frame styles such as `Gilded Relic Frame` and `TTRPG Vellum Frame` no longer appear on icon selection.

## Recommended Makerspace Model

Use three lanes, not one pile of buttons:

| Lane | Owned by | Examples | Voting/pipeline |
| --- | --- | --- | --- |
| Local editor controls | Product code | position, size, z-index, primitive shape, raw colors, font family, alignment, padding, border width | No voting. These are tools, not assets. |
| Pipeline recipes | Developer asset registry | text frames, icon styles, divider recipes, shape roles, border treatments, frame kits | Yes. Starter library content and developer uploads use the same voting, archive, and recovery loop. |
| User-local assets | Browser/project storage | paid/free user uploads that are not submitted to developer program | No public voting unless explicitly submitted into the developer pipeline; these stay `localOnly`. |

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
  | 'overlayAsset'
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

The professional direction is to keep local primitive controls local, but make every offered creative recipe a developer-pipeline asset. A starter asset should not get special treatment; it should simply be a published, voteable pipeline asset with the same badges, archive behavior, and recovery path as everything else.
