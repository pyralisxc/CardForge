import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { WebsiteUpdates } from '@/features/roadmap/components/WebsiteUpdates';
import { OwnerWebsiteReleaseEditor } from '@/features/owner/components/OwnerWebsiteReleaseEditor';
import { OwnerPageEditorStateContext } from '@/features/public-site/client';
import { projectWebsiteReleases, type WebsiteReleaseRecord } from '@/features/roadmap/model/websiteRelease';
const params=new URLSearchParams(location.search);
const initial:WebsiteReleaseRecord={id:'20000000-0000-4000-8000-000000000001',version:'0.0.1',notes:{improvements:['Exact governed previews'],fixes:['Faithful Studio controls'],knownLimits:['Main promotion remains pending']},sourceSha:null,candidateSha:null,shippedAt:null,updatedAt:'2026-10-30T00:00:00Z'};
const proof=window as typeof window & {releaseRequests:string[]};proof.releaseRequests=[];
let saved=initial;let rows=[initial];
window.fetch=async(_input,init)=>{
 if(!init?.method||init.method==='GET')return Response.json({items:rows});
 const body=String(init?.body??'');proof.releaseRequests.push(body);const input=JSON.parse(body).websiteRelease;
 if(params.has('networkThenConflict')){if(proof.releaseRequests.length===1)throw new TypeError('Synthetic lost response');return Response.json({error:{message:'A later conflict does not resolve the first outcome.'}},{status:409});}
 if(params.has('parseThenConflict')){if(proof.releaseRequests.length===1)return new Response('{broken',{status:200});return Response.json({error:{message:'A later conflict does not resolve the first outcome.'}},{status:409});}
 if(params.has('rejected')&&proof.releaseRequests.length===1)return Response.json({error:{message:'Review the exact saved revision.'}},{status:409});
 if(params.has('committedReadback')){saved={...initial,notes:input.notes,operationId:input.operationId,updatedAt:'2026-10-30T00:01:00Z'};rows=[saved];}
 if(params.has('uncertain')&&proof.releaseRequests.length===1)return Response.json({error:{message:'The write may have committed. Retain the same attempt.'}},{status:503});
 saved={...initial,notes:input.notes,operationId:input.operationId,updatedAt:'2026-10-30T00:01:00Z'};
 if(input.advanceFrom){const previous={...initial,sourceSha:'a'.repeat(40),candidateSha:'b'.repeat(40),shippedAt:'2026-10-30T00:02:00Z'};saved={...saved,id:'20000000-0000-4000-8000-000000000002',version:input.version,shippedAt:null,candidateSha:null};rows=[previous,saved];}else rows=[saved];
 return Response.json({publication:{value:saved,receipt:{committed:true,retryable:false,message:'Working notes saved; no release published.'}}});
};
function Proof(){const [state,setState]=useState({dirty:false,saving:false});const production=params.has('production');return <div className="cardforge-public min-h-screen"><WebsiteUpdates {...projectWebsiteReleases(params.has('empty')?[]:[initial],!production)} unavailable={params.has('unavailable')}/>{!production&&!params.has('empty')&&!params.has('unavailable')?<OwnerPageEditorStateContext.Provider value={setState}><OwnerWebsiteReleaseEditor initial={[initial]} production={false} deployedSha={null}/><p role="status">{state.dirty?'Unpublished notes retained':'Notes saved'}</p></OwnerPageEditorStateContext.Provider>:null}</div>;}
createRoot(document.body.appendChild(document.createElement('div'))).render(<Proof/>);
