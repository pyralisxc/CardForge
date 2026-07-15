# Centered watermark policy

## Outcome

CardForge will use its approved transparent symbol-and-wordmark as an entitlement-aware overlay instead of a footer placard.

- Free or otherwise unentitled users see the watermark centered over generated card previews in Studio.
- Founder Beta, paid, developer, and owner users see clean generated previews because those accounts have clean-export entitlement.
- Every Share Card image is branded, regardless of account tier, with the watermark centered over the card artwork.
- Normal PNG, PDF, ZIP, spritesheet, and project-file exports remain clean and continue to require the existing export entitlement.
- The template editor canvas remains unobstructed while a creator is designing.

## Visual treatment

The runtime source remains `/brand/cardforge-studio/watermark.svg`. The SVG has a transparent background; no white or colored rectangle will be drawn behind it.

For Studio previews, one horizontal watermark is centered over the card, spans approximately 68% of the rendered card width, and is rendered at 20% opacity. It is decorative, cannot receive pointer events, and does not alter the underlying card data or export canvas.

For Share Card images, the same mark is centered within the card bounds at 24% opacity. The existing footer placard is removed. Social presets retain their branded background and border, but the card can use the space previously reserved for the footer.

The overlay is intentionally singular and horizontal. CardForge will not use tiled, repeated, diagonal, or corner-only marks in this slice.

## Entitlement behavior

`canExportClean` is the single source of truth for Studio preview branding:

| Context | Unentitled/free | Founder Beta/paid/developer/owner |
| --- | --- | --- |
| Generated gallery preview | Centered watermark | Clean |
| Generator front/back deck preview | Centered watermark | Clean |
| Template editor canvas | Clean | Clean |
| Share Card square/portrait/story image | Centered watermark | Centered watermark |
| Normal export | Blocked by existing gate | Clean |

Founder Beta remains clean because its active account entitlement grants `canExportClean`, matching the campaign promise already shown in the account UI.

## Architecture and data flow

A small presentation component will own the DOM preview overlay. Generated preview surfaces receive a boolean derived from `canExportClean` and render the overlay only when the boolean is false. `CardPreview` itself will not gain global entitlement knowledge, preventing accidental branding in the template editor, developer library, or unrelated thumbnails.

The social renderer will continue to call the clean `renderCardToCanvas` function first. It will then composite the watermark inside the calculated card rectangle on the separate social canvas. Normal export buttons and PDF/ZIP renderers continue to call the clean card renderer directly and therefore cannot inherit the social watermark.

This separation makes the policy explicit:

1. Render clean card content.
2. Add a DOM-only overlay for unentitled generated previews.
3. Add a canvas overlay only inside the Share Card composition.
4. Never add watermark logic to the shared clean-export renderer.

## Failure handling

If the Share Card watermark asset cannot load, Share Card creation fails with the existing visible error instead of silently producing an unbranded social image. A missing DOM preview asset does not block card editing or generation; the browser shows no overlay, while automated tests protect the asset path and rendering contract.

## Verification

Regression coverage will prove:

- the entitlement policy maps `canExportClean=false` to a preview overlay and `true` to a clean preview;
- generated gallery and deck previews receive the correct policy;
- Share Card layouts place the watermark inside the card bounds instead of a footer;
- the social compositor uses no background plate and applies the approved opacity;
- normal export code remains independent from watermark composition;
- the approved runtime asset path remains reachable;
- lint, typecheck, unit tests, build, and public browser smoke tests pass before merge.
