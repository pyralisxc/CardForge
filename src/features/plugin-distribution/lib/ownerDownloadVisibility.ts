/** Display eligibility only. API guards remain the download authority. */
export async function mayShowOwnerDownloads(read: () => Promise<{user: unknown | null; ownerAccess: {isOwner: boolean}}>): Promise<boolean> {
  try {
    const access = await read();
    return Boolean(access.user && access.ownerAccess.isOwner);
  } catch {
    return false;
  }
}
