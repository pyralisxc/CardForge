export type SiteContentGroup = 'shell' | 'landing' | 'about' | 'founder' | 'developer' | 'roadmap' | 'sharing';
export type SiteContentKind = 'short' | 'long';

type SiteContentDefinition = {
  slug: string;
  group: SiteContentGroup;
  section: string;
  label: string;
  body: string;
  kind: SiteContentKind;
  maxLength: number;
};

export const SITE_CONTENT_DEFINITIONS = [
  { slug: 'shell.mobile.description', group: 'shell', section: 'Mobile menu', label: 'Menu introduction', body: 'Explore CardForge Studio and its public resources.', kind: 'short', maxLength: 180 },
  { slug: 'shell.mobile.developer.heading', group: 'shell', section: 'Mobile menu', label: 'Founder link heading', body: 'Meet the developer', kind: 'short', maxLength: 80 },
  { slug: 'shell.mobile.developer.body', group: 'shell', section: 'Mobile menu', label: 'Founder link description', body: 'Meet Cameron Locke, the independent developer building CardForge Studio.', kind: 'long', maxLength: 300 },
  { slug: 'shell.footer.independent', group: 'shell', section: 'Footer', label: 'Copyright closing line', body: 'CardForge Studio is an independent product built with care.', kind: 'short', maxLength: 180 },

  { slug: 'landing.hero.headline', group: 'landing', section: 'Hero', label: 'Headline', body: 'Design one card. Add your list. CardForge builds the set.', kind: 'short', maxLength: 160 },
  { slug: 'landing.hero.body', group: 'landing', section: 'Hero', label: 'Introduction', body: 'Make the look once, add the words and pictures for each card, and watch the whole set come together. Try it in your browser and keep your work on your device.', kind: 'long', maxLength: 500 },
  { slug: 'landing.hero.support', group: 'landing', section: 'Hero', label: 'Eyebrow', body: 'Build the card once. Let the set follow.', kind: 'short', maxLength: 120 },
  { slug: 'landing.hero.secondary-action', group: 'landing', section: 'Hero', label: 'Secondary action', body: 'See what it makes', kind: 'short', maxLength: 80 },
  { slug: 'landing.showcase.eyebrow', group: 'landing', section: 'Studio showcase', label: 'Eyebrow', body: 'Look inside CardForge', kind: 'short', maxLength: 100 },
  { slug: 'landing.showcase.headline', group: 'landing', section: 'Studio showcase', label: 'Headline', body: 'Design the look, build the set, and see every finished card.', kind: 'short', maxLength: 180 },
  { slug: 'landing.showcase.body', group: 'landing', section: 'Studio showcase', label: 'Introduction', body: "This walkthrough uses CardForge's real templates, sample rows, and card renderer. Choose any step or set inside the Studio frame.", kind: 'long', maxLength: 500 },
  { slug: 'landing.workflow.eyebrow', group: 'landing', section: 'Workflow', label: 'Eyebrow', body: 'How it works', kind: 'short', maxLength: 100 },
  { slug: 'landing.workflow.headline', group: 'landing', section: 'Workflow', label: 'Headline', body: 'From one good-looking card to the whole set.', kind: 'short', maxLength: 180 },
  { slug: 'landing.workflow.step1.title', group: 'landing', section: 'Workflow steps', label: 'Step 1 title', body: 'Make the look once', kind: 'short', maxLength: 100 },
  { slug: 'landing.workflow.step1.body', group: 'landing', section: 'Workflow steps', label: 'Step 1 description', body: 'Set up the front, back, words, and pictures for the kind of card you want.', kind: 'long', maxLength: 300 },
  { slug: 'landing.workflow.step2.title', group: 'landing', section: 'Workflow steps', label: 'Step 2 title', body: 'Add your card list', kind: 'short', maxLength: 100 },
  { slug: 'landing.workflow.step2.body', group: 'landing', section: 'Workflow steps', label: 'Step 2 description', body: 'Type the details or bring in a list you already have. Each line becomes a card.', kind: 'long', maxLength: 300 },
  { slug: 'landing.workflow.step3.title', group: 'landing', section: 'Workflow steps', label: 'Step 3 title', body: 'Build the whole set', kind: 'short', maxLength: 100 },
  { slug: 'landing.workflow.step3.body', group: 'landing', section: 'Workflow steps', label: 'Step 3 description', body: 'CardForge places every title, picture, and detail into the same design.', kind: 'long', maxLength: 300 },
  { slug: 'landing.workflow.step4.title', group: 'landing', section: 'Workflow steps', label: 'Step 4 title', body: 'Check and download', kind: 'short', maxLength: 100 },
  { slug: 'landing.workflow.step4.body', group: 'landing', section: 'Workflow steps', label: 'Step 4 description', body: 'Look through every card, fix anything odd, and save the finished files.', kind: 'long', maxLength: 300 },
  { slug: 'landing.access.eyebrow', group: 'landing', section: 'Access', label: 'Eyebrow', body: 'Choose your next step', kind: 'short', maxLength: 100 },
  { slug: 'landing.access.headline', group: 'landing', section: 'Access', label: 'Headline', body: 'Start free. Upgrade when you need watermark-free downloads.', kind: 'short', maxLength: 180 },
  { slug: 'landing.access.developer-note', group: 'landing', section: 'Access', label: 'Developer note', body: 'Developers can help improve shared CardForge tools and artwork through the Developer Program.', kind: 'long', maxLength: 300 },
  { slug: 'landing.founder.eyebrow', group: 'landing', section: 'Founder introduction', label: 'Eyebrow', body: 'A real person is building this', kind: 'short', maxLength: 100 },
  { slug: 'landing.founder.headline', group: 'landing', section: 'Founder introduction', label: 'Headline', body: 'Built independently by Cameron Locke', kind: 'short', maxLength: 160 },
  { slug: 'landing.founder.body', group: 'landing', section: 'Founder introduction', label: 'Introduction', body: "I'm building CardForge in Oregon with a lot of curiosity, modern tools, and the belief that making a whole deck should feel just as creative as making the first card.", kind: 'long', maxLength: 500 },
  { slug: 'landing.founder.action', group: 'landing', section: 'Founder introduction', label: 'Link text', body: 'Come say hello', kind: 'short', maxLength: 80 },
  { slug: 'landing.final.headline', group: 'landing', section: 'Final action', label: 'Headline', body: 'Build your first set.', kind: 'short', maxLength: 140 },
  { slug: 'landing.final.body', group: 'landing', section: 'Final action', label: 'Introduction', body: 'Open the Studio, choose a starting point, and make something that feels like yours.', kind: 'long', maxLength: 350 },

  { slug: 'about.hero.eyebrow', group: 'about', section: 'Hero', label: 'Eyebrow', body: 'About CardForge Studio', kind: 'short', maxLength: 100 },
  { slug: 'about.meta.title', group: 'about', section: 'Search & sharing', label: 'Page title', body: 'About CardForge', kind: 'short', maxLength: 100 },
  { slug: 'about.meta.description', group: 'about', section: 'Search & sharing', label: 'Page description', body: 'See how CardForge Studio helps creators build customized card sets and how contributors support its shared library, marketing, and public-site improvements.', kind: 'long', maxLength: 200 },
  { slug: 'about.hero.headline', group: 'about', section: 'Hero', label: 'Headline', body: 'Give everyday creators room to make it their own.', kind: 'short', maxLength: 180 },
  { slug: 'about.hero.body', group: 'about', section: 'Hero', label: 'Introduction', body: 'CardForge Studio turns a reusable design and structured content into a consistent set without taking the creative decisions away from you. It is built for people who want deep customization without rebuilding every item by hand.', kind: 'long', maxLength: 600 },
  { slug: 'about.hero.secondary-action', group: 'about', section: 'Hero', label: 'Founder action', body: 'Meet the developer', kind: 'short', maxLength: 80 },
  { slug: 'about.principles.headline', group: 'about', section: 'Principles', label: 'Headline', body: 'Customization without repetitive work', kind: 'short', maxLength: 180 },
  { slug: 'about.principles.body', group: 'about', section: 'Principles', label: 'Introduction', body: 'The goal is a practical middle ground: enough structure to keep a large set coherent, and enough control for the finished work to belong unmistakably to its creator.', kind: 'long', maxLength: 500 },
  { slug: 'about.principle1.title', group: 'about', section: 'Principle cards', label: 'Principle 1 title', body: 'Design the system once', kind: 'short', maxLength: 100 },
  { slug: 'about.principle1.body', group: 'about', section: 'Principle cards', label: 'Principle 1 description', body: 'Build a reusable layout, then carry the visual rules across every item in the set.', kind: 'long', maxLength: 300 },
  { slug: 'about.principle2.title', group: 'about', section: 'Principle cards', label: 'Principle 2 title', body: 'Your work stays with you', kind: 'short', maxLength: 100 },
  { slug: 'about.principle2.body', group: 'about', section: 'Principle cards', label: 'Principle 2 description', body: 'Your projects and artwork stay in your browser or downloaded files unless you choose to share them.', kind: 'long', maxLength: 300 },
  { slug: 'about.principle3.title', group: 'about', section: 'Principle cards', label: 'Principle 3 title', body: 'Tune every detail', kind: 'short', maxLength: 100 },
  { slug: 'about.principle3.body', group: 'about', section: 'Principle cards', label: 'Principle 3 description', body: 'Mix shared structure with card-specific text, art, colors, and positioning so the result still feels personal.', kind: 'long', maxLength: 300 },
  { slug: 'about.principle4.title', group: 'about', section: 'Principle cards', label: 'Principle 4 title', body: 'Review the whole run', kind: 'short', maxLength: 100 },
  { slug: 'about.principle4.body', group: 'about', section: 'Principle cards', label: 'Principle 4 description', body: 'Inspect the complete set together, catch inconsistencies, then export images, a PDF, or a ZIP when it is ready.', kind: 'long', maxLength: 300 },
  { slug: 'about.direction.headline', group: 'about', section: 'Direction', label: 'Headline', body: 'Cards are the starting point', kind: 'short', maxLength: 180 },
  { slug: 'about.direction.body', group: 'about', section: 'Direction', label: 'Introduction', body: 'Card sets are the product today. The wider ambition is a creation system that can serve many kinds of repeatable, printable design work while keeping the same data-driven workflow.', kind: 'long', maxLength: 500 },
  { slug: 'about.direction.current.label', group: 'about', section: 'Direction cards', label: 'Current label', body: 'Available now', kind: 'short', maxLength: 80 },
  { slug: 'about.direction.current.title', group: 'about', section: 'Direction cards', label: 'Current title', body: 'Complete custom card sets', kind: 'short', maxLength: 120 },
  { slug: 'about.direction.current.body', group: 'about', section: 'Direction cards', label: 'Current description', body: 'Reusable card layouts, structured data, whole-set review, browser-based project control, and downloadable production files.', kind: 'long', maxLength: 400 },
  { slug: 'about.direction.future.label', group: 'about', section: 'Direction cards', label: 'Future label', body: 'Long-term direction', kind: 'short', maxLength: 80 },
  { slug: 'about.direction.future.title', group: 'about', section: 'Direction cards', label: 'Future title', body: 'More kinds of printable creation', kind: 'short', maxLength: 120 },
  { slug: 'about.direction.future.body', group: 'about', section: 'Direction cards', label: 'Future description', body: 'Our future printable formats may include game aids, reference sheets, labels, badges, tokens, and other reusable layouts. These formats are a direction, not currently available features.', kind: 'long', maxLength: 500 },
  { slug: 'about.contributors.headline', group: 'about', section: 'Contributors', label: 'Headline', body: 'Growing with creators and developers', kind: 'short', maxLength: 180 },
  { slug: 'about.contributors.body', group: 'about', section: 'Contributors', label: 'Introduction', body: 'Public roadmap voting helps creators influence priorities. Qualified contributors can submit shared assets, marketing drafts, and site-copy proposals.', kind: 'long', maxLength: 500 },
  { slug: 'about.contributors.ownership', group: 'about', section: 'Contributors', label: 'Ownership note', body: 'All public changes remain owner-approved. Contributions follow the current Developer Terms and do not create guaranteed payment, ownership of CardForge, or revenue-sharing rights.', kind: 'long', maxLength: 500 },
  { slug: 'about.contributors.developer-action', group: 'about', section: 'Contributor actions', label: 'Developer program action', body: 'Developer program', kind: 'short', maxLength: 80 },
  { slug: 'about.contributors.roadmap-action', group: 'about', section: 'Contributor actions', label: 'Roadmap action', body: 'Public roadmap', kind: 'short', maxLength: 80 },
  { slug: 'about.contributors.founder-action', group: 'about', section: 'Contributor actions', label: 'Founder action', body: 'About Cameron', kind: 'short', maxLength: 80 },
  { slug: 'about.beta.headline', group: 'about', section: 'Public beta', label: 'Headline', body: 'An honest public beta', kind: 'short', maxLength: 160 },
  { slug: 'about.beta.body', group: 'about', section: 'Public beta', label: 'Introduction', body: 'CardForge Studio is independently built and actively improving. The public roadmap separates what works now from what is still planned.', kind: 'long', maxLength: 400 },
  { slug: 'about.beta.showcase-action', group: 'about', section: 'Public beta', label: 'Showcase action', body: 'See CardForge in action', kind: 'short', maxLength: 80 },
  { slug: 'about.beta.roadmap-action', group: 'about', section: 'Public beta', label: 'Roadmap action', body: 'View roadmap', kind: 'short', maxLength: 80 },

  { slug: 'founder.meta.title', group: 'founder', section: 'Search & sharing', label: 'Page title', body: 'Cameron Locke — Founder of CardForge Studio', kind: 'short', maxLength: 120 },
  { slug: 'founder.meta.description', group: 'founder', section: 'Search & sharing', label: 'Page description', body: 'Meet Cameron Locke, the Oregon sole proprietor building CardForge Studio, and support his independent work.', kind: 'long', maxLength: 200 },
  { slug: 'founder.hero.road-action', group: 'founder', section: 'Page actions', label: 'Roadmap action', body: "See what I'm building", kind: 'short', maxLength: 80 },
  { slug: 'founder.hero.contact-action', group: 'founder', section: 'Page actions', label: 'Contact action', body: 'Contact me', kind: 'short', maxLength: 80 },
  { slug: 'founder.hero.support-action', group: 'founder', section: 'Page actions', label: 'Support action', body: 'Support the work', kind: 'short', maxLength: 80 },
  { slug: 'founder.current.priorities-heading', group: 'founder', section: 'Current work', label: 'Priorities heading', body: "What I'm focused on now", kind: 'short', maxLength: 120 },
  { slug: 'founder.support.eyebrow', group: 'founder', section: 'Support', label: 'Eyebrow', body: 'Support the journey', kind: 'short', maxLength: 100 },
  { slug: 'founder.creator-pass.heading', group: 'founder', section: 'Creator Pass', label: 'Heading', body: 'Want CardForge too?', kind: 'short', maxLength: 120 },
  { slug: 'founder.creator-pass.body', group: 'founder', section: 'Creator Pass', label: 'Description', body: 'Creator Pass is the best way to support CardForge as a business. It is a product subscription that includes CardForge access and gives the business dependable support to keep growing.', kind: 'long', maxLength: 500 },
  { slug: 'founder.creator-pass.action', group: 'founder', section: 'Creator Pass', label: 'Action', body: 'See Creator Pass', kind: 'short', maxLength: 80 },
  { slug: 'founder.support-uses.heading', group: 'founder', section: 'Support uses', label: 'Heading', body: 'What personal support can help with', kind: 'short', maxLength: 160 },
  { slug: 'founder.support-uses.body', group: 'founder', section: 'Support uses', label: 'Introduction', body: 'In plain terms: food, housing, transportation, development time, and the business expenses behind the work.', kind: 'long', maxLength: 400 },
  { slug: 'founder.support-use1.title', group: 'founder', section: 'Support use cards', label: 'Use 1 title', body: 'Food and daily life', kind: 'short', maxLength: 100 },
  { slug: 'founder.support-use1.body', group: 'founder', section: 'Support use cards', label: 'Use 1 description', body: 'The ordinary things that make it possible to sit down and keep building.', kind: 'long', maxLength: 300 },
  { slug: 'founder.support-use2.title', group: 'founder', section: 'Support use cards', label: 'Use 2 title', body: 'Housing and stability', kind: 'short', maxLength: 100 },
  { slug: 'founder.support-use2.body', group: 'founder', section: 'Support use cards', label: 'Use 2 description', body: 'A steady place to live, work, rest, and keep moving forward.', kind: 'long', maxLength: 300 },
  { slug: 'founder.support-use3.title', group: 'founder', section: 'Support use cards', label: 'Use 3 title', body: 'Transportation', kind: 'short', maxLength: 100 },
  { slug: 'founder.support-use3.body', group: 'founder', section: 'Support use cards', label: 'Use 3 description', body: 'Getting where I need to go while I build a more stable independent life.', kind: 'long', maxLength: 300 },
  { slug: 'founder.support-use4.title', group: 'founder', section: 'Support use cards', label: 'Use 4 title', body: 'Business expenses', kind: 'short', maxLength: 100 },
  { slug: 'founder.support-use4.body', group: 'founder', section: 'Support use cards', label: 'Use 4 description', body: 'Hosting, software, testing, design resources, and the services that keep CardForge running.', kind: 'long', maxLength: 300 },

  { slug: 'developer.meta.title', group: 'developer', section: 'Search & sharing', label: 'Page title', body: 'CardForge Developer Program', kind: 'short', maxLength: 100 },
  { slug: 'developer.meta.description', group: 'developer', section: 'Search & sharing', label: 'Page description', body: 'Learn how approved CardForge contributors submit shared assets, prepare campaign drafts, and propose public-site improvements.', kind: 'long', maxLength: 200 },
  { slug: 'developer.hero.eyebrow', group: 'developer', section: 'Hero', label: 'Eyebrow', body: 'Developer Program', kind: 'short', maxLength: 100 },
  { slug: 'developer.hero.headline', group: 'developer', section: 'Hero', label: 'Headline', body: 'Help improve CardForge with reviewable contributions.', kind: 'short', maxLength: 180 },
  { slug: 'developer.hero.body', group: 'developer', section: 'Hero', label: 'Introduction', body: 'Approved contributors add shared assets, prepare marketing drafts, and propose clearer public-site text from one secure workspace. Every contribution keeps its source and review history, and the owner approves all public changes.', kind: 'long', maxLength: 600 },
  { slug: 'developer.lane.assets.title', group: 'developer', section: 'Contribution lanes', label: 'Assets title', body: 'Shared library assets', kind: 'short', maxLength: 100 },
  { slug: 'developer.lane.assets.body', group: 'developer', section: 'Contribution lanes', label: 'Assets description', body: 'Submit templates, overlays, icons, textures, fonts, and reusable design presets for owner review.', kind: 'long', maxLength: 350 },
  { slug: 'developer.lane.campaigns.title', group: 'developer', section: 'Contribution lanes', label: 'Campaigns title', body: 'Campaign packages', kind: 'short', maxLength: 100 },
  { slug: 'developer.lane.campaigns.body', group: 'developer', section: 'Contribution lanes', label: 'Campaigns description', body: 'Combine post copy, media, rights details, and release context into reusable marketing drafts.', kind: 'long', maxLength: 350 },
  { slug: 'developer.lane.site.title', group: 'developer', section: 'Contribution lanes', label: 'Site improvements title', body: 'Site improvements', kind: 'short', maxLength: 100 },
  { slug: 'developer.lane.site.body', group: 'developer', section: 'Contribution lanes', label: 'Site improvements description', body: 'Propose clearer public-site copy against the current live text, with rationale and owner review.', kind: 'long', maxLength: 350 },
  { slug: 'developer.rules.heading', group: 'developer', section: 'Contribution rules', label: 'Heading', body: 'Contribution rules', kind: 'short', maxLength: 120 },

  { slug: 'roadmap.meta.title', group: 'roadmap', section: 'Search & sharing', label: 'Page title', body: 'CardForge Roadmap', kind: 'short', maxLength: 100 },
  { slug: 'roadmap.meta.description', group: 'roadmap', section: 'Search & sharing', label: 'Page description', body: 'Vote on CardForge feature priorities and follow planned service upgrades for the shared card-system studio.', kind: 'long', maxLength: 200 },
  { slug: 'roadmap.hero.eyebrow', group: 'roadmap', section: 'Hero', label: 'Eyebrow', body: 'Product roadmap', kind: 'short', maxLength: 100 },
  { slug: 'roadmap.hero.headline', group: 'roadmap', section: 'Hero', label: 'Headline', body: 'Vote for the CardForge tools you want next.', kind: 'short', maxLength: 180 },
  { slug: 'roadmap.hero.body', group: 'roadmap', section: 'Hero', label: 'Introduction', body: 'Add compact ideas, vote on what matters, and follow the next milestones without digging through your account page. Suggestions and votes are shared public beta signals, not private project notes.', kind: 'long', maxLength: 500 },

  { slug: 'sharing.message', group: 'sharing', section: 'Social sharing', label: 'Default share message', body: 'Check out CardForge Studio—a friendly way to design one card and build the whole set.', kind: 'long', maxLength: 500 },
] as const satisfies readonly SiteContentDefinition[];

export type SiteContentBlockSlug = typeof SITE_CONTENT_DEFINITIONS[number]['slug'];

export interface SiteContentBlock {
  slug: SiteContentBlockSlug;
  group: SiteContentGroup;
  section: string;
  label: string;
  body: string;
  kind: SiteContentKind;
  maxLength: number;
  updatedAt: string | null;
}

export const DEFAULT_SITE_CONTENT_BLOCKS: SiteContentBlock[] = SITE_CONTENT_DEFINITIONS.map((definition) => ({
  ...definition,
  updatedAt: null,
}));

const siteContentSlugs = new Set<SiteContentBlockSlug>(
  DEFAULT_SITE_CONTENT_BLOCKS.map((block) => block.slug),
);

export type SiteContentBlockInputResult =
  | { ok: true; value: { slug: SiteContentBlockSlug; body: string } }
  | { ok: false; message: string };

export const normalizeSiteContentBlockInput = (value: {
  slug?: unknown;
  body?: unknown;
}): SiteContentBlockInputResult => {
  const slug = typeof value.slug === 'string' ? value.slug : '';
  if (!siteContentSlugs.has(slug as SiteContentBlockSlug)) {
    return { ok: false, message: 'Unknown site copy block.' };
  }

  const definition = getDefaultSiteContentBlock(slug as SiteContentBlockSlug);
  const body = typeof value.body === 'string' ? value.body.trim() : '';
  if (!body) return { ok: false, message: 'Site copy is required.' };
  if (body.length > definition.maxLength) {
    return { ok: false, message: `Site copy must be ${definition.maxLength} characters or fewer.` };
  }

  return { ok: true, value: { slug: slug as SiteContentBlockSlug, body } };
};

export const getDefaultSiteContentBlock = (slug: SiteContentBlockSlug): SiteContentBlock =>
  DEFAULT_SITE_CONTENT_BLOCKS.find((block) => block.slug === slug) ?? DEFAULT_SITE_CONTENT_BLOCKS[0];

export type SiteContentMap = Record<SiteContentBlockSlug, string>;

export const createSiteContentMap = (
  blocks: SiteContentBlock[],
): SiteContentMap => Object.fromEntries(
  DEFAULT_SITE_CONTENT_BLOCKS.map((defaultBlock) => {
    const block = blocks.find((candidate) => candidate.slug === defaultBlock.slug);
    return [defaultBlock.slug, block?.body || defaultBlock.body];
  }),
) as SiteContentMap;
