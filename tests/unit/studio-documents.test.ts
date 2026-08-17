import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createProjectDocumentFromTemplateDraft,
  gptTemplateDraftInputSchema,
  normalizeStudioDocumentPayload,
} from '@/features/studio-documents/model';

describe('account Studio documents', () => {
  it('turns a developer AI template into a private editable project document', () => {
    const input = gptTemplateDraftInputSchema.parse({
      title: 'Launch proof poster',
      template: {
        name: 'Launch proof poster',
        aspectRatio: '4:5',
        baseBackgroundColor: '#120c08',
        freeformCanvas: {
          width: 1080,
          height: 1350,
          elements: [{
            id: 'headline',
            type: 'text',
            name: 'Headline',
            x: 80,
            y: 90,
            width: 920,
            height: 180,
            zIndex: 1,
            content: 'Design one card. Build the set.',
          }],
        },
      },
    });

    const document = createProjectDocumentFromTemplateDraft(input, 'gpt-template-123');

    expect(document.version).toBe(1);
    expect(document.userTemplates).toHaveLength(1);
    expect(document.userTemplates[0]).toMatchObject({
      id: 'gpt-template-123',
      name: 'Launch proof poster',
      templateSource: 'user',
      templateLibrarySource: 'personal',
      templateRegistryStatus: 'localOnly',
    });
    expect(document.userTemplates[0].freeformCanvas?.elements[0]).toMatchObject({
      id: 'headline',
      type: 'text',
    });
    expect(normalizeStudioDocumentPayload(document)).toEqual(document);
  });

  it('bounds the developer-only AI input instead of accepting an arbitrary project payload', () => {
    expect(gptTemplateDraftInputSchema.safeParse({
      title: 'Too many layers',
      template: {
        name: 'Too many layers',
        aspectRatio: '1:1',
        freeformCanvas: {
          width: 1000,
          height: 1000,
          elements: Array.from({ length: 201 }, (_, index) => ({ id: String(index) })),
        },
      },
    }).success).toBe(false);

    expect(gptTemplateDraftInputSchema.safeParse({
      title: 'Unexpected command',
      template: { name: 'Draft', aspectRatio: '1:1' },
      publish: true,
    }).success).toBe(false);
  });

  it('keeps plugin access developer-only and delegates watermark eligibility to the existing entitlement owner', () => {
    const route = readFileSync(resolve(process.cwd(), 'src/app/api/studio-documents/template-drafts/route.ts'), 'utf8');
    const service = readFileSync(resolve(process.cwd(), 'src/features/studio-documents/server/developerTemplateDrafts.ts'), 'utf8');
    const access = readFileSync(resolve(process.cwd(), 'src/features/studio-documents/server/studioDocumentAccess.ts'), 'utf8');

    expect(service).toContain("requireContributionScope(access, 'studio.ai.create')");
    expect(access).toContain('isWatermarkRequired(entitlement.capabilities.canExportClean)');
    expect(route).not.toContain('watermarkPreviewOpacity');
  });
});

describe('account Studio document migration', () => {
  const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260817061522_account_studio_documents.sql'),
    'utf8',
  ).toLowerCase().replace(/\s+/g, ' ');

  it('creates private Clerk-owned documents with optimistic revisions', () => {
    expect(migration).toContain('create table public.cardforge_studio_documents');
    expect(migration).toContain('owner_user_id text not null');
    expect(migration).toContain('document_payload jsonb not null');
    expect(migration).toContain('revision integer not null default 1');
    expect(migration).toContain('alter table public.cardforge_studio_documents enable row level security');
    expect(migration).toContain('revoke all privileges on public.cardforge_studio_documents from public, anon, authenticated');
    expect(migration).toContain('grant all privileges on public.cardforge_studio_documents to service_role');
  });

  it('does not persist watermark state beside editable content', () => {
    expect(migration).not.toContain('watermark_required');
    expect(migration).not.toContain('can_export_clean');
  });
});
