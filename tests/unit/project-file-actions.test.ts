import { describe, expect, it } from 'vitest';

import {
  buildProjectImportPreview,
  buildProjectImportSummary,
} from '@/features/project/hooks/useProjectFileActions';
import {
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
} from '@/lib/projectDocument';

describe('project file actions', () => {
  it('summarizes template-only imports without implying nothing happened', () => {
    expect(buildProjectImportSummary({
      importedTemplateCount: 1,
      successCount: 0,
      skippedCount: 0,
    })).toBe('1 template imported. No generated outputs were included in this file.');
  });

  it('includes skipped generated outputs when templates are missing', () => {
    expect(buildProjectImportSummary({
      importedTemplateCount: 2,
      successCount: 3,
      skippedCount: 1,
    })).toBe('2 templates imported. 3 outputs processed. 1 output skipped due to missing or invalid templates.');
  });

  it('builds a preview with import counts and local template conflicts', () => {
    const preview = buildProjectImportPreview({
      fileName: 'project.json',
      currentUserTemplates: [
        { id: 'template-1', name: 'Existing Template' },
        { id: 'template-2', name: 'Same Name' },
      ],
      patch: {
        userTemplates: [
          { id: 'template-1', name: 'Imported Over Existing' },
          { id: 'template-3', name: 'Same Name' },
        ],
        storedCards: [{ uniqueId: 'card-1', templateId: 'template-1', data: {} }],
        appearanceStyles: [{ id: 'style-1', name: 'Style', kind: 'theme', targets: [], appearance: {} }],
        selectedPaperSize: { name: 'Letter', width: 8.5, height: 11 },
        customAssets: {
          [CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]: [{ id: 'texture-1', name: 'Texture', url: 'data:image/png;base64,abc', kind: 'texture', tileMode: 'repeat', seamless: true, allowedTargets: ['text'] }],
          [CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]: [],
          [CUSTOM_ICON_ASSETS_STORAGE_KEY]: [{ id: 'icon-1', name: 'Icon', url: 'data:image/png;base64,abc', kind: 'icon', tileMode: 'contain', seamless: false, allowedTargets: ['icon'] }],
          [CUSTOM_IMAGE_ASSETS_STORAGE_KEY]: [],
        },
      },
    });

    expect(preview).toMatchObject({
      fileName: 'project.json',
      templateCount: 2,
      outputCount: 1,
      appearanceStyleCount: 1,
      customAssetCount: 2,
      exportSettingCount: 1,
      templateIdConflicts: ['Imported Over Existing'],
      templateNameConflicts: ['Same Name'],
    });
  });
});
