export const STUDIO_ASSET_DESTINATIONS = [
  'template.front',
  'template.back',
  'image.picture',
  'image.frame.front',
  'image.frame.back',
  'element.icon',
  'element.divider',
  'appearance.texture',
  'style.material',
  'style.border',
  'style.textFrame',
  'style.shape',
  'style.divider',
  'style.icon',
  'typography.font',
] as const;

export type StudioAssetDestination = typeof STUDIO_ASSET_DESTINATIONS[number];
export type StudioAssetRoutingMode = 'automatic' | 'owner';

export type StudioRegistryAssetKind =
  | 'texture'
  | 'divider'
  | 'icon'
  | 'image'
  | 'template'
  | 'elementPreset'
  | 'font';

export interface StudioAssetDestinationDefinition {
  id: StudioAssetDestination;
  group: 'Templates' | 'Images' | 'Elements' | 'Styles' | 'Typography';
  label: string;
  shortLabel: string;
  description: string;
  acceptedKinds: StudioRegistryAssetKind[];
}

export const STUDIO_ASSET_DESTINATION_DEFINITIONS: StudioAssetDestinationDefinition[] = [
  { id: 'template.front', group: 'Templates', label: 'Front Templates', shortLabel: 'Fronts', description: 'Complete editable front designs offered in Template Studio and the Generator.', acceptedKinds: ['template'] },
  { id: 'template.back', group: 'Templates', label: 'Back Templates', shortLabel: 'Backs', description: 'Complete editable back designs matched to a front by physical card size.', acceptedKinds: ['template'] },
  { id: 'image.picture', group: 'Images', label: 'Pictures', shortLabel: 'Pictures', description: 'Ordinary artwork offered inside picture elements and image fields.', acceptedKinds: ['image'] },
  { id: 'image.frame.front', group: 'Images', label: 'Front Frames', shortLabel: 'Front frames', description: 'Full-card visual artwork applied to the front surface of a Template.', acceptedKinds: ['image'] },
  { id: 'image.frame.back', group: 'Images', label: 'Back Frames', shortLabel: 'Back frames', description: 'Full-card visual artwork applied to the back surface of a Template.', acceptedKinds: ['image'] },
  { id: 'element.icon', group: 'Elements', label: 'Icons', shortLabel: 'Icons', description: 'Symbols, badges, corner ornaments, gems, and compact decorative marks.', acceptedKinds: ['icon'] },
  { id: 'element.divider', group: 'Elements', label: 'Dividers', shortLabel: 'Dividers', description: 'Separators, rules, title plates, and wide decorative panels.', acceptedKinds: ['divider'] },
  { id: 'appearance.texture', group: 'Styles', label: 'Textures', shortLabel: 'Textures', description: 'Repeatable or scalable surface treatments used by Fill & Effects.', acceptedKinds: ['texture'] },
  { id: 'style.material', group: 'Styles', label: 'Materials & Themes', shortLabel: 'Materials', description: 'Reusable fills, gradients, materials, themes, and complete card treatments.', acceptedKinds: ['elementPreset'] },
  { id: 'style.border', group: 'Styles', label: 'Borders', shortLabel: 'Borders', description: 'Reusable border and edge treatments.', acceptedKinds: ['elementPreset'] },
  { id: 'style.textFrame', group: 'Styles', label: 'Text Frames', shortLabel: 'Text frames', description: 'Reusable rules boxes, title treatments, and framed text surfaces.', acceptedKinds: ['elementPreset'] },
  { id: 'style.shape', group: 'Styles', label: 'Shape Styles', shortLabel: 'Shapes', description: 'Reusable visual treatments for panels, gems, badges, and shapes.', acceptedKinds: ['elementPreset'] },
  { id: 'style.divider', group: 'Styles', label: 'Divider Styles', shortLabel: 'Divider styles', description: 'Reusable appearance treatments for Divider Builder.', acceptedKinds: ['elementPreset'] },
  { id: 'style.icon', group: 'Styles', label: 'Icon Styles', shortLabel: 'Icon styles', description: 'Reusable appearance treatments for icon elements.', acceptedKinds: ['elementPreset'] },
  { id: 'typography.font', group: 'Typography', label: 'Fonts', shortLabel: 'Fonts', description: 'Published typefaces offered by the Typography inspector.', acceptedKinds: ['font'] },
];

const destinationById = new Map(
  STUDIO_ASSET_DESTINATION_DEFINITIONS.map((definition) => [definition.id, definition]),
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const readStyleKind = (metadata: unknown): string | null => {
  if (!isRecord(metadata)) return null;
  const style = isRecord(metadata.style)
    ? metadata.style
    : isRecord(metadata.elementPreset)
      ? metadata.elementPreset
      : isRecord(metadata.payload)
        ? metadata.payload
        : null;
  return style && typeof style.kind === 'string' ? style.kind : null;
};

const readTemplateUsage = (metadata: unknown): string | null => {
  if (!isRecord(metadata)) return null;
  const template = isRecord(metadata.template)
    ? metadata.template
    : isRecord(metadata.payload)
      ? metadata.payload
      : null;
  return template && typeof template.templateUsage === 'string' ? template.templateUsage : null;
};

const readConfiguredDefaultDestination = (
  kind: StudioRegistryAssetKind,
  metadata: unknown,
): StudioAssetDestination | null => {
  if (!isRecord(metadata) || !isStudioAssetDestination(metadata.studioDefaultDestination)) return null;
  const definition = destinationById.get(metadata.studioDefaultDestination);
  return definition?.acceptedKinds.includes(kind) ? metadata.studioDefaultDestination : null;
};

export const isStudioAssetDestination = (value: unknown): value is StudioAssetDestination => (
  typeof value === 'string'
  && (STUDIO_ASSET_DESTINATIONS as readonly string[]).includes(value)
);

export const getStudioAssetDestinationDefinition = (
  destination: StudioAssetDestination,
): StudioAssetDestinationDefinition => destinationById.get(destination)!;

export const getDefaultStudioAssetDestinations = ({
  kind,
  metadata,
}: {
  kind: StudioRegistryAssetKind;
  metadata?: unknown;
}): StudioAssetDestination[] => {
  const configuredDestination = readConfiguredDefaultDestination(kind, metadata);
  if (configuredDestination) return [configuredDestination];
  if (kind === 'template') {
    return [readTemplateUsage(metadata) === 'back-preset' ? 'template.back' : 'template.front'];
  }
  if (kind === 'image') return ['image.picture'];
  if (kind === 'texture') return ['appearance.texture'];
  if (kind === 'divider') return ['element.divider'];
  if (kind === 'icon') return ['element.icon'];
  if (kind === 'font') return ['typography.font'];

  const styleKind = readStyleKind(metadata);
  if (styleKind === 'border') return ['style.border'];
  if (styleKind === 'textFrame') return ['style.textFrame'];
  if (styleKind === 'shapeRole') return ['style.shape'];
  if (styleKind === 'divider') return ['style.divider'];
  if (styleKind === 'icon') return ['style.icon'];
  return ['style.material'];
};

export const getCompatibleStudioAssetDestinations = ({
  kind,
  metadata,
}: {
  kind: StudioRegistryAssetKind;
  metadata?: unknown;
}): StudioAssetDestination[] => {
  if (kind === 'template') return getDefaultStudioAssetDestinations({ kind, metadata });
  if (kind === 'image') return ['image.picture', 'image.frame.front', 'image.frame.back'];
  if (kind !== 'elementPreset') {
    return STUDIO_ASSET_DESTINATION_DEFINITIONS
      .filter((definition) => definition.acceptedKinds.includes(kind))
      .map((definition) => definition.id);
  }
  return getDefaultStudioAssetDestinations({ kind, metadata });
};

export const normalizeStudioAssetDestinations = (value: unknown): StudioAssetDestination[] => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isStudioAssetDestination))];
};
