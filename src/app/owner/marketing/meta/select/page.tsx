import { getCurrentOwnerAccess } from '@/features/owner/server';
import { listPendingMetaPages } from '@/features/marketing-distribution/server';
import { redirect } from 'next/navigation';

export default async function MetaPageSelection({searchParams}: {searchParams: Promise<{selection?:string}>}) {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner || !owner.userId) redirect('/account');
  const {selection} = await searchParams;
  if (!selection || !/^[0-9a-f-]{36}$/i.test(selection)) redirect('/account');
  let pages: Awaited<ReturnType<typeof listPendingMetaPages>>;
  try { pages = await listPendingMetaPages(selection,owner.userId); }
  catch { redirect('/account?section=library&scope=campaigns&meta=expired'); }
  return <main className="mx-auto max-w-xl space-y-5 p-8">
    <h1 className="text-2xl font-semibold">Choose a Facebook Page</h1>
    <p>Only the Page you choose will be connected. Cancel keeps existing connections unchanged.</p>
    <form method="post" action="/api/owner/marketing/meta/select" className="space-y-4">
      <input type="hidden" name="selection" value={selection}/>
      {pages.map(page=><label key={page.id} className="block border p-4">
        <input type="radio" name="page" value={page.id} required/> {page.name} <span className="text-xs">(Page ID: {page.id})</span>
        {page.instagram ? <span className="ml-2 text-sm">Instagram @{page.instagram}</span> : null}
      </label>)}
      <button className="border px-4 py-2" type="submit">Connect selected Page</button>
    </form>
    <form method="post" action="/api/owner/marketing/meta/select">
      <input type="hidden" name="selection" value={selection}/>
      <input type="hidden" name="cancel" value="true"/>
      <button className="underline" type="submit">Cancel</button>
    </form>
  </main>;
}
