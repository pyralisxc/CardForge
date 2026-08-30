import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('lean Studio bootstrap', () => {
  it('keeps the full catalog out of the Studio critical boot consumers', () => {
    const bootstrap = source('src/features/app-shell/hooks/useBootstrapLibraries.ts');
    const editorSession = source('src/features/template-editor/hooks/useTemplateEditorSession.ts');
    const assetLibrary = source('src/features/template-editor/hooks/useTemplateAssetLibrary.ts');

    expect(bootstrap).toContain('loadCardForgeStudioBootstrap');
    expect(bootstrap).not.toContain('loadCardForgeCatalog');
    expect(editorSession).toContain('loadCardForgeStudioBootstrap');
    expect(editorSession).not.toContain('loadCardForgeCatalog');
    expect(editorSession).toContain('if (!isActive) return;');
    expect(assetLibrary).toContain('loadCardForgeStudioAssets');
    expect(assetLibrary).not.toContain('loadCardForgeCatalog');
  });

  it('uses purpose-built endpoints for core libraries and editor art', () => {
    const catalogClient = source('src/features/pipeline/client/catalog.ts');
    const bootstrapRoute = source('src/app/api/catalog/studio-bootstrap/route.ts');
    const assetRoute = source('src/app/api/catalog/studio-assets/route.ts');

    expect(catalogClient).toContain("'/api/catalog/studio-bootstrap'");
    expect(catalogClient).toContain("'/api/catalog/studio-assets'");
    expect(bootstrapRoute).toContain('getCachedCardForgeStudioBootstrap');
    expect(assetRoute).toContain('getCachedCardForgeStudioAssets');
  });

  it('does not serialize templates or element presets into the editor-art view', () => {
    const manifest = source('src/features/pipeline/lib/catalogManifest.ts');

    expect(manifest).toContain("Pick<AssetRegistryPayload, 'textures' | 'dividers' | 'icons' | 'imageAssets'>");
    expect(manifest).toContain('textures: payload.textures');
    expect(manifest).toContain('imageAssets: payload.imageAssets');
  });
});
