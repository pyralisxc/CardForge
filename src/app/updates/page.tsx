import { OwnerPublicSiteControlsSlot } from '@/app/_components/OwnerPublicSiteControlsSlot';
import { CardForgeAppProviders } from '@/features/app-shell/server';
import { getCachedBusinessIdentity } from '@/features/business-identity/server';
import { ConfiguredPublicSiteShell } from '@/features/public-site/server';
import { getWebsiteReleaseRecords } from '@/features/roadmap/server';
import { projectWebsiteReleases, WebsiteUpdates, type WebsiteReleaseRecord } from '@/features/roadmap/client';
import { createPageMetadata } from '@/shared/siteMetadata';
export const dynamic='force-dynamic';
export const metadata=createPageMetadata({title:'Website Updates',description:'CardForge website release notes, fixes and known limits.',path:'/updates'});
export default async function UpdatesPage(){
 let records:WebsiteReleaseRecord[]=[];let unavailable=false;
 try{records=await getWebsiteReleaseRecords();}catch{unavailable=true;}
 const production=process.env.VERCEL_ENV==='production';const presentation=projectWebsiteReleases(records,!production);
 return <CardForgeAppProviders><ConfiguredPublicSiteShell currentPath="/updates" businessIdentity={await getCachedBusinessIdentity()} ownerControls={<OwnerPublicSiteControlsSlot currentPath="/updates"/>}><WebsiteUpdates {...presentation} unavailable={unavailable}/></ConfiguredPublicSiteShell></CardForgeAppProviders>;
}
