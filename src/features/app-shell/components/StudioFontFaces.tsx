"use client";

import { useEffect, useState } from 'react';

import { createPipelineFontFaceCss, mergeCardFontOptions } from '@/domain/rendering';
import { loadCardForgeStudioBootstrap } from '@/features/pipeline/client/catalog';
import {
  mapProjectFontsToCardFontOptions,
  PROJECT_FONT_LIBRARY_CHANGE_EVENT,
  readProjectFonts,
} from '@/features/project/client';

export function StudioFontFaces() {
  const [css, setCss] = useState('');

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const [bootstrap, personalFonts] = await Promise.all([
        loadCardForgeStudioBootstrap().catch(() => null),
        readProjectFonts().catch(() => []),
      ]);
      if (!mounted) return;
      const dynamicFonts = mergeCardFontOptions(
        bootstrap?.fonts.fonts ?? [],
        mapProjectFontsToCardFontOptions(personalFonts),
      );
      setCss(createPipelineFontFaceCss(dynamicFonts));
    };
    void refresh();
    const onFontsChanged = () => { void refresh(); };
    window.addEventListener(PROJECT_FONT_LIBRARY_CHANGE_EVENT, onFontsChanged);
    return () => {
      mounted = false;
      window.removeEventListener(PROJECT_FONT_LIBRARY_CHANGE_EVENT, onFontsChanged);
    };
  }, []);

  return css ? <style data-cardforge-project-fonts>{css}</style> : null;
}
