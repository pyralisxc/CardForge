"use client";

import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';

import { openEnvironmentDetail, type SelectionSession } from '@/features/app-shell/client/environment';
import { createLibraryReturnHref, readSurfaceReturnContext, storeSurfaceReturnContext } from '@/features/app-shell/client/navigation';

import type { LibraryViewItem } from '../components/LibraryObjectPresentation';
import { resolveLibraryScopeForViewer, type LibraryDensity, type LibraryScope } from '../model/libraryScopes';
import { useAccountLibraryProjection } from './useAccountLibraryProjection';

export function useLibraryReturnContext({
  activeLoading,
  activeScope,
  campaignAccess,
  density,
  initialReturnContextKey,
  itemMap,
  owner,
  pipelineAccess,
  projection,
  selection,
  setDensity,
  setScope,
  setSelection,
  setSharedType,
  sharedType,
  surfaceRef,
}: {
  activeLoading: boolean;
  activeScope: LibraryScope;
  campaignAccess: boolean;
  density: LibraryDensity;
  initialReturnContextKey: string | null;
  itemMap: Map<string, LibraryViewItem>;
  owner: boolean;
  pipelineAccess: boolean;
  projection: ReturnType<typeof useAccountLibraryProjection>;
  selection: SelectionSession;
  setDensity: Dispatch<SetStateAction<LibraryDensity>>;
  setScope: Dispatch<SetStateAction<LibraryScope>>;
  setSelection: Dispatch<SetStateAction<SelectionSession>>;
  setSharedType: Dispatch<SetStateAction<string>>;
  sharedType: string;
  surfaceRef: RefObject<HTMLElement | null>;
}) {
  const restoredRef = useRef(false);
  const createCompatibilityReturnTo = () => {
    const returnContext = storeSurfaceReturnContext({
      kind: 'library', scope: activeScope, objectId: selection.objectId, query: projection.query,
      source: projection.source, itemKind: projection.kind, sort: projection.sort, density, sharedType,
      scrollTop: surfaceRef.current?.scrollTop ?? 0,
    });
    return createLibraryReturnHref(activeScope, returnContext);
  };

  useEffect(() => {
    if (!initialReturnContextKey || restoredRef.current || activeLoading) return;
    const context = readSurfaceReturnContext(initialReturnContextKey);
    if (!context || context.kind !== 'library') {
      restoredRef.current = true;
      return;
    }
    restoredRef.current = true;
    setScope(resolveLibraryScopeForViewer(context.scope, { contributor: pipelineAccess, campaigns: campaignAccess, owner }));
    setDensity(context.density);
    setSharedType(context.sharedType);
    projection.setQuery(context.query);
    projection.setSource(context.source);
    projection.setKind(context.itemKind);
    projection.setSort(context.sort);
    if (context.objectId && itemMap.has(context.objectId)) {
      setSelection((current) => openEnvironmentDetail({ ...current, listOffset: context.scrollTop }, {
        objectId: context.objectId,
        listOffset: context.scrollTop,
        focusReturnId: `library-object-${context.objectId}`,
      }));
    }
    requestAnimationFrame(() => surfaceRef.current?.scrollTo({ top: context.scrollTop }));
  }, [activeLoading, campaignAccess, initialReturnContextKey, itemMap, owner, pipelineAccess, projection, setDensity, setScope, setSelection, setSharedType, surfaceRef]);

  return createCompatibilityReturnTo;
}
