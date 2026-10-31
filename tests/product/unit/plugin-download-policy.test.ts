import { describe, expect, it } from 'vitest';
import { mayDownloadPlugin } from '@/features/plugin-distribution/model/downloadPolicy';

describe('native plugin distribution role policy', () => {
  for (const product of ['studio', 'owner'] as const) {
    for (const environment of ['production', 'preview'] as const) {
      it(product + ' ' + environment + ' is server-gated for every role', () => {
        const publicExpected = product === 'studio' && environment === 'production';
        expect(mayDownloadPlugin(product, environment, false, false)).toBe(publicExpected);
        expect(mayDownloadPlugin(product, environment, true, false)).toBe(true);
        expect(mayDownloadPlugin(product, environment, false, true)).toBe(product === 'studio');
      });
    }
  }
});
