export type CardForgeExampleRow = Readonly<Record<string, string>>;

export interface CardForgeExample {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly cardCount: number;
  readonly systemType: string;
  readonly frontTemplateId: string;
  readonly backTemplateId?: string;
  readonly rows: readonly CardForgeExampleRow[];
  readonly sourceFormat: string;
  readonly outputFormats: readonly string[];
  readonly altText: Readonly<{
    rows: readonly string[];
    back?: string;
  }>;
  readonly caseStudy: Readonly<{
    summary: string;
    workflow: readonly string[];
  }>;
}

const defineExample = (
  example: Omit<CardForgeExample, 'cardCount'>,
): CardForgeExample => Object.freeze({
  ...example,
  cardCount: example.rows.length,
});

const ARCANE_PLAYING_CARD_ROWS = Object.freeze([
  Object.freeze({
    Rank: 'A',
    Suit: '♠',
    Artwork: '/card-assets/showcase/playing-cards/ace-of-spades.webp',
    CardTitle: 'The Night Sentinel',
  }),
  Object.freeze({
    Rank: 'K',
    Suit: '♥',
    Artwork: '/card-assets/showcase/playing-cards/king-of-hearts.webp',
    CardTitle: 'The Rosebound King',
  }),
  Object.freeze({
    Rank: 'Q',
    Suit: '♦',
    Artwork: '/card-assets/showcase/playing-cards/queen-of-diamonds.webp',
    CardTitle: 'The Prism Sovereign',
  }),
  Object.freeze({
    Rank: 'J',
    Suit: '♣',
    Artwork: '/card-assets/showcase/playing-cards/jack-of-clubs.webp',
    CardTitle: 'The Greenwood Tinker',
  }),
]);

const ARCANE_CREATURE_ROWS = Object.freeze([
  Object.freeze({
    CardName: 'Emberclaw Whelp',
    Cost: '2',
    Artwork: '/card-assets/showcase/creatures/emberclaw-whelp.webp',
    TypeLine: 'Creature — Forge Dragon',
    Ability: 'Kindleflight — When Emberclaw enters, another creature gains +1 power this turn.',
    SubText: 'Small sparks still remember the mountain.',
    Power: '2',
    Toughness: '2',
  }),
  Object.freeze({
    CardName: 'Mossback Guardian',
    Cost: '5',
    Artwork: '/card-assets/showcase/creatures/mossback-guardian.webp',
    TypeLine: 'Creature — Ancient Tortoise',
    Ability: 'Sanctuary Shell — Allies beside Mossback gain +1 toughness.',
    SubText: 'Whole villages have grown beneath its patient watch.',
    Power: '3',
    Toughness: '7',
  }),
  Object.freeze({
    CardName: 'Moonveil Stag',
    Cost: '4',
    Artwork: '/card-assets/showcase/creatures/moonveil-stag.webp',
    TypeLine: 'Creature — Astral Stag',
    Ability: 'Quiet Passage — Moonveil cannot be blocked on the turn it arrives.',
    SubText: 'Follow the silver tracks, but never call its name.',
    Power: '4',
    Toughness: '3',
  }),
  Object.freeze({
    CardName: 'Stormglass Siren',
    Cost: '6',
    Artwork: '/card-assets/showcase/creatures/stormglass-siren.webp',
    TypeLine: 'Creature — Tempest Siren',
    Ability: 'Breaking Tide — Return one opposing creature to its keeper’s hand.',
    SubText: 'Her wings carry the sea farther than any shore.',
    Power: '5',
    Toughness: '5',
  }),
]);

const EVENT_BADGE_ROWS = Object.freeze([
  Object.freeze({
    EventLogo: '/brand/cardforge-studio/brand-mark.svg',
    EventName: 'Card Systems Workshop',
    AttendeeName: 'Morgan Lee',
    BadgeType: 'Facilitator',
    RoleColor: '#d49a3a',
    Organization: 'CardForge Studio',
    Track: 'Template Lab',
    Room: 'Foundry A',
    AccessCode: 'DEMO-01',
  }),
  Object.freeze({
    EventLogo: '/brand/cardforge-studio/brand-mark.svg',
    EventName: 'Card Systems Workshop',
    AttendeeName: 'Riley Chen',
    BadgeType: 'Participant',
    RoleColor: '#3a8093',
    Organization: 'CardForge Studio',
    Track: 'Data Review',
    Room: 'Foundry B',
    AccessCode: 'DEMO-02',
  }),
  Object.freeze({
    EventLogo: '/brand/cardforge-studio/brand-mark.svg',
    EventName: 'Card Systems Workshop',
    AttendeeName: 'Avery Patel',
    BadgeType: 'Participant',
    RoleColor: '#7c5aa6',
    Organization: 'CardForge Studio',
    Track: 'Export Proof',
    Room: 'Foundry C',
    AccessCode: 'DEMO-03',
  }),
  Object.freeze({
    EventLogo: '/brand/cardforge-studio/brand-mark.svg',
    EventName: 'Card Systems Workshop',
    AttendeeName: 'Jordan Rivera',
    BadgeType: 'Event Crew',
    RoleColor: '#a85b45',
    Organization: 'CardForge Studio',
    Track: 'Welcome Desk',
    Room: 'Foundry Hall',
    AccessCode: 'DEMO-04',
  }),
]);

export const CARDFORGE_EXAMPLES: readonly CardForgeExample[] = Object.freeze([
  defineExample({
    slug: 'arcane-playing-card-mini-set',
    name: 'Illustrated Arcane Court',
    description: 'A CardForge demonstration where every playing card receives its own artwork and title while the shared frame, corners, and back keep the set together.',
    systemType: 'Playing-card system',
    frontTemplateId: 'default-playing-card-theme',
    backTemplateId: 'default-obsidian-neon-card-back',
    rows: ARCANE_PLAYING_CARD_ROWS,
    sourceFormat: 'CSV rows',
    outputFormats: Object.freeze(['Individual PNG', 'PNG ZIP', 'PDF', 'Tabletop Simulator ZIP']),
    altText: Object.freeze({
      rows: Object.freeze([
        'Illustrated ace of spades titled The Night Sentinel, framed as part of the Arcane Court set.',
        'Illustrated king of hearts titled The Rosebound King, framed as part of the Arcane Court set.',
        'Illustrated queen of diamonds titled The Prism Sovereign, framed as part of the Arcane Court set.',
        'Illustrated jack of clubs titled The Greenwood Tinker, framed as part of the Arcane Court set.',
      ]),
      back: 'The shared Obsidian Neon reverse used by all four playing cards.',
    }),
    caseStudy: Object.freeze({
      summary: 'CardForge keeps the border, corner marks, title treatment, and reverse consistent while every row supplies different artwork and card details.',
      workflow: Object.freeze(['Design the illustrated frame', 'Add artwork and card details', 'Check the finished court']),
    }),
  }),
  defineExample({
    slug: 'arcane-creature-bestiary',
    name: 'Arcane Creature Bestiary',
    description: 'A CardForge demonstration where one creature-card layout becomes four very different creatures with their own art, abilities, and combat stats.',
    systemType: 'Creature-card system',
    frontTemplateId: 'default-mtg-theme',
    rows: ARCANE_CREATURE_ROWS,
    sourceFormat: 'CSV rows',
    outputFormats: Object.freeze(['Individual PNG', 'PNG ZIP', 'PDF', 'Tabletop Simulator ZIP']),
    altText: Object.freeze({
      rows: Object.freeze([
        'Emberclaw Whelp creature card showing a small volcanic dragon perched on a forge anvil.',
        'Mossback Guardian creature card showing an ancient tortoise carrying a mossy forest shrine.',
        'Moonveil Stag creature card showing a silver spectral stag beside an alpine lake.',
        'Stormglass Siren creature card showing a winged sea creature rising above a stormy ocean.',
      ]),
    }),
    caseStudy: Object.freeze({
      summary: 'The template holds the artwork window, name, type, ability area, and combat stats steady while the creature data changes.',
      workflow: Object.freeze(['Choose the creature frame', 'Add the bestiary rows', 'Review the complete set']),
    }),
  }),
  defineExample({
    slug: 'event-badge-workshop-batch',
    name: 'Event Badge Workshop Batch',
    description: 'A practical CardForge demonstration where each person gets a different name, role color, room, and code without rebuilding the event pass.',
    systemType: 'Event badge system',
    frontTemplateId: 'default-event-badge-theme',
    rows: EVENT_BADGE_ROWS,
    sourceFormat: 'CSV rows',
    outputFormats: Object.freeze(['Individual PNG', 'PNG ZIP', 'PDF']),
    altText: Object.freeze({
      rows: Object.freeze([
        'Event Badge front for Morgan Lee, facilitator for the Template Lab in Foundry A.',
        'Event Badge front for Riley Chen, participant in Data Review in Foundry B.',
        'Event Badge front for Avery Patel, participant in Export Proof in Foundry C.',
        'Event Badge front for Jordan Rivera, event crew at the Welcome Desk in Foundry Hall.',
      ]),
    }),
    caseStudy: Object.freeze({
      summary: 'CardForge holds the event identity and layout steady while each attendee receives a clear role color and their own practical details.',
      workflow: Object.freeze(['Choose the badge look', 'Add the attendee list', 'Check the full badge batch']),
    }),
  }),
]);
