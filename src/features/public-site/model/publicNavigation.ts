export interface PublicNavigationLink {
  href: string;
  label: string;
}

export interface PublicNavigationGroup {
  label: string;
  links: ReadonlyArray<PublicNavigationLink>;
}

export const PUBLIC_NAVIGATION = {
  primary: [
    { href: '/about', label: 'How it works' },
    { href: '/roadmap', label: 'Roadmap' },
    { href: '/account', label: 'Account' },
  ],
  studio: { href: '/studio', label: 'Try the Studio' },
  founder: { href: '/cameron', label: 'Meet Cameron' },
  footerGroups: [
    {
      label: 'Product',
      links: [
        { href: '/studio', label: 'Studio' },
        { href: '/account', label: 'Account' },
        { href: '/roadmap', label: 'Roadmap' },
      ],
    },
    {
      label: 'Company',
      links: [
        { href: '/about', label: 'About CardForge' },
        { href: '/cameron', label: 'Cameron Locke' },
        { href: '/developer', label: 'Developer Program' },
      ],
    },
    {
      label: 'Help',
      links: [
        { href: '/contact', label: 'Contact' },
        { href: '/accessibility', label: 'Accessibility' },
      ],
    },
    {
      label: 'Legal',
      links: [
        { href: '/privacy', label: 'Privacy' },
        { href: '/terms', label: 'Terms' },
        { href: '/creator-pass-terms', label: 'Creator Pass Terms' },
        { href: '/supporter-terms', label: 'Supporter Terms' },
        { href: '/refund', label: 'Refunds' },
        { href: '/developer-terms', label: 'Developer Terms' },
      ],
    },
  ],
} as const satisfies {
  primary: ReadonlyArray<PublicNavigationLink>;
  studio: PublicNavigationLink;
  founder: PublicNavigationLink;
  footerGroups: ReadonlyArray<PublicNavigationGroup>;
};

export const PUBLIC_FOOTER_LINKS: ReadonlyArray<PublicNavigationLink> = PUBLIC_NAVIGATION.footerGroups
  .flatMap<PublicNavigationLink>((group) => [...group.links])
  .filter((link, index, links) => (
    links.findIndex((candidate) => candidate.href === link.href) === index
  ));
