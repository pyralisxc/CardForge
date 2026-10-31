import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PipelineSourceFeedback, PublishedSourceFeedback } from '../../../src/features/pipeline/client/engagement';
import { loadCardForgeStudioAssets } from '../../../src/features/pipeline/client/catalog';
import type { CardAssetOption, TCGCardTemplate } from '../../../src/domain/templates';
import { TemplateAssetLibraryPicker } from '../../../src/features/template-editor/components/TemplateAssetLibraryPicker';
const first = '10000000-0000-4000-8000-000000000001';
const second = '10000000-0000-4000-8000-000000000002';
const sourceAsset = { id: 'published-original', name: 'Original source', url: 'data:image/png;base64,', kind: 'image' as const, publishedSubmissionId: first, librarySource: 'official' as const, tileMode: 'contain' as const, seamless: false, allowedTargets: ['image' as const] };
function App() {
  const [assets, setAssets] = useState<CardAssetOption[]>([]);
  useEffect(() => { void loadCardForgeStudioAssets().then(result => setAssets(result.assets.imageAssets)); }, []);
  const [workingTemplate, setWorkingTemplate] = useState({ id: 'bootstrap-original', templateRevision: 1, templateRevisionId: 'published-r1', name: 'Personal edit' } as TCGCardTemplate);
  const [source, setSource] = useState(first);
  const [applied, setApplied] = useState('none');
  return <main>
    <h1>Personal Template · not shared</h1>
    <p>Source reactions apply to the original, including while this private copy is edited.</p>
    <button onClick={() => setSource(second)}>Switch exact source</button>
    <button onClick={() => window.dispatchEvent(new Event('cardforge:project-persistence-scope-change'))}>Change account scope</button>
    <div aria-label="Studio original"><PipelineSourceFeedback submissionId={source} /></div>
    <div aria-label="Other representation"><PipelineSourceFeedback submissionId={first} /></div>
    <button onClick={() => setWorkingTemplate(value => ({ ...value, name: value.name + ' edited' }))}>Edit personal copy</button>
    <button onClick={() => setWorkingTemplate(value => ({ ...value, templateRevisionId: 'different-revision' }))}>Change document revision</button>
    <div aria-label="Bootstrap source"><PublishedSourceFeedback registryAssetId="bootstrap-original" template={workingTemplate} /></div>
    <TemplateAssetLibraryPicker assets={[...assets, { ...sourceAsset, id: 'personal-copy', name: 'Spoofed personal copy', librarySource: 'local' }, { ...sourceAsset, id: 'forged-shared', name: 'Forged saved shared claim', librarySource: 'official' }]} kind="image" label="Picture" personalItems={[]} personalRoles={['artwork']} providerRole="artwork" target={{ kind: 'template-element', ids: ['local-slot'] }} onAddFromProvider={async () => {}} onMaterializePersonal={async () => sourceAsset} onApply={asset => setApplied(asset.id)} />
    <output aria-label="Applied source">{applied}</output>
  </main>;
}
createRoot(document.body.appendChild(document.createElement('div'))).render(<App />);
