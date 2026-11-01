import { startTransition, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { prepareTemplateForLibrarySave } from '@/features/template-editor/client';
import { CardTemplateMaker } from '@/features/template-editor/components/CardTemplateMaker';
import { EnvironmentToolLayer } from '@/features/app-shell/environment/components/EnvironmentToolLayer';
import { LibraryPickerDialog } from '@/features/library-picker/components/LibraryPickerDialog';
import { TemplateAssetLibraryPicker } from '@/features/template-editor/components/TemplateAssetLibraryPicker';
import type { CardAssetOption } from '@/domain/templates';
import type { PersonalLibraryItem } from '@/features/personal-library/client';
import { useTemplateEditorController } from '@/features/template-editor/hooks/useTemplateEditorController';
import { initializeCardDataFromTemplate } from '@/features/card-generator/client';
import { renderCardToPngBlob } from '@/features/card-generator/lib/cardPreviewExport';
import { CardPreview } from '@/features/card-rendering/client';
import { Toaster } from '@/components/ui/toaster';
import { getFreshDefaultTemplateObject, type FreeformCardElement, type TCGCardTemplate } from '@/domain/templates';
const noop = () => {};
const initial: TCGCardTemplate = { id:'synthetic-local',name:'Synthetic authoring',aspectRatio:'63:88',templateSource:'user',freeformCanvas:{width:630,height:880,elements:[]} };
if(new URLSearchParams(location.search).has('contract')) initial.fieldContracts=[{key:'existingArtwork',type:'image'}];
if(new URLSearchParams(location.search).has('historyContracts')) { initial.freeformCanvas!.elements=[{id:'neighbor',type:'text',name:'Untouched neighbor',content:'{{untouched:"Keep neighbor"}}',x:20,y:20,width:150,height:40,zIndex:1}];initial.fieldContracts=[{key:'untouched',elementId:'neighbor',type:'text',defaultValue:'Keep neighbor'}]; }
function Fixture() {
  const [templates, setTemplates] = useState<TCGCardTemplate[]>(() => [JSON.parse(localStorage.getItem('synthetic-saved-template') ?? 'null') ?? initial]);
  const [selectedId,setSelectedId]=useState(initial.id);
  const [showEditor,setShowEditor] = useState(true);
  const [dirty,setDirty]=useState(false);
  const [finishSave,setFinishSave]=useState<null|(()=>void)>(null);
  const [saved,setSaved] = useState(''); const [exported,setExported]=useState('');
  const file = useRef<HTMLInputElement>(null!);
  const [showProofs,setShowProofs]=useState(true);
  const [image, setImage] = useState('');
  const [rounded,setRounded]=useState<string[]>([]);
  const renderRounded=async()=>{
    const images:string[]=[];
    for(const intensity of [100,25,0]){
      const template=getFreshDefaultTemplateObject(`rounded-${intensity}`,'Synthetic bordered text');template.cardBorderWidth='0px';template.cardBackgroundImageUrl=undefined;template.appearance=undefined;template.baseBackgroundColor='#fff';template.fieldContracts=[];template.templatePreviewData={};
      const element:FreeformCardElement={id:'rounded',name:'Rounded text',type:'text',content:'STUDIO',x:30,y:30,width:570,height:820,rotation:0,opacity:1,zIndex:1,appearance:{assetSource:window.innerWidth>1000?'/overlay.svg':undefined,tileMode:'stretch',border:{kind:'solid',width:20,radius:90,color:window.innerWidth>1000?'rgba(255,0,0,0.35)':'#ff0000'},effects:{innerHighlight:10},material:{baseColor:'#ff00ff',textColor:'#000',gradient:{type:'linear',angle:90,stops:[{id:'a',color:'#00cc66',position:0},{id:'b',color:'#ffff00',position:100}]},texture:{kind:'uploaded',imageSource:'/transparent.svg',intensity,tileMode:'repeat'}}}};
      template.freeformCanvas={width:630,height:880,elements:[element]};images.push(URL.createObjectURL(await renderCardToPngBlob({template,data:{},uniqueId:template.id!},'virtual',72)));
    }setRounded(images);
  };
  const [strokes,setStrokes]=useState<{name:string;src:string}[]>([]);
  const renderStrokes=async()=>{
    const images:{name:string;src:string}[]=[];
    for(const [kind,radius] of [['solid',0],['solid',60],['solid',120],['double',0],['none',0]] as const){
      const template=getFreshDefaultTemplateObject(`stroke-${kind}-${radius}`,'Synthetic stroke');template.aspectRatio='4:3';template.trimWidthMm=40;template.trimHeightMm=30;template.cardBorderWidth='0px';template.cardBorderRadius='0px';template.cardBackgroundImageUrl=undefined;template.appearance=undefined;template.baseBackgroundColor='#fff';template.fieldContracts=[];template.templatePreviewData={};
      const shape:FreeformCardElement={id:'shape',name:'Synthetic shape',type:'shape',shapeKind:'rectangle',x:0,y:0,width:400,height:300,rotation:0,opacity:1,zIndex:1,strokeWidth:16,strokeColor:'#ff0000',appearance:{border:{kind,width:16,radius,color:'#ff0000'},material:{baseColor:'#00cc66'}}};
      template.freeformCanvas={width:400,height:300,elements:[shape]};images.push({name:`${kind}-${radius}`,src:URL.createObjectURL(await renderCardToPngBlob({template,data:{},uniqueId:template.id!},'virtual',254))});
    }setStrokes(images);
  };
  const [proofs,setProofs]=useState<string[]>([]);
  const renderStrengths=async()=>{
    const images:string[]=[];
    for(const intensity of [100,25,0]){
      const template=getFreshDefaultTemplateObject(`strength-${intensity}`,'Synthetic strength');
      template.cardBorderWidth='0px';template.cardBorderRadius='0px';template.cardBackgroundImageUrl=undefined;template.appearance=undefined;template.baseBackgroundColor='#fff';template.fieldContracts=[];template.templatePreviewData={};
      const shape:FreeformCardElement={id:'shape',name:'Synthetic shape',type:'shape',shapeKind:'rectangle',x:0,y:0,width:630,height:880,rotation:0,opacity:1,zIndex:1,strokeWidth:16,strokeColor:'#ff0000',appearance:{border:{kind:'solid',width:16,radius:0,color:'#ff0000'},material:{baseColor:'#fff',gradient:{type:'linear',stops:[{id:'a',color:'#00cc66',position:0},{id:'b',color:'#00cc66',position:100}]},texture:{kind:'uploaded',imageSource:'/ink.svg',intensity,tileMode:'repeat',textureScale:80,blendMode:'multiply'}}}};
      template.freeformCanvas={width:630,height:880,elements:[shape]};
      images.push(URL.createObjectURL(await renderCardToPngBlob({template,data:{},uniqueId:template.id!},'virtual',72)));
    }
    setProofs(images);
  };
  return <><button onClick={()=>setShowProofs(false)}>Close output proofs</button><button onClick={renderRounded}>Render rounded proof</button>{rounded.map((src,i)=><img style={{display:showProofs?undefined:'none'}} key={i} alt={`Rounded proof ${[100,25,0][i]}`} src={src}/>)}<button onClick={renderStrokes}>Render stroke proof</button>{strokes.map(p=><img style={{display:showProofs?undefined:'none'}} key={p.name} alt={`Stroke proof ${p.name}`} src={p.src}/>)}<button onClick={renderStrengths}>Render strength proof</button>{proofs.map((src,i)=><img style={{display:showProofs?undefined:'none'}} key={i} alt={`Strength proof ${[100,25,0][i]}`} src={src}/>)}<button onClick={async()=>{ const template=JSON.parse(localStorage.getItem('synthetic-saved-template')!); const blob=await renderCardToPngBlob({template,data:initializeCardDataFromTemplate(template,template.templatePreviewData??{})[1],uniqueId:'studio-export'},'virtual',72); setImage(URL.createObjectURL(blob)); }}>Render saved PNG</button>{image && <img alt="Saved Studio PNG" src={image}/>}<div data-testid="saved-preview">{saved && <CardPreview card={{template:JSON.parse(saved),data:initializeCardDataFromTemplate(JSON.parse(saved),JSON.parse(saved).templatePreviewData??{})[1],uniqueId:'saved-preview'}} targetWidthPx={630}/>}</div><button onClick={()=>setShowEditor(value=>!value)}>{showEditor?'Hide editor':'Show editor'}</button><button onClick={()=>setExported(localStorage.getItem('synthetic-saved-template') ?? JSON.stringify(templates))}>Export local proof</button><output hidden data-testid="saved">{saved}</output><output hidden data-testid="exported">{exported}</output>
    <output data-testid="working-dirty">{dirty?'dirty':'saved'}</output>{finishSave?<><button onClick={()=>{finishSave();setFinishSave(null);}}>Finish local Save</button><button onClick={()=>{const other:TCGCardTemplate={...initial,id:'other-template',name:'Other local Template',freeformCanvas:{width:630,height:880,elements:[{id:'other-text',type:'text',name:'Other text',content:'Other document',x:10,y:10,width:200,height:80,zIndex:1}]}};setTemplates(current=>[...current.filter(row=>row.id!==other.id),other]);setSelectedId(other.id);}}>Switch local Template during Save</button></>:null}
    {showEditor && <CardTemplateMaker templates={templates} defaultTemplates={[]} backFaceTemplates={[]} userTemplates={templates}
      selectedTemplateIdForEditing={selectedId} onSelectTemplateForEditing={setSelectedId} canUseProjectFiles canSubmitSharedTemplateRevision canPublishSharedLibrary={false}
      showCardWatermark={false} canUploadCustomAssets={false} isActive isCheckoutStarting={false} fileInputRef={file}
      onDirtyChange={setDirty}
      onSaveTemplate={async t=>{const params=new URLSearchParams(location.search);if(params.has('rejectSave'))throw new Error('Synthetic local persistence refusal');if(params.has('delayedSave'))await new Promise<void>(resolve=>setFinishSave(()=>resolve));const prepared=params.has('normalizedSave')?prepareTemplateForLibrarySave(t,true,()=> 'saved-revision',templates.find(row=>row.id===t.id)):t;const snapshot={...prepared,id:params.has('forkSave')?'synthetic-fork':t.id!};setTemplates(current=>[...current.filter(row=>row.id!==snapshot.id),snapshot]);setSaved(JSON.stringify(snapshot));localStorage.setItem('synthetic-saved-template',JSON.stringify(snapshot));if(params.has('forkSave'))setSelectedId(snapshot.id);if(params.has('postCommitDelay'))await new Promise<void>(resolve=>setFinishSave(()=>resolve));return {id:snapshot.id!,template:snapshot};}}
      
      onSubmitTemplateRevision={async()=>{throw new Error('Submission forbidden in local proof');}} onContinueNewTemplateInPipeline={async()=>{throw new Error('Submission forbidden in local proof');}}
      onDeleteTemplate={noop} onCloneTemplate={()=>null} onExportProject={noop} onImportProject={noop} onLoadProject={noop}
      onStartCheckout={noop} appearanceStyles={[]} onSaveAppearanceStyle={()=>''} onReturnToTemplateMaker={noop} />}
    <Toaster /></>;
}
function ControllerBatchProof() {
  const source: TCGCardTemplate = {
    ...initial, id: 'svg-batch-proof',
    freeformCanvas: { width: 630, height: 880, elements: [
      { id: 'icon', type: 'icon', name: 'Test icon', iconName: 'Sparkles', x: 30, y: 30, width: 100, height: 100, zIndex: 1 },
      { id: 'neighbor', type: 'text', name: 'Neighbor', content: 'Keep neighbor', x: 200, y: 30, width: 100, height: 40, zIndex: 2 },
    ] },
  };
  const controller = useTemplateEditorController(source);
  return <>
    <button onClick={() => {
      // Two updates scheduled before React has rendered the first. Previously,
      // updateElement's captured canvas list discarded the SVG source here.
      controller.updateElement('icon', { iconName: undefined, iconImageSource: '/asymmetric.svg', iconRenderMode: 'original' });
      controller.updateElement('icon', { rotation: 30 });
    }}>Apply paired icon updates</button>
    <output data-testid="batch-icon">{JSON.stringify(controller.canvas.elements.find(element => element.id === 'icon'))}</output>
    <output data-testid="batch-neighbor">{JSON.stringify(controller.canvas.elements.find(element => element.id === 'neighbor'))}</output>
    <output data-testid="batch-history">{controller.history.length}</output>
  </>;
}


function PickerSessionProof() {
  const [open,setOpen] = useState(false);
  const [result,setResult] = useState('idle');
  const completion = useRef<null|{resolve:()=>void;reject:(error:Error)=>void}>(null);
  const count = useRef(0);
  const failEarlier = new URLSearchParams(location.search).has('failEarlier');
  const onSelect = () => {
    ++count.current;
    if (count.current === 2) {
      // An ordinary second confirmation settles the prior session while
      // the reopened chooser is still awaiting its own completion.
      if (failEarlier) completion.current?.reject(new Error('Previous session failed'));
      else completion.current?.resolve();
      setResult('previous settled');
    }
    return new Promise<void>((resolve,reject)=>{
      completion.current={resolve,reject};
    });
  };
  return <>
    <button onClick={()=>setOpen(true)}>Open chooser</button>
    <output data-testid="picker-session-result">{result}</output>
    <LibraryPickerDialog open={open} onOpenChange={setOpen}
      request={{purpose:'template.icon-source',title:'Choose icon',acceptedKinds:['icon'],acceptedRoles:['icon'],sources:['published'],selectionMode:'single',target:{kind:'template-element',ids:['icon']},requiresProjectMaterialization:false}}
      resources={[{id:'published:test',objectId:'test',name:'Test published icon',kind:'icon',role:'icon',source:'published',sourceLabel:'CardForge',materialization:'reference'}]}
      onSelect={onSelect}
    />
  </>;
}

let retainedIconCallback: ReturnType<typeof useTemplateEditorController>['applyIconSelection'] | null = null;
function MountedRetainedIcon() {
  const source: TCGCardTemplate = {
    ...initial,id:'retained-icon-proof',freeformCanvas:{width:630,height:880,elements:[
      {id:'icon',type:'icon',name:'Icon',iconName:'Star',x:10,y:10,width:72,height:72,zIndex:1},
    ]},
  };
  const controller = useTemplateEditorController(source);
  useEffect(() => { retainedIconCallback = controller.applyIconSelection; }, [controller.applyIconSelection]);
  return <output data-testid="retained-mounted">mounted</output>;
}
function RetainedIconUnmountProof() {
  const [mounted,setMounted] = useState(true);
  const [status,setStatus] = useState('idle');
  const applyAfterUnmount = () => {
    const callback = retainedIconCallback;
    if (!callback) {setStatus('missing');return;}
    void callback('icon',{iconName:'Star',iconImageSource:undefined,iconRenderMode:undefined})
      .then(()=>setStatus('incorrect-success'))
      .catch(()=>setStatus('rejected'));
  };
  return <>
    <button onClick={()=>setMounted(false)}>Unmount Icon controller</button>
    <button onClick={applyAfterUnmount}>Invoke retained same-value Icon callback</button>
    <output data-testid="retained-status">{status}</output>
    {mounted?<MountedRetainedIcon/>:null}
  </>;
}
function DelayedPersonalIconContextProof() {
  const base: TCGCardTemplate = {
    ...initial, id:'personal-A',
    freeformCanvas:{width:630,height:880,elements:[
      {id:'icon',type:'icon',name:'Icon',iconName:'Star',x:10,y:10,width:72,height:72,zIndex:1},
      {id:'neighbor',type:'text',name:'Neighbor',content:'Keep neighbor',x:180,y:30,width:120,height:35,zIndex:2},
    ]},
  };
  const [activeTemplate,setActiveTemplate] = useState(base);
  const materializeRef = useRef<null | (()=>void)>(null);
  const controller=useTemplateEditorController(activeTemplate);
  useEffect(() => {
    if (activeTemplate.id !== 'personal-B' || controller.currentTemplate.id !== 'personal-B') return;
    const finish = materializeRef.current;
    materializeRef.current = null;
    finish?.();
  }, [activeTemplate.id, controller.currentTemplate.id]);
  const item:PersonalLibraryItem={
    id:'personal-art',provider:'google-drive',providerFileId:'synthetic-file',providerRevision:'1',
    displayName:'Delayed personal SVG',mimeType:'image/svg+xml',role:'icon',byteSize:300,
    providerModifiedAt:'2026-01-01T00:00:00.000Z',providerWebViewLink:null,
    contentHash:null,lastVerifiedAt:'2026-01-01T00:00:00.000Z',
    createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',
  };
  const asset:CardAssetOption={
    id:'materialized-art',name:'Delayed personal SVG',url:'/asymmetric.svg',kind:'icon',
    librarySource:'local',tileMode:'contain',seamless:false,allowedTargets:['icon'],
  };
  return <>
    <output data-testid="personal-context-initial">{activeTemplate.id}</output>
    <TemplateAssetLibraryPicker assets={[]} applicationTemplateId={controller.currentTemplate.id}
      kind="icon" label="an icon" personalItems={[item]} personalRoles={['icon']}
      providerRole="icon" target={{kind:'template-element',ids:['icon']}}
      onAddFromProvider={async()=>undefined}
      onMaterializePersonal={async()=>{
        // B changes the actual controller initialTemplate prop before A resolves.
        setActiveTemplate({...base,id:'personal-B'});
        await new Promise<void>(resolve => { materializeRef.current = resolve; });
        return asset;
      }}
      onApply={(chosen,signal,expectedId)=>controller.applyIconSelection('icon',{
        iconName:undefined,iconImageSource:chosen.url,iconRenderMode:'original',
      },signal,expectedId)}
    />
    <output data-testid="personal-context-template">{controller.currentTemplate.id}</output>
    <output data-testid="personal-context-icon">{JSON.stringify(controller.selectedElement)}</output>
  </>;
}
function UnsavedDraftIconProof() {
  const initialTemplate:TCGCardTemplate = {
    ...initial,id:'saved-source',freeformCanvas:{width:630,height:880,elements:[
      {id:'icon',type:'icon',name:'Icon Layer',iconName:'Sparkles',x:279,y:404,width:72,height:72,zIndex:3},
      {id:'neighbor',type:'text',name:'Neighbor',content:'Keep neighbor',x:20,y:20,width:140,height:35,zIndex:1},
    ]},
  };
  const controller=useTemplateEditorController(initialTemplate);
  const [status,setStatus]=useState('idle');
  return <>
    <button onClick={()=>controller.resetTemplate({...initialTemplate,id:'draft-new-personal-template'})}>Begin unsaved personal Template</button>
    <button onClick={()=>controller.selectElement('icon')}>Select Icon Layer</button>
    <button onClick={()=>{
      setStatus('pending');
      void controller.applyIconSelection('icon',{
        iconName:undefined,iconImageSource:'/asymmetric.svg',iconRenderMode:'original',
      },undefined,controller.currentTemplate.id)
        .then(()=>setStatus('applied')).catch(()=>setStatus('rejected'));
    }}>Apply published SVG to unsaved Template</button>
    <output data-testid="draft-template-id">{controller.currentTemplate.id}</output>
    <output data-testid="draft-selected-element-id">{controller.selectedElementId}</output>
    <output data-testid="draft-apply-status">{status}</output>
    <output data-testid="draft-icon">{JSON.stringify(controller.selectedElement)}</output>
    <output data-testid="draft-neighbor">{JSON.stringify(controller.canvas.elements.find(e=>e.id==='neighbor'))}</output>
    <output data-testid="draft-history">{controller.history.length}</output>
  </>;
}
function ControllerIconApplicationProof() {
  const source: TCGCardTemplate = {
    ...initial, id: 'icon-confirmation-proof',
    freeformCanvas: {width:630,height:880,elements:[
      {id:'icon',type:'icon',name:'Icon',iconName:'Star',x:10,y:10,width:72,height:72,zIndex:3},
      {id:'neighbor',type:'text',name:'Neighbor',content:'Keep neighbor',x:180,y:30,width:150,height:40,zIndex:4},
    ]},
  };
  const controller = useTemplateEditorController(source);
  const [result,setResult] = useState('idle');
  const [race,setRace] = useState('idle');
  const raceConfirmations = () => {
    setRace('pending');
    const first = controller.applyIconSelection('icon', {iconName:undefined,iconImageSource:'/asymmetric.svg',iconRenderMode:'original'});
    const second = controller.applyIconSelection('icon', {iconName:'Star',iconImageSource:undefined,iconRenderMode:undefined});
    void Promise.allSettled([first, second]).then(results => setRace(results.map(result => result.status).join(',')));
  };
  const perform = (sourceValue:string) => {
    setResult('pending');
    void controller.applyIconSelection('icon',{iconName:undefined,iconImageSource:sourceValue,iconRenderMode:'original'})
      .then(()=>setResult('applied'))
      .catch(()=>setResult('rejected'));
  };
  return <>
    <button onClick={()=>perform('/asymmetric.svg')}>Apply Icon with acknowledgment</button>
    <button onClick={raceConfirmations}>Race Arcane then original Star</button>
    <button onClick={() => {
      setResult('pending');
      // A lower-priority unrelated update queued before the Icon update forces
      // React to rebase/replay the Icon updater after its first commit.
      startTransition(() => controller.updateElement('neighbor', {content:'Updated neighbor'}));
      const pickerClose = new AbortController();
      void controller.applyIconSelection('icon', {
        iconName:undefined,iconImageSource:'/asymmetric.svg',iconRenderMode:'original',
      },pickerClose.signal).then(() => {
        // This mirrors LibraryPickerDialog closing after committed acknowledgment.
        pickerClose.abort();
        setResult('applied');
      }).catch(() => setResult('rejected'));
    }}>Apply Icon during lower-priority neighbor edit</button>
    <output data-testid="ack-race">{race}</output>
    <button onClick={()=>{
      setResult('pending');
      const pending=controller.applyIconSelection('icon',{iconName:undefined,iconImageSource:'/asymmetric.svg',iconRenderMode:'original'});
      controller.resetTemplate(source);
      void pending.then(()=>setResult('incorrect-success')).catch(()=>setResult('rejected'));
    }}>Reset same Template during Icon apply</button>
    <button onClick={()=>{
      setResult('pending');
      const pending=controller.applyIconSelection('icon',{iconName:undefined,iconImageSource:'/asymmetric.svg',iconRenderMode:'original'});
      controller.undo();
      void pending.then(()=>setResult('incorrect-success')).catch(()=>setResult('rejected'));
    }}>Undo during Icon apply</button>
    <button onClick={()=>{
      setResult('pending');
      const pending=controller.applyIconSelection('icon',{iconName:undefined,iconImageSource:'/asymmetric.svg',iconRenderMode:'original'});
      controller.redo();
      void pending.then(()=>setResult('incorrect-success')).catch(()=>setResult('rejected'));
    }}>Redo during Icon apply</button>
    <button onClick={()=>controller.updateElement('icon',{locked:true})}>Lock Icon</button>
    <button onClick={()=>controller.updateElement('icon',{locked:false})}>Unlock Icon</button>
    <button onClick={()=>controller.updateElement('icon',{rotation:30})}>Change geometry</button>
    <button onClick={()=>controller.updateCanvas({elements:controller.canvas.elements.filter(element=>element.id!=='icon')})}>Delete Icon</button>
    <button onClick={()=>{
      setResult('pending');
      const pending=controller.applyIconSelection('icon',{iconName:undefined,iconImageSource:'/asymmetric.svg',iconRenderMode:'original'});
      controller.resetTemplate({...source,id:'other-template',freeformCanvas:{...source.freeformCanvas!,elements:source.freeformCanvas!.elements.map(element=>({...element}))}});
      void pending.then(()=>setResult('incorrect-success')).catch(()=>setResult('rejected'));
    }}>Switch Template during Icon apply</button>
    <output data-testid="ack-result">{result}</output>
    <output data-testid="ack-history">{controller.history.length}</output>
    <output data-testid="ack-icon">{JSON.stringify(controller.canvas.elements.find(element=>element.id==='icon'))}</output>
    <output data-testid="ack-neighbor">{JSON.stringify(controller.canvas.elements.find(element=>element.id==='neighbor'))}</output>
  </>;
}
const params = new URLSearchParams(location.search);
createRoot(document.body.appendChild(document.createElement('div'))).render(
  params.has('delayedPersonal') ? <DelayedPersonalIconContextProof/>
  : params.has('retainedIcon') ? <RetainedIconUnmountProof/>
  : params.has('pickerSession') ? <PickerSessionProof/>
  : params.has('iconAcknowledgment') ? <ControllerIconApplicationProof/>
  : params.has('unsavedDraftIcon') ? <UnsavedDraftIconProof/>
  : params.has('controllerBatch') ? <ControllerBatchProof/>
  : params.has('accountToolLayer') ? (
    <EnvironmentToolLayer
      id="library-design-title"
      eyebrow="Library tool"
      title="Design Template"
      summary="Existing Device-only Design"
      closeLabel="Close Design"
      onClose={() => undefined}
      dirty
      presentation="sheet"
      manageHistory={false}
    >
      <Fixture/>
    </EnvironmentToolLayer>
  ) : <Fixture/>
);
