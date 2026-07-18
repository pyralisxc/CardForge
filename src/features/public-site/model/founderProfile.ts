export const FOUNDER_PROFILE_ID = 'cameron-locke';
export const FOUNDER_PORTRAIT_BUCKET = 'cardforge-public-media';
export const FOUNDER_PORTRAIT_PATH = 'founder/cameron-locke/portrait.webp';

export interface FounderProfile {
  heroEyebrow: string;
  heroHeadline: string;
  introduction: string;
  roadHeading: string;
  roadBody: string;
  currentHeading: string;
  currentBody: string;
  priorities: string[];
  supportHeading: string;
  supportIntroduction: string;
  supportUseSummary: string;
  portraitStoragePath: string | null;
  portraitAlt: string;
  facebookUrl: string | null;
  instagramUrl: string | null;
  discordUrl: string | null;
  updatedAt: string | null;
}

export type FounderProfileInput = Omit<FounderProfile, 'updatedAt'>;

export const DEFAULT_FOUNDER_PROFILE: FounderProfile = {
  heroEyebrow: 'Hey, welcome in.',
  heroHeadline: 'I’m Cameron.',
  introduction: 'I build and operate CardForge Studio as an Oregon sole proprietor. I use AI-assisted code generation alongside my own ideas, design choices, testing, and stubborn curiosity to turn useful product ideas into real software.',
  roadHeading: 'The road here',
  roadBody: 'My path has not been a straight line. I’ve spent time in Hawaii, traveled, and spent time hitchhiking. Those experiences taught me about resourcefulness, freedom, hospitality, and how far you can get by staying curious and making the most of what is in front of you.',
  currentHeading: 'What I’m building toward',
  currentBody: 'CardForge is the first product in a larger independent journey. I’m building products that help people make things, solve real problems, and create a more stable and generous life along the way.',
  priorities: [
    'Make CardForge easier for someone opening it for the first time.',
    'Keep improving how complete sets are checked and downloaded.',
    'Build a stable independent business around useful, creative products.',
  ],
  supportHeading: 'Help me keep building.',
  supportIntroduction: 'Voluntary support helps pay for food, housing, transportation, development time, and the ordinary business costs behind the work.',
  supportUseSummary: 'Food and daily life; housing and stability; transportation; hosting, software, testing, design resources, and independent development time.',
  portraitStoragePath: null,
  portraitAlt: 'Portrait of Cameron Locke',
  facebookUrl: null,
  instagramUrl: null,
  discordUrl: null,
  updatedAt: null,
};

const fieldLimits: Record<Exclude<keyof FounderProfileInput, 'priorities' | 'portraitStoragePath' | 'facebookUrl' | 'instagramUrl' | 'discordUrl'>, number> = {
  heroEyebrow: 80,
  heroHeadline: 120,
  introduction: 1200,
  roadHeading: 120,
  roadBody: 1200,
  currentHeading: 120,
  currentBody: 1200,
  supportHeading: 120,
  supportIntroduction: 1200,
  supportUseSummary: 1200,
  portraitAlt: 200,
};

const allowedKeys = new Set<keyof FounderProfileInput>([
  ...Object.keys(fieldLimits) as Array<keyof FounderProfileInput>,
  'priorities',
  'portraitStoragePath',
  'facebookUrl',
  'instagramUrl',
  'discordUrl',
]);

const normalizeSocialUrl = (
  value: unknown,
  allowedHosts: readonly string[],
): string | null | undefined => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > 500) return undefined;
  try {
    const parsed = new URL(value.trim());
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== 'https:' || !allowedHosts.some((candidate) => (
      host === candidate || host.endsWith(`.${candidate}`)
    ))) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
};

export type FounderProfileInputResult =
  | { ok: true; value: FounderProfileInput }
  | { ok: false; message: string };

export const normalizeFounderProfileInput = (value: unknown): FounderProfileInputResult => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, message: 'Founder profile details are required.' };
  }

  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowedKeys.has(key as keyof FounderProfileInput))) {
    return { ok: false, message: 'Founder profile contains an unknown field.' };
  }

  const normalizedText: Partial<FounderProfileInput> = {};
  for (const [key, limit] of Object.entries(fieldLimits) as Array<[keyof typeof fieldLimits, number]>) {
    const field = record[key];
    if (typeof field !== 'string' || !field.trim()) {
      return { ok: false, message: `${key} is required.` };
    }
    const trimmed = field.trim();
    if (trimmed.length > limit) {
      return { ok: false, message: `${key} must be ${limit} characters or fewer.` };
    }
    normalizedText[key] = trimmed;
  }

  if (!Array.isArray(record.priorities) || record.priorities.length < 1 || record.priorities.length > 5) {
    return { ok: false, message: 'Choose between one and five founder priorities.' };
  }
  const priorities = record.priorities.map((priority) => (
    typeof priority === 'string' ? priority.trim() : ''
  ));
  if (priorities.some((priority) => !priority || priority.length > 200)) {
    return { ok: false, message: 'Each founder priority must be between 1 and 200 characters.' };
  }

  const portraitStoragePath = record.portraitStoragePath;
  if (portraitStoragePath !== null && portraitStoragePath !== FOUNDER_PORTRAIT_PATH) {
    return { ok: false, message: 'Founder portrait path is invalid.' };
  }

  const facebookUrl = normalizeSocialUrl(record.facebookUrl, ['facebook.com', 'fb.com']);
  const instagramUrl = normalizeSocialUrl(record.instagramUrl, ['instagram.com']);
  const discordUrl = normalizeSocialUrl(record.discordUrl, ['discord.com', 'discord.gg']);
  if (facebookUrl === undefined || instagramUrl === undefined || discordUrl === undefined) {
    return { ok: false, message: 'Social links must use HTTPS and match their selected network.' };
  }

  return {
    ok: true,
    value: {
      ...(normalizedText as Omit<FounderProfileInput, 'priorities' | 'portraitStoragePath' | 'facebookUrl' | 'instagramUrl' | 'discordUrl'>),
      priorities,
      portraitStoragePath: portraitStoragePath as string | null,
      facebookUrl,
      instagramUrl,
      discordUrl,
    },
  };
};
