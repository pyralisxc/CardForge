"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { PublicAuthControls } from '@/features/account/client/auth';

type HeaderVariant = 'hero' | 'solid';

interface PublicSiteHeaderProps {
  currentPath?: string;
  rightSlot?: ReactNode;
  showAccountLink?: boolean;
  showOwnerLink?: boolean;
  showStudioCta?: boolean;
  title?: string;
  variant?: HeaderVariant;
}

const baseNavItems = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/access', label: 'Access' },
  { href: '/studio', label: 'Studio' },
  { href: '/roadmap', label: 'Roadmap' },
  { href: '/developer', label: 'Developers' },
] as const;

export function PublicSiteHeader({
  currentPath,
  rightSlot,
  showAccountLink = true,
  showOwnerLink = false,
  showStudioCta = false,
  title = 'CardForge Studio',
  variant = 'solid',
}: PublicSiteHeaderProps) {
  const navItems = [
    ...baseNavItems,
    ...(showAccountLink ? [{ href: '/account', label: 'Account' } as const] : []),
    ...(showOwnerLink ? [{ href: '/owner', label: 'Owner' } as const] : []),
  ];
  const isHero = variant === 'hero';
  const resolvedRightSlot = rightSlot ?? <PublicAuthControls />;

  return (
    <header className={isHero ? 'relative z-10' : 'border-b border-[#5f4526] bg-[#120e09]'}>
      <div className={`mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 md:px-6 ${
        isHero ? 'md:px-8 md:py-5' : ''
      }`}>
        <Link
          href="/"
          prefetch={false}
          className="flex min-w-0 items-center gap-3 text-[#f9e7b7]"
        >
          <span className={`grid shrink-0 place-items-center border border-[#d7b469]/70 bg-[#1c130b] text-[#f2c15d] ${
            isHero
              ? 'h-10 w-10 bg-[#140f0a]/80 shadow-[0_0_28px_rgba(242,149,48,0.18)]'
              : 'h-9 w-9'
          }`}>
            <Image
              src="/brand/cardforge-studio/brand-mark.svg"
              alt=""
              width={24}
              height={32}
              priority={isHero}
              className={isHero ? 'h-8 w-auto' : 'h-7 w-auto'}
            />
          </span>
          <span className="truncate font-serif text-xl font-semibold tracking-wide">{title}</span>
        </Link>

        <nav className="order-3 flex w-full flex-wrap gap-3 text-xs text-[#dbc79e] md:order-none md:ml-4 md:w-auto md:flex-1 md:items-center md:gap-5 md:text-sm">
          {navItems.map((item) => {
            const isActive = currentPath === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                aria-current={isActive ? 'page' : undefined}
                className={`border-b border-transparent py-1 transition hover:text-[#fff3ca] ${
                  isActive ? 'border-[#d8b365] text-[#fff3ca]' : ''
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {showStudioCta ? (
          <Button asChild className="ml-auto hidden bg-[#d69c3a] text-[#16100a] hover:bg-[#f1bd58] md:inline-flex">
            <Link href="/studio" prefetch={false}>Open Studio</Link>
          </Button>
        ) : null}

        {resolvedRightSlot ? (
          <div className={showStudioCta ? 'ml-auto md:ml-0' : 'ml-auto'}>
            {resolvedRightSlot}
          </div>
        ) : null}
      </div>
    </header>
  );
}
