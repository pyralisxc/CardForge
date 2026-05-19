import { describe, expect, it } from 'vitest';

import {
  cardAssetMetadataOverrideSchema,
  formatZodIssues,
  parseJsonBodyWithLimit,
  stylePresetPayloadSchema,
  templatePayloadSchema,
} from '@/lib/apiValidation';

describe('apiValidation', () => {
  it('rejects payloads that exceed the byte limit via content-length', async () => {
    const request = new Request('http://localhost/api/templates', {
      method: 'POST',
      headers: {
        'content-length': '50',
      },
      body: '{}',
    });

    const result = await parseJsonBodyWithLimit(request, 10);
    expect(result).toEqual({
      ok: false,
      code: 'payload_too_large',
      message: 'Request body exceeds 10 bytes.',
    });
  });

  it('rejects invalid JSON payloads', async () => {
    const request = new Request('http://localhost/api/templates', {
      method: 'POST',
      body: '{invalid',
    });

    const result = await parseJsonBodyWithLimit(request, 1024);
    expect(result).toEqual({
      ok: false,
      code: 'invalid_json',
      message: 'Request body must be valid JSON.',
    });
  });

  it('parses valid JSON payloads', async () => {
    const request = new Request('http://localhost/api/templates', {
      method: 'POST',
      body: JSON.stringify({ id: 'template-1' }),
    });

    const result = await parseJsonBodyWithLimit(request, 1024);
    expect(result).toEqual({
      ok: true,
      data: { id: 'template-1' },
    });
  });

  it('validates minimal template payload requirements', () => {
    const valid = templatePayloadSchema.safeParse({
      id: 'template-1',
      name: 'Demo Template',
      aspectRatio: '63:88',
    });
    expect(valid.success).toBe(true);

    const invalid = templatePayloadSchema.safeParse({
      id: '   ',
      name: 'Demo Template',
      aspectRatio: '63:88',
    });
    expect(invalid.success).toBe(false);
  });

  it('validates style payload shape and reports issue paths', () => {
    const invalid = stylePresetPayloadSchema.safeParse({
      id: 'style-1',
      name: 'Style',
      kind: 'material',
      targets: [],
      appearance: null,
    });

    expect(invalid.success).toBe(false);
    if (invalid.success) return;

    const issueMessages = formatZodIssues(invalid.error.issues);
    expect(issueMessages.some((message) => message.includes('appearance'))).toBe(true);
  });

  it('validates asset metadata sidecar shape and rejects unknown keys', () => {
    const valid = cardAssetMetadataOverrideSchema.safeParse({
      name: 'Marble Vein',
      tileMode: 'repeat',
      seamless: true,
      allowedTargets: ['shape', 'template'],
      defaultBlendMode: 'multiply',
      defaultOpacity: 35,
      defaultScale: 180,
    });
    expect(valid.success).toBe(true);

    const invalid = cardAssetMetadataOverrideSchema.safeParse({
      name: 'Bad Metadata',
      tileMode: 'tile',
      ignoredField: true,
    });
    expect(invalid.success).toBe(false);
    if (invalid.success) return;

    const issueMessages = formatZodIssues(invalid.error.issues);
    expect(issueMessages.some((message) => message.includes('tileMode'))).toBe(true);
    expect(issueMessages.some((message) => message.includes('ignoredField'))).toBe(true);
  });
});
