import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CardTemplateMaker } from '@/features/template-editor/components/CardTemplateMaker';
import { useTemplateLibraryActions } from '@/features/template-editor/hooks/useTemplateLibraryActions';
import { Toaster } from '@/components/ui/toaster';
import type { TCGCardTemplate } from '@/domain/templates';
const noop = () => {};
const initial: TCGCardTemplate = { id:'synthetic-local',name:'Synthetic authoring',aspectRatio:'63:88',templateSource:'user',freeformCanvas:{width:630,height:880,elements:[]} };
if(new URLSearchParams(location.search).has('contract')) initial.fieldContracts=[{key:'existingArtwork',type:'image'}];
function Fixture() {
  const [templates, setTemplates] = useState<TCGCardTemplate[]>(() => [JSON.parse(localStorage.getItem('synthetic-saved-template') ?? 'null') ?? initial]);
  const [showEditor,setShowEditor] = useState(true);
  const [saved,setSaved] = useState(''); const [exported,setExported]=useState('');
  const file = useRef<HTMLInputElement>(null!);
  const actions = useTemplateLibraryActions({
    addOrUpdateAppearanceStyle:()=>'',addOrUpdateTemplate:t=>{setTemplates([t]);return t.id!;}, commitTemplateChange:()=>initial.id!,
    clearPersonalTemplateOverride:noop,appearanceStyles:[],cloneTemplate:()=>null,deleteAppearanceStyle:noop,deleteTemplate:noop,
    projectCapabilities:{canSubmitTemplateRevisions:true,canPublishSharedLibrary:false},setGeneratorSelectedTemplateId:noop,setTemplateEditorSelectedTemplateId:noop,
    storedCards:[],templates,toast:noop,
  });
  return <><button onClick={()=>setShowEditor(value=>!value)}>{showEditor?'Hide editor':'Show editor'}</button><button onClick={()=>setExported(localStorage.getItem('synthetic-saved-template') ?? JSON.stringify(templates))}>Export local proof</button><output hidden data-testid="saved">{saved}</output><output hidden data-testid="exported">{exported}</output>
    {showEditor && <CardTemplateMaker templates={templates} defaultTemplates={[]} backFaceTemplates={[]} userTemplates={templates}
      selectedTemplateIdForEditing={initial.id!} onSelectTemplateForEditing={noop} canUseProjectFiles canSubmitSharedTemplateRevision canPublishSharedLibrary={false}
      showCardWatermark={false} canUploadCustomAssets={false} isActive isCheckoutStarting={false} fileInputRef={file}
      onSaveTemplate={async t=>{setSaved(JSON.stringify(t));localStorage.setItem('synthetic-saved-template',JSON.stringify(t));return t.id!;}}
      onContinueNewTemplateInPipeline={actions.handleContinueNewTemplateInPipeline} onSubmitTemplateRevision={actions.handleSubmitTemplateRevision}
      onDeleteTemplate={noop} onCloneTemplate={()=>null} onExportProject={noop} onImportProject={noop} onLoadProject={noop}
      onStartCheckout={noop} appearanceStyles={[]} onSaveAppearanceStyle={()=>''} onReturnToTemplateMaker={noop} />}
    <Toaster /></>;
}
createRoot(document.body.appendChild(document.createElement('div'))).render(<Fixture/>);
