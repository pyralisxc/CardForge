"use client";

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, EyeOff, Map, RefreshCcw, Save, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  STUDIO_ASSET_DESTINATION_DEFINITIONS,
  getStudioAssetDestinationDefinition,
  type StudioAssetDestination,
  type StudioAssetRoutingMode,
} from '@/domain/templates';
import type {
  OwnerStudioRoutingItem,
  OwnerStudioRoutingPage,
} from '@/features/pipeline/lib/ownerStudioRouting';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import { cn } from '@/shared/classNames';

const GROUPS = ['Templates', 'Images', 'Elements', 'Styles', 'Typography'] as const;

export function OwnerStudioRoutingPanel() {
  const { toast } = useToast();
  const [routingPage, setRoutingPage] = useState<OwnerStudioRoutingPage | null>(null);
  const [destination, setDestination] = useState<StudioAssetDestination | 'all'>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingAssetId, setSavingAssetId] = useState<string | null>(null);

  const loadRouting = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ query, page: String(page), pageSize: '12' });
      if (destination !== 'all') params.set('destination', destination);
      const response = await fetch(`/api/owner/studio-routing?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to load the Studio Map.'));
      const body = await response.json() as { page: OwnerStudioRoutingPage };
      setRoutingPage(body.page);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load the Studio Map.');
    } finally {
      setIsLoading(false);
    }
  }, [destination, page, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRouting(), 200);
    return () => window.clearTimeout(timer);
  }, [loadRouting]);

  const saveRouting = async (item: OwnerStudioRoutingItem, draft: RoutingDraft) => {
    setSavingAssetId(item.assetId);
    try {
      const response = await fetch('/api/owner/studio-routing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: item.assetId,
          mode: draft.mode,
          destinations: draft.destinations,
          sortOrder: draft.sortOrder,
          featured: draft.featured,
        }),
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to save Studio placement.'));
      await loadRouting();
      toast({
        title: draft.mode === 'automatic' ? 'Automatic placement saved' : 'Studio placement saved',
        description: draft.mode === 'automatic'
          ? `${item.name} now follows its asset contract.`
          : `${item.name} now appears only in the selected Studio sections.`,
      });
    } catch (error) {
      toast({
        title: 'Studio placement not saved',
        description: error instanceof Error ? error.message : 'Unable to save Studio placement.',
        variant: 'destructive',
      });
    } finally {
      setSavingAssetId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Map className="h-4 w-4 text-[var(--cf-accent)]" />
              <h3 className="font-serif text-xl text-[var(--cf-text-strong)]">Studio Map</h3>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cf-text-muted)]">
              This is the live map between the Forge Pipeline and Template Studio. Automatic placement follows each asset&apos;s contract; owner placement can feature, order, reroute, or hide an asset without changing its file or publication history.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadRouting()} disabled={isLoading} className="rounded-none border-[var(--cf-border)] bg-transparent text-[var(--cf-accent-text)]">
            <RefreshCcw className={cn('mr-2 h-3.5 w-3.5', isLoading && 'animate-spin')} /> Refresh
          </Button>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-3">
            {GROUPS.map((group) => (
              <div key={group}>
                <p className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-[#8e795e]">{group}</p>
                <div className="flex flex-wrap gap-1.5">
                  {STUDIO_ASSET_DESTINATION_DEFINITIONS.filter((definition) => definition.group === group).map((definition) => {
                    const count = routingPage?.counts.find((item) => item.destination === definition.id);
                    return (
                      <button
                        key={definition.id}
                        type="button"
                        title={definition.description}
                        className={cn(
                          'border px-2.5 py-1.5 text-left text-xs transition',
                          destination === definition.id
                            ? 'border-[var(--cf-accent)] bg-[var(--cf-surface-hover)] text-[var(--cf-accent-text)]'
                            : 'border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] text-[var(--cf-text-muted)] hover:border-[#806033]',
                        )}
                        onClick={() => { setDestination(definition.id); setPage(1); }}
                      >
                        {definition.shortLabel} <span className="text-[#8e795e]">{count?.liveCount ?? 0}/{count?.totalCount ?? 0}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="studio-map-search" className="text-xs text-[var(--cf-text-muted)]">Find a Pipeline asset</Label>
            <Input
              id="studio-map-search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              placeholder="Search by name..."
              className="rounded-none border-[var(--cf-border)] bg-[var(--cf-surface)] text-[var(--cf-accent-text)]"
            />
            {destination !== 'all' ? (
              <Button type="button" variant="ghost" size="sm" className="h-8 px-0 text-xs text-[var(--cf-accent)]" onClick={() => { setDestination('all'); setPage(1); }}>
                Show all Studio assets
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {loadError ? (
        <div className="border border-[var(--cf-danger-border)] bg-[var(--cf-danger-surface-muted)] p-4 text-sm text-[var(--cf-danger)]">
          <p>{loadError}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void loadRouting()}>Retry</Button>
        </div>
      ) : null}

      {!loadError && routingPage?.items.length === 0 && !isLoading ? (
        <div className="border border-dashed border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-5 text-sm text-[var(--cf-text-muted)]">
          No Pipeline assets match this Studio section and search.
        </div>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-2">
        {routingPage?.items.map((item) => (
          <StudioRoutingCard
            key={item.assetId}
            item={item}
            isSaving={savingAssetId === item.assetId}
            onSave={(draft) => saveRouting(item, draft)}
          />
        ))}
      </div>

      {routingPage && routingPage.total > 0 ? (
        <div className="flex flex-col gap-2 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3 text-xs text-[var(--cf-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>{routingPage.total} assets · Page {routingPage.page} of {routingPage.totalPages}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={routingPage.page <= 1 || isLoading} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Previous
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={routingPage.page >= routingPage.totalPages || isLoading} onClick={() => setPage((value) => value + 1)}>
              Next <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface RoutingDraft {
  mode: StudioAssetRoutingMode;
  destinations: StudioAssetDestination[];
  sortOrder: number;
  featured: boolean;
}

function StudioRoutingCard({
  item,
  isSaving,
  onSave,
}: {
  item: OwnerStudioRoutingItem;
  isSaving: boolean;
  onSave: (draft: RoutingDraft) => void;
}) {
  const [draft, setDraft] = useState<RoutingDraft>({
    mode: item.studioRoutingMode,
    destinations: item.studioDestinations,
    sortOrder: item.studioSortOrder,
    featured: item.studioFeatured,
  });

  useEffect(() => {
    setDraft({
      mode: item.studioRoutingMode,
      destinations: item.studioDestinations,
      sortOrder: item.studioSortOrder,
      featured: item.studioFeatured,
    });
  }, [item]);

  const isVisualAsset = item.assetType === 'image' || item.assetType === 'texture' || item.assetType === 'divider' || item.assetType === 'icon';
  const isHidden = item.studioDestinations.length === 0;

  return (
    <article className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-3">
      <div className="flex gap-3">
        <div
          className="grid h-20 w-16 shrink-0 place-items-center overflow-hidden border border-[var(--cf-border-subtle)] bg-[#090705] bg-contain bg-center bg-no-repeat text-[9px] uppercase tracking-[0.12em] text-[#8e795e]"
          style={isVisualAsset ? { backgroundImage: `url(${item.url})` } : undefined}
          role="img"
          aria-label={`${item.name} preview`}
        >
          {!isVisualAsset ? (item.assetType === 'template' ? 'Template' : item.assetType === 'elementPreset' ? 'Style' : item.assetType) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate font-semibold text-[var(--cf-accent-text)]">{item.name}</h4>
              <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#8e795e]">{item.assetType} · {item.status} · {item.accessTier}</p>
            </div>
            {item.studioFeatured ? <span className="inline-flex items-center gap-1 border border-[#806033] bg-[var(--cf-surface-hover)] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-[var(--cf-accent-text)]"><Sparkles className="h-3 w-3" /> Featured</span> : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {item.studioDestinations.map((route) => (
              <span key={route} className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] px-1.5 py-1 text-[9px] text-[var(--cf-text-muted)]">{getStudioAssetDestinationDefinition(route).shortLabel}</span>
            ))}
            {isHidden ? <span className="inline-flex items-center gap-1 border border-[#66423a] bg-[var(--cf-danger-surface-muted)] px-1.5 py-1 text-[9px] text-[#efb3a6]"><EyeOff className="h-3 w-3" /> Hidden from Studio</span> : null}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 border-t border-[#342719] pt-3 sm:grid-cols-[10rem_1fr]">
        <div>
          <Label className="text-[10px] uppercase tracking-[0.13em] text-[#8e795e]">Placement owner</Label>
          <Select value={draft.mode} onValueChange={(value) => setDraft((current) => ({ ...current, mode: value as StudioAssetRoutingMode }))}>
            <SelectTrigger className="mt-1 h-9 rounded-none border-[var(--cf-border)] bg-[var(--cf-surface)] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="automatic">Automatic</SelectItem>
              <SelectItem value="owner">Owner override</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-[0.13em] text-[#8e795e]">Used in</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {item.compatibleDestinations.map((route) => (
              <label key={route} className={cn('flex items-center gap-1.5 border border-[var(--cf-border-subtle)] px-2 py-1.5 text-[10px] text-[var(--cf-text-muted)]', draft.mode === 'automatic' && 'opacity-55')}>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--cf-accent)]"
                  checked={draft.destinations.includes(route)}
                  disabled={draft.mode === 'automatic'}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    destinations: event.target.checked
                      ? [...current.destinations, route]
                      : current.destinations.filter((value) => value !== route),
                  }))}
                />
                {getStudioAssetDestinationDefinition(route).shortLabel}
              </label>
            ))}
          </div>
          <p className="mt-1 text-[10px] leading-4 text-[#8e795e]">
            {draft.mode === 'automatic' ? 'The asset contract chooses its shelf.' : 'Clear every shelf to hide the asset from Studio without deleting it.'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-3">
          <div>
            <Label htmlFor={`studio-order-${item.assetId}`} className="text-[10px] uppercase tracking-[0.13em] text-[#8e795e]">Order</Label>
            <Input id={`studio-order-${item.assetId}`} type="number" min={0} max={100000} value={draft.sortOrder} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value) }))} className="mt-1 h-9 w-24 rounded-none border-[var(--cf-border)] bg-[var(--cf-surface)] text-xs" />
          </div>
          <label className="flex items-center gap-2 pb-2 text-xs text-[var(--cf-text-muted)]">
            <input type="checkbox" className="h-4 w-4 accent-[var(--cf-accent)]" checked={draft.featured} onChange={(event) => setDraft((current) => ({ ...current, featured: event.target.checked }))} /> Featured first
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.assetType === 'template' ? (
            <Button asChild type="button" variant="outline" size="sm" className="rounded-none border-[var(--cf-border)] bg-transparent text-[var(--cf-accent-text)]">
              <a href={`/studio?editTemplate=${encodeURIComponent(item.assetId)}`}>Edit Template <ExternalLink className="ml-1 h-3.5 w-3.5" /></a>
            </Button>
          ) : null}
          <Button type="button" size="sm" disabled={isSaving || !Number.isInteger(draft.sortOrder) || draft.sortOrder < 0 || draft.sortOrder > 100000} onClick={() => onSave(draft)} className="rounded-none bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:bg-[var(--cf-accent)]">
            {draft.mode === 'automatic' ? <RefreshCcw className="mr-1 h-3.5 w-3.5" /> : <Save className="mr-1 h-3.5 w-3.5" />}
            {isSaving
              ? 'Saving...'
              : draft.mode === 'automatic'
                ? item.studioRoutingMode === 'owner' ? 'Restore automatic' : 'Save automatic'
                : 'Save placement'}
          </Button>
        </div>
      </div>
    </article>
  );
}
