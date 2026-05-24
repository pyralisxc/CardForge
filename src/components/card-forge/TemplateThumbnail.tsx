"use client";

import type { TCGCardTemplate } from '@/types';

export function TemplateThumbnail({ template }: { template: TCGCardTemplate }) {
  const rawBackground = template.cardBackgroundImageUrl ?? template.appearance?.rawCss?.backgroundImage;
  const safeBackgroundImage = rawBackground?.startsWith('linear-gradient') || rawBackground?.startsWith('radial-gradient')
    ? rawBackground
    : undefined;
  const backgroundColor = template.baseBackgroundColor ?? template.appearance?.material?.baseColor ?? '#111827';
  const borderColor = template.cardBorderColor ?? template.appearance?.border?.color ?? '#d5ad54';
  const accent = template.baseTextColor ?? template.appearance?.material?.textColor ?? '#f5d27b';
  const label = (template.name ?? 'CF')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CF';

  return (
    <span
      className="relative flex h-[72px] w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-[5px] border bg-[#06080d] shadow-inner"
      style={{
        borderColor,
        backgroundColor,
        backgroundImage: safeBackgroundImage,
      }}
      aria-hidden="true"
    >
      <span className="absolute inset-1 rounded-[3px] border border-black/35 bg-black/10" />
      <span className="absolute left-1/2 top-2 h-1 w-7 -translate-x-1/2 rounded-full bg-white/20" />
      <span
        className="relative grid h-7 w-7 place-items-center rounded-full border border-black/35 bg-black/30 text-[10px] font-bold tracking-[0.08em]"
        style={{ color: accent }}
      >
        {label}
      </span>
    </span>
  );
}
