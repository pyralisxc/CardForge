import { getWebsiteReleaseRecords } from '@/features/roadmap/server';
export const dynamic='force-dynamic';
/** Canonical released facts only; no working notes or private Website Editions. */
export async function GET(){
 try {
  const records=await getWebsiteReleaseRecords();
  return Response.json({releases:records.filter(row=>row.shippedAt!==null).map(({id,version,notes,sourceSha,candidateSha,shippedAt,updatedAt})=>({id,version,notes,sourceSha,candidateSha,shippedAt,updatedAt}))},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Website releases are unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
