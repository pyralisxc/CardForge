import { z } from 'zod';

export const DEFAULT_MAX_JSON_BODY_BYTES = 256 * 1024;

export const templatePayloadSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  aspectRatio: z.string().trim().min(1),
}).passthrough();

const nonEmptyStringSchema = z.string().trim().min(1);

export const stylePresetPayloadSchema = z.object({
  id: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  kind: nonEmptyStringSchema,
  targets: z.array(nonEmptyStringSchema),
  appearance: z.unknown().refine((value) => typeof value === 'object' && value !== null, {
    message: 'appearance must be an object',
  }),
}).passthrough();

const cardAssetAllowedTargetSchema = z.enum(['text', 'shape', 'divider', 'template', 'imageFrame', 'icon', 'image']);
const tileModeSchema = z.enum(['repeat', 'stretch', 'contain']);
const cardPartRoleSchema = z.enum([
  'outerFrame',
  'frameRail',
  'corner',
  'titlePlate',
  'artWindow',
  'rulesBox',
  'statGem',
  'costOrb',
  'panel',
  'overlay',
  'ornament',
]);

export const cardAssetMetadataOverrideSchema = z.object({
  id: nonEmptyStringSchema.optional(),
  name: nonEmptyStringSchema.optional(),
  packId: nonEmptyStringSchema.optional(),
  packName: nonEmptyStringSchema.optional(),
  tileMode: tileModeSchema.optional(),
  seamless: z.boolean().optional(),
  allowedTargets: z.array(cardAssetAllowedTargetSchema).min(1).optional(),
  defaultBlendMode: nonEmptyStringSchema.optional(),
  defaultOpacity: z.number().finite().min(0).max(100).optional(),
  defaultScale: z.number().finite().min(1).max(1000).optional(),
  partRole: cardPartRoleSchema.optional(),
  defaultWidth: z.number().finite().min(1).max(5000).optional(),
  defaultHeight: z.number().finite().min(1).max(5000).optional(),
}).strict();

export const getUtf8ByteLength = (value: string): number => {
  return new TextEncoder().encode(value).length;
};

export type BodyParseResult =
  | { ok: true; data: unknown }
  | {
    ok: false;
    code: 'payload_too_large' | 'invalid_json';
    message: string;
  };

export const parseJsonBodyWithLimit = async (
  request: Request,
  maxBytes = DEFAULT_MAX_JSON_BODY_BYTES
): Promise<BodyParseResult> => {
  const contentLengthHeader = request.headers.get('content-length');
  const contentLength = Number(contentLengthHeader);

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return {
      ok: false,
      code: 'payload_too_large',
      message: `Request body exceeds ${maxBytes} bytes.`,
    };
  }

  let rawBody = '';
  try {
    rawBody = await request.text();
  } catch {
    return {
      ok: false,
      code: 'invalid_json',
      message: 'Unable to read request body.',
    };
  }

  if (getUtf8ByteLength(rawBody) > maxBytes) {
    return {
      ok: false,
      code: 'payload_too_large',
      message: `Request body exceeds ${maxBytes} bytes.`,
    };
  }

  const trimmed = rawBody.trim();
  if (!trimmed) {
    return {
      ok: false,
      code: 'invalid_json',
      message: 'Request body is required and must be valid JSON.',
    };
  }

  try {
    return {
      ok: true,
      data: JSON.parse(trimmed),
    };
  } catch {
    return {
      ok: false,
      code: 'invalid_json',
      message: 'Request body must be valid JSON.',
    };
  }
};

export const formatZodIssues = (issues: z.ZodIssue[]): string[] => {
  return issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
    return `${path}: ${issue.message}`;
  });
};
