import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { getAccountDeskKey } from '@/features/account/lib/accountSections';
import { WorkspaceUpdatesBoundary } from '@/features/creator-workbench/client';
import { Desk } from '@/features/desk/components/Desk';
import { EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE } from '@/features/contributor-access/client';
import { resolveAccountEntitlement } from '@/features/account/lib/accountEntitlement';
import { projectAccountExperience } from '@/features/account/lib/accountExperience';
import { materializeProjectTemplateOwnership } from '@/features/project/model/projectDocument';
import { hydrateProjectWorkspaceForScope, useProjectStore } from '@/features/project/client/workspace';
import { setProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import { normalizeStudioDocumentPayload } from '@/features/studio-documents/model';
import { Toaster } from '@/components/ui/toaster';
import { createProjectScaleFixture } from '../../fixtures/projectScale';
const document = createProjectScaleFixture(100);
document.storedCards = document.storedCards.slice(0, 3).map((card, index) => ({ ...card, data: { ...card.data, cardName: ['ALPHA', 'BRAVO', 'CHARLIE'][index] } }));
document.userTemplates[0].freeformCanvas!.elements = [{ id: 'label', name: 'Label', type: 'text', x: 20, y: 30, width: 500, height: 80, zIndex: 1, content: '{{cardName}}', fontSizePx: 30, textColor: '#000000' }];
document.userTemplates.push({ ...document.userTemplates[0], id: 'synthetic-back', templateUsage: 'back-preset', name: 'Back' });
document.storedCards[2].backingTemplateId = 'synthetic-back';
document.storedCards[2].backingData = { cardName: 'CHARLIE BACK' };
const normalizedDocument = normalizeStudioDocumentPayload(document);
if (!normalizedDocument) throw new Error('The synthetic Studio document is invalid.');
const entitlement = resolveAccountEntitlement({ authConfigured: true, isSignedIn: true, accountUserId: 'synthetic', privateMetadata: { cardforgeAccess: 'paid' } });
const proof = window as unknown as { outputDocument: unknown; outputEntitlement: unknown; outputState: () => unknown; changeWorkspace: () => void; switchOutputScope: () => void; removeFixtureCard: (id: string) => void; removeFixtureSet: (id: string) => void; outputLifecycle: { mounts: number; unmounts: number; routes: string[] } };
proof.outputLifecycle = { mounts: 0, unmounts: 0, routes: [] };
proof.outputDocument = normalizedDocument;
proof.outputEntitlement = entitlement;
proof.outputState = () => ({ cards: useProjectStore.getState().storedCards.map(card => card.uniqueId), activeSet: useProjectStore.getState().activeCardSet?.id });
proof.changeWorkspace = () => useProjectStore.setState(state => ({ storedCards: [...state.storedCards, { uniqueId: 'concurrent-local', templateId: 'local', data: {} }] }));
proof.switchOutputScope = () => setProjectPersistenceScope('account:another-output-proof');
proof.removeFixtureCard = (id) => useProjectStore.setState(state => ({ storedCards: state.storedCards.filter(card => card.uniqueId !== id) }));
proof.removeFixtureSet = (id) => useProjectStore.setState(state => ({ cardSets: state.cardSets.filter(set => set.id !== id), storedCards: state.storedCards.filter(card => card.setId !== id), activeCardSet: state.activeCardSet?.id === id ? null : state.activeCardSet }));

function TrackedDesk({ params }: { params: URLSearchParams }) {
  useEffect(() => { proof.outputLifecycle.mounts++; return () => { proof.outputLifecycle.unmounts++; }; }, []);
  return <Desk businessIdentity={{ brandName: 'Synthetic', copyrightHolder: 'Synthetic' }} persistenceScope="account:synthetic-output-proof" initialTool={params.get('tool') === 'design' ? 'design' : 'output'} initialFocusedWorkId={params.get('focus')} initialContributorAccess={EMPTY_CONTRIBUTOR_ACCESS_SESSION_STATE} experience={projectAccountExperience({ entitlement, contribution: { active: false, canSubmit: false, canReview: false, canPublish: false, canDraftCampaigns: false } })} />;
}
function App() {
  const [params, setParams] = useState(() => new URLSearchParams(location.search));
  useEffect(() => { const onPop = () => setParams(new URLSearchParams(location.search)); window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop); }, []);
  const navigate = (href: string) => { proof.outputLifecycle.routes.push(href); history.replaceState({}, '', href); setParams(new URLSearchParams(location.search)); };
  const router = { bfcacheId: 'desk-output-proof', back: () => history.back(), forward: () => history.forward(), refresh: () => {}, push: navigate, replace: navigate, prefetch: async () => {} };
  return <AppRouterContext.Provider value={router as never}><SearchParamsContext.Provider value={params}>
    <WorkspaceUpdatesBoundary scope="account:synthetic-output-proof">
      <TrackedDesk key={getAccountDeskKey({ focusedWorkId: params.get('focus'), focusedArtifactId: params.get('artifact'), returnContextKey: params.get('returnContext'), documentId: params.get('document'), revision: params.get('revision'), outputRef: params.get('outputRef') })} params={params} />
    </WorkspaceUpdatesBoundary>
    <Toaster />
  </SearchParamsContext.Provider></AppRouterContext.Provider>;
}
void hydrateProjectWorkspaceForScope('account:synthetic-output-proof').then(() => {
  if (new URLSearchParams(location.search).has('seedLocal')) {
    const localDocument = materializeProjectTemplateOwnership(normalizedDocument).document;
    const templateId = localDocument.storedCards[0]!.templateId;
    const set = { id: 'existing-set', name: 'Existing Set', templateIds: [templateId] };
    useProjectStore.setState({
      userTemplates: localDocument.userTemplates,
      storedCards: [{ uniqueId: 'existing-local', templateId, setId: set.id, data: {} }],
      cardSets: [set],
      activeCardSet: set,
    });
  }
  createRoot(window.document.body.appendChild(window.document.createElement('div'))).render(<App />);
});
