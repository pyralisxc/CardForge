/** Literal CSS image generators only. No URL, escapes, indirection or other functions. */
export function isSourceContainedCssImage(value: string): boolean {
  const css = value.trim();
  if (css === 'none' || css === '') return true;
  if (!/^(?:repeating-)?(?:linear|radial)-gradient\(/i.test(css) || !/^[a-z0-9#.,()%+\-\s]+$/i.test(css)) return false;
  let depth = 0;
  for (let index = 0; index < css.length; index += 1) {
    if (css[index] === '(') {
      const name = css.slice(0, index).match(/([a-z-]+)\s*$/i)?.[1]?.toLowerCase();
      if (!name || !['linear-gradient', 'radial-gradient', 'repeating-linear-gradient', 'repeating-radial-gradient', 'rgb', 'rgba', 'hsl', 'hsla'].includes(name)) return false;
      depth += 1;
    } else if (css[index] === ')' && --depth < 0) return false;
  }
  return depth === 0 && css.endsWith(')');
}
