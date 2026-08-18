import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('Forge Review taxonomy ingress architecture', () => {
  it('collects controlled taxonomy before the initial upload', () => {
    const submissionPanel = read('src/features/developer-assets/components/DeveloperAssetSubmissionPanel.tsx');
    expect(submissionPanel).toContain('ControlledTaxonomySelect');
    expect(submissionPanel).toContain('CARDFORGE_SPECIALTY_OPTIONS');
    expect(submissionPanel).toContain('CARDFORGE_USE_CASE_OPTIONS');
    expect(submissionPanel).toContain("formData.set('specialtyTags'");
    expect(submissionPanel).toContain("formData.set('useCaseTags'");
    expect(submissionPanel).not.toContain('placeholder="games, marketing"');
    expect(submissionPanel).not.toContain('placeholder="tcg, event-poster"');
  });

  it('carries initial classification through the existing upload workflow', () => {
    const route = read('src/app/api/developer-assets/route.ts');
    const uploader = read('src/features/developer-assets/lib/developerAssetUploadSubmission.ts');
    const store = read('src/features/developer-assets/lib/developerAssetStore.ts');

    expect(route).toContain("specialtyTags: formData.get('specialtyTags')");
    expect(route).toContain("useCaseTags: formData.get('useCaseTags')");
    expect(uploader).toContain('specialtyTags,');
    expect(uploader).toContain('useCaseTags,');
    expect(store).toContain('specialty_tags: normalized.value.specialtyTags');
    expect(store).toContain('use_case_tags: normalized.value.useCaseTags');
  });

  it('keeps specialty and use-case vocabularies semantically distinct on the server', () => {
    const program = read('src/features/developer-assets/lib/developerAssetProgram.ts');
    expect(program).toContain('normalizeSpecialtyTags(value.specialtyTags)');
    expect(program).toContain('normalizeUseCaseTags(value.useCaseTags)');
    expect(program).toContain('normalizeSpecialtyTags(row.specialty_tags)');
    expect(program).toContain('normalizeUseCaseTags(row.use_case_tags)');
    expect(program).not.toContain('normalizeContentTaxonomyTags(row.specialty_tags)');
    expect(program).not.toContain('normalizeContentTaxonomyTags(row.use_case_tags)');
  });

  it('does not add a parallel persistence or migration layer', () => {
    const uploader = read('src/features/developer-assets/lib/developerAssetUploadSubmission.ts');
    expect(uploader).toContain('createDeveloperAssetSubmission');
    expect(uploader).toContain('DEVELOPER_ASSET_STORAGE_BUCKET');
  });
});
