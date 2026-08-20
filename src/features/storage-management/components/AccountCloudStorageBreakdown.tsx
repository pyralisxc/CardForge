"use client";

import { useMemo } from 'react';
import { Cloud, ImageIcon, Loader2 } from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { MAX_CLOUD_SET_BYTES, useCloudSetActions } from '@/features/project/client';

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

export function AccountCloudStorageBreakdown({ isSignedIn }: { isSignedIn: boolean }) {
  const { toast } = useToast();
  const { cloud, isLoadingCloudSets } = useCloudSetActions({ toast, enabled: isSignedIn });
  const totalBytes = useMemo(() => (cloud?.sets ?? []).reduce((sum, set) => sum + set.storageBytes, 0), [cloud?.sets]);

  if (!isSignedIn) return null;

  return (
    <section className="mx-auto max-w-4xl px-4 pb-8 md:px-6" aria-labelledby="cloud-space-title">
      <div className="border border-[#5f4526] bg-[#15100a] p-4 md:p-5">
        <div className="flex items-center gap-2 text-[#e2aa4a]">
          <Cloud className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-[0.16em]">Cloud space details</span>
        </div>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="cloud-space-title" className="font-serif text-xl text-[#fff1c7]">What is using your cloud storage</h2>
            <p className="mt-1 text-xs leading-5 text-[#a9946c]">Artwork bytes and editable set data are tracked separately inside each backup. The 128 MB ceiling applies to each set individually.</p>
          </div>
          <p className="text-sm font-semibold text-[#ffe7ad]">{formatBytes(totalBytes)} total</p>
        </div>

        {isLoadingCloudSets ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-[#cbb58b]"><Loader2 className="h-4 w-4 animate-spin" /> Loading cloud storage details…</p>
        ) : cloud?.sets.length ? (
          <div className="mt-4 space-y-3">
            {cloud.sets.map((set) => {
              const artworkBytes = Math.max(0, set.storageBytes - set.metadataBytes);
              const usagePercent = Math.max(0, Math.min(100, (set.storageBytes / MAX_CLOUD_SET_BYTES) * 100));
              return (
                <div key={set.setId} className="border border-[#4a3823] bg-[#100c08] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#fff1c7]">{set.name}</p>
                      <p className="mt-1 text-xs text-[#bba57c]">{set.cardCount} cards · revision {set.revision}</p>
                    </div>
                    <p className="text-sm font-semibold text-[#f6d891]">{formatBytes(set.storageBytes)}</p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#332719]" aria-label={`${usagePercent.toFixed(1)} percent of this set's cloud limit used`}>
                    <div className="h-full rounded-full bg-[#dca747]" style={{ width: `${usagePercent}%` }} />
                  </div>
                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-3 border border-[#3c3020] px-3 py-2 text-[#cbb58b]">
                      <span className="inline-flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5 text-[#e2aa4a]" /> Artwork</span>
                      <strong className="text-[#ffe7ad]">{formatBytes(artworkBytes)}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-3 border border-[#3c3020] px-3 py-2 text-[#cbb58b]">
                      <span>Cards, Templates &amp; set data</span>
                      <strong className="text-[#ffe7ad]">{formatBytes(set.metadataBytes)}</strong>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-[#8f7b5d]">{usagePercent.toFixed(1)}% of this set&apos;s 128 MB cloud ceiling</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[#cbb58b]">Back up a set to see exactly how its cloud space is divided.</p>
        )}
      </div>
    </section>
  );
}
