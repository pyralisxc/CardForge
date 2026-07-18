"use client";

import React, { useState, type SVGProps } from 'react';

import type { FounderProfile } from '../model/founderProfile';

type SocialProfile = Pick<FounderProfile, 'facebookUrl' | 'instagramUrl' | 'discordUrl'>;

const iconClassName = 'h-5 w-5 fill-current';

function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M13.7 22v-8.8h3l.45-3.43H13.7V7.58c0-.99.28-1.67 1.72-1.67h1.84V2.85c-.32-.04-1.41-.13-2.68-.13-2.65 0-4.47 1.62-4.47 4.6v2.45h-3v3.43h3V22h3.59Z" /></svg>;
}

function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path fillRule="evenodd" d="M7.2 2h9.6A5.2 5.2 0 0 1 22 7.2v9.6a5.2 5.2 0 0 1-5.2 5.2H7.2A5.2 5.2 0 0 1 2 16.8V7.2A5.2 5.2 0 0 1 7.2 2Zm-.18 1.82a3.2 3.2 0 0 0-3.2 3.2v9.96a3.2 3.2 0 0 0 3.2 3.2h9.96a3.2 3.2 0 0 0 3.2-3.2V7.02a3.2 3.2 0 0 0-3.2-3.2H7.02ZM12 6.86A5.14 5.14 0 1 1 12 17.14 5.14 5.14 0 0 1 12 6.86Zm0 1.8A3.34 3.34 0 1 0 12 15.34 3.34 3.34 0 0 0 12 8.66Zm5.35-3.02a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z" clipRule="evenodd" /></svg>;
}

function DiscordIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M19.55 5.33A18.8 18.8 0 0 0 14.9 3.9l-.57 1.16a17.2 17.2 0 0 0-4.66 0L9.1 3.9a18.9 18.9 0 0 0-4.66 1.43C1.5 9.72.7 14 .99 18.22a18.9 18.9 0 0 0 5.71 2.86l1.4-1.9a12.4 12.4 0 0 1-2.2-1.06l.54-.42c4.25 1.97 8.87 1.97 13.06 0l.55.42c-.7.41-1.44.77-2.2 1.06l1.4 1.9a18.8 18.8 0 0 0 5.7-2.86c.35-4.9-.82-9.14-3.4-12.89ZM8.52 15.65c-1.28 0-2.33-1.18-2.33-2.63s1.02-2.64 2.33-2.64c1.32 0 2.36 1.19 2.33 2.64 0 1.45-1.02 2.63-2.33 2.63Zm6.96 0c-1.28 0-2.33-1.18-2.33-2.63s1.02-2.64 2.33-2.64c1.32 0 2.36 1.19 2.33 2.64 0 1.45-1.01 2.63-2.33 2.63Z" /></svg>;
}

export function FounderSocialLinks({ profile, compact = false }: { profile: SocialProfile; compact?: boolean }) {
  const [announcement, setAnnouncement] = useState('');
  const networks = [
    { label: 'Facebook', url: profile.facebookUrl, Icon: FacebookIcon },
    { label: 'Instagram', url: profile.instagramUrl, Icon: InstagramIcon },
    { label: 'Discord', url: profile.discordUrl, Icon: DiscordIcon },
  ] as const;
  const controlClassName = `${compact ? 'h-10 w-10' : 'h-11 w-11'} inline-flex items-center justify-center rounded-[var(--public-radius)] border border-[var(--public-border)] text-[var(--public-muted-text)] transition-colors hover:border-[var(--public-brass)] hover:text-[var(--public-brass)]`;

  return (
    <div className="flex items-center gap-2" aria-label="Follow Cameron">
      {networks.map((network) => network.url ? (
        <a
          key={network.label}
          href={network.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${network.label} (opens in a new tab)`}
          title={network.label}
          className={controlClassName}
        >
          <network.Icon className={iconClassName} />
        </a>
      ) : (
        <button
          key={network.label}
          type="button"
          aria-label={`${network.label} coming soon`}
          title={`${network.label} coming soon`}
          className={controlClassName}
          onClick={() => setAnnouncement(`${network.label} coming soon`)}
        >
          <network.Icon className={iconClassName} />
        </button>
      ))}
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </div>
  );
}
