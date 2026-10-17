"use client";

import { Button } from '@/components/ui/button';
import { DEFAULT_HOMEPAGE_SECTION_DESIGN, type PrimaryNavigationItem, type PublicSitePage } from '@/features/public-site/client';

const inputClass = 'min-h-11 w-full border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 text-[var(--cf-accent-text)]';
const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 12)}`;

export function OwnerSitePagesPanel({ pages, navigation, selectedId, onSelect, onChange }: {
  pages: PublicSitePage[]; navigation: PrimaryNavigationItem[]; selectedId: string;
  onSelect: (id: string) => void;
  onChange: (pages: PublicSitePage[], navigation: PrimaryNavigationItem[]) => void;
}) {
  const selected = pages.find((page) => page.id === selectedId);
  const update = (patch: Partial<PublicSitePage>) => {
    onChange(pages.map((page) => page.id === selectedId ? { ...page, ...patch } : page), navigation);
  };
  return <article className="space-y-4 border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5">
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-48 flex-1 space-y-1 text-sm">Design page
        <select className={inputClass} value={selectedId} onChange={(event) => onSelect(event.target.value)}>
          <option value="">Homepage</option>
          {pages.map((page) => <option key={page.id} value={page.id}>{page.title} {page.published ? '' : '(not public)'}</option>)}
        </select>
      </label>
      <Button type="button" variant="outline" disabled={pages.length >= 32} onClick={() => {
        let slug = 'new-page'; let suffix = 2;
        while (pages.some((page) => page.slug === slug)) slug = 'new-page-' + suffix++;
        const id = makeId('page') as PublicSitePage['id'];
        onChange([...pages, { id, slug, title: 'New page',
          description: 'Describe this page clearly for visitors, search engines and social sharing.',
          keywords: ['CardForge'], published: false, sections: [{
            id: makeId('custom'), kind: 'custom', visible: true, design: { ...DEFAULT_HOMEPAGE_SECTION_DESIGN },
            blocks: [{ id: makeId('block'), kind: 'heading', text: 'Tell your story' },
              { id: makeId('block'), kind: 'text', text: 'Add your page content here.' }],
          }] }], navigation);
        onSelect(id);
      }}>Create page</Button>
    </div>
    <p className="text-xs leading-5 text-[var(--cf-text-muted)]">Existing account, Plans, Roadmap, legal and provider routes stay code-owned. New first-party pages use the same safe blocks and published media as the homepage. All changes below remain drafts until publication.</p>
    {selected ? <div className="space-y-3">
      <label className="grid gap-1 text-sm">Page title<input className={inputClass} maxLength={80} value={selected.title} onChange={(event) => update({ title: event.target.value })} /></label>
      <label className="grid gap-1 text-sm">Page path<input className={inputClass} maxLength={64} value={selected.slug} onChange={(event) => update({ slug: event.target.value })} /><span className="text-xs text-[var(--cf-text-muted)]">/{selected.slug} · lowercase words separated by hyphens. Changing a published path removes its old address.</span></label>
      <label className="grid gap-1 text-sm">Page search description<textarea className={inputClass + ' min-h-24 p-3'} maxLength={200} value={selected.description} onChange={(event) => update({ description: event.target.value })} /></label>
      <label className="grid gap-1 text-sm">Page search phrases (one per line)<textarea className={inputClass + ' min-h-24 p-3'} value={selected.keywords.join('\n')} onChange={(event) => update({ keywords: event.target.value.split('\n').map((word) => word.trim()).filter(Boolean) })} /></label>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={selected.published} onChange={(event) => update({ published: event.target.checked })} />Make this page public when saved</label>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={navigation.some((item) => item.id === selected.id)} onChange={(event) => onChange(pages, event.target.checked
        ? [...navigation, { id: selected.id, label: selected.title.slice(0, 40), href: '/' + selected.slug, visible: true }]
        : navigation.filter((item) => item.id !== selected.id))} />Include in primary navigation (visible only while the page is public)</label>
      <Button type="button" variant="outline" onClick={() => {
        onChange(pages.filter((page) => page.id !== selected.id), navigation.filter((item) => item.id !== selected.id));
        onSelect('');
      }}>Remove page from draft</Button>
      <p className="text-xs text-[var(--cf-text-muted)]">Page removal takes effect only when published. Undo or Cancel restores it before saving; public media versions are not deleted.</p>
    </div> : null}
  </article>;
}
