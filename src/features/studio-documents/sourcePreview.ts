import { z } from 'zod/v4';
import type { ProjectDocumentV1 } from '@/features/project/client/model';
import type { PipelineMediaPresentation } from '@/features/pipeline/client';
import type { AppearanceStylePreset, TCGCardTemplate } from '@/domain/templates';

const ids = z.array(z.string().min(1).max(255)).min(1).max(12).refine(v => new Set(v).size === v.length);
export const savedSourceSelectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('pipeline-candidate'), identity: z.record(z.string(), z.unknown()) }).strict(),
  z.object({ kind: z.literal('google-drive'), projectId: z.string().min(8).max(255), expectedProviderRevision: z.string().min(1).max(255), expectedProjectRevision: z.string().regex(/^[a-f0-9]{64}$/), setId: z.string().min(1).max(255).optional(), cardIds: ids.optional() }).strict(),
  z.object({ kind: z.literal('pipeline'), assetId: z.string().min(1).max(200), submissionId: z.string().uuid(), lineageId: z.string().uuid(), selection: z.enum(['current', 'historical']), setId: z.string().max(255).optional(), cardIds: ids.optional() }).strict(),
]);
export type SavedSourceSelection = z.infer<typeof savedSourceSelectionSchema>;
export const sourceRenderRequestSchema = z.object({ source: savedSourceSelectionSchema, sourceVersion: z.string().regex(/^[a-f0-9]{64}$/), operation: z.enum(['preview', 'export', 'clean-export']) }).strict();
export type SourceRenderRequest = z.infer<typeof sourceRenderRequestSchema>;
export type NativeSourceContent =
  | { kind: 'cards'; document: ProjectDocumentV1; setId: string; cardIds: string[] }
  | { kind: 'template'; template: TCGCardTemplate }
  | { kind: 'recipe'; recipe: AppearanceStylePreset }
  | { kind: 'media'; dataUrl: string; presentation?: PipelineMediaPresentation | null }
  | { kind: 'font'; dataUrl: string }
  | { kind: 'unsupported'; reason: string };
export interface NativeSourceSnapshot {
  title: string;
  sourceIntegrity?: { kind: string; notice: string };
  availableSelections?: Array<{ setId: string; name: string; totalCards: number; cardIds: string[] }>;
  sourceVersion: string;
  content: NativeSourceContent;
  identity: Record<string, string | number | null>;
}
