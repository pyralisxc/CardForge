import { z } from 'zod/v4';

const noteList = z.array(z.string().trim().min(1).max(1000)).max(40);
export const websiteReleaseNotesSchema = z.object({
  improvements: noteList, fixes: noteList, knownLimits: noteList,
}).strict();
export const websiteReleaseVersionSchema = z.string().regex(/^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/);
export const websiteReleaseSourceSchema = z.string().regex(/^[a-f0-9]{40}$/);
export type WebsiteReleaseNotes = z.infer<typeof websiteReleaseNotesSchema>;
export interface WebsiteReleaseRecord {
  id: string;
  version: string;
  notes: WebsiteReleaseNotes;
  sourceSha: string | null;
  candidateSha: string | null;
  shippedAt: string | null;
  updatedAt: string;
  mutationKind?: 'working-saved'|'release-published'|'narrative-corrected'|'working-advanced'|null;
  operationId?: string | null;
  advanceFrom?: string | null;
}

/** Release history is independent of Website Edition presentation snapshots. */
export function projectWebsiteReleases(records: readonly WebsiteReleaseRecord[], preview: boolean) {
  const released = records.filter(row => row.shippedAt !== null).toSorted((a,b) => Date.parse(b.shippedAt!) - Date.parse(a.shippedAt!));
  const working = preview ? records.filter(row => row.shippedAt === null).toSorted((a,b) => compareVersions(b.version,a.version))[0] ?? null : null;
  return { working, released };
}
function compareVersions(a: string,b: string) {
  const left=websiteReleaseVersionSchema.parse(a).split('.').map(Number);
  const right=websiteReleaseVersionSchema.parse(b).split('.').map(Number);
  for(let i=0;i<3;i++) if(left[i]!==right[i]) return left[i]-right[i];
  return 0;
}
