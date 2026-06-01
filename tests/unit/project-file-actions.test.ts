import { describe, expect, it } from 'vitest';

import { buildProjectImportSummary } from '@/features/project/hooks/useProjectFileActions';

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
});
