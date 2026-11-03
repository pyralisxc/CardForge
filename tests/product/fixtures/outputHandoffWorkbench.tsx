import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { CreatorWorkbench } from '@/features/creator-workbench/components/CreatorWorkbench';
import { EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE } from '@/features/contributor-access/client';
import { resolveAccountEntitlement } from '@/features/account/lib/accountEntitlement';
import { Toaster } from '@/components/ui/toaster';
import { createProjectScaleFixture } from '../../fixtures/projectScale';
const doc = createProjectScaleFixture(100); doc.storedCards = doc.storedCards.slice(0, 2);
doc.userTemplates[0].freeformCanvas!.elements = [{ id: 'label', name: 'Label', type: 'text', x: 20, y: 30, width: 500, height: 80, zIndex: 1, content: 'Synthetic {{cardName}}', fontSizePx: 30, textColor: '#000000' }];
const back = { ...doc.userTemplates[0], id: 'synthetic-back', templateUsage: 'back-preset' as const, name: 'Back' }; doc.userTemplates.push(back); doc.storedCards[1].backingTemplateId = back.id; doc.storedCards[1].backingData = {};
(window as unknown as { outputDocument: unknown }).outputDocument = doc;
(window as unknown as { outputEntitlement: unknown }).outputEntitlement = resolveAccountEntitlement({ authConfigured: true, isSignedIn: true, accountUserId: 'synthetic', privateMetadata: { cardforgeAccess: 'paid' } });
function App() {
 const [params, setParams] = useState(() => new URLSearchParams(location.search));
 useEffect(() => { const onPop = () => setParams(new URLSearchParams(location.search)); window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop); }, []);
 const navigate = (href: string) => { history.replaceState({}, '', href); setParams(new URLSearchParams(location.search)); };
 const router = { bfcacheId: 'output-proof', back: () => history.back(), forward: () => history.forward(), refresh: () => {}, push: navigate, replace: navigate, prefetch: async () => {} };
 return <AppRouterContext.Provider value={router as never}><SearchParamsContext.Provider value={params}><CreatorWorkbench businessIdentity={{ brandName: 'Synthetic', copyrightHolder: 'Synthetic' }} initialContributorAccess={EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE} /><Toaster /></SearchParamsContext.Provider></AppRouterContext.Provider>;
}
createRoot(document.body.appendChild(document.createElement('div'))).render(<App />);
