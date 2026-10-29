import type { TCGCardTemplate } from '@/domain/templates';

/** Transient authoring intent, never Template content or an adoption receipt. */
export interface ManagedRasterSelection {
  registryAssetId: string;
  publishedSubmissionId: string;
  elementId: string;
}

export function managedRasterSlotIssue(template: TCGCardTemplate, elementId: string): string | null {
  const chosen = (template.freeformCanvas?.elements ?? []).filter(element => element.id === elementId);
  if (chosen.length !== 1 || chosen[0].type !== 'image') return 'Select one image element.';
  if (chosen[0].imageSource?.includes('{{') || (chosen[0].content !== undefined && chosen[0].content !== '')
    || template.fieldContracts?.some(contract => contract.type === 'image')
    || Object.keys(template.templatePreviewData ?? {}).length > 0) {
    return 'Managed adoption needs a static image slot without content, image fields or preview overrides. Your existing content is unchanged.';
  }
  return null;
}
