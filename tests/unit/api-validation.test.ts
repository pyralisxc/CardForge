import { describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

import {
  cardAssetMetadataOverrideSchema,
  formatZodIssues,
  parseJsonBodyWithLimit,
  stylePresetPayloadSchema,
  templatePayloadSchema,
} from '@/lib/apiValidation';
import { createApiErrorResponse } from '@/lib/apiResponses';

describe('apiValidation', () => {
  it('creates no-store JSON API error envelopes with correlation ids', async () => {
    const response = createApiErrorResponse(503, 'service_unavailable', 'Try again later.', [
      'Temporary maintenance window.',
    ]);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('x-correlation-id')).toMatch(/[a-f0-9-]{36}/);
    expect(body).toEqual({
      ok: false,
      error: {
        code: 'service_unavailable',
        message: 'Try again later.',
        details: ['Temporary maintenance window.'],
      },
      correlationId: response.headers.get('x-correlation-id'),
    });
  });

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
      partRole: 'titlePlate',
      defaultWidth: 360,
      defaultHeight: 72,
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

  it('keeps the premium CardForge asset sidecars valid and discoverable', async () => {
    const expectedSidecars = [
      'data/assets/textures/arcane-forge/forged-parchment.json',
      'data/assets/textures/arcane-forge/obsidian-vellum.json',
      'data/assets/textures/arcane-forge/rune-metal.json',
      'data/assets/textures/arcane-forge/ember-leather.json',
      'data/assets/textures/arcane-forge/astral-paper.json',
      'data/assets/textures/arcane-forge/guild-slate.json',
      'data/assets/textures/arcane-forge/frame-creature-premium.json',
      'data/assets/textures/arcane-forge/frame-ttrpg-premium.json',
      'data/assets/textures/arcane-forge/frame-playing-premium.json',
      'data/assets/textures/arcane-forge/back-obsidian-neon-premium.json',
      'data/assets/dividers/arcane-forge/gilded-title-plate.json',
      'data/assets/dividers/arcane-forge/rune-rule-separator.json',
      'data/assets/dividers/arcane-forge/corner-flourish.json',
      'data/assets/dividers/arcane-forge/mana-gem-rule.json',
      'data/assets/dividers/arcane-forge/stat-rail.json',
      'data/assets/dividers/arcane-forge/neon-sigil-divider.json',
    ];

    await Promise.all(expectedSidecars.map(async (relativePath) => {
      const contents = await fs.readFile(path.join(process.cwd(), relativePath), 'utf8');
      const parsed = cardAssetMetadataOverrideSchema.safeParse(JSON.parse(contents));
      expect(parsed.success, `${relativePath} should be valid asset metadata`).toBe(true);
    }));
  });
});
