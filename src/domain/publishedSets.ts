export interface PublishedSetCatalogItem {
  id: string;
  /** Exact source observed alongside this published starter; not copied into authored Sets. */
  submissionId?: string | null;
  name: string;
  packageUrl: string;
  previewUrl: string | null;
  access: 'free' | 'paid' | 'contributor';
  source: 'official' | 'contributor';
  fileSizeBytes: number | null;
  revision: number;
  description: string;
  specialtyTags: string[];
  useCaseTags: string[];
  semanticRole?: string;
  visualFamily?: string | null;
  variantKind?: string;
  variantLabel?: string | null;
  compatibilityTags?: string[];
}

