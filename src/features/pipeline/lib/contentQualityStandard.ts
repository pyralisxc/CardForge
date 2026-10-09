import type { PipelineSemanticRole } from './contentTaxonomy';

/**
 * One versioned first-party/Contributor quality bar. The controlled semantic
 * role vocabulary stays in contentTaxonomy; this module governs editorial proof.
 */
export const CONTENT_QUALITY_STANDARD_VERSION = 'CF-CQS-1';
export const CONTENT_QUALITY_REVIEW_NOTE_LIMIT = 600;

export const CONTENT_QUALITY_UNIVERSAL = [
  'Use the truthful semantic role, intended audience and minimum real-world viewing or card size.',
  'Inspect the actual output at intended size for legibility, rendering, edges, transparency, scaling and export defects.',
  'Review originality, licensing, non-infringing branding/trade dress, source attribution and publication rights.',
  'Supply accurate preview evidence, meaning, format, family and compatibility; technical health and votes are not editorial approval.',
] as const;
export const CONTENT_QUALITY_AI = [
  'Disclose AI assistance. When known, state tool/model, generation date, non-sensitive references/process and meaningful human edits.',
  'Do not claim knowledge of training-data provenance without evidence or disclose private user material and raw sensitive prompts.',
  'Reject imitation of protected franchises, logos, signature card frames, confusingly similar trade dress or prompts imitating living artists for first-party work.',
  'Human-review text, anatomy, repetition, symmetry, edges and tiling at intended card size, with the same quality threshold regardless of origin.',
] as const;
export const CONTENT_QUALITY_FINISH = [
  'A simulated digital foil effect is not a manufacturable foil separation.',
  'Physical foil, emboss or spot finish claims require a separate validated mask, explicit metadata and printer-specific proof.',
] as const;

export interface ContentQualityRoleRule {
  pass: string;
  revise: string;
  reject: string;
  proof: string;
}

export const CONTENT_QUALITY_BY_ROLE = {
  'template-front': {
    pass: 'Editable fields, visual hierarchy and readable front-face text at intended card dimensions.',
    revise: 'Improve contrast, padding, field layout or realistic long-text behavior.',
    reject: 'Clipped required fields or confusingly similar proprietary card trade dress.',
    proof: 'Populated front render with longest rules/name/stat cases at actual size.',
  },
  'template-back': {
    pass: 'Orientation-safe back, aligned geometry and a coherent recognizable visual family.',
    revise: 'Fix centering, bleed, edge continuity or format-family inconsistencies.',
    reject: 'Incorrect orientation, critical trim-edge detail or borrowed branded back.',
    proof: 'Real-size back beside its front and every claimed format variant.',
  },
  set: {
    pass: 'Complete playable or useful card Set with portable references and coherent visuals.',
    revise: 'Repair incomplete cards, rules coverage, inconsistency or missing dependencies.',
    reject: 'Missing cards, nonportable Set, borrowed IP or unrecoverable embedded sources.',
    proof: 'Complete Set opening/export plus contact sheet of representative and edge-case cards.',
  },
  picture: {
    pass: 'Original useful illustration/photo with sufficient resolution at placed size.',
    revise: 'Correct crop, low resolution, generated artifacts or awkward framing.',
    reject: 'Unlicensed imagery, confusing franchise likeness or unusable defects.',
    proof: 'Source preview and actual-sized card crop.',
  },
  foundation: {
    pass: 'Full-area surface with adequate content contrast and truthful trim/bleed intent.',
    revise: 'Adjust composition, contrast or confusing frame/texture classification.',
    reject: 'Text-obstructing background or a framed asset falsely sold as a texture.',
    proof: 'Blank surface and populated card including safe/bleed areas.',
  },
  border: {
    pass: 'Clean transparent edge overlay preserving readable center content.',
    revise: 'Repair alpha halos, sizing, inconsistent edges or trim fit.',
    reject: 'Opaque full-area fill masquerading as a transparent border.',
    proof: 'Overlay on dark/light real-size cards with visible alpha edges.',
  },
  frame: {
    pass: 'Structural content regions align with text/images and supported formats.',
    revise: 'Improve region spacing, scaling or contour transparency.',
    reject: 'Content cannot fit inside the advertised structure.',
    proof: 'Populated frame with short and long content samples.',
  },
  'text-frame': {
    pass: 'Readable long and short text with safe padding, contrast and wrapping.',
    revise: 'Fix line-height, crop, contrast or resizing behavior.',
    reject: 'Required text is illegible or clipped at advertised size.',
    proof: 'Dense rules text at minimum advertised card size.',
  },
  ornament: {
    pass: 'Reusable decorative accent with correct alpha and family styling.',
    revise: 'Clean edges, scaling or corner placement.',
    reject: 'Nonfunctional ornament falsely classified as a mechanic icon or copied branding.',
    proof: 'Transparent isolated ornament and in-context real-size placement.',
  },
  divider: {
    pass: 'Functional region separator that stays clear at card scale.',
    revise: 'Tune width, line weight, repeat or categorization.',
    reject: 'A full title/text panel passed off as a divider.',
    proof: 'Rules/card layout showing the intended dividing role.',
  },
  texture: {
    pass: 'Scale-stable material surface with seamless repetition when tileable is claimed.',
    revise: 'Repair tile seams, excessive pattern contrast or compression artifacts.',
    reject: 'Conspicuous seams or a single framed image mislabeled as tiling texture.',
    proof: '2-by-2 repeat plus minimum/maximum scale specimens.',
  },
  material: {
    pass: 'Reusable material recipe that maintains meaningful contrast on diverse objects.',
    revise: 'Tune highlights, grain, opacity or light/dark response.',
    reject: 'Uneditable flattened art disguised as a reusable material.',
    proof: 'Same recipe on two distinct shapes and contrast backgrounds.',
  },
  icon: {
    pass: 'Distinct general-purpose pictogram at minimum advertised size.',
    revise: 'Simplify silhouette, strokes or alpha edge treatment.',
    reject: 'Unrecognizable symbol, trademarked logo or mislabeled ornament.',
    proof: 'Small/medium icon examples on dark/light card backgrounds.',
  },
  pip: {
    pass: 'Fast-countable family of resource/suit/value marks at repeated small scale.',
    revise: 'Improve member differentiation, alignment or numeric context.',
    reject: 'Indistinguishable sibling symbols at the claimed minimum size.',
    proof: 'Full family and repeated-pip card specimen.',
  },
  symbol: {
    pass: 'Mechanic/type/state meaning is distinct and coherent across one symbol family.',
    revise: 'Improve accessibility, ambiguity, glyph weight or small-size behavior.',
    reject: 'Copied protected game iconography or contradictory same-family meanings.',
    proof: 'Labeled full family plus realistic mechanic/type specimen.',
  },
  'stat-component': {
    pass: 'Value container supports readable min/max numerals on compact cards.',
    revise: 'Fix numeral contrast, spacing or alignment.',
    reject: 'Stat cannot be represented without clipping or misreading.',
    proof: 'Single and multiple digit examples at minimum size.',
  },
  shape: {
    pass: 'Reusable primitive scales and recolors predictably with safe source geometry.',
    revise: 'Correct stroke alignment, clipping or proportion changes.',
    reject: 'Malformed vector or noneditable raster falsely described as a shape.',
    proof: 'Light/dark and large/small recolored specimens.',
  },
  style: {
    pass: 'Reusable appearance recipe applied consistently without duplicating identity.',
    revise: 'Improve hierarchy, contrast or use across components.',
    reject: 'Destructive treatment or new parallel style/content authority.',
    proof: 'Styled and unstyled comparison on two different components.',
  },
  font: {
    pass: 'Verified license, embedding/export rights and readable intended text roles.',
    revise: 'Improve glyph coverage, weight mapping, pairing or dense-text legibility.',
    reject: 'Unlicensed redistribution, invalid embedding or illegible required glyphs.',
    proof: 'Upper/lower/numeral/punctuation/rules samples and license source.',
  },
} satisfies Record<PipelineSemanticRole, ContentQualityRoleRule>;

export type PipelineAiAssistance = 'none' | 'used';
export type ContentEvidenceResult = { ok: true; value: string } | { ok: false; message: string };

export const buildPipelineSourceEvidence = ({
  rightsAndSources, aiAssistance, aiProcess,
}: { rightsAndSources: string; aiAssistance: PipelineAiAssistance; aiProcess: string }): ContentEvidenceResult => {
  const rights = rightsAndSources.trim().replace(/\s+/g, ' ');
  const process = aiProcess.trim().replace(/\s+/g, ' ');
  if (!rights) return { ok: false, message: 'Describe the creator, source, license and publication rights before submitting.' };
  if (aiAssistance === 'used' && !process) {
    return { ok: false, message: 'Describe the non-sensitive AI tools, process, references and human edits.' };
  }
  const value = [
    `Rights and sources: ${rights}`,
    `AI assistance: ${aiAssistance === 'used' ? 'Used' : 'None'}`,
    ...(aiAssistance === 'used' ? [`Process: ${process}`] : []),
  ].join(' | ');
  if (value.length > 600) return { ok: false, message: 'Shorten the evidence to 600 characters without losing source/AI details.' };
  return { ok: true, value };
};

const reviewPrefix = /^\[(CF-CQS-\d+)\]\s*/u;
export const parseContentQualityReviewNote = (value: string | null | undefined): { version: string | null; reason: string } => {
  const note = (value ?? '').trim();
  const match = reviewPrefix.exec(note);
  return { version: match?.[1] ?? null, reason: match ? note.slice(match[0].length) : note };
};

export const stampContentQualityReviewNote = (value: string): ContentEvidenceResult => {
  const reason = parseContentQualityReviewNote(value).reason.trim().replace(/\s+/g, ' ');
  if (!reason) return { ok: false, message: 'Add a substantive editorial reason.' };
  const note = `[${CONTENT_QUALITY_STANDARD_VERSION}] ${reason}`;
  if (note.length > CONTENT_QUALITY_REVIEW_NOTE_LIMIT) {
    return { ok: false, message: 'Shorten the reason to preserve its full text and quality-standard version.' };
  }
  return { ok: true, value: note };
};
