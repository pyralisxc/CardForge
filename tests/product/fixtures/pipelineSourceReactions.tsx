import { TooltipProvider } from '../../../src/components/ui/tooltip';
import { useEffect, useState } from 'react';
import { mapProjectFontsToCardFontOptions } from '../../../src/features/project/client/assets';
import type { ProjectFontAsset } from '../../../src/features/project/model/projectFont';
import { cardFontOptionsToSelectOptions, mergeCardFontOptions, CARD_FONT_OPTIONS, type CardFontOption, type DisplayCard } from '../../../src/domain/rendering';
import { FontLibraryPicker } from '../../../src/features/template-editor/components/FontLibraryPicker';
import { BulkRevisionLibraryPicker } from '../../../src/features/card-generator/components/BulkRevisionLibraryPicker';
import { AppearanceStudioPanel } from '../../../src/features/template-editor/components/AppearanceStudioPanel';
import { NewSetDialog } from '../../../src/features/project/components/NewSetDialog';
import type { PublishedSetCatalogItem } from '../../../src/domain/publishedSets';
import { createRoot } from 'react-dom/client';
import { PipelineSourceFeedback, PublishedSourceFeedback, PipelineSourceDisclosure } from '../../../src/features/pipeline/client/engagement';
import { loadCardForgeStudioAssets } from '../../../src/features/pipeline/client/catalog';
import type { AppearanceStylePreset, CardAssetOption, TCGCardTemplate, FreeformCardElement } from '../../../src/domain/templates';
import { TemplateAssetLibraryPicker } from '../../../src/features/template-editor/components/TemplateAssetLibraryPicker';
const first = '10000000-0000-4000-8000-000000000001';
const second = '10000000-0000-4000-8000-000000000002';
const sourceAsset = { id: 'published-original', name: 'Original source', url: 'data:image/png;base64,', kind: 'image' as const, publishedSubmissionId: first, librarySource: 'official' as const, tileMode: 'contain' as const, seamless: false, allowedTargets: ['image' as const] };
function App() {
  const [fonts, setFonts] = useState<CardFontOption[]>([]);
  const [styles, setStyles] = useState<AppearanceStylePreset[]>([]);
  const [starters, setStarters] = useState<PublishedSetCatalogItem[]>([]);
  const [starterOpen, setStarterOpen] = useState(false);
  const [copiedStarter, setCopiedStarter] = useState('none');
  const [fontApplied, setFontApplied] = useState('none');
  const [styleApplied, setStyleApplied] = useState('none');
  const [bulkPlan, setBulkPlan] = useState('none');
  useEffect(() => {
    void import('../../../src/features/pipeline/client/catalog').then(module => module.loadCardForgeStudioBootstrap()).then(result => { setFonts(result.fonts?.fonts ?? []); setStyles(result.styles.styles); });
    void fetch('/api/catalog').then(response => response.json()).then(result => setStarters(result.sets?.items ?? []));
  }, []);
  const [assets, setAssets] = useState<CardAssetOption[]>([]);
  useEffect(() => { void loadCardForgeStudioAssets().then(result => setAssets(result.assets.imageAssets)); }, []);
  const [workingTemplate, setWorkingTemplate] = useState({ id: 'bootstrap-original', templateRevision: 1, templateRevisionId: 'published-r1', name: 'Personal edit' } as TCGCardTemplate);
  const [source, setSource] = useState(first);
  const [applied, setApplied] = useState('none');
  return <TooltipProvider><main>
    <h1>Personal Template · not shared</h1>
    <p>Source reactions apply to the original, including while this private copy is edited.</p>
    <button onClick={() => setSource(second)}>Switch exact source</button>
    <button onClick={() => window.dispatchEvent(new Event('cardforge:project-persistence-scope-change'))}>Change account scope</button>
    <div aria-label="Studio original"><PipelineSourceFeedback submissionId={source} /></div>
    <div aria-label="Other representation"><PipelineSourceFeedback submissionId={first} /></div>
    <button onClick={() => setWorkingTemplate(value => ({ ...value, name: value.name + ' edited' }))}>Edit personal copy</button>
    <button onClick={() => setWorkingTemplate(value => ({ ...value, templateRevisionId: 'different-revision' }))}>Change document revision</button>
    <div aria-label="Bootstrap source"><PublishedSourceFeedback registryAssetId="bootstrap-original" template={workingTemplate} /></div>
    <section aria-label="Template picture chooser"><TemplateAssetLibraryPicker assets={[...assets, { ...sourceAsset, id: 'personal-copy', name: 'Spoofed personal copy', librarySource: 'local' }, { ...sourceAsset, id: 'forged-shared', name: 'Forged saved shared claim', librarySource: 'official' }]} kind="image" label="Picture" personalItems={[]} personalRoles={['artwork']} providerRole="artwork" target={{ kind: 'template-element', ids: ['local-slot'] }} onAddFromProvider={async () => {}} onMaterializePersonal={async () => sourceAsset} onApply={asset => setApplied(asset.id)} /></section>
    <section aria-label="Governed font chooser"><FontLibraryPicker availableFonts={cardFontOptionsToSelectOptions(mergeCardFontOptions(mergeCardFontOptions(CARD_FONT_OPTIONS, fonts), mapProjectFontsToCardFontOptions([{ id: 'Heading-Regular', name: 'Private lookalike', value: 'font-contributor-heading-regular', mimeType: 'font/woff2', dataUrl: 'data:font/woff2;base64,AA==', fileSizeBytes: 1 } as ProjectFontAsset])))} targetId="local-slot" onSelect={setFontApplied} /><output aria-label="Applied font">{fontApplied}</output></section>
    <section aria-label="Bulk picture chooser"><BulkRevisionLibraryPicker currentCards={['card-one', 'card-two'].map(uniqueId => ({ uniqueId, data: {}, template: workingTemplate })) as DisplayCard[]} fieldKey="picture" fieldLabel="Artwork" targetIds={['card-one', 'card-two']} onPlan={plan => setBulkPlan(JSON.stringify(plan.revisions.map(card => card.data.picture)))} /><output aria-label="Bulk picture plan">{bulkPlan}</output></section>
    <section aria-label="Material chooser"><AppearanceStudioPanel element={{ id: 'shape-one', type: 'shape' } as FreeformCardElement} compatibleAppearanceStyles={styles} compatibleTextureAssets={[]} elementStylePresets={[]} canUseImageSource={false} canUseDividerControls={false} canUseBackgroundTexture={false} controlClassName="" buttonClassName="" canUploadCustomAssets={false} onHandleAssetUpload={() => {}} onApplyAppearancePreset={style => setStyleApplied(style.id)} onUpdateAppearance={() => {}} personalItems={[]} onAddFromProvider={async () => {}} onMaterializePersonal={async () => sourceAsset} /><output aria-label="Applied material">{styleApplied}</output></section>
    <button onClick={() => setStarterOpen(true)}>Open Set starters</button>
    <NewSetDialog renderPublishedSetDetails={set => set.submissionId ? <PipelineSourceDisclosure submissionId={set.submissionId} /> : null} createOpen={starterOpen} publishedSets={starters} publishedSetsLoading={false} publishedSetsFailure={null} creatingPublishedSetId={null} onCreateOpenChange={setStarterOpen} onCreateWork={() => {}} onCreatePublishedSet={set => { setCopiedStarter(set.id); setStarterOpen(false); }} onRetryPublishedSets={() => {}} /><output aria-label="Copied starter">{copiedStarter}</output>
    <output aria-label="Applied source">{applied}</output>
  </main></TooltipProvider>;
}
createRoot(document.body.appendChild(document.createElement('div'))).render(<App />);
