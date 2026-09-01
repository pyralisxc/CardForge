"use client";

import type { CSSProperties } from 'react';

import { useProjectBinaryAssetUrl } from '../client/useProjectBinaryAssetUrl';

interface ProjectBinaryAssetBackgroundProps {
  className?: string;
  source: string;
  style?: CSSProperties;
}

/** A mounted preview owns exactly one temporary object URL and releases it on unmount. */
export function ProjectBinaryAssetBackground({ className, source, style }: ProjectBinaryAssetBackgroundProps) {
  const resolvedSource = useProjectBinaryAssetUrl(source);
  return (
    <span
      className={className}
      style={{ ...style, backgroundImage: resolvedSource ? `url("${resolvedSource}")` : undefined }}
      aria-hidden="true"
    />
  );
}
