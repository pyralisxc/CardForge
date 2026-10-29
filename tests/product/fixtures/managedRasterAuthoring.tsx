import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CardTemplateMaker } from '@/features/template-editor/components/CardTemplateMaker';
import { useTemplateLibraryActions } from '@/features/template-editor/hooks/useTemplateLibraryActions';
import { Toaster } from '@/components/ui/toaster';
import type { TCGCardTemplate } from '@/domain/templates';
const noop = () => {};
const initial: TCGCardTemplate = { id:'synthetic-local',name:'Synthetic authoring',aspectRatio:'63:88',templateSource:'user',freeformCanvas:{width:630,height:880,elements:[
  {id:'art',name:'Static picture',type:'image',x:100,y:100,width:300,height:300,zIndex:1,imageSource:'',content:''},
  {id:'other',name:'Other slot',type:'image',x:100,y:500,width:200,height:200,zIndex:2,imageSource:'',content:''},
]} };
function Fixture() {
  const [templates, setTemplates] = useState([initial]);
  const [saved,setSaved] = useState(''); const [exported,setExported]=useState('');
  const file = useRef<HTMLInputElement>(null!);
  const actions = useTemplateLibraryActions({
    addOrUpdateAppearanceStyle:()=>'',addOrUpdateTemplate:t=>{setTemplates([t]);return t.id!;}, commitTemplateChange:()=>initial.id!,
    clearPersonalTemplateOverride:noop,appearanceStyles:[],cloneTemplate:()=>null,deleteAppearanceStyle:noop,deleteTemplate:noop,
    projectCapabilities:{canSubmitTemplateRevisions:true,canPublishSharedLibrary:false},setGeneratorSelectedTemplateId:noop,setTemplateEditorSelectedTemplateId:noop,
    storedCards:[],templates,toast:noop,
  });
  return <><button onClick={()=>setExported(JSON.stringify(templates))}>Export local proof</button><output data-testid="saved">{saved}</output><output data-testid="exported">{exported}</output>
    <CardTemplateMaker templates={templates} defaultTemplates={[]} backFaceTemplates={[]} userTemplates={templates}
      selectedTemplateIdForEditing={initial.id!} onSelectTemplateForEditing={noop} canUseProjectFiles canSubmitSharedTemplateRevision canPublishSharedLibrary={false}
      showCardWatermark={false} canUploadCustomAssets={false} isActive isCheckoutStarting={false} fileInputRef={file}
      onSaveTemplate={async t=>{setSaved(JSON.stringify(t));return t.id!;}}
      onContinueNewTemplateInPipeline={actions.handleContinueNewTemplateInPipeline} onSubmitTemplateRevision={actions.handleSubmitTemplateRevision}
      onDeleteTemplate={noop} onCloneTemplate={()=>null} onExportProject={noop} onImportProject={noop} onLoadProject={noop}
      onStartCheckout={noop} appearanceStyles={[]} onSaveAppearanceStyle={()=>''} onReturnToTemplateMaker={noop} />
    <Toaster /></>;
}
createRoot(document.body.appendChild(document.createElement('div'))).render(<Fixture/>);
