import { z } from 'zod/v4';
export const ownerStudioDependencyInput = z.object({ documentId: z.string().uuid(), expectedRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).strict();
// Diagnostic paths can contain authored property names. Only stable reason codes cross this boundary.
const reasons = new Set(['invalid_project_document','unsupported_project_field','dynamic_binding','unsupported_css_color','encoded_or_dynamic_source','external_or_unbound_source','unsupported_raw_userTemplates','unsupported_raw_appearanceStyles','unsupported_raw_storedCards','unsupported_raw_cardSets','custom_asset_or_font_inventory','unsupported_operation_receipts','unsupported_export_settings','unsupported_raw_production_plan','unsupported_template_shape','unsupported_style_shape','unsupported_card_shape','unsupported_set_shape','mutable_catalog_template_resolution','unsupported_production_plan']);
export const sanitizeStudioDependencyReasons = (values: string[]): string[] => [...new Set(values.map(value => reasons.has(value) ? value : value.startsWith('template_shape:') ? 'unsupported_template_shape' : 'unrecognized_dependency_reason'))].sort();
export const ownerStudioDependencySnapshot = z.object({ documentId: z.string().uuid(), revision: z.number().int().positive(),
  contractVersion: z.number().int().positive().nullable(), complete: z.boolean().nullable(), opaqueReasons: z.array(z.string()),
  state: z.enum(['absent','stale','complete','incomplete']), }).strict();
export const ownerStudioDependencyAcknowledgement = z.object({ documentId: z.string().uuid(), revision: z.number().int().positive(), contractVersion: z.number().int().positive(), complete: z.boolean(), opaqueReasons: z.array(z.string()) }).strict();
export const ownerStudioDependencyResult = ownerStudioDependencyAcknowledgement.partial({ contractVersion: true, complete: true }).extend({
  contractVersion: z.number().int().positive().nullable(), complete: z.boolean().nullable(), snapshot: ownerStudioDependencySnapshot.nullable(),
  receipt: z.object({ outcome: z.enum(['committed','uncertain']), committed: z.boolean().nullable(), readbackComplete: z.boolean(), activityRecorded: z.boolean().nullable(), warnings: z.array(z.string()), retryable: z.literal(false), nextAction: z.enum(['read','none']) }).strict(),
}).strict();
