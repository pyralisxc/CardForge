import { expect, it } from 'vitest';
import { projectWebsiteReleases, websiteReleaseNotesSchema, websiteReleaseVersionSchema, type WebsiteReleaseRecord } from '@/features/roadmap/model/websiteRelease';
const notes={improvements:['Exact revision preview'],fixes:[],knownLimits:['Main promotion remains pending']};
const row=(version:string,shippedAt:string|null):WebsiteReleaseRecord=>({id:version,version,shippedAt,notes,sourceSha:null,candidateSha:null,updatedAt:'2026-10-30T00:00:00Z'});
it('shows the working version only on Preview with no invented release date',()=>{
 const records=[row('0.0.1',null)];
 expect(projectWebsiteReleases(records,true)).toEqual({working:records[0],released:[]});
 expect(projectWebsiteReleases(records,false)).toEqual({working:null,released:[]});
});
it('orders actual releases by date and keeps the next working version separate',()=>{
 const records=[row('0.0.1','2026-10-20T00:00:00Z'),row('0.0.3',null),row('0.0.2','2026-10-29T00:00:00Z')];
 const result=projectWebsiteReleases(records,true);
 expect(result.working?.version).toBe('0.0.3');
 expect(result.released.map(r=>r.version)).toEqual(['0.0.2','0.0.1']);
 expect(records[0].version).toBe('0.0.1');
});
it('uses typed bounded notes and explicit versions rather than encoded titles',()=>{
 expect(websiteReleaseNotesSchema.parse(notes)).toEqual(notes);
 expect(websiteReleaseNotesSchema.safeParse({...notes,extra:'opaque metadata'}).success).toBe(false);
 expect(websiteReleaseVersionSchema.safeParse('Release0.0.1').success).toBe(false);
 expect(websiteReleaseVersionSchema.safeParse('00.0.1').success).toBe(false);
});
