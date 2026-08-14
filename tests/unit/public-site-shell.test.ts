import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) => readFileSync(
  resolve(process.cwd(), relativePath),
  'utf8',
);

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '');
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
};

const relativeLuminance = (hex: string) => {
  const [red, green, blue] = hexToRgb(hex).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
};

const contrastRatio = (first: string, second: string) => {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
};

const readHexToken = (source: string, token: string) => {
  const match = source.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`));
  expect(match, `${token} should be a six-digit hex color`).not.toBeNull();
  return match![1];
};

describe('public site shell source contract', () => {
  it('owns one navigation catalog shared by the header and compact footer', () => {
    const navigationSource = readSource('src/features/public-site/model/publicNavigation.ts');
    const headerSource = readSource('src/features/public-site/components/PublicSiteHeader.tsx');
    const footerSource = readSource('src/features/public-site/components/PublicSiteFooter.tsx');
    const layoutSource = readSource('src/app/layout.tsx');

    expect(navigationSource).toContain('export const PUBLIC_NAVIGATION');
    expect(navigationSource).toContain('footerGroups');
    expect(navigationSource).toContain('footerGroups\n  .flatMap<PublicNavigationLink>');
    expect(headerSource).toContain("from '../model/publicNavigation'");
    expect(footerSource).toContain("from '../model/publicNavigation'");
    expect(headerSource).not.toContain('const baseNavItems');
    expect(footerSource).toContain('PUBLIC_NAVIGATION.footerGroups.map');
    expect(layoutSource).toContain('getCachedFounderProfile');
    expect(layoutSource).toContain('<FounderProfileProvider profile={founderProfile}>');
  });

  it('provides skip navigation and one stable semantic landmark sequence', () => {
    const shellSource = readSource('src/features/public-site/components/PublicSiteShell.tsx');
    const headerSource = readSource('src/features/public-site/components/PublicSiteHeader.tsx');
    const footerSource = readSource('src/features/public-site/components/PublicSiteFooter.tsx');

    expect(shellSource).toContain('href="#main-content"');
    expect(shellSource).toContain('cardforge-public-skip-link');
    expect(shellSource).toContain('<main id="main-content"');
    expect(headerSource).toContain('<header');
    expect(headerSource).toContain('aria-label="Primary navigation"');
    expect(footerSource).toContain('<footer');
    expect(footerSource).toContain('aria-label="Footer links"');
  });

  it('uses an accessible non-wrapping mobile dialog menu without owning account state', () => {
    const headerSource = readSource('src/features/public-site/components/PublicSiteHeader.tsx');

    expect(headerSource).toContain('Dialog');
    expect(headerSource).toContain('aria-expanded={mobileMenuOpen}');
    expect(headerSource).toContain('aria-label="Open menu"');
    expect(headerSource).toContain('min-h-11');
    expect(headerSource).toContain('xl:flex');
    expect(headerSource).toContain('xl:hidden');
    expect(headerSource).not.toContain('order-3 flex w-full flex-wrap');
    expect(headerSource).toContain('accountSlot?: ReactNode');
    expect(headerSource).not.toContain('PublicAuthControls');
    expect(headerSource).not.toContain("@/features/account");
    expect(headerSource).toContain('Check out our developer');
    expect(headerSource).toContain('PUBLIC_NAVIGATION.founder.href');
    expect(headerSource).toContain('Follow CardForge Studio');
  });

  it('opts the portaled mobile menu into public tokens and reduced motion', () => {
    const headerSource = readSource('src/features/public-site/components/PublicSiteHeader.tsx');
    const dialogSource = readSource('src/components/ui/dialog.tsx');
    const globalStyles = readSource('src/app/globals.css');

    expect(headerSource).toContain('className="cardforge-public-tokens cardforge-public-mobile-menu');
    expect(headerSource).toContain('overlayClassName="cardforge-public-tokens"');
    expect(dialogSource).toContain('overlayClassName?: string;');
    expect(dialogSource).toContain('<DialogOverlay className={overlayClassName} />');
    expect(globalStyles).toContain('.cardforge-public,\n.cardforge-public-tokens {');
    expect(globalStyles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.cardforge-public-tokens,[\s\S]*\.cardforge-public-tokens \*/);
  });

  it('uses a two-layer public focus treatment with contrast on light and dark surfaces', () => {
    const globalStyles = readSource('src/app/globals.css');
    const publicFocus = readHexToken(globalStyles, '--public-focus');
    const publicFocusContrast = readHexToken(globalStyles, '--public-focus-contrast');
    const publicIvory = readHexToken(globalStyles, '--public-ivory');
    const publicCharcoal = readHexToken(globalStyles, '--public-charcoal');

    expect(contrastRatio(publicFocus, publicIvory)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(publicFocusContrast, publicCharcoal)).toBeGreaterThanOrEqual(3);
    expect(globalStyles).toContain('outline: 3px solid var(--public-focus);');
    expect(globalStyles).toContain('box-shadow: 0 0 0 7px var(--public-focus-contrast);');
  });

  it('scopes the public visual tokens, focus treatment, and reduced motion behavior', () => {
    const globalStyles = readSource('src/app/globals.css');
    const footerSource = readSource('src/features/public-site/components/PublicSiteFooter.tsx');
    const legalPageSource = readSource('src/features/legal/components/PublicLegalPage.tsx');

    expect(globalStyles).toContain('.cardforge-public {');
    for (const token of [
      '--public-charcoal',
      '--public-ivory',
      '--public-brass',
      '--public-text',
      '--public-muted-text',
      '--public-border',
      '--public-focus',
      '--public-focus-contrast',
      '--public-radius',
      '--public-shadow',
      '--public-space',
      '--public-font-body',
      '--public-font-display',
    ]) {
      expect(globalStyles, token).toContain(token);
    }
    expect(globalStyles).toContain('.cardforge-public-skip-link:focus-visible');
    expect(globalStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(globalStyles).toContain('.cardforge-public-auth-status');
    expect(footerSource).toContain('grid grid-cols-2');
    expect(footerSource).toContain('text-xs font-semibold uppercase');
    expect(footerSource).toContain('min-h-9 items-center text-sm');
    expect(legalPageSource).toContain('[&>div]:text-base');
    expect(legalPageSource).not.toMatch(/text-(?:xs|sm)/);
    expect(legalPageSource).toContain('<p className="text-base font-bold text-[var(--public-brass)]');
    expect(legalPageSource).toContain('<p className="mb-3 text-base font-bold text-[var(--public-brass)]');
  });

  it('uses the compact obsidian forge shell instead of a tall light marketing frame', () => {
    const globalStyles = readSource('src/app/globals.css');
    const headerSource = readSource('src/features/public-site/components/PublicSiteHeader.tsx');
    const footerSource = readSource('src/features/public-site/components/PublicSiteFooter.tsx');

    expect(globalStyles).toContain('--public-obsidian: #0c0b09');
    expect(globalStyles).toContain('--public-surface: #1b1510');
    expect(globalStyles).toContain('--public-brass: #d9a441');
    expect(headerSource).toContain('min-h-16');
    expect(footerSource).toContain('PUBLIC_NAVIGATION.footerGroups.map');
    expect(footerSource).not.toContain('lg:grid-cols-[minmax(15rem,1.2fr)_2fr]');
  });

  it('exports the shell and composes legal presentation without replacing trust content', () => {
    const publicInterface = readSource('src/features/public-site/client.ts');
    const legalPageSource = readSource('src/features/legal/components/PublicLegalPage.tsx');

    expect(publicInterface).toContain("export { PublicSiteShell }");
    expect(publicInterface).toContain("export { PublicSiteHeader }");
    expect(publicInterface).toContain("export { PublicSiteFooter }");
    expect(publicInterface).toContain('PUBLIC_NAVIGATION');
    expect(legalPageSource).toContain("from '@/features/public-site/client'");
    expect(legalPageSource).toContain('siteConfiguration: PublicSiteConfiguration');
    expect(legalPageSource).toContain('<PublicSiteShell');
    expect(legalPageSource).toContain('aria-label="Trust center pages"');
    expect(legalPageSource).toContain('formatBusinessIdentityDescription(businessIdentity)');
  });
});
