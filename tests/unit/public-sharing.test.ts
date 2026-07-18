import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('owner-managed public sharing', () => {
  it('provides one global owner-controlled share message to generated-card sharing', () => {
    const contextPath = resolve(process.cwd(), 'src/features/card-generator/components/PublicShareSettingsContext.tsx');
    expect(existsSync(contextPath)).toBe(true);

    const layout = readSource('src/app/layout.tsx');
    const shareButton = readSource('src/features/card-generator/components/ShareCardButton.tsx');
    expect(layout).toContain("getCachedSiteContentBlocks('sharing')");
    expect(layout).toContain('<PublicShareSettingsProvider');
    expect(shareButton).toContain('usePublicShareSettings');
    expect(shareButton).toContain('text: shareSettings.message');
    expect(shareButton).toContain('url: shareSettings.homepageUrl');
    expect(shareButton).toContain('Copy caption &amp; link');
    expect(shareButton).toContain('navigator.clipboard.writeText');
    expect(shareButton).not.toContain("url: 'https://cardforges.com/studio'");
  });

  it('offers separate downloadable homepage and Cameron QR assets in the owner console', () => {
    const toolkitPath = resolve(process.cwd(), 'src/features/owner/components/OwnerShareToolkit.tsx');
    expect(existsSync(toolkitPath)).toBe(true);

    const toolkit = readSource('src/features/owner/components/OwnerShareToolkit.tsx');
    const panel = readSource('src/features/owner/components/OwnerPublicContentPanel.tsx');
    expect(toolkit).toContain('QRCodeCanvas');
    expect(toolkit).toContain('Homepage QR code');
    expect(toolkit).toContain('Cameron page QR code');
    expect(toolkit).toContain('Download PNG');
    expect(toolkit).toContain('Share QR code');
    expect(panel).toContain('<OwnerShareToolkit');
  });
});
