"use client";

import { useProjectBinaryAssetUrl } from '../client/useProjectBinaryAssetUrl';

interface ProjectBinaryAssetImageProps {
  alt: string;
  className?: string;
  source: string;
}

export function ProjectBinaryAssetImage({ alt, className, source }: ProjectBinaryAssetImageProps) {
  const resolvedSource = useProjectBinaryAssetUrl(source);
  return resolvedSource ? <img src={resolvedSource} alt={alt} className={className} /> : null;
}
