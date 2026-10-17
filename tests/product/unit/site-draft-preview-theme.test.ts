import { describe, expect, it, vi } from 'vitest';
vi.mock('@/features/public-site/client/landing', () => ({}));
vi.mock('@/features/public-site/client/shell', () => ({}));
import { applyOwnerPreviewTheme } from '@/features/owner/components/OwnerSiteDraftPreview';

describe('responsive site draft theme fidelity', () => {
  it('projects the native palette, accent, corner, contrast and font presentation, not editor or arbitrary attributes', () => {
    const sourceAttributes = new Map([['lang', 'en'], ['data-cf-palette', 'slate'], ['data-cf-accent', 'arcane'], ['data-cf-corners', 'square'], ['data-cf-contrast', 'high'], ['data-site-inline-editing', 'true'], ['onclick', 'unsafe']]);
    const targetAttributes = new Map<string, string>();
    const source = { documentElement: { className: 'presentation', getAttribute: (key: string) => sourceAttributes.get(key) ?? null }, body: { className: 'font-sans antialiased' } } as unknown as Document;
    const target = { documentElement: { className: '', setAttribute: (key: string, value: string) => targetAttributes.set(key, value), removeAttribute: (key: string) => targetAttributes.delete(key) }, body: { className: '' } } as unknown as Document;
    applyOwnerPreviewTheme(source, target);
    expect(Object.fromEntries(targetAttributes)).toEqual({ lang: 'en', 'data-cf-palette': 'slate', 'data-cf-accent': 'arcane', 'data-cf-corners': 'square', 'data-cf-contrast': 'high' });
    expect(target.body.className).toBe('font-sans antialiased');
    expect(target.documentElement.className).toBe('presentation');
  });
});
