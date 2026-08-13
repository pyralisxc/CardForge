import type { DeveloperAssetType, DeveloperAssetStatus } from './developerAssets';
import type { DeveloperAssetSubmission } from './developerAssetProgram';

export const OWNER_ASSET_LIBRARY_PAGE_SIZE = 12;

export type OwnerAssetStatusFilter = DeveloperAssetStatus | 'all';
export type OwnerAssetTypeFilter = DeveloperAssetType | 'all';

export interface OwnerAssetLibraryQuery {
  page: number;
  pageSize?: number;
  query?: string;
  status: OwnerAssetStatusFilter;
  assetType: OwnerAssetTypeFilter;
}

export interface OwnerAssetLibraryPage {
  items: DeveloperAssetSubmission[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  firstItemNumber: number;
  lastItemNumber: number;
}

const matchesSearch = (submission: DeveloperAssetSubmission, query: string): boolean => {
  if (!query) return true;

  return [
    submission.name,
    submission.description,
    submission.developerDisplayName,
    submission.developerEmail,
    submission.developerId,
    submission.registryAssetId,
  ].some((value) => value?.toLocaleLowerCase().includes(query));
};

export const buildOwnerAssetLibraryPage = (
  submissions: DeveloperAssetSubmission[],
  filters: OwnerAssetLibraryQuery,
): OwnerAssetLibraryPage => {
  const pageSize = Math.max(1, Math.floor(filters.pageSize ?? OWNER_ASSET_LIBRARY_PAGE_SIZE));
  const query = filters.query?.trim().toLocaleLowerCase() ?? '';
  const matching = submissions.filter((submission) => (
    (filters.status === 'all' || submission.status === filters.status)
    && (filters.assetType === 'all' || submission.assetType === filters.assetType)
    && matchesSearch(submission, query)
  ));
  const totalItems = matching.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(totalPages, Math.max(1, Math.floor(filters.page) || 1));
  const firstIndex = (page - 1) * pageSize;
  const items = matching.slice(firstIndex, firstIndex + pageSize);

  return {
    items,
    page,
    pageSize,
    totalItems,
    totalPages,
    firstItemNumber: totalItems === 0 ? 0 : firstIndex + 1,
    lastItemNumber: totalItems === 0 ? 0 : firstIndex + items.length,
  };
};
