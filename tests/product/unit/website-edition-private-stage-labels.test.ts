import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const source = (path: string) => readFileSync(resolve(path), 'utf8');
describe('Website Edition private staging labels', () => {
  it('renders stage controls for selected manifest without changing live publication routing', () => {
    const owner = source('src/features/public-site/components/PublicSiteOwnerLiveControls.tsx');
    expect(owner).toContain("manifest && editionId ? 'Stage changes'");
    expect(owner).toContain('stageOnly={Boolean(manifest && editionId)}');
    expect(owner).toContain("editionSaving ? 'Saving…' : 'Save revision'");
    expect(owner).toContain('activateEditionRevision()');
    expect(owner).toContain("if (manifest && editionId) {");
    expect(owner).toContain("savePublicSiteContentBlock({ slug: block.slug");
  });
  it('preserves truthful live labels and warns only live field edits as published', () => {
    const editor = source('src/features/public-site/components/PublicSiteCopyLiveEditor.tsx');
    expect(editor).toContain("stageOnly ? (busy ? 'Staging…' : 'Stage changes')");
    expect(editor).toContain('publication.publishActionLabel');
    expect(editor).toContain("stageOnly ? 'Current draft value' : 'Current published value'");
  });
});
