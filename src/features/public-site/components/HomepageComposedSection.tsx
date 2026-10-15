import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { HomepageCustomSection } from '../model/homepageComposition';
import type { SiteMediaAsset } from '../model/siteMedia';
import { getSiteMediaDisplaySrc } from '../model/siteMedia';
import { ResponsiveSiteMediaImage } from './ResponsiveSiteMediaImage';

const toneClasses = {
  charcoal: 'bg-[var(--public-charcoal)] text-[var(--public-ivory)]',
  raised: 'bg-[var(--public-surface)] text-[var(--public-ivory)]',
  warm: 'bg-[#281b0e] text-[var(--public-ivory)]',
} as const;
const spacingClasses = {
  compact: 'py-8 md:py-10',
  balanced: 'py-12 md:py-16',
  spacious: 'py-16 md:py-24',
} as const;
const layoutClasses = {
  stack: 'flex flex-col gap-5',
  split: 'grid gap-6 md:grid-cols-2 md:items-center',
  grid: 'grid gap-5 md:grid-cols-2 xl:grid-cols-3',
} as const;

/** Data cannot introduce an HTML tag, CSS declaration, event handler, or executable URL. */
export function HomepageComposedSection({ section, media }: {
  section: HomepageCustomSection;
  media: SiteMediaAsset[];
}) {
  const design = section.design;
  return (
    <section
      id={section.id}
      data-owner-section-id={section.id}
      aria-label={section.blocks.find((block) => block.kind === 'heading')?.text ?? 'CardForge website section'}
      className={`scroll-mt-16 border-b border-[var(--public-border)] px-5 md:px-8 ${toneClasses[design.tone]} ${spacingClasses[design.spacing]}`}
    >
      <div className={`mx-auto max-w-7xl ${layoutClasses[design.layout]} ${design.align === 'center' ? 'text-center' : 'text-left'}`}>
        {section.blocks.map((block) => {
          const key = block.id;
          const shared = { 'data-owner-block-id': block.id, 'data-owner-section-id': section.id };
          if (block.kind === 'heading') return (
            <h2 {...shared} key={key} className="font-[var(--public-font-display)] text-3xl font-semibold leading-tight md:text-4xl">
              {block.text}
            </h2>
          );
          if (block.kind === 'text') return (
            <p {...shared} key={key} className="max-w-3xl text-lg leading-8 text-[var(--public-muted-text)]">{block.text}</p>
          );
          if (block.kind === 'feature') return (
            <article {...shared} key={key} className="rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[var(--cf-surface-raised)] p-5">
              <h3 className="font-[var(--public-font-display)] text-2xl font-semibold">{block.title}</h3>
              <p className="mt-3 text-base leading-7 text-[var(--public-muted-text)]">{block.body}</p>
            </article>
          );
          if (block.kind === 'button') return (
            <div {...shared} key={key} className={design.align === 'center' ? 'flex justify-center' : ''}>
              <Link href={block.href!} prefetch={false} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--public-radius)] bg-[var(--public-brass)] px-6 py-3 font-bold text-[var(--public-obsidian)] hover:bg-[#f0bd58]">
                {block.text}<ArrowUpRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          );
          const asset = media.find((item) => item.slot === block.mediaSlot);
          if (block.kind !== 'image') return null;
          if (!asset || !getSiteMediaDisplaySrc(asset)) return (
            <figure {...shared} key={key} data-site-media-slot={block.mediaSlot} className="flex min-h-48 items-center justify-center rounded-[var(--public-radius)] border border-dashed border-[var(--public-border)] text-center text-[var(--public-muted-text)]">
              <p>Illustration not yet published — select this image in Owner editing to upload it.</p>
            </figure>
          );
          return (
            <figure {...shared} key={key} data-site-media-slot={block.mediaSlot} className="min-w-0 overflow-hidden rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[var(--cf-canvas)]">
              <ResponsiveSiteMediaImage
                media={asset}
                width={asset.width ?? 1400}
                height={asset.height ?? 900}
                sizes="(min-width: 1280px) 640px, (min-width: 768px) 50vw, 100vw"
                className="h-auto max-h-[42rem] w-full object-contain"
              />
            </figure>
          );
        })}
      </div>
    </section>
  );
}
