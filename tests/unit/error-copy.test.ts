import { describe, expect, it } from 'vitest';

import { ERROR_COPY } from '@/lib/errorCopy';

describe('error copy', () => {
  it('uses non-empty titles for all error copy entries', () => {
    Object.values(ERROR_COPY).forEach((entry) => {
      expect(entry.title.trim().length).toBeGreaterThan(0);
    });
  });

  it('keeps titles unique to avoid ambiguous toasts', () => {
    const titles = Object.values(ERROR_COPY).map((entry) => entry.title);
    const uniqueTitles = new Set(titles);

    expect(uniqueTitles.size).toBe(titles.length);
  });

  it('contains baseline workflow keys', () => {
    expect(ERROR_COPY).toHaveProperty('selectTemplateFirst');
    expect(ERROR_COPY).toHaveProperty('requiredFieldsMissing');
    expect(ERROR_COPY).toHaveProperty('csvRequired');
    expect(ERROR_COPY).toHaveProperty('strictModeBlocked');
    expect(ERROR_COPY).toHaveProperty('pdfNoCards');
    expect(ERROR_COPY).toHaveProperty('exportFailed');
  });
});
