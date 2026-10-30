import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CardTemplateMaker } from '@/features/template-editor/components/CardTemplateMaker';
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
      onSaveTemplate={async t=>{const params=new URLSearchParams(location.search);if(params.has('rejectSave'))throw new Error('Synthetic local persistence refusal');if(params.has('delayedSave'))await new Promise<void>(resolve=>setFinishSave(()=>resolve));const snapshot={...t,id:params.has('forkSave')?'synthetic-fork':t.id!};setTemplates(current=>[...current.filter(row=>row.id!==snapshot.id),snapshot]);setSaved(JSON.stringify(snapshot));localStorage.setItem('synthetic-saved-template',JSON.stringify(snapshot));if(params.has('forkSave'))setSelectedId(snapshot.id);if(params.has('postCommitDelay'))await new Promise<void>(resolve=>setFinishSave(()=>resolve));return snapshot.id;}}
      
      onSubmitTemplateRevision={async()=>{throw new Error('Submission forbidden in local proof');}} onContinueNewTemplateInPipeline={async()=>{throw new Error('Submission forbidden in local proof');}}
      onDeleteTemplate={noop} onCloneTemplate={()=>null} onExportProject={noop} onImportProject={noop} onLoadProject={noop}
      onStartCheckout={noop} appearanceStyles={[]} onSaveAppearanceStyle={()=>''} onReturnToTemplateMaker={noop} />}
    <Toaster /></>;
}
createRoot(document.body.appendChild(document.createElement('div'))).render(<Fixture/>);
