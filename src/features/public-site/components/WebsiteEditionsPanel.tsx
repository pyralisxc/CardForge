"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

type Edition = { id: string; name: string; archivedAt: string | null };
type Revision = { id: string; ordinal: number; createdAt: string };

/** Placed in existing on-page Owner operations; never a second Owner navigation. */
export function WebsiteEditionsPanel({
  editionId, revisionId, unsaved, onCreateEdition,
}: {
  editionId: string;
  revisionId: string | null;
  unsaved: boolean;
  onCreateEdition: (editionId: string) => void;
}) {
  const router = useRouter();
  const [editions, setEditions] = useState<Edition[]>([]);
  const [selected, setSelected] = useState(editionId);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const refresh = async () => {
    const response = await fetch('/api/owner/website-editions', { cache: 'no-store' });
    if (!response.ok) throw new Error(await readApiErrorMessage(response,'Cannot read editions.'));
    const body = await response.json() as { editions: Edition[] };
    setEditions(body.editions);
  };
  useEffect(() => { void refresh().catch((failure:unknown)=>setError(failure instanceof Error?failure.message:'Unable to load editions.')); }, []);
  useEffect(() => { setSelected(editionId); }, [editionId]);
  useEffect(() => {
    if (!selected) { setRevisions([]); return; }
    let active = true;
    void fetch('/api/owner/website-revisions?editionId='+encodeURIComponent(selected), {cache:'no-store'})
      .then(async (response) => {
        if(!response.ok) throw new Error(await readApiErrorMessage(response,'Unable to read revision history.'));
        return response.json() as Promise<{revisions:Revision[]}>;
      })
      .then((body) => {if(active) setRevisions(body.revisions);})
      .catch((failure:unknown)=>{if(active) setError(failure instanceof Error?failure.message:'Revision list unavailable.');});
    return () => {active=false;};
  }, [selected, revisionId]);
  const perform = async (action: () => Promise<void>) => {
    if (loading) return;
    setLoading(true);setError('');
    try { await action(); await refresh(); }
    catch (failure) { setError(failure instanceof Error?failure.message:'Website edition operation failed.'); }
    finally { setLoading(false); }
  };
  const create = () => void perform(async () => {
    if (unsaved && !window.confirm('Start another edition using your current private draft?')) return;
    const response=await fetch('/api/owner/website-editions', {
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name}),
    });
    if(!response.ok) throw new Error(await readApiErrorMessage(response,'Cannot create edition.'));
    const created=await response.json() as {editionId:string};
    onCreateEdition(created.editionId);setSelected(created.editionId);setName('');
  });
  const initialize = () => void perform(async () => {
    if(!window.confirm('Capture the currently published website as immutable Current Website revision 1?')) return;
    const response=await fetch('/api/owner/website-editions',{
      method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({operationId:crypto.randomUUID()}),
    });
    if(!response.ok) throw new Error(await readApiErrorMessage(response,'Unable to adopt current website.'));
    router.refresh();
  });
  const preview = (id: string) => void perform(async () => {
    if (unsaved && !window.confirm('Discard private unsaved changes before opening this saved revision?')) return;
    const response=await fetch('/api/owner/website-preview',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revisionId:id}),
    });
    if(!response.ok) throw new Error(await readApiErrorMessage(response,'Cannot preview revision.'));
    router.refresh();
  });
  const closePreview = () => void perform(async () => {
    if (unsaved && !window.confirm('Discard private unsaved changes and return to live?')) return;
    const response=await fetch('/api/owner/website-preview',{method:'DELETE'});
    if(!response.ok) throw new Error(await readApiErrorMessage(response,'Unable to exit preview.'));
    router.refresh();
  });
  const archive = () => void perform(async () => {
    if(!selected || !window.confirm('Archive this inactive edition? All immutable revisions are retained.')) return;
    const response=await fetch('/api/owner/website-editions',{
      method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({editionId:selected}),
    });
    if(!response.ok) throw new Error(await readApiErrorMessage(response,'Unable to archive edition.'));
  });

  return <section className="space-y-3 border border-[var(--cf-border-strong)] bg-[var(--cf-surface)] p-4" aria-label="Website editions">
    <div><h3 className="font-serif text-xl text-[var(--cf-text-strong)]">Website editions</h3>
      <p className="text-sm text-[var(--cf-text-muted)]">Save immutable presentation revisions, inspect any saved edition privately, then explicitly activate an exact revision. Accounts, legal records, provider settings and prices remain live.</p></div>
    {error ? <p role="alert" className="text-sm text-[var(--cf-warning)]">{error}</p> : null}
    {!editionId && editions.length===0 ?
      <Button type="button" disabled={loading} onClick={initialize}>Adopt Current Website as revision 1</Button> : null}
    <label className="grid gap-1 text-sm">Edition
      <select className="min-h-11 border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-2" value={selected}
        onChange={(event)=>setSelected(event.target.value)}>
        <option value="">Choose an edition</option>
        {editions.map((edition)=><option key={edition.id} value={edition.id}>{edition.name}{edition.archivedAt?' (archived)':''}</option>)}
      </select>
    </label>
    <div className="flex flex-wrap gap-2">
      <input className="min-h-11 flex-1 border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-2" aria-label="New edition name"
        placeholder="New edition name" value={name} maxLength={100} onChange={(event)=>setName(event.target.value)}/>
      <Button type="button" disabled={loading||!name.trim()||!editionId} onClick={create}>New edition from this design</Button>
      <Button type="button" variant="outline" disabled={loading} onClick={closePreview}>View live website</Button>
      <Button type="button" variant="outline" disabled={loading||!selected} onClick={archive}>Archive inactive</Button>
    </div>
    {selected?<div className="space-y-2">
      <p className="text-sm font-semibold">Saved revisions ({revisions.length})</p>
      {revisions.map((revision)=><div key={revision.id} className="flex items-center justify-between gap-3 border-b border-[var(--cf-border-subtle)] py-2 text-sm">
        <span>Revision {revision.ordinal}{revision.id===revisionId?' · Editing':''}
          <span className="block text-xs text-[var(--cf-text-subtle)]">{new Date(revision.createdAt).toLocaleString()}</span>
        </span>
        <Button size="sm" type="button" variant="outline" disabled={loading} onClick={()=>preview(revision.id)}>Private preview</Button>
      </div>)}
    </div>:null}
  </section>;
}
