'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createAuthRouteHref } from '@/infrastructure/auth/clerk';

type Release = { name: string; version: string; checksum: string; environment: string; endpoint: string; appSha: string | null; releaseDate: string | null; changes: string; compatibility: string[]; filename: string };
const errorText = (status: number, scope: 'studio' | 'owner', environment: string): string => {
  if (status === 401) return 'Sign in to CardForge to access this download.';
  if (status === 403) return scope === 'owner' ? 'CardForge Owner access is required.' : environment === 'preview' ? 'Active Contributor or Owner access is required.' : 'Access is not permitted.';
  if (status === 409) return 'This download changed. Refresh the release information.';
  return 'The download is temporarily unavailable. Your account access has not changed.';
};
export function PluginDownloadLinks({ scope }: { scope: 'studio' | 'owner' }) {
  const [results, setResults] = useState<Record<string, Release | null>>({});
  const [errors, setErrors] = useState<Record<string, { status: number; message: string }>>({});
  useEffect(() => {
    let active = true;
    for (const environment of ['production', 'preview']) {
      fetch('/api/plugin-downloads?product=' + scope + '&environment=' + environment, { cache: 'no-store' })
        .then(async (response) => {
          if (!response.ok) throw { status: response.status, message: errorText(response.status, scope, environment) };
          return response.json() as Promise<{ latest: Release }>;
        })
        .then(({ latest }) => { if (active) setResults(current => ({ ...current, [environment]: latest })); })
        .catch((error: { status?: number; message?: string }) => {
          if (active) setErrors(current => ({ ...current, [environment]: { status: error.status ?? 503, message: error.message ?? errorText(503, scope, environment) } }));
        });
    }
    return () => { active = false; };
  }, [scope]);
  return <section aria-label={scope === 'studio' ? 'CardForge Studio downloads' : 'CardForge Owner downloads'} className="grid gap-4">
    <h2 className="text-xl font-semibold">{scope === 'studio' ? 'Studio plugin downloads' : 'Owner plugin downloads'}</h2>
    <p>Download a complete plugin package for your host. Installation does not sign you in or grant CardForge permissions. Previous releases appear only when original verified bytes are retained.</p>
    {(['production', 'preview'] as const).map(environment => {
      const release = results[environment];
      const failure = errors[environment];
      return <div key={environment} className="rounded border border-current p-4">
        <h3 className="font-semibold">{environment === 'production' ? 'Production' : 'Preview'}</h3>
        {release ? <>
          <p>{release.name} · version {release.version}</p>
          <p>Release date: not recorded for this current-only build.</p>
          <p>{release.changes}</p>
          <p>Supported formats: {release.compatibility.join(', ')}</p>
          <p className="break-all text-xs">Endpoint: {release.endpoint}</p>
          <p className="break-all text-xs">SHA-256: {release.checksum}</p>
          <p className="break-all text-xs">App SHA: {release.appSha || 'Unavailable'}</p>
          <a className="inline-block underline" href={'/api/plugin-downloads?product=' + scope + '&environment=' + environment + '&download=1&sha256=' + release.checksum}>Download latest ZIP</a>
        </> : <p>{failure?.message || 'Checking available release…'} {failure?.status === 401 && <Link className="underline" href={createAuthRouteHref('/sign-in', '/downloads')}>Sign in</Link>}</p>}
      </div>;
    })}
  </section>;
}
