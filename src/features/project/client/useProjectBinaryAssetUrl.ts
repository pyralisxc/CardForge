"use client";

import { useEffect, useState } from 'react';

import {
  createScopedProjectBinaryAssetResolver,
  isProjectBinaryAssetReference,
  type ProjectBinaryAssetResolver,
} from '../persistence/projectBinaryAssetResolver';
import { getProjectPersistenceScope } from '../persistence/projectPersistenceScope';

const scopedResolvers = new Map<string, ProjectBinaryAssetResolver>();

const resolverForScope = (scope: string) => {
  let resolver = scopedResolvers.get(scope);
  if (!resolver) {
    resolver = createScopedProjectBinaryAssetResolver(scope);
    scopedResolvers.set(scope, resolver);
  }
  return resolver;
};

/** Resolves one mounted binary reference and releases its object URL on change/unmount. */
export const useProjectBinaryAssetResolution = (source: string | null | undefined): { url: string; mimeType: string } | undefined => {
  const scope = getProjectPersistenceScope();
  const [resolution, setResolution] = useState<{ scope: string; source: string; url: string; mimeType: string } | null>(null);

  useEffect(() => {
    if (!source || !isProjectBinaryAssetReference(source)) return;

    let active = true;
    let release: () => void = () => undefined;
    void resolverForScope(scope).acquire(source).then((handle) => {
      if (!active) {
        handle.release();
        return;
      }
      release = handle.release;
      setResolution({ scope, source, url: handle.url, mimeType: handle.mimeType });
    }).catch(() => {
      if (active) setResolution(null);
    });
    return () => {
      active = false;
      release();
    };
  }, [scope, source]);

  if (!source) return undefined;
  if (!isProjectBinaryAssetReference(source)) return { url: source, mimeType: '' };
  return resolution?.scope === scope && resolution.source === source ? resolution : undefined;
};

/** Compatibility projection; MIME metadata remains owned by the existing resolver. */
export const useProjectBinaryAssetUrl = (source: string | null | undefined): string | undefined => (
  useProjectBinaryAssetResolution(source)?.url
);

const BINARY_REFERENCE_PATTERN = /cardforge-browser-asset:\/\/[a-f0-9]{64}/gu;
const MAX_PRIMED_PROJECT_BINARY_ASSETS = 160;
const DEFAULT_PROJECT_BINARY_PRIME_HOLD_MS = 1_500;

export const collectProjectBinaryAssetReferences = (
  value: unknown,
  limit = MAX_PRIMED_PROJECT_BINARY_ASSETS,
): string[] => {
  const references = new Set<string>();
  const visit = (entry: unknown) => {
    if (references.size >= limit) return;
    if (typeof entry === 'string') {
      for (const reference of entry.match(BINARY_REFERENCE_PATTERN) ?? []) {
        references.add(reference);
        if (references.size >= limit) break;
      }
      return;
    }
    if (Array.isArray(entry)) {
      for (const item of entry) {
        visit(item);
        if (references.size >= limit) break;
      }
      return;
    }
    if (!entry || typeof entry !== 'object') return;
    for (const item of Object.values(entry as Record<string, unknown>)) {
      visit(item);
      if (references.size >= limit) break;
    }
  };
  visit(value);
  return [...references];
};

/**
 * Prime a bounded set of freshly materialized browser assets before the first
 * provider-backed Artifact paint. Handles stay alive briefly so mounted
 * renderers acquire the same scoped object URLs, then normal component
 * lifetimes resume ownership.
 */
export const primeProjectBinaryAssetUrls = async (
  value: unknown,
  {
    maxReferences = MAX_PRIMED_PROJECT_BINARY_ASSETS,
    holdMs = DEFAULT_PROJECT_BINARY_PRIME_HOLD_MS,
  }: { maxReferences?: number; holdMs?: number } = {},
): Promise<number> => {
  const scope = getProjectPersistenceScope();
  const references = collectProjectBinaryAssetReferences(value, maxReferences);
  if (!references.length) return 0;
  const handles: Awaited<ReturnType<ProjectBinaryAssetResolver['acquire']>>[] = [];
  try {
    for (const reference of references) {
      handles.push(await resolverForScope(scope).acquire(reference));
    }
    if (getProjectPersistenceScope() !== scope) {
      throw new Error('The workspace account changed while CardForge prepared project artwork.');
    }
    globalThis.setTimeout(() => handles.forEach((handle) => handle.release()), Math.max(0, holdMs));
    return handles.length;
  } catch (error) {
    handles.forEach((handle) => handle.release());
    throw error;
  }
};

/** Resolves references embedded inside CSS values such as url(...). */
export const useProjectBinaryAssetValueResolution = (value: string | null | undefined): { value: string; vectorUrls: string[] } | undefined => {
  const scope = getProjectPersistenceScope();
  const [resolution, setResolution] = useState<{ scope: string; value: string; resolved: string; vectorUrls: string[] } | null>(null);

  useEffect(() => {
    if (!value) return;
    const references = [...new Set(value.match(BINARY_REFERENCE_PATTERN) ?? [])];
    if (references.length === 0) return;
    let active = true;
    const releases: Array<() => void> = [];
    void Promise.all(references.map(async (reference) => {
      const handle = await resolverForScope(scope).acquire(reference);
      if (!active) {
        handle.release();
        return { reference, url: reference, mimeType: '' };
      }
      releases.push(handle.release);
      return { reference, url: handle.url, mimeType: handle.mimeType };
    })).then((entries) => {
      if (!active) return;
      const resolved = entries.reduce((current, { reference, url }) => current.replaceAll(reference, url), value);
      setResolution({ scope, value, resolved, vectorUrls: entries.filter((entry) => entry.mimeType === 'image/svg+xml').map((entry) => entry.url) });
    }).catch(() => {
      if (active) setResolution(null);
    });
    return () => {
      active = false;
      releases.forEach((release) => release());
    };
  }, [scope, value]);

  if (!value) return undefined;
  if (!value.includes('cardforge-browser-asset://')) return { value, vectorUrls: [] };
  return resolution?.scope === scope && resolution.value === value ? { value: resolution.resolved, vectorUrls: resolution.vectorUrls } : undefined;
};

/** Compatibility projection over the same CSS resolution lifecycle. */
export const useProjectBinaryAssetValue = (value: string | null | undefined): string | undefined => useProjectBinaryAssetValueResolution(value)?.value;
