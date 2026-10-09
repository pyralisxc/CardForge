export const CARDFORGE_CONTENT_STANDARD_VERSION = '2026-10-08-v1';

export const PIPELINE_CREATION_ORIGINS = [
  'unknown',
  'human',
  'ai-assisted',
  'generated',
  'remixed',
  'licensed',
] as const;

export type PipelineCreationOrigin = typeof PIPELINE_CREATION_ORIGINS[number];

export interface PipelineCreationDisclosure {
  tool?: string;
  generatedAt?: string;
  processSummary?: string;
  referenceSummary?: string;
  humanEditSummary?: string;
}

export interface PipelineContentStandardEvidence {
  sourceNotes: string;
  creationOrigin: PipelineCreationOrigin;
  contentStandardVersion: string | null;
  intendedUseEvidence: string;
  creationDisclosure: PipelineCreationDisclosure;
}

export interface PipelineRoleQualityCriterion {
  id: string;
  label: string;
  description: string;
}

const GENERAL_CRITERIA: readonly PipelineRoleQualityCriterion[] = [
  {
    id: 'rights',
    label: 'Rights and provenance',
    description: 'Source, license, authorship, remix/reference context, and redistribution rights are clear enough for CardForge to publish the exact revision.',
  },
  {
    id: 'intended-size',
    label: 'Intended-use proof',
    description: 'The exact revision has been inspected in the size/context where creators are expected to use it, not only as a large editor preview.',
  },
  {
    id: 'originality',
    label: 'Originality and trade dress',
    description: 'The work does not rely on franchise marks, characters, signature commercial frames, or confusingly similar trade dress.',
  },
  {
    id: 'family-coherence',
    label: 'Family coherence',
    description: 'When the object belongs to a visual family, its role, treatment, naming, and variant relationship are deliberate and consistent.',
  },
];

const ROLE_CRITERIA: Readonly<Record<string, readonly PipelineRoleQualityCriterion[]>> = {
  'template-front': [
    { id: 'template-legibility', label: 'Card-scale legibility', description: 'Title, rules, labels, stats, and contrast remain usable at the intended physical/digital card size.' },
    { id: 'template-data', label: 'Data resilience', description: 'Representative short, long, empty, and dense values do not create obvious collisions or broken hierarchy.' },
    { id: 'template-output', label: 'Output behavior', description: 'Safe area, trim/bleed intent, front/back semantics, and export behavior match the Template’s declared use.' },
  ],
  'template-back': [
    { id: 'back-orientation', label: 'Back-face orientation', description: 'The design remains intentional when used as a repeated reverse and does not imply unsupported duplex/finish behavior.' },
    { id: 'back-edge', label: 'Edge behavior', description: 'Full-bleed or bordered edges are deliberate and visually stable at trim.' },
  ],
  set: [
    { id: 'set-coherence', label: 'Set coherence', description: 'The Set demonstrates a coherent authored system rather than a loose collection of unrelated examples.' },
    { id: 'set-openability', label: 'Usable starter', description: 'The package opens as a real CardForge Set and its referenced Templates/assets remain resolvable.' },
  ],
  picture: [
    { id: 'picture-defects', label: 'Image defects', description: 'No obvious unintended anatomy, text, repetition, symmetry, crop, compression, or generation artifacts remain at intended use size.' },
  ],
  foundation: [
    { id: 'foundation-edge', label: 'Full-area behavior', description: 'The surface supports the claimed crop/bleed use without unintended seams, halos, or empty edges.' },
  ],
  border: [
    { id: 'border-geometry', label: 'Border geometry', description: 'Corners, edges, transparency, and symmetry are clean at intended dimensions.' },
  ],
  frame: [
    { id: 'frame-geometry', label: 'Frame geometry', description: 'The frame creates a usable content region and preserves consistent edge/corner treatment.' },
  ],
  'text-frame': [
    { id: 'text-frame-legibility', label: 'Text-region legibility', description: 'The frame supports real rules/body text without sacrificing contrast or crowding.' },
  ],
  ornament: [
    { id: 'ornament-isolation', label: 'Ornament isolation', description: 'Transparency, crop, edge cleanup, and intended layering are deliberate.' },
  ],
  divider: [
    { id: 'divider-scale', label: 'Divider scale', description: 'Stroke/detail weight survives intended card scale and does not become visual noise.' },
  ],
  texture: [
    { id: 'texture-repeat', label: 'Texture repetition', description: 'Visible seams, accidental repetition, and scale artifacts are absent for the claimed use.' },
  ],
  material: [
    { id: 'material-editability', label: 'Material behavior', description: 'The treatment remains useful under its supported recolor/opacity/blend controls.' },
  ],
  icon: [
    { id: 'icon-readability', label: 'Small-size readability', description: 'The icon remains identifiable at compact card/UI sizes and has clean transparency.' },
  ],
  pip: [
    { id: 'pip-repeat', label: 'Repeated-symbol clarity', description: 'The symbol remains distinct and balanced when repeated in groups or rows.' },
  ],
  symbol: [
    { id: 'symbol-semantics', label: 'Semantic distinction', description: 'The mark communicates a deliberate type/mechanic/state and is not confusingly close to a protected franchise symbol.' },
  ],
  'stat-component': [
    { id: 'stat-legibility', label: 'Stat readability', description: 'Numbers/labels remain readable across expected one-, two-, and three-character values.' },
  ],
  shape: [
    { id: 'shape-editability', label: 'Shape editability', description: 'The shape behaves predictably under intended resize/recolor operations.' },
  ],
  style: [
    { id: 'style-resilience', label: 'Style resilience', description: 'The recipe remains coherent across representative compatible elements rather than one hand-tuned example.' },
  ],
  font: [
    { id: 'font-rights', label: 'Embedding and export rights', description: 'The exact font files have explicit redistribution/embedding evidence and attribution/reserved-name notes where relevant.' },
    { id: 'font-specimen', label: 'Card-scale specimen', description: 'Upper/lowercase, numerals, punctuation, dense rules text, and intended title/stat usage have been reviewed.' },
    { id: 'font-coverage', label: 'Coverage', description: 'Declared scripts/language coverage and shipped weights/axes match the actual files.' },
  ],
};

export const isPipelineCreationOrigin = (value: unknown): value is PipelineCreationOrigin => (
  typeof value === 'string'
  && (PIPELINE_CREATION_ORIGINS as readonly string[]).includes(value)
);

const normalizeText = (value: unknown, maxLength: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
  return normalized || undefined;
};

export const normalizePipelineCreationDisclosure = (
  value: unknown,
): PipelineCreationDisclosure => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const generatedAt = typeof record.generatedAt === 'string'
    && !Number.isNaN(Date.parse(record.generatedAt))
    ? new Date(record.generatedAt).toISOString()
    : undefined;
  return {
    tool: normalizeText(record.tool, 120),
    generatedAt,
    processSummary: normalizeText(record.processSummary, 800),
    referenceSummary: normalizeText(record.referenceSummary, 800),
    humanEditSummary: normalizeText(record.humanEditSummary, 800),
  };
};

export const getPipelineContentStandardCriteria = (
  semanticRole: string,
): readonly PipelineRoleQualityCriterion[] => [
  ...GENERAL_CRITERIA,
  ...(ROLE_CRITERIA[semanticRole] ?? []),
];

export const getPipelineContentStandardEvidenceGaps = ({
  sourceNotes,
  creationOrigin,
  contentStandardVersion,
  intendedUseEvidence,
  creationDisclosure,
}: PipelineContentStandardEvidence): string[] => {
  const gaps: string[] = [];
  if (!sourceNotes.trim()) gaps.push('source/rights notes');
  if (creationOrigin === 'unknown') gaps.push('creation origin');
  if (contentStandardVersion !== CARDFORGE_CONTENT_STANDARD_VERSION) gaps.push('current content-standard version');
  if (!intendedUseEvidence.trim()) gaps.push('intended-use evidence');

  if (creationOrigin === 'ai-assisted' || creationOrigin === 'generated') {
    if (!creationDisclosure.processSummary?.trim()) gaps.push('AI/generation process summary');
    if (!creationDisclosure.humanEditSummary?.trim()) gaps.push('human edit/review summary');
  }
  if (creationOrigin === 'remixed' || creationOrigin === 'licensed') {
    if (!creationDisclosure.referenceSummary?.trim()) gaps.push('source/reference summary');
  }
  return gaps;
};

export const hasCurrentPipelineContentStandardEvidence = (
  evidence: PipelineContentStandardEvidence,
): boolean => getPipelineContentStandardEvidenceGaps(evidence).length === 0;
