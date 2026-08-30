import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('Forge Review taxonomy ingress architecture', () => {
  it('collects controlled taxonomy before the initial upload', () => {
    const submissionPanel = read('src/features/pipeline/components/PipelineSubmissionPanel.tsx');
    expect(submissionPanel).toContain('ControlledTaxonomySelect');
    expect(submissionPanel).toContain('CARDFORGE_SPECIALTY_OPTIONS');
    expect(submissionPanel).toContain('CARDFORGE_USE_CASE_OPTIONS');
    expect(submissionPanel).toContain('specialtyTags,');
    expect(submissionPanel).toContain('useCaseTags,');
    expect(submissionPanel).toContain("headers: { 'Content-Type': 'application/json' }");
    expect(submissionPanel).not.toContain('placeholder="games, marketing"');
    expect(submissionPanel).not.toContain('placeholder="tcg, event-poster"');
  });

  it('carries initial classification through the direct-upload workflow', () => {
    const route = read('src/app/api/pipeline/route.ts');
    const uploader = read('src/features/pipeline/lib/pipelineUploadSubmission.ts');
    const store = read('src/features/pipeline/lib/pipelineStore.ts');

    expect(route).toContain('specialtyTags: body.specialtyTags');
    expect(route).toContain('useCaseTags: body.useCaseTags');
    expect(route).not.toContain('request.formData()');
    expect(uploader).toContain('specialtyTags,');
    expect(uploader).toContain('useCaseTags,');
    expect(store).toContain('specialty_tags: normalized.value.specialtyTags');
    expect(store).toContain('use_case_tags: normalized.value.useCaseTags');
  });

  it('keeps specialty and use-case vocabularies semantically distinct on the server', () => {
    const program = read('src/features/pipeline/lib/pipelineProgram.ts');
    expect(program).toContain('normalizeSpecialtyTags(value.specialtyTags)');
    expect(program).toContain('normalizeUseCaseTags(value.useCaseTags)');
    expect(program).toContain('normalizeSpecialtyTags(row.specialty_tags)');
    expect(program).toContain('normalizeUseCaseTags(row.use_case_tags)');
    expect(program).not.toContain('normalizeContentTaxonomyTags(row.specialty_tags)');
    expect(program).not.toContain('normalizeContentTaxonomyTags(row.use_case_tags)');
  });

  it('does not add a parallel persistence or migration layer', () => {
    const uploader = read('src/features/pipeline/lib/pipelineUploadSubmission.ts');
    expect(uploader).toContain('createPipelineSubmission');
    expect(uploader).toContain('PIPELINE_STORAGE_BUCKET');
    expect(uploader).toContain('decodeCardForgeProjectPackage');
    expect(uploader).toContain('Published Set packages must contain at least one card.');
    const publishedSet = read('supabase/migrations/20260827120000_published_set_registry.sql');
    expect(publishedSet).toContain('cardforge_sync_studio_asset_registry');
    expect(publishedSet).toContain("asset_type <> 'sets'");
    expect(publishedSet).toContain("'portableProject', true");
  });
});
