import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { WebsiteUpdates } from '@/features/roadmap/components/WebsiteUpdates';
import { OwnerWebsiteReleaseEditor } from '@/features/owner/components/OwnerWebsiteReleaseEditor';
import { OwnerPageEditorStateContext } from '@/features/public-site/client';
import { projectWebsiteReleases, websiteReleaseNotesSchema, type WebsiteReleaseRecord } from '@/features/roadmap/model/websiteRelease';
const params=new URLSearchParams(location.search);
const initial:WebsiteReleaseRecord={id:'20000000-0000-4000-8000-000000000001',version:'0.0.1',notes:{improvements:['Exact governed previews'],fixes:['Faithful Studio controls'],knownLimits:['Main promotion remains pending']},sourceSha:null,candidateSha:null,shippedAt:null,updatedAt:'2026-10-30T00:00:00Z'};
if(params.has('embeddedNote'))initial.notes={...initial.notes,improvements:['Existing note\nwith continuation']};
const proof=window as typeof window & {releaseRequests:string[]};proof.releaseRequests=[];
const seedRows:WebsiteReleaseRecord[]=params.has('releasedOwner')?[{...initial,id:'20000000-0000-4000-8000-000000000002',version:'0.0.2',notes:{improvements:['Retained released notes'],fixes:['Original correction'],knownLimits:[]},sourceSha:'a'.repeat(40),candidateSha:'b'.repeat(40),shippedAt:'2026-10-30T00:00:00Z'},{...initial,sourceSha:'c'.repeat(40),candidateSha:'d'.repeat(40),shippedAt:'2026-10-29T00:00:00Z'}]:[initial];
const storageKey='synthetic-website-release-records';
let saved=initial;let rows:WebsiteReleaseRecord[]=params.has('persistNotes')?JSON.parse(sessionStorage.getItem(storageKey)??JSON.stringify(seedRows)):seedRows;
const persist=()=>{if(params.has('persistNotes'))sessionStorage.setItem(storageKey,JSON.stringify(rows));};
window.fetch=async(_input,init)=>{
 if(!init?.method||init.method==='GET')return Response.json({items:rows});
 const body=String(init?.body??'');proof.releaseRequests.push(body);const input=JSON.parse(body).websiteRelease;const parsedNotes=websiteReleaseNotesSchema.safeParse(input.notes);if(!parsedNotes.success)return Response.json({error:{message:'Notes must be nonblank, at most 1000 characters each, and at most 40 per section.'}},{status:400});const current=rows.find(row=>row.version===input.version)??initial;
 if(params.has('networkThenConflict')){if(proof.releaseRequests.length===1)throw new TypeError('Synthetic lost response');return Response.json({error:{message:'A later conflict does not resolve the first outcome.'}},{status:409});}
 if(params.has('parseThenConflict')){if(proof.releaseRequests.length===1)return new Response('{broken',{status:200});return Response.json({error:{message:'A later conflict does not resolve the first outcome.'}},{status:409});}
 if(params.has('rejected')&&proof.releaseRequests.length===1)return Response.json({error:{message:'Review the exact saved revision.'}},{status:409});
 if(params.has('committedReadback')){saved={...current,version:input.version,notes:parsedNotes.data,operationId:input.operationId,updatedAt:'2026-10-30T00:01:00Z'};rows=[...rows.filter(row=>row.version!==input.version),saved];persist();}
 if(params.has('uncertain')&&proof.releaseRequests.length===1)return Response.json({error:{message:'The write may have committed. Retain the same attempt.'}},{status:503});
 saved={...current,version:input.version,notes:parsedNotes.data,operationId:input.operationId,updatedAt:'2026-10-30T00:01:00Z'};
 if(input.advanceFrom){const previous={...initial,sourceSha:'a'.repeat(40),candidateSha:'b'.repeat(40),shippedAt:'2026-10-30T00:02:00Z'};saved={...saved,id:'20000000-0000-4000-8000-000000000002',version:input.version,shippedAt:null,candidateSha:null};rows=[previous,saved];}else rows=[...rows.filter(row=>row.version!==input.version),saved];
 persist();return Response.json({publication:{value:saved,receipt:{committed:true,retryable:false,message:'Working notes saved; no release published.'}}});
};
const ownerHistory=rows;
function Proof(){const [state,setState]=useState({dirty:false,saving:false});const production=params.has('production')||params.has('releasedOwner');return <div className="cardforge-public min-h-screen"><WebsiteUpdates {...projectWebsiteReleases(params.has('empty')?[]:ownerHistory,!production)} unavailable={params.has('unavailable')}/>{(!production||params.has('releasedOwner'))&&!params.has('empty')&&!params.has('unavailable')?<OwnerPageEditorStateContext.Provider value={setState}><OwnerWebsiteReleaseEditor initial={ownerHistory} production={production} deployedSha={null}/><p role="status">{state.dirty?'Unpublished notes retained':'Notes saved'}</p></OwnerPageEditorStateContext.Provider>:null}</div>;}
createRoot(document.body.appendChild(document.createElement('div'))).render(<Proof/>);
