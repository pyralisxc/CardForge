const TEMPLATE_ACCENTS = ['#a16dde', '#398cce', '#ad7d27', '#35967e', '#bc638b', '#82923d'];

/** Stable across Sets; names and border styles carry identity alongside color. */
export function getTemplateAccent(templateId: string): string {
  let hash = 0;
  for (const character of templateId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return TEMPLATE_ACCENTS[hash % TEMPLATE_ACCENTS.length]!;
}
