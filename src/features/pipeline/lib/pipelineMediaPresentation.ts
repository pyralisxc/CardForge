import { z } from 'zod';
import type { FreeformAppearance } from '@/domain/templates';

export const mediaPresentationValuesSchema = z.object({
  tileMode: z.enum(['repeat', 'stretch', 'contain']),
  seamless: z.boolean(),
}).strict();

export const mediaPresentationSchema = z.object({
  schemaVersion: z.literal(1),
  parentSubmissionId: z.string().uuid(),
  lineageId: z.string().uuid(),
  baseRevisionNumber: z.number().int().nonnegative(),
  baseVersion: z.string().regex(/^[a-f0-9]{32}$/),
  registryVersion: z.string().regex(/^[a-f0-9]{32}$/),
  intendedAccessTier: z.enum(['free', 'paid', 'contributor', 'hidden', 'official']),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  baseline: mediaPresentationValuesSchema,
  proposed: mediaPresentationValuesSchema,
}).strict();

export type PipelineMediaPresentation = z.infer<typeof mediaPresentationSchema>;

export const mediaRevisionInputSchema = z.object({
  assetId: z.string().trim().min(1).max(200),
  submissionKey: z.string().uuid(),
  presentation: mediaPresentationSchema,
}).strict().refine(({ presentation: { baseline, proposed } }) => (
  baseline.tileMode !== proposed.tileMode || baseline.seamless !== proposed.seamless
), 'Choose a presentation change.');

export interface MediaRevisionSnapshot {
  assetId: string;
  name: string;
  presentation: PipelineMediaPresentation;
  sourceUrl: string;
}

export const parsePipelineMediaPresentation = (value: unknown): PipelineMediaPresentation | null => {
  return value == null ? null : mediaPresentationSchema.parse(value);
};

// Exact candidate previews never consult the mutable registry or inherited preview URL.
export const pipelineMediaRevisionAppearance = (sourceUrl: string, presentation: PipelineMediaPresentation): FreeformAppearance => ({
  assetSource: sourceUrl,
  assetKind: 'texture',
  tileMode: presentation.proposed.tileMode,
  textureOpacity: 100,
  textureScale: 100,
});
