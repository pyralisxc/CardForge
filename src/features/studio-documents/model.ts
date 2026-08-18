import { z } from 'zod';

import {
  CARDFORGE_FREEFORM_ELEMENT_TYPES,
  CARDFORGE_FREEFORM_SHAPE_KINDS,
  reconstructMinimalTemplateObject,
  type TCGCardTemplate,
} from '@/domain/templates';
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

const templateDraftElementSchema = z.object({
  id: z.string().trim().min(1).max(255).optional(),
  type: z.enum(CARDFORGE_FREEFORM_ELEMENT_TYPES),
  name: z.string().trim().min(1).max(160).optional(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  width: z.number().finite().positive().optional(),
  height: z.number().finite().positive().optional(),
  rotation: z.number().finite().optional(),
  opacity: z.number().finite().min(0).max(1).optional(),
  zIndex: z.number().finite().optional(),
  locked: z.boolean().optional(),
  content: z.string().max(20_000).optional(),
  imageSource: z.string().max(20_000).optional(),
  iconImageSource: z.string().max(20_000).optional(),
  iconName: z.string().max(255).optional(),
  shapeKind: z.enum(CARDFORGE_FREEFORM_SHAPE_KINDS).optional(),
  textColor: z.string().max(255).optional(),
  backgroundColor: z.string().max(255).optional(),
  backgroundImageUrl: z.string().max(20_000).optional(),
  fontFamily: z.string().max(255).optional(),
  fontSize: z.enum(['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl']).optional(),
  fontSizePx: z.number().finite().positive().max(1000).optional(),
  fontWeight: z.enum(['font-normal', 'font-medium', 'font-semibold', 'font-bold']).optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  fontStyle: z.enum(['normal', 'italic']).optional(),
  letterSpacing: z.string().max(100).optional(),
  lineHeight: z.string().max(100).optional(),
  padding: z.string().max(100).optional(),
  borderColor: z.string().max(255).optional(),
  borderWidth: z.string().max(100).optional(),
  borderRadius: z.string().max(100).optional(),
  minHeight: z.string().max(100).optional(),
  imageObjectFit: z.enum(['cover', 'contain', 'fill', 'none']).optional(),
  fillColor: z.string().max(255).optional(),
  strokeColor: z.string().max(255).optional(),
  strokeWidth: z.number().finite().min(0).max(100).optional(),
}).strict();

const templateDraftSchema = z.object({
  id: z.string().trim().min(1).max(255).nullable().optional(),
  name: z.string().trim().min(1).max(160),
  aspectRatio: z.string().trim().min(1).max(40),
  baseBackgroundColor: z.string().max(255).optional(),
  baseTextColor: z.string().max(255).optional(),
  cardBackgroundImageUrl: z.string().max(20_000).optional(),
  cardBorderColor: z.string().max(255).optional(),
  cardBorderWidth: z.string().max(100).optional(),
  cardBorderStyle: z.string().max(100).optional(),
  cardBorderRadius: z.string().max(100).optional(),
  freeformCanvas: z.object({
    width: z.number().finite().min(1).max(5000),
    height: z.number().finite().min(1).max(5000),
    elements: z.array(templateDraftElementSchema).max(200),
  }).strict().optional(),
}).strict();

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
