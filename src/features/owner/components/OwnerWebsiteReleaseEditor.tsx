'use client';
import { useState, useContext, useRef } from 'react';
import type { WebsiteReleaseRecord, WebsiteReleaseNotes } from '@/features/roadmap/client';
import { OwnerPageEditorStateContext } from '@/features/public-site/client';
import { Button } from '@/components/ui/button';
import { useEditorDraft } from '@/components/ui/use-editor-draft';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';
const control='block w-full border border-[var(--public-border)] bg-[var(--public-charcoal)] p-2 text-[var(--public-ivory)]';
// Keep draft lines (including unfinished empty lines) losslessly. Normalize only
// a new request snapshot; unchanged stored bullet boundaries remain intact.
// The server schema still owns trimming, nonblank validation and bounds.
const submissionNotes=(notes:WebsiteReleaseNotes):WebsiteReleaseNotes=>({improvements:notes.improvements.filter(Boolean),fixes:notes.fixes.filter(Boolean),knownLimits:notes.knownLimits.filter(Boolean)});
const formFor=(row:WebsiteReleaseRecord)=>({version:row.version,notes:row.notes,candidate:row.candidateSha??''});
export function OwnerWebsiteReleaseEditor({initial,production,deployedSha}:{initial:WebsiteReleaseRecord[];production:boolean;deployedSha:string|null}) {
 const [records,setRecords]=useState(initial);const [stale,setStale]=useState(false);
 const [attempt,setAttempt]=useState<{body:string}|null>(null);const uncertain=useRef(false);const busyRef=useRef(false);
 const [initialForm]=useState(()=>{const row=initial.find(r=>!r.shippedAt)??initial.toSorted((a,b)=>Date.parse(b.shippedAt!)-Date.parse(a.shippedAt!))[0];return row?formFor(row):{version:'0.0.1',notes:{improvements:[],fixes:[],knownLimits:[]},candidate:''};});
 const editor=useEditorDraft(initialForm,useContext(OwnerPageEditorStateContext),Boolean(attempt));
 const {version,notes,candidate}=editor.draft;const busy=editor.saving;
 const working=records.find(row=>!row.shippedAt);const selected=records.find(r=>r.version===version);const [message,setMessage]=useState('');
 const setNotes=(value:WebsiteReleaseNotes)=>editor.setDraft({...editor.draft,notes:value});
 const choose=(value:string)=>{if(attempt||stale)return;if(editor.dirty&&!window.confirm('Discard unpublished update notes?'))return;const row=records.find(r=>r.version===value);if(row)editor.acceptPublished(formFor(row));};
 const readRecords=async()=>{const response=await fetch('/api/owner/operations?scope=websiteReleases',{cache:'no-store'});if(!response.ok)throw new Error(await readApiErrorMessage(response,'Saved records are unavailable.'));return (await response.json()).items as WebsiteReleaseRecord[];};
 const reconcile=async()=>{
  if(busyRef.current)return;busyRef.current=true;editor.setSaving(true);
  try{const rows=await readRecords();setRecords(rows);setStale(false);
   if(attempt){const input=JSON.parse(attempt.body).websiteRelease;const saved=rows.find(row=>row.version===input.version&&row.operationId===input.operationId);
    if(saved){setAttempt(null);uncertain.current=false;editor.acceptPublished(formFor(saved));setMessage('The exact saved attempt is confirmed committed. Do not replay it.');}
    else setMessage('Current records were read, but this exact attempt is unresolved. Absence of its receipt is not proof of failure. Retain this snapshot.');
   }else setMessage('Current saved records refreshed. Your local notes are preserved; review both before saving.');
  }catch(error){setMessage(error instanceof Error?error.message:'Readback unavailable; preserve this draft.');}finally{busyRef.current=false;editor.setSaving(false);}
 };
 const save=async(publish:boolean)=>{
  if(busyRef.current||stale)return;busyRef.current=true;
  const body=attempt?.body??JSON.stringify({kind:'websiteRelease',websiteRelease:{version,notes:submissionNotes(notes),sourceSha:publish?(selected?.sourceSha??deployedSha):null,candidateSha:!selected&&working?null:candidate||null,expectedUpdatedAt:selected?.updatedAt??working?.updatedAt??null,...(!selected&&working?{advanceFrom:working.version}:{}),operationId:crypto.randomUUID(),publish}});
  setAttempt({body});editor.setSaving(true);setMessage('');let confirmedRejection=false;
  try {const response=await fetch('/api/owner/operations',{method:'PUT',headers:{'Content-Type':'application/json'},body});
   if(!response.ok){if([400,409].includes(response.status)&&!uncertain.current){confirmedRejection=true;setAttempt(null);}else uncertain.current=true;throw new Error(await readApiErrorMessage(response,'Outcome unavailable. Retain this exact attempt.'));}
   const result=await response.json();const publication=result.publication;
   if(publication?.receipt?.committed!==true||!publication.value){uncertain.current=true;throw new Error('The outcome is unconfirmed. Retain this exact attempt.');}
   const value=publication.value as WebsiteReleaseRecord;const submitted=JSON.parse(body).websiteRelease;
   setRecords(current=>[...current.filter(row=>row.id!==value.id&&row.version!==submitted.advanceFrom),value]);
   setAttempt(null);uncertain.current=false;editor.acceptPublished(formFor(value));setMessage(publication.receipt.message);
   try{setRecords(await readRecords());setStale(false);}catch{setStale(true);setMessage(publication.receipt.message+' The write committed; refresh the saved records before another edit. Do not replay.');}
  }catch(error){if(!confirmedRejection)uncertain.current=true;setMessage(error instanceof Error?error.message:'Outcome unavailable. Keep this attempt.');}finally{busyRef.current=false;editor.setSaving(false);}
 };
 return <details className="mx-auto max-w-4xl border p-5"><summary>Owner: manage website update notes</summary><p>Saving working notes and publishing a verified release are distinct. Save and review the exact approved notes/candidate packet before publication. Committed refresh warnings must not be replayed.</p><fieldset disabled={busy||!!attempt||stale} className="grid gap-4"><label>Version<input aria-label="Version" className={control} value={version} onChange={e=>editor.setDraft({...editor.draft,version:e.target.value})}/></label><label>Existing record<select className={control} value={selected?.version??''} onChange={e=>choose(e.target.value)}><option value="">Choose exact version</option>{records.map(row=><option key={row.id}>{row.version}</option>)}</select></label>{(['improvements','fixes','knownLimits'] as const).map(key=><label key={key}>{key==='knownLimits'?'Known limits':key}<textarea aria-label={key} className={control} value={notes[key].join('\n')} onChange={e=>setNotes({...notes,[key]:e.target.value.split('\n')})}/></label>)}<label>Approved candidate source SHA<input className={control} value={candidate} onChange={e=>editor.setDraft({...editor.draft,candidate:e.target.value})}/></label></fieldset>{selected?<details><summary>Current saved snapshot</summary><p>{selected.version} · {selected.shippedAt?'Released '+selected.shippedAt:'Unreleased'} · {selected.sourceSha??'No released source'}</p>{Object.entries(selected.notes).map(([key,values])=><p key={key}>{key}: {values.join('; ')||'No notes'}</p>)}</details>:null}{attempt?<p role="status">Unresolved exact attempt retained. Retry only this saved snapshot; do not change its version or notes.</p>:null}<Button type="button" className="m-2" disabled={busy||stale} onClick={()=>void save(Boolean(selected?.shippedAt))}>{attempt?'Confirm same saved attempt':selected?.shippedAt?'Save narrative correction':!selected&&working?'Begin next working version after Production release':production?'Save approved release packet':'Save working notes'}</Button>{production&&!selected?.shippedAt&&!attempt?<Button type="button" disabled={busy||stale||editor.dirty||!selected?.candidateSha} onClick={()=>void save(true)}>Publish verified release</Button>:null}<Button type="button" variant="outline" disabled={busy} onClick={()=>void reconcile()}>Read current saved records</Button>{message?<p role="status">{message}</p>:null}</details>;
}
