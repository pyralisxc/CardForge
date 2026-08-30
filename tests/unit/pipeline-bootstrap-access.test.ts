import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readBootstrapJson = (path: string): Record<string, unknown> => JSON.parse(
  readFileSync(join(process.cwd(), 'data', 'pipeline-bootstrap', ...path.split('/')), 'utf8'),
) as Record<string, unknown>;

describe('Pipeline bootstrap access tiers', () => {
  it('keeps the curated premium launch resources out of the Free catalog', () => {
    const resources = [
      ['metadata/images/frames/back/back-obsidian-neon-premium.json', 'pipelineAccessTier'],
      ['metadata/images/frames/front/frame-creature-premium.json', 'pipelineAccessTier'],
      ['metadata/images/frames/front/frame-playing-premium.json', 'pipelineAccessTier'],
      ['metadata/images/frames/front/frame-ttrpg-premium.json', 'pipelineAccessTier'],
      ['recipes/material-obsidian-neon-premium.json', 'accessTier'],
      ['templates/default-obsidian-neon-card-back.json', 'templateAccessTier'],
    ] as const;

    for (const [path, tierField] of resources) {
      expect(readBootstrapJson(path)[tierField], path).toBe('paid');
    }
  });
});
