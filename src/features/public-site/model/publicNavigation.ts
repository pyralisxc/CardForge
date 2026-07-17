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
    { href: '/examples', label: 'Examples' },
    { href: '/access', label: 'Access' },
    { href: '/about', label: 'About' },
    { href: '/cameron', label: 'Cameron' },
    { href: '/roadmap', label: 'Roadmap' },
    { href: '/developer', label: 'Developers' },
  ],
  studio: { href: '/studio', label: 'Try the Studio' },
  footerGroups: [
    {
      label: 'Product',
      links: [
        { href: '/examples', label: 'Complete Sets' },
        { href: '/studio', label: 'Studio' },
        { href: '/access', label: 'Access' },
        { href: '/roadmap', label: 'Roadmap' },
      ],
    },
    {
      label: 'Company',
      links: [
        { href: '/about', label: 'About CardForge' },
        { href: '/cameron', label: 'Cameron Locke' },
        { href: '/support', label: 'Support Cameron' },
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
  footerGroups: ReadonlyArray<PublicNavigationGroup>;
};

export const PUBLIC_FOOTER_LINKS: ReadonlyArray<PublicNavigationLink> = PUBLIC_NAVIGATION.footerGroups
  .flatMap<PublicNavigationLink>((group) => [...group.links])
  .filter((link, index, links) => (
    links.findIndex((candidate) => candidate.href === link.href) === index
  ));
