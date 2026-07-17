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
  Object.freeze({ Rank: 'A', Suit: '♠', CenterMark: '♠' }),
  Object.freeze({ Rank: 'K', Suit: '♥', CenterMark: '♥' }),
  Object.freeze({ Rank: 'Q', Suit: '♦', CenterMark: '♦' }),
  Object.freeze({ Rank: 'J', Suit: '♣', CenterMark: '♣' }),
]);

const EVENT_BADGE_ROWS = Object.freeze([
  Object.freeze({
    EventLogo: '/brand/cardforge-studio/brand-mark.svg',
    EventName: 'Card Systems Workshop',
    AttendeeName: 'Morgan Lee',
    BadgeType: 'Facilitator',
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
    Organization: 'CardForge Studio',
    Track: 'Export Proof',
    Room: 'Foundry C',
    AccessCode: 'DEMO-03',
  }),
]);

export const CARDFORGE_EXAMPLES: readonly CardForgeExample[] = Object.freeze([
  defineExample({
    slug: 'arcane-playing-card-mini-set',
    name: 'Arcane Playing Card Mini Set',
    description: 'A small CardForge demonstration where the rank and suit change while one shared design and card back keep the set together.',
    systemType: 'Playing-card system',
    frontTemplateId: 'default-playing-card-theme',
    backTemplateId: 'default-obsidian-neon-card-back',
    rows: ARCANE_PLAYING_CARD_ROWS,
    sourceFormat: 'CSV rows',
    outputFormats: Object.freeze(['Individual PNG', 'PNG ZIP', 'PDF', 'Tabletop Simulator ZIP']),
    altText: Object.freeze({
      rows: Object.freeze([
        'Arcane Playing Card front showing the ace of spades.',
        'Arcane Playing Card front showing the king of hearts.',
        'Arcane Playing Card front showing the queen of diamonds.',
        'Arcane Playing Card front showing the jack of clubs.',
      ]),
      back: 'The shared Obsidian Neon reverse used by all four playing cards.',
    }),
    caseStudy: Object.freeze({
      summary: 'CardForge keeps the border, type, spacing, and reverse consistent while it places each rank and suit into the design.',
      workflow: Object.freeze(['Choose the shared look', 'Add the card list', 'Check the finished mini set']),
    }),
  }),
  defineExample({
    slug: 'event-badge-workshop-batch',
    name: 'Event Badge Workshop Batch',
    description: 'A practical CardForge demonstration where each person gets a different name, role, room, and code without rebuilding the badge.',
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
      ]),
    }),
    caseStudy: Object.freeze({
      summary: 'CardForge holds the badge layout steady and fills in the changing details for each person.',
      workflow: Object.freeze(['Choose the badge look', 'Add the attendee list', 'Check the full badge batch']),
    }),
  }),
]);
