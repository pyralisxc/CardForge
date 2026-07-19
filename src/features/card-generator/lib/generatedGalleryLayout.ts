export const GALLERY_COLUMNS_OPTIONS = ['auto', '2', '3', '4', '6'] as const;

export type GeneratedGalleryColumns = (typeof GALLERY_COLUMNS_OPTIONS)[number];

export function resolveGeneratedGalleryColumnCount({
  availableWidth,
  minimumItemWidth,
  gap,
  requestedColumns,
}: {
  availableWidth: number;
  minimumItemWidth: number;
  gap: number;
  requestedColumns: GeneratedGalleryColumns;
}) {
  const columnsThatFit = Math.max(
    1,
    Math.floor((availableWidth + gap) / (minimumItemWidth + gap)),
  );

  if (requestedColumns === 'auto') return columnsThatFit;

  return Math.min(Number(requestedColumns), columnsThatFit);
}
