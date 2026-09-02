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
export const useProjectBinaryAssetUrl = (source: string | null | undefined): string | undefined => {
  const scope = getProjectPersistenceScope();
  const [resolution, setResolution] = useState<{ source: string; url: string } | null>(null);

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
      setResolution({ source, url: handle.url });
    }).catch(() => {
      if (active) setResolution(null);
    });
    return () => {
      active = false;
      release();
    };
  }, [scope, source]);

  if (!source) return undefined;
  if (!isProjectBinaryAssetReference(source)) return source;
  return resolution?.source === source ? resolution.url : undefined;
};

const BINARY_REFERENCE_PATTERN = /cardforge-browser-asset:\/\/[a-f0-9]{64}/gu;

/** Resolves references embedded inside CSS values such as url(...). */
export const useProjectBinaryAssetValue = (value: string | null | undefined): string | undefined => {
  const scope = getProjectPersistenceScope();
  const [resolution, setResolution] = useState<{ value: string; resolved: string } | null>(null);

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
        return [reference, reference] as const;
      }
      releases.push(handle.release);
      return [reference, handle.url] as const;
    })).then((entries) => {
      if (!active) return;
      const resolved = entries.reduce((current, [reference, url]) => current.replaceAll(reference, url), value);
      setResolution({ value, resolved });
    }).catch(() => {
      if (active) setResolution(null);
    });
    return () => {
      active = false;
      releases.forEach((release) => release());
    };
  }, [scope, value]);

  if (!value) return undefined;
  if (!value.includes('cardforge-browser-asset://')) return value;
  return resolution?.value === value ? resolution.resolved : undefined;
};
