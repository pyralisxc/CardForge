export const isSvgAssetSource = (source?: string | null): boolean => {
  const normalized = source?.trim().toLowerCase() ?? '';
  return normalized.startsWith('data:image/svg+xml') || /\.(?:svg|cfsvg)(?:$|[?#])/u.test(normalized);
};

/** A render-only SVG view: explicit Stretch must not retain the source's meet fit. */
export const SVG_STRETCH_VIEW_FRAGMENT = '#svgView(preserveAspectRatio(none))';
export const svgSourceForStretch = (source: string): string => (
  isSvgAssetSource(source) && !source.includes('#') ? `${source}${SVG_STRETCH_VIEW_FRAGMENT}` : source
);
