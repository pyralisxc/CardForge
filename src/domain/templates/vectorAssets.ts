export const isSvgAssetSource = (source?: string | null): boolean => {
  const normalized = source?.trim().toLowerCase() ?? '';
  return normalized.startsWith('data:image/svg+xml') || /\.(?:svg|cfsvg)(?:$|[?#])/u.test(normalized);
};
