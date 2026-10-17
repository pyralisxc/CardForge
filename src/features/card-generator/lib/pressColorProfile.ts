/** A named reference condition, never a promise that it matches a particular press or stock. */
export const PRESS_COLOR_REFERENCE = {
  id: 'pdfx4-fogra39-reference-v1',
  label: 'FOGRA39L coated-offset reference',
  source: {
    path: '/color-profiles/sRGB.icc',
    sha256: '049e05b4b9f85e2b65d43e1bed89e301d157f14ba8dadefe3a92e12814d763da',
  },
  output: {
    path: '/color-profiles/FOGRA39L_coated.icc',
    sha256: 'b35713ef7eff09349d4c3249e5f377736d06d8a2671c54712971a3546bf17c57',
  },
  notice: {
    path: '/color-profiles/NOTICE.txt',
    sha256: '50de43a4f8abb17390c0ff24b71643ee3c3cb6b757c8eb85b1ac5cc59e76f2ac',
  },
} as const;

export interface PressColorProfiles {
  source: Uint8Array;
  output: Uint8Array;
  notice: Uint8Array;
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

export async function verifyPressColorProfiles(profiles: PressColorProfiles): Promise<void> {
  for (const key of ['source', 'output', 'notice'] as const) {
    if (await sha256(profiles[key]) !== PRESS_COLOR_REFERENCE[key].sha256) {
      throw new Error(`The press ${key === 'notice' ? 'notice' : 'color profile'} changed. Reload and retry; no untagged substitute was exported.`);
    }
  }
}

export async function loadPressColorProfiles(): Promise<PressColorProfiles> {
  const [source, output, notice] = await Promise.all((['source', 'output', 'notice'] as const).map(async (key) => {
    let response: Response;
    try { response = await fetch(PRESS_COLOR_REFERENCE[key].path, { cache: 'no-store' }); }
    catch { throw new Error('The press color profiles are unavailable. Restore the connection and retry.'); }
    if (!response.ok) throw new Error('The press color profiles are unavailable. Retry after the service recovers.');
    return new Uint8Array(await response.arrayBuffer());
  }));
  const profiles = { source, output, notice };
  await verifyPressColorProfiles(profiles);
  return profiles;
}
