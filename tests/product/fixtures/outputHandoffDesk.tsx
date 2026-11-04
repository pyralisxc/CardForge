import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { Desk } from '@/features/desk/components/Desk';
import { EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE } from '@/features/contributor-access/client';
import { resolveAccountEntitlement } from '@/features/account/lib/accountEntitlement';
import { projectAccountExperience } from '@/features/account/lib/accountExperience';
import { hydrateProjectWorkspaceForScope, useProjectStore } from '@/features/project/client/workspace';
import { Toaster } from '@/components/ui/toaster';
import { createProjectScaleFixture } from '../../fixtures/projectScale';
const document = createProjectScaleFixture(100);
document.storedCards = document.storedCards.slice(0, 3).map((card, index) => ({ ...card, data: { ...card.data, cardName: ['ALPHA', 'BRAVO', 'CHARLIE'][index] } }));
document.userTemplates[0].freeformCanvas!.elements = [{ id: 'label', name: 'Label', type: 'text', x: 20, y: 30, width: 500, height: 80, zIndex: 1, content: '{{cardName}}', fontSizePx: 30, textColor: '#000000' }];
document.userTemplates.push({ ...document.userTemplates[0], id: 'synthetic-back', templateUsage: 'back-preset', name: 'Back' });
document.storedCards[2].backingTemplateId = 'synthetic-back';
document.storedCards[2].backingData = { cardName: 'CHARLIE BACK' };
const entitlement = resolveAccountEntitlement({ authConfigured: true, isSignedIn: true, accountUserId: 'synthetic', privateMetadata: { cardforgeAccess: 'paid' } });
const proof = window as unknown as { outputDocument: unknown; outputEntitlement: unknown; outputState: () => unknown; changeWorkspace: () => void };
proof.outputDocument = document;
proof.outputEntitlement = entitlement;
proof.outputState = () => ({ cards: useProjectStore.getState().storedCards.map(card => card.uniqueId), activeSet: useProjectStore.getState().activeCardSet?.id });
proof.changeWorkspace = () => useProjectStore.setState(state => ({ storedCards: [...state.storedCards, { uniqueId: 'concurrent-local', templateId: 'local', data: {} }] }));

function App() {
  const [params, setParams] = useState(() => new URLSearchParams(location.search));
  useEffect(() => { const onPop = () => setParams(new URLSearchParams(location.search)); window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop); }, []);
  const navigate = (href: string) => { history.replaceState({}, '', href); setParams(new URLSearchParams(location.search)); };
  const router = { bfcacheId: 'desk-output-proof', back: () => history.back(), forward: () => history.forward(), refresh: () => {}, push: navigate, replace: navigate, prefetch: async () => {} };
  return <AppRouterContext.Provider value={router as never}><SearchParamsContext.Provider value={params}>
    <Desk businessIdentity={{ brandName: 'Synthetic', copyrightHolder: 'Synthetic' }} persistenceScope="account:synthetic-output-proof" initialTool="output" initialContributorAccess={EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE} experience={projectAccountExperience({ entitlement, contribution: { active: false, canSubmit: false, canReview: false, canPublish: false, canDraftCampaigns: false } })} />
    <Toaster />
  </SearchParamsContext.Provider></AppRouterContext.Provider>;
}
void hydrateProjectWorkspaceForScope('account:synthetic-output-proof').then(() => {
  if (new URLSearchParams(location.search).has('seedLocal')) {
    const set = { id: 'existing-set', name: 'Existing Set' };
    useProjectStore.setState({ userTemplates: document.userTemplates, storedCards: [{ uniqueId: 'existing-local', templateId: document.userTemplates[0].id!, setId: set.id, data: {} }], cardSets: [set], activeCardSet: set });
  }
  createRoot(window.document.body.appendChild(window.document.createElement('div'))).render(<App />);
});
