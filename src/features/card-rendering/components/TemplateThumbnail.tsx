"use client";

import { normalizeTemplateAppearance, type TCGCardTemplate } from '@/domain/templates';
import { useProjectBinaryAssetValue } from '@/features/project/client/useProjectBinaryAssetUrl';
import { AppearanceSurface } from './AppearanceSurface';
import { appearanceToStyle, authoredCardFoundationStyle, textureLayerStyle } from '../model/appearance';

const toThumbnailBackgroundImage = (value?: string): string | undefined => {
  if (!value) return undefined;
  if (value.startsWith('linear-gradient') || value.startsWith('radial-gradient') || value.startsWith('url(')) {
    return value;
  }
  if (value.startsWith('/') || value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('http')) {
    return `url(${value})`;
  }
  return undefined;
};

export function TemplateThumbnail({ template }: { template: TCGCardTemplate }) {
  const appearance = appearanceToStyle(normalizeTemplateAppearance(template));
  const hasAuthoredBackground = Boolean(template.cardBackgroundImageUrl?.trim());
  const rawBackground = hasAuthoredBackground ? template.cardBackgroundImageUrl : appearance.backgroundImage;
  const foundationStyle = authoredCardFoundationStyle(template, hasAuthoredBackground ? toThumbnailBackgroundImage(template.cardBackgroundImageUrl) : undefined, appearance);
  const safeBackgroundImage = useProjectBinaryAssetValue(foundationStyle?.backgroundImage ?? toThumbnailBackgroundImage(rawBackground));
  const backgroundColor = template.baseBackgroundColor ?? template.appearance?.material?.baseColor ?? '#111827';
  const borderColor = template.cardBorderColor ?? template.appearance?.border?.color ?? '#d5ad54';
  const accent = template.baseTextColor ?? template.appearance?.material?.textColor ?? 'var(--cf-accent-text)';
  const [rawWidth, rawHeight] = template.aspectRatio.split(':').map(Number);
  const thumbnailRatio = rawWidth > 0 && rawHeight > 0 ? rawWidth / rawHeight : 58 / 72;
  const thumbnailWidth = Math.max(48, Math.min(112, Math.round(72 * thumbnailRatio)));
  const label = (template.name ?? 'CF')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CF';

  return (
    <AppearanceSurface as="span"
      className="relative flex h-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[5px] border bg-[#06080d] bg-no-repeat shadow-inner"
      style={{
        ...textureLayerStyle(foundationStyle ?? (hasAuthoredBackground ? undefined : appearance)),
        width: `${thumbnailWidth}px`,
        borderWidth: 1, borderStyle: 'solid', borderRadius: 5, borderColor,
        backgroundColor,
        backgroundImage: safeBackgroundImage,
        backgroundPosition: foundationStyle?.backgroundPosition ?? (hasAuthoredBackground ? 'center' : appearance.backgroundPosition || 'center'),
        backgroundRepeat: foundationStyle?.backgroundRepeat ?? (hasAuthoredBackground ? 'no-repeat' : appearance.backgroundRepeat || 'no-repeat'),
        backgroundSize: foundationStyle?.backgroundSize ?? (safeBackgroundImage ? hasAuthoredBackground ? '100% 100%' : appearance.backgroundSize || '100% 100%' : undefined),
        backgroundBlendMode: foundationStyle ? appearance.backgroundBlendMode : hasAuthoredBackground ? undefined : appearance.backgroundBlendMode,
      }}
      aria-hidden="true"
    >
      {!safeBackgroundImage ? (
        <>
          <span className="absolute inset-1 rounded-[3px] border border-black/35 bg-black/10" />
          <span className="absolute left-1/2 top-2 h-1 w-7 -translate-x-1/2 rounded-full bg-white/20" />
          <span
            className="relative grid h-7 w-7 place-items-center rounded-full border border-black/35 bg-black/30 text-[10px] font-bold tracking-[0.08em]"
            style={{ color: accent }}
          >
            {label}
          </span>
        </>
      ) : null}
    </AppearanceSurface>
  );
}
