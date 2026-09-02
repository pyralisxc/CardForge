import type { DisplayCard } from '@/domain/rendering';
import { extractTemplateFieldDefinitions } from '@/domain/templates';

export interface ReflectiveFieldFacet {
  id: string;
  label: string;
  valueCount: number;
  populatedCount: number;
  groupable: boolean;
  sortable: boolean;
  semanticGrouping: 'content-type' | 'batch' | null;
}

export interface ReflectiveOrganization {
  fields: ReflectiveFieldFacet[];
  groupings: Array<'tag' | 'field' | 'template' | 'content-type' | 'batch'>;
}

const normalizedValue = (value: unknown): string => String(value ?? '').trim();
const semanticFieldNames = {
  contentType: ['contenttype', 'type', 'kind'],
  batch: ['batch', 'batchname'],
} as const;

const normalizeFieldIdentity = (value: string): string => value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
const semanticGroupingFor = (key: string): ReflectiveFieldFacet['semanticGrouping'] => {
  const normalized = normalizeFieldIdentity(key);
  if (semanticFieldNames.contentType.includes(normalized as never)) return 'content-type';
  if (semanticFieldNames.batch.includes(normalized as never)) return 'batch';
  return null;
};

export const getSemanticOrganizationField = (
  fields: readonly ReflectiveFieldFacet[],
  kind: keyof typeof semanticFieldNames,
): ReflectiveFieldFacet | null => fields.find((field) => (
  semanticFieldNames[kind].includes(normalizeFieldIdentity(field.id) as never)
)) ?? null;

export const deriveReflectiveOrganization = (cards: readonly DisplayCard[]): ReflectiveOrganization => {
  const definitionByKey = new Map(cards.flatMap((card) => extractTemplateFieldDefinitions(card.template)).map((field) => [field.key, field]));
  const allKeys = Array.from(new Set(cards.flatMap((card) => Object.keys(card.data))));
  const fields = allKeys.flatMap((key): ReflectiveFieldFacet[] => {
    const definition = definitionByKey.get(key);
    const values = cards.map((card) => normalizedValue(card.data[key])).filter(Boolean);
    const uniqueValues = new Set(values.map((value) => value.toLocaleLowerCase()));
    if (values.length < 2 || uniqueValues.size < 2) return [];
    const longValues = values.some((value) => value.length > 80);
    const highCardinality = uniqueValues.size > 24 || (values.length >= 12 && uniqueValues.size / values.length > 0.6);
    const groupable = !definition?.isImage
      && !definition?.isMultiline
      && definition?.contentModel !== 'structuredRows'
      && !longValues
      && !highCardinality;
    const sortable = !definition?.isImage && definition?.contentModel !== 'structuredRows' && !longValues;
    if (!groupable && !sortable) return [];
    return [{
      id: key,
      label: definition?.label?.trim() || key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
      valueCount: uniqueValues.size,
      populatedCount: values.length,
      groupable,
      sortable,
      semanticGrouping: semanticGroupingFor(key),
    }];
  }).toSorted((left, right) => left.label.localeCompare(right.label));

  const templateCount = new Set(cards.map((card) => card.template.id ?? card.template.name)).size;
  const hasTags = cards.some((card) => (card.tagIds?.length ?? 0) > 0);
  const contentType = getSemanticOrganizationField(fields, 'contentType');
  const batch = getSemanticOrganizationField(fields, 'batch');
  const groupings: ReflectiveOrganization['groupings'] = [
    ...(hasTags ? ['tag' as const] : []),
    ...(fields.some((field) => field.groupable && !field.semanticGrouping) ? ['field' as const] : []),
    ...(templateCount > 1 ? ['template' as const] : []),
    ...(contentType?.groupable ? ['content-type' as const] : []),
    ...(batch?.groupable ? ['batch' as const] : []),
  ];
  return { fields, groupings };
};
