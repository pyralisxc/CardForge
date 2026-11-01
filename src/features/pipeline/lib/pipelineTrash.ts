/** Protected read projection. These facts are never creator-editable tags. */
export type PipelineTrashFacts = {
  trashedAt?: string | null;
  purgeAfter?: string | null;
  retentionHold?: boolean;
  catalogTrashedAt?: string | null;
  catalogPurgeAfter?: string | null;
  catalogRetentionHold?: boolean;
  catalogSubmissionId?: string | null;
};

export function getPipelineTrashState(row: PipelineTrashFacts) {
  const scope = row.catalogTrashedAt ? 'catalog' : row.trashedAt ? 'revision' : null;
  return {
    trashed: scope !== null,
    scope,
    trashedAt: row.catalogTrashedAt ?? row.trashedAt ?? null,
    purgeAfter: scope === 'catalog' ? row.catalogPurgeAfter ?? null : row.purgeAfter ?? null,
    held: scope === 'catalog' ? row.catalogRetentionHold === true : row.retentionHold === true,
    catalogSubmissionId: scope === 'catalog' ? row.catalogSubmissionId ?? null : null,
  };
}
