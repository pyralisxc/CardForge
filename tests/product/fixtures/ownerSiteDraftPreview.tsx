import { createRoot } from 'react-dom/client';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { OwnerSiteDraftPreview } from '@/features/owner/components/OwnerSiteDraftPreview';
import { DEFAULT_PUBLIC_SITE_CONFIGURATION } from '@/features/public-site/model/siteConfiguration';
import { DEFAULT_BUSINESS_IDENTITY } from '@/features/business-identity/model/businessIdentity';
import type { PublicSitePage } from '@/features/public-site/model/sitePages';

const page: PublicSitePage = { id: 'page-proof', slug: 'proof', title: 'Curated website preview',
  description: 'This isolated component fixture contains no personal workspace or account content.', keywords: ['proof'], published: false,
  sections: [{ id: 'custom-proof', kind: 'custom', visible: true,
    design: { layout: 'split', tone: 'raised', spacing: 'balanced', align: 'start' },
    blocks: [{ id: 'block-title', kind: 'heading', text: 'A reusable first-party page' },
      { id: 'block-body', kind: 'text', text: 'The live page and draft share one trusted renderer.' }] }],
};
const target = document.createElement('div');
target.dataset.ownerPreviewFixture = 'true';
document.body.appendChild(target);
createRoot(target).render(<Sheet defaultOpen><SheetContent className="w-[min(100vw,42rem)] max-w-[42rem] overflow-auto sm:max-w-[42rem]" aria-describedby="owner-preview-proof-description">
  <SheetTitle>Isolated Owner preview proof</SheetTitle>
  <SheetDescription id="owner-preview-proof-description">Test presentation only; no Owner authority or publication API is connected.</SheetDescription>
  <OwnerSiteDraftPreview settings={{ ...DEFAULT_PUBLIC_SITE_CONFIGURATION, pages: [page] }} page={page} media={[]} businessIdentity={DEFAULT_BUSINESS_IDENTITY} plans={[]} />
</SheetContent></Sheet>);
