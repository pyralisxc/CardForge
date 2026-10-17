"use client";

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BusinessIdentity } from '@/features/business-identity/client';
import type { McpAllowance } from '@/features/mcp-usage/client/plans';
import { HomepagePageContent, ComposedPageContent } from '@/features/public-site/client/landing';
import { PublicSiteShell } from '@/features/public-site/client/shell';
import type { PublicSiteConfiguration, PublicSitePage, SiteMediaAsset } from '@/features/public-site/client';

const viewportWidths = { desktop: 1440, tablet: 768, phone: 390 } as const;

export const applyOwnerPreviewTheme = (source: Document, target: Document): void => {
  target.documentElement.className = source.documentElement.className;
  target.body.className = source.body.className;
  for (const attribute of ['lang', 'data-cf-palette', 'data-cf-accent', 'data-cf-corners', 'data-cf-contrast']) {
    const value = source.documentElement.getAttribute(attribute);
    if (value === null) target.documentElement.removeAttribute(attribute);
    else target.documentElement.setAttribute(attribute, value);
  }
};

/** A same-origin, script-disabled canvas uses real viewport media queries and the live renderer. */
export function OwnerSiteDraftPreview({ settings, page, media, businessIdentity, plans }: {
  settings: PublicSiteConfiguration; page?: PublicSitePage; media: SiteMediaAsset[];
  businessIdentity: BusinessIdentity; plans: McpAllowance[];
}) {
  const [viewport, setViewport] = useState<keyof typeof viewportWidths>('desktop');
  const [canvas, setCanvas] = useState<Document | null>(null);
  useEffect(() => {
    if (!canvas) return;
    const update = () => applyOwnerPreviewTheme(document, canvas);
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true,
      attributeFilter: ['class', 'lang', 'data-cf-palette', 'data-cf-accent', 'data-cf-corners', 'data-cf-contrast'] });
    return () => observer.disconnect();
  }, [canvas]);
  return <section className="space-y-3 border border-[var(--cf-border)] p-4" aria-label="Unpublished website preview">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold">Draft preview</h2><p className="text-xs text-[var(--cf-text-muted)]">Unpublished. Uses the live renderer; links are disabled in this canvas.</p></div>
      <label className="grid gap-1 text-xs">Viewport
        <select className="min-h-11 border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3" value={viewport}
          onChange={(event) => setViewport(event.target.value as typeof viewport)}>
          {Object.entries(viewportWidths).map(([name, width]) => <option key={name} value={name}>{name} · {width}px</option>)}
        </select>
      </label>
    </div>
    <div className="max-w-full overflow-x-auto border border-[var(--cf-border)]" tabIndex={0} aria-label="Scroll draft canvas horizontally">
      <iframe title={`${viewport} unpublished ${page?.title ?? 'homepage'} preview`} sandbox="allow-same-origin"
        style={{ width: viewportWidths[viewport], height: 640 }} className="block max-w-none border-0"
        srcDoc="<!doctype html><html lang='en'><head><meta name='viewport' content='width=device-width, initial-scale=1'><style>html,body{margin:0;min-height:100%;}*{box-sizing:border-box;}</style></head><body></body></html>"
        onLoad={(event) => {
          const doc = event.currentTarget.contentDocument;
          if (!doc) return;
          // Only this application's existing styles, never Owner-supplied CSS or scripts.
          document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => doc.head.appendChild(node.cloneNode(true)));
          applyOwnerPreviewTheme(document, doc);
          setCanvas(doc);
        }} />
    </div>
    {canvas ? createPortal(<div onClickCapture={(event) => { if ((event.target as Element).closest('a')) event.preventDefault(); }}>
      <PublicSiteShell businessIdentity={businessIdentity} siteConfiguration={settings} currentPath={page ? '/' + page.slug : '/'} portalContainer={canvas.body}>
        {page ? <ComposedPageContent page={page} media={media} />
          : <HomepagePageContent siteConfiguration={settings} siteMedia={media} plans={plans} founderName={businessIdentity.legalOperatorName} />}
      </PublicSiteShell>
    </div>, canvas.body) : null}
  </section>;
}
