"use client";

import { useEffect, useState } from 'react';

import { createPipelineFontFaceCss, mergeCardFontOptions, type CardFontOption } from '@/domain/rendering';
import { loadCardForgeStudioBootstrap, PUBLISHED_FONTS_OBSERVED_EVENT } from '@/features/pipeline/client/catalog';
import { getProjectPersistenceScope, PROJECT_PERSISTENCE_SCOPE_CHANGE_EVENT } from '@/features/project/client/persistence-workspace';
import { mapProjectFontsToCardFontOptions, PROJECT_FONT_LIBRARY_CHANGE_EVENT, readProjectFonts } from '@/features/project/client/assets';
import { useProjectBinaryAssetValue } from '@/features/project/client/binary-assets';

export function StudioFontFaces() {
  const [css, setCss] = useState('');
  const resolvedCss = useProjectBinaryAssetValue(css);

  useEffect(() => {
    let mounted = true;
    let revision = 0;
    let observedFonts: { scope: string; fonts: CardFontOption[] } | null = null;
    const refresh = async (publishedFonts?: CardFontOption[]) => {
      const scope = getProjectPersistenceScope();
      const request = ++revision;
      const availableFonts = publishedFonts ?? (observedFonts?.scope === scope ? observedFonts.fonts : undefined);
      const [bootstrap, personalFonts] = await Promise.all([
        availableFonts ? Promise.resolve(null) : loadCardForgeStudioBootstrap({ fresh: true }).catch(() => null),
        readProjectFonts().catch(() => []),
      ]);
      if (!mounted || request !== revision || scope !== getProjectPersistenceScope()) return;
      const observed = availableFonts ?? bootstrap?.fonts.fonts;
      const fonts = observed ?? [];
      if (observed !== undefined) observedFonts = { scope, fonts: observed };
      const dynamicFonts = mergeCardFontOptions(
        fonts,
        mapProjectFontsToCardFontOptions(personalFonts),
      );
      setCss(createPipelineFontFaceCss(dynamicFonts));
    };
    void refresh();
    const onFontsChanged = () => { void refresh(); };
    const onScopeChanged = () => { observedFonts = null; setCss(''); void refresh(); };
    const onPublishedFonts = (event: Event) => {
      const observation = (event as CustomEvent<{ scope: string; fonts: CardFontOption[] }>).detail;
      if (observation?.scope === getProjectPersistenceScope()) void refresh(observation.fonts);
    };
    window.addEventListener(PROJECT_FONT_LIBRARY_CHANGE_EVENT, onFontsChanged);
    window.addEventListener(PUBLISHED_FONTS_OBSERVED_EVENT, onPublishedFonts);
    window.addEventListener(PROJECT_PERSISTENCE_SCOPE_CHANGE_EVENT, onScopeChanged);
    return () => {
      mounted = false;
      window.removeEventListener(PROJECT_FONT_LIBRARY_CHANGE_EVENT, onFontsChanged);
      window.removeEventListener(PUBLISHED_FONTS_OBSERVED_EVENT, onPublishedFonts);
      window.removeEventListener(PROJECT_PERSISTENCE_SCOPE_CHANGE_EVENT, onScopeChanged);
    };
  }, []);

  return resolvedCss ? <style data-cardforge-project-fonts>{resolvedCss}</style> : null;
}
