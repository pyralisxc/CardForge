import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createNewSharedTemplateId } from '@/features/developer-assets/lib/developerAssetRegistryCommands';
import { normalizeContentTaxonomyTags } from '@/features/developer-assets/lib/contentTaxonomy';

describe('new Template publication', () => {
  it('creates a stable, developer-owned shared id without trusting a local id as the public id', () => {
    const first = createNewSharedTemplateId({
      developerId: 'developer-1',
      localTemplateId: 'draft-local-1',
      name: 'Summer Event Poster',
    });
    const retry = createNewSharedTemplateId({
      developerId: 'developer-1',
      localTemplateId: 'draft-local-1',
      name: 'Summer Event Poster',
    });
    const otherDeveloper = createNewSharedTemplateId({
      developerId: 'developer-2',
      localTemplateId: 'draft-local-1',
      name: 'Summer Event Poster',
    });

    expect(first).toBe(retry);
    expect(first).toMatch(/^community-summer-event-poster-[a-f0-9]{12}$/);
    expect(otherDeveloper).not.toBe(first);
  });

  it('hands first publication to an editable Pipeline draft without granting publication authority', () => {
    const route = readFileSync(
      resolve(process.cwd(), 'src/app/api/templates/submissions/route.ts'),
      'utf8',
    );
    const editor = readFileSync(
      resolve(process.cwd(), 'src/features/template-editor/components/CardTemplateMaker.tsx'),
      'utf8',
    );
    const ownerReview = readFileSync(
      resolve(process.cwd(), 'src/features/developer-assets/components/OwnerAssetLibraryPanel.tsx'),
      'utf8',
    );

    expect(route).toContain("requireContributionScope(access, 'library.submit')");
    expect(route).toContain("localTemplate.templateSource === 'default'");
    expect(route).toContain('createTemplatePipelineDraft');
    expect(route).toContain('openInPipelineUrl');
    expect(route).not.toContain('publishOwnerTemplateRevision');
    expect(editor).toContain('Continue in Pipeline');
    expect(editor).not.toContain('Publish new Template');
    expect(ownerReview).toContain('Approve & publish new Template');
    expect(ownerReview).toContain('submission.baseRevisionNumber === 0');
  });

  it('normalizes only developer-supplied taxonomy instead of inventing classifications', () => {
    expect(normalizeContentTaxonomyTags(' Games, Event Poster, games, TCG! ')).toEqual([
      'games',
      'event-poster',
      'tcg',
    ]);
    expect(normalizeContentTaxonomyTags(undefined)).toEqual([]);
  });

  it('enforces human-confirmed Pipeline details in the database boundary', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260817061523_template_pipeline_drafts_and_taxonomy.sql'),
      'utf8',
    );

    expect(migration).toContain('cardforge_create_template_pipeline_draft');
    expect(migration).toContain('cardforge_submit_template_pipeline_draft');
    expect(migration).toContain("raise exception 'template_draft_details_required'");
    expect(migration).toContain("submission.status not in ('draft', 'rejected')");
  });
});
