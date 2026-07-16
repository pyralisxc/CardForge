/** Convert camelCase, snake_case, or kebab-case identifiers to title case. */
export const toTitleCase = (value: string): string => {
  if (!value) return '';
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};
