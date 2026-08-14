import { ImageIcon, Layers3, SlidersHorizontal, Type } from 'lucide-react';

import { LiveExampleGallery } from './LiveExampleGallery';
import { useBrandPresentation } from '@/features/brand-presentation/client';

const libraryItems = [
  ['Cards', Layers3],
  ['Artwork', ImageIcon],
  ['Words', Type],
  ['Style', SlidersHorizontal],
] as const;

export function StudioProductProof() {
  const brand = useBrandPresentation();
  return (
    <figure
      aria-labelledby="studio-proof-caption"
      className="overflow-hidden rounded-[var(--public-radius)] border border-[var(--public-border)] bg-[#0a0907] shadow-[0_1.5rem_4rem_rgba(0,0,0,0.55)]"
    >
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--public-border)] bg-[var(--public-surface)] px-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#d7643b]" aria-hidden="true" />
          <span className="h-2 w-2 rounded-full bg-[var(--public-brass)]" aria-hidden="true" />
          <span className="h-2 w-2 rounded-full bg-[#78965b]" aria-hidden="true" />
        </div>
        <strong className="font-[var(--public-font-display)] text-base text-[var(--public-ivory)]">
          {brand.brandName}
        </strong>
        <span className="text-base text-[var(--public-muted-text)]">Maker</span>
      </div>

      <div className="grid min-h-[25rem] grid-cols-[5.5rem_minmax(0,1fr)] sm:grid-cols-[8.5rem_minmax(0,1fr)] lg:grid-cols-[8.5rem_minmax(0,1fr)_9.5rem]">
        <aside className="border-r border-[#3c2c19] bg-[#100d09] p-3" aria-label="Studio tools shown in preview">
          <p className="mb-3 hidden text-base font-bold text-[var(--public-ivory)] sm:block">Build</p>
          <div className="grid gap-2">
            {libraryItems.map(([label, Icon], index) => (
              <div
                key={label}
                className={`flex min-h-11 items-center gap-2 border px-2 text-base ${
                  index === 0
                    ? 'border-[var(--public-brass)] bg-[#261b0f] text-[var(--public-ivory)]'
                    : 'border-transparent text-[var(--public-muted-text)]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 text-[var(--public-brass)]" aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="min-w-0 bg-[radial-gradient(circle_at_top,#2b1b0c_0%,#12100d_44%,#090806_100%)] p-3 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3 text-base">
            <span className="font-bold text-[var(--public-ivory)]">Your card set</span>
            <span className="text-[var(--public-muted-text)]">Front · Back</span>
          </div>
          <LiveExampleGallery />
        </div>

        <aside className="hidden border-l border-[#3c2c19] bg-[#100d09] p-3 lg:block" aria-label="Studio settings shown in preview">
          <p className="text-base font-bold text-[var(--public-ivory)]">Card settings</p>
          {['Title', 'Picture', 'Card text', 'Colors'].map((label) => (
            <div key={label} className="mt-3 border-b border-[#352716] pb-3">
              <p className="text-base text-[var(--public-muted-text)]">{label}</p>
              <div className="mt-2 h-2 bg-[#2a2118]" aria-hidden="true" />
            </div>
          ))}
        </aside>
      </div>

      <figcaption id="studio-proof-caption" className="border-t border-[var(--public-border)] bg-[var(--public-surface)] px-4 py-3 text-base text-[var(--public-muted-text)]">
        Studio workspace preview with real cards rendered by {brand.brandName}.
      </figcaption>
    </figure>
  );
}
