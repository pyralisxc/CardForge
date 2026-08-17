import { z } from 'zod';

import { reconstructMinimalTemplateObject, type TCGCardTemplate } from '@/domain/templates';
import {
  createProjectDocumentFromState,
  parseProjectDocumentValue,
  type ProjectDocumentV1,
} from '@/features/project/server';

export const STUDIO_DOCUMENT_SOURCES = ['studio', 'gpt', 'import'] as const;
export type StudioDocumentSource = typeof STUDIO_DOCUMENT_SOURCES[number];

export interface StudioDocumentSummary {
  id: string;
  title: string;
  creationSource: StudioDocumentSource;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudioDocument extends StudioDocumentSummary {
  document: ProjectDocumentV1;
}

export interface StudioDocumentWatermarkPolicy {
  required: boolean;
  canExportClean: boolean;
}

const templateDraftSchema = z.object({
  id: z.string().trim().min(1).max(255).nullable().optional(),
  name: z.string().trim().min(1).max(160),
  aspectRatio: z.string().trim().min(1).max(40),
  freeformCanvas: z.object({
    width: z.number().finite().min(1).max(5000),
    height: z.number().finite().min(1).max(5000),
    elements: z.array(z.record(z.string(), z.unknown())).max(200),
  }).passthrough().optional(),
}).passthrough();

export const gptTemplateDraftInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  template: templateDraftSchema,
}).strict();

export type GptTemplateDraftInput = z.infer<typeof gptTemplateDraftInputSchema>;

export const normalizeStudioDocumentTitle = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const title = value.trim().replace(/\s+/g, ' ');
  return title.length >= 1 && title.length <= 160 ? title : null;
};

export const normalizeStudioDocumentPayload = (value: unknown): ProjectDocumentV1 | null => {
  const parsed = parseProjectDocumentValue(value);
  return parsed.success ? parsed.document : null;
};

export const createProjectDocumentFromTemplateDraft = (
  input: GptTemplateDraftInput,
  templateId: string,
): ProjectDocumentV1 => {
  const template = reconstructMinimalTemplateObject({
    ...(input.template as Partial<TCGCardTemplate>),
    id: templateId,
    name: input.template.name.trim(),
    aspectRatio: input.template.aspectRatio.trim(),
    templateSource: 'user',
    templateLibrarySource: 'personal',
    templateAccessTier: undefined,
    templateRegistryStatus: 'localOnly',
    templateContributorName: undefined,
  });

  return createProjectDocumentFromState({
    userTemplates: [template],
    storedCards: [],
    appearanceStyles: [],
  });
};
