# Darker watermark opacity

## Outcome

Increase every existing CardForge watermark by four percentage points without changing its placement, dimensions, entitlement behavior, or rendering boundary.

- Free Studio card surfaces increase from 20% opacity to 24%.
- Share Card artwork increases from 24% opacity to 28% for every account tier.

## Scope

The Studio increase applies to the editable Layout Studio canvas, Layout Studio Preview mode, template-library thumbnails, Generator front/back setup previews, and generated-output gallery cards. Founder Beta, paid, developer, and owner Studio surfaces remain clean.

Share Card square, portrait, and story images remain branded for every tier at the new 28% opacity. Normal PNG, PDF, ZIP, spritesheet, and project exports remain clean and entitlement-gated.

## Architecture

Change only `GENERATED_PREVIEW_WATERMARK_OPACITY` and `SOCIAL_SHARE_WATERMARK_OPACITY` in the existing watermark policy module. Every current surface already consumes these constants, so no component, layout, data, or export-renderer changes are required.

## Verification

Update the policy and social-renderer tests to require 24% Studio opacity and 28% Share Card opacity. Update the public browser smoke assertion to require `opacity: 0.24` on both generated and editor overlays. Then run lint, type checking, the complete unit suite, the production build, Public smoke, and production health checks before completion.
