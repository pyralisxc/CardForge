import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const rootPath = (...parts: string[]) => path.join(process.cwd(), ...parts);

const pathExists = async (...parts: string[]) => {
  try {
    await access(rootPath(...parts));
    return true;
  } catch {
    return false;
  }
};

const collectTypeScriptFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectTypeScriptFiles(entryPath));
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) files.push(entryPath);
  }

  return files;
};

describe('card rendering ownership', () => {
  it('owns card presentation behind one browser-safe interface', async () => {
    const ownedPaths = [
      ['src', 'features', 'card-rendering', 'client.ts'],
      ['src', 'features', 'card-rendering', 'components', 'CardPreview.tsx'],
      ['src', 'features', 'card-rendering', 'components', 'CardTextContent.tsx'],
      ['src', 'features', 'card-rendering', 'components', 'CardWatermarkOverlay.tsx'],
      ['src', 'features', 'card-rendering', 'components', 'CardForgeRichTextEditor.tsx'],
      ['src', 'features', 'card-rendering', 'components', 'TemplateThumbnail.tsx'],
      ['src', 'features', 'card-rendering', 'components', 'VectorShapeElement.tsx'],
      ['src', 'features', 'card-rendering', 'model', 'appearance.ts'],
      ['src', 'features', 'card-rendering', 'model', 'elementStyles.ts'],
      ['src', 'features', 'card-rendering', 'model', 'richTextDocument.ts'],
      ['src', 'features', 'card-rendering', 'model', 'watermarkPolicy.ts'],
    ];

    for (const ownedPath of ownedPaths) {
      await expect(pathExists(...ownedPath), ownedPath.join('/')).resolves.toBe(true);
    }
  });

  it('does not restore retired card rendering locations', async () => {
    const retiredPaths = [
      ['src', 'components', 'card-forge', 'CardForgeRichTextEditor.tsx'],
      ['src', 'components', 'card-forge', 'CardPreview.tsx'],
      ['src', 'components', 'card-forge', 'TemplateThumbnail.tsx'],
      ['src', 'components', 'card-forge', 'VectorShapeElement.tsx'],
      ['src', 'features', 'card-generator', 'components', 'CardWatermarkOverlay.tsx'],
      ['src', 'features', 'card-generator', 'lib', 'cardWatermarkPolicy.ts'],
      ['src', 'features', 'card-generator', 'lib', 'fieldStyleOverrides.ts'],
      ['src', 'features', 'card-generator', 'lib', 'imageFieldOverrides.ts'],
      ['src', 'features', 'card-generator', 'lib', 'structuredRows.ts'],
      ['src', 'features', 'template-editor', 'lib', 'cardFonts.ts'],
      ['src', 'features', 'template-editor', 'lib', 'textBindings.ts'],
      ['src', 'features', 'template-editor', 'lib', 'textElementContracts.ts'],
      ['src', 'features', 'template-editor', 'lib', 'textTools.ts'],
      ['src', 'lib', 'appearance.ts'],
      ['src', 'lib', 'cardBacking.ts'],
      ['src', 'lib', 'cardExportGeometry.ts'],
      ['src', 'lib', 'cardPreviewExport.tsx'],
      ['src', 'lib', 'cardPreviewLayout.ts'],
      ['src', 'lib', 'cardTextRender.tsx'],
      ['src', 'lib', 'elementCapabilities.ts'],
      ['src', 'lib', 'freeformElementRender.ts'],
      ['src', 'lib', 'richTextDocument.ts'],
      ['src', 'lib', 'vectorShapes.ts'],
    ];

    for (const retiredPath of retiredPaths) {
      await expect(pathExists(...retiredPath), retiredPath.join('/')).resolves.toBe(false);
    }
  });

  it('keeps the presentation feature independent from product workflows and workspace state', async () => {
    const featureRoot = rootPath('src', 'features', 'card-rendering');
    const files = await collectTypeScriptFiles(featureRoot);
    const offenders: string[] = [];

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      if (
        source.includes('@/features/card-generator/')
        || source.includes('@/features/template-editor/')
        || source.includes('@/features/project/')
        || source.includes('@/store/')
      ) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }

    const preview = await readFile(rootPath('src', 'features', 'card-rendering', 'components', 'CardPreview.tsx'), 'utf8');
    expect(offenders).toEqual([]);
    expect(preview).not.toContain('useAppStore');
    expect(preview).toContain('highlightColor');
  });

  it('passes presentation settings into clean exports instead of reading workspace state', async () => {
    const exportSource = await readFile(
      rootPath('src', 'features', 'card-generator', 'lib', 'cardPreviewExport.tsx'),
      'utf8',
    );

    expect(exportSource).not.toContain('useAppStore');
    expect(exportSource).not.toContain('@/store/');
    expect(exportSource).toContain('highlightColor = DEFAULT_RICH_TEXT_HIGHLIGHT_COLOR');
    expect(exportSource).toContain('highlightColor,');
  });

  it('allows other features to import only the Card Rendering client interface', async () => {
    const featureFiles = await collectTypeScriptFiles(rootPath('src', 'features'));
    const cardRenderingRoot = `${path.sep}card-rendering${path.sep}`;
    const offenders: string[] = [];

    for (const file of featureFiles) {
      if (file.includes(cardRenderingRoot)) continue;
      const source = await readFile(file, 'utf8');
      const imports = source.matchAll(/from\s+['"](@\/features\/card-rendering\/[^'"]+)['"]/g);
      for (const match of imports) {
        if (match[1] !== '@/features/card-rendering/client') {
          offenders.push(`${path.relative(process.cwd(), file)} -> ${match[1]}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps pure rendering domain modules framework and product independent', async () => {
    const files = await collectTypeScriptFiles(rootPath('src', 'domain', 'rendering'));
    const forbidden = ["from 'react'", 'from "react"', "from 'next/", 'from "next/', '@/features/', '@/infrastructure/', '@/lib/', '@/store/'];
    const offenders: string[] = [];

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      if (forbidden.some((token) => source.includes(token))) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }

    expect(offenders).toEqual([]);
  });
});
