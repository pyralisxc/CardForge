export const GALLERY_COLUMNS_OPTIONS = ['auto', '2', '3', '4', '6'] as const;

export type GeneratedGalleryColumns = (typeof GALLERY_COLUMNS_OPTIONS)[number];

export function resolveGeneratedGalleryColumnCount({
  availableWidth,
  minimumItemWidth,
  gap,
  requestedColumns,
  itemCount,
}: {
  availableWidth: number;
  minimumItemWidth: number;
  gap: number;
  requestedColumns: GeneratedGalleryColumns;
  itemCount: number;
}) {
  const columnsThatFit = Math.max(
    1,
    Math.floor((availableWidth + gap) / (minimumItemWidth + gap)),
  );
  const usefulColumns = Math.min(columnsThatFit, Math.max(1, itemCount));

  if (requestedColumns === 'auto') return usefulColumns;

  return Math.min(Number(requestedColumns), usefulColumns);
}
