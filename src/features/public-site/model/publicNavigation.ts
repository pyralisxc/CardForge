export interface PublicNavigationLink {
  href: string;
  label: string;
}

export interface PublicNavigationGroup {
  label: string;
  links: ReadonlyArray<PublicNavigationLink>;
}

const NAVIGATION_LINKS = {
  home: { href: '/', label: 'Home' },
  about: { href: '/about', label: 'How it works' },
  plans: { href: '/plans', label: 'Plans' },
  roadmap: { href: '/roadmap', label: 'Roadmap' },
  contributor: { href: '/contributors', label: 'Contributors' },
  account: { href: '/account', label: 'Desk' },
  founder: { href: '/cameron', label: 'Meet Cameron' },
} as const satisfies Record<string, PublicNavigationLink>;

export const PUBLIC_NAVIGATION = {
  primary: [
    NAVIGATION_LINKS.about,
    NAVIGATION_LINKS.plans,
    NAVIGATION_LINKS.roadmap,
    NAVIGATION_LINKS.account,
  ],
  founder: NAVIGATION_LINKS.founder,
  footerGroups: [
    {
      label: 'Product',
      links: [
        NAVIGATION_LINKS.plans,
        NAVIGATION_LINKS.account,
        NAVIGATION_LINKS.roadmap,
      ],
    },
    {
      label: 'Company',
      links: [
        { href: '/about', label: 'About CardForge' },
        { href: '/cameron', label: 'Cameron Locke' },
        { href: '/contributors', label: 'Contributor Program' },
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
        { href: '/contributor-terms', label: 'Contributor Terms' },
      ],
    },
  ],
} as const satisfies {
  primary: ReadonlyArray<PublicNavigationLink>;
  founder: PublicNavigationLink;
  footerGroups: ReadonlyArray<PublicNavigationGroup>;
};

export const PUBLIC_FOOTER_LINKS: ReadonlyArray<PublicNavigationLink> = PUBLIC_NAVIGATION.footerGroups
  .flatMap<PublicNavigationLink>((group) => [...group.links])
  .filter((link, index, links) => (
    links.findIndex((candidate) => candidate.href === link.href) === index
  ));
